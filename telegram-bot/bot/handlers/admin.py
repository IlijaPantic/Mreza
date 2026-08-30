"""Admin komande: /stats, /stats7, /export, /broadcast, /broadcast_resume.

Nekome ko nije u ADMIN_IDS bot na ove komande ne odgovara NISTA — ne treba da
sazna ni da komanda postoji.
"""

from __future__ import annotations

import asyncio
import csv
import io
import logging
from datetime import datetime, timezone

from aiogram import Bot, F, Router
from aiogram.exceptions import TelegramForbiddenError, TelegramRetryAfter
from aiogram.filters import BaseFilter, Command, CommandObject
from aiogram.types import BufferedInputFile, CallbackQuery, Message

from bot import config, db, keyboards as kb, texts

log = logging.getLogger(__name__)
router = Router(name="admin")

# ~25 poruka/s. Telegramov limit za DM-ove je oko 30/s; ostavljamo rezervu jer
# bot u isto vreme odgovara i obicnim korisnicima.
BROADCAST_DELAY = 0.04
BROADCAST_BATCH = 500

_broadcast_task: asyncio.Task | None = None


class IsAdmin(BaseFilter):
    async def __call__(self, event: Message | CallbackQuery) -> bool:
        user = event.from_user
        return user is not None and config.is_admin(user.id)


router.message.filter(IsAdmin())


def _fmt_pairs(pairs: list[tuple[str, int]], labels: dict[str, str] | None = None) -> str:
    if not pairs:
        return texts.TEXTS["admin_stats_empty"]
    lines = []
    for key, count in pairs:
        name = labels.get(key, key) if labels else key
        lines.append(f"  {texts.escape(name)}: <b>{count}</b>")
    return "\n".join(lines)


async def _stats_message(since: str | None, title: str) -> str:
    data = await db.stats(since)
    return "\n".join(
        [
            title,
            "",
            texts.TEXTS["admin_stats_users"].format(total=data["total"]),
            "",
            texts.TEXTS["admin_stats_by_status"],
            _fmt_pairs(data["by_status"]),  # type: ignore[arg-type]
            "",
            texts.TEXTS["admin_stats_by_role"],
            _fmt_pairs(data["by_role"], texts.ROLE_LABELS),  # type: ignore[arg-type]
            "",
            texts.TEXTS["admin_stats_by_network"],
            _fmt_pairs(data["by_network"], texts.NETWORK_LABELS),  # type: ignore[arg-type]
            "",
            texts.TEXTS["admin_stats_by_source"],
            _fmt_pairs(data["by_source"]),  # type: ignore[arg-type]
            "",
            texts.TEXTS["admin_stats_by_chat"],
            _fmt_pairs(data["by_chat"], texts.CHAT_TITLES),  # type: ignore[arg-type]
        ]
    )


@router.message(Command("stats"))
async def cmd_stats(message: Message) -> None:
    await message.answer(await _stats_message(None, texts.TEXTS["admin_stats_title"]))


@router.message(Command("stats7"))
async def cmd_stats7(message: Message) -> None:
    since = db.days_ago_iso(7)
    await message.answer(await _stats_message(since, texts.TEXTS["admin_stats7_title"]))


@router.message(Command("export"))
async def cmd_export(message: Message) -> None:
    rows = await db.export_rows()

    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(
        [
            "telegram_id",
            "username",
            "ime",
            "izvor",
            "status",
            "prijavljen",
            "uloge",
            "mreže",
            "kanali",
        ]
    )
    for row in rows:
        writer.writerow(
            [
                row["telegram_id"],
                row["username"] or "",
                row["first_name"] or "",
                row["source"] or "",
                row["status"] or "",
                row["created_at"] or "",
                row["roles"] or "",
                row["networks"] or "",
                row["chats"] or "",
            ]
        )

    # BOM: bez njega Excel na Windowsu razbija nasa slova. Isto kao izvoz na sajtu.
    data = ("﻿" + buf.getvalue()).encode("utf-8")
    filename = f"mreza-bot-{datetime.now(timezone.utc):%Y-%m-%d}.csv"
    await message.answer_document(
        BufferedInputFile(data, filename=filename),
        caption=texts.TEXTS["admin_export_caption"].format(count=len(rows)),
    )


# ------------------------------------------------------------- broadcast


@router.message(Command("broadcast"))
async def cmd_broadcast(message: Message, command: CommandObject) -> None:
    body = (command.args or "").strip()
    if not body:
        await message.answer(texts.TEXTS["admin_broadcast_usage"])
        return

    count = await db.completed_count()
    broadcast_id = await db.create_broadcast(body, message.from_user.id)
    minutes = max(1, round(count * BROADCAST_DELAY / 60))

    await message.answer(
        texts.TEXTS["admin_broadcast_confirm"].format(
            preview=texts.escape(body),
            count=count,
            minutes=minutes,
        ),
        reply_markup=kb.broadcast_keyboard(broadcast_id),
    )


@router.callback_query(IsAdmin(), F.data.startswith(f"{kb.CB_BROADCAST}:"))
async def on_broadcast_decision(callback: CallbackQuery) -> None:
    parts = (callback.data or "").split(":")
    if len(parts) != 3:
        await callback.answer()
        return
    _, decision, raw_id = parts

    if decision != "go":
        await callback.answer(texts.TEXTS["admin_broadcast_cancelled"], show_alert=False)
        if isinstance(callback.message, Message):
            await callback.message.edit_reply_markup(reply_markup=None)
        return

    broadcast_id = int(raw_id)
    await callback.answer(texts.TEXTS["admin_broadcast_started"], show_alert=False)
    if isinstance(callback.message, Message):
        await callback.message.edit_reply_markup(reply_markup=None)

    _start_broadcast(callback.bot, broadcast_id, callback.from_user.id)


@router.message(Command("broadcast_resume"))
async def cmd_broadcast_resume(message: Message) -> None:
    row = await db.unfinished_broadcast()
    if row is None:
        await message.answer(texts.TEXTS["admin_broadcast_nothing_to_resume"])
        return
    await message.answer(texts.TEXTS["admin_broadcast_resumed"].format(id=row["id"]))
    _start_broadcast(message.bot, int(row["id"]), message.from_user.id)


def _start_broadcast(bot: Bot, broadcast_id: int, notify_admin_id: int) -> None:
    """Pokrece slanje kao pozadinski task.

    Mora u pozadini: 20.000 poruka na 25/s traje ~13 minuta, a za to vreme bot
    nastavlja da odgovara ostalima.
    """
    global _broadcast_task
    if _broadcast_task is not None and not _broadcast_task.done():
        log.warning("slanje je vec u toku, ignorisem novi zahtev")
        return
    _broadcast_task = asyncio.create_task(_run_broadcast(bot, broadcast_id, notify_admin_id))


async def _run_broadcast(bot: Bot, broadcast_id: int, notify_admin_id: int) -> None:
    row = await db.get_broadcast(broadcast_id)
    if row is None:
        return

    body = row["body"]
    cursor = int(row["cursor_id"])
    sent, blocked, failed = int(row["sent"]), int(row["blocked"]), int(row["failed"])
    await db.mark_broadcast_started(broadcast_id)

    log.info("slanje #%s pocinje od kursora %s", broadcast_id, cursor)

    while True:
        batch = await db.broadcast_batch(cursor, BROADCAST_BATCH)
        if not batch:
            break

        for record in batch:
            user_id = int(record["telegram_id"])
            try:
                await bot.send_message(user_id, body)
                sent += 1
            except TelegramForbiddenError:
                # Korisnik je blokirao bota — vise mu ne saljemo nista.
                await db.mark_blocked(user_id)
                blocked += 1
            except TelegramRetryAfter as exc:
                wait = int(exc.retry_after) + 1
                log.warning("slanje: rate limit, cekam %ss", wait)
                await asyncio.sleep(wait)
                try:
                    await bot.send_message(user_id, body)
                    sent += 1
                except Exception:  # noqa: BLE001 — jedan primalac ne sme da obori slanje
                    failed += 1
            except Exception as exc:  # noqa: BLE001
                log.warning("slanje korisniku %s nije uspelo: %s", user_id, exc)
                failed += 1

            cursor = user_id
            await asyncio.sleep(BROADCAST_DELAY)

        # Napredak se cuva posle svake grupe: restart nastavlja odavde,
        # umesto da posalje sve ispocetka.
        await db.update_broadcast_progress(broadcast_id, cursor, sent, blocked, failed)

    await db.update_broadcast_progress(broadcast_id, cursor, sent, blocked, failed)
    await db.mark_broadcast_finished(broadcast_id)
    log.info("slanje #%s zavrseno: %s poslato, %s blokirano, %s gresaka", broadcast_id, sent, blocked, failed)

    try:
        await bot.send_message(
            notify_admin_id,
            texts.TEXTS["admin_broadcast_done"].format(sent=sent, blocked=blocked, failed=failed),
        )
    except TelegramForbiddenError:
        pass


async def warn_unfinished_broadcast(bot: Bot) -> None:
    """Pri startu javi adminima ako je neko slanje ostalo na pola.

    Namerno se NE nastavlja samo od sebe — restart je cesto zbog ispravke, a
    automatsko nastavljanje slanja bi tada bilo pogresno.
    """
    row = await db.unfinished_broadcast()
    if row is None:
        return
    total = await db.completed_count()
    message = texts.TEXTS["admin_broadcast_unfinished"].format(
        id=row["id"], sent=row["sent"], total=total
    )
    log.warning(message)
    for admin_id in config.ADMIN_IDS:
        try:
            await bot.send_message(admin_id, message)
        except Exception:  # noqa: BLE001 — admin mozda nije pokrenuo bota
            pass
