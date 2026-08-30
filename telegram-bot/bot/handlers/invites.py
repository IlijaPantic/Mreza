"""Izdavanje pozivnica, zahtevi za ulazak, i pracenje ko je stvarno usao.

Telegram Bot API ne daje spisak clanova kanala. Jedini nacin da se zna ko je
gde jeste da se svakom coveku izda JEDINSTVEN link i da se slusa chat_member
update koji nosi tacno taj link nazad. Otud tabela invites.
"""

from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timedelta, timezone

from aiogram import Bot, F, Router
from aiogram.exceptions import TelegramAPIError, TelegramBadRequest, TelegramRetryAfter
from aiogram.filters import ChatMemberUpdatedFilter, Command, JOIN_TRANSITION, LEAVE_TRANSITION
from aiogram.types import CallbackQuery, ChatJoinRequest, ChatMemberUpdated, Message

from bot import config, db, keyboards as kb, texts

log = logging.getLogger(__name__)
router = Router(name="invites")

# Koliko puta pokusavamo poziv koji je Telegram odbio sa "uspori".
RETRY_ATTEMPTS = 3
# Gornja granica cekanja; duze od ovoga korisnik ionako nece cekati odgovor.
MAX_RETRY_SLEEP = 30


async def _call_with_retry(factory, what: str):
    """Poziva Telegram i postuje RetryAfter.

    Bez ovoga bi pri navali (npr. odmah posle broadcast-a) deo linkova tiho
    propao, jer Telegram vraca 429 umesto da odgovori.
    """
    for attempt in range(1, RETRY_ATTEMPTS + 1):
        try:
            return await factory()
        except TelegramRetryAfter as exc:
            wait = min(int(exc.retry_after) + 1, MAX_RETRY_SLEEP)
            log.warning(
                "rate limit na %s, cekam %ss (pokusaj %d/%d)", what, wait, attempt, RETRY_ATTEMPTS
            )
            await asyncio.sleep(wait)
    log.error("odustajem od %s posle %d pokusaja", what, RETRY_ATTEMPTS)
    return None


async def _create_invite(bot: Bot, chat_key: str, user_id: int) -> str | None:
    """Pravi pozivnicu za jedan cet. Vraca link ili None ako nije uspelo."""
    chat_id = config.chat_id_of(chat_key)
    rule = config.rule_of(chat_key)
    if chat_id is None or rule is None:
        return None

    name = f"u{user_id}"

    async def factory():
        if rule.join_request:
            # member_limit i creates_join_request se ne mogu kombinovati —
            # Telegram odbija takav poziv.
            return await bot.create_chat_invite_link(
                chat_id=chat_id,
                creates_join_request=True,
                name=name,
            )
        return await bot.create_chat_invite_link(
            chat_id=chat_id,
            member_limit=1,
            expire_date=datetime.now(timezone.utc)
            + timedelta(hours=config.INVITE_TTL_HOURS),
            name=name,
        )

    try:
        link = await _call_with_retry(factory, f"create_chat_invite_link({chat_key})")
    except TelegramAPIError as exc:
        # Jedan pokvaren kanal ne sme da obori celo izdavanje.
        log.error("kanal %s: pozivnica nije napravljena: %s", chat_key, exc)
        return None

    if link is None:
        return None
    await db.record_invite(user_id, chat_key, link.invite_link)
    return link.invite_link


async def _revoke_stale(bot: Bot, user_id: int, chat_keys: set[str]) -> None:
    """Ponistava ranije neiskoriscene pozivnice za date cetove.

    Bez ovoga bi svaka regeneracija ostavljala stari link da visi do isteka,
    pa bi jedan covek imao vise vazecih ulaznica u isti kanal.
    """
    for row in await db.unused_invites(user_id):
        if row["chat_key"] not in chat_keys:
            continue
        chat_id = config.chat_id_of(row["chat_key"])
        if chat_id is None:
            continue
        try:
            await bot.revoke_chat_invite_link(
                chat_id=chat_id, invite_link=row["invite_link"]
            )
        except TelegramAPIError as exc:
            # Vec istekao ili ponisten link nije problem — samo nastavi.
            log.debug("ponistavanje linka nije uspelo (%s): %s", row["chat_key"], exc)


async def send_links(bot: Bot, chat_id: int, user_id: int) -> None:
    """Izracuna cetove, izda linkove i posalje ih korisniku u jednoj poruci."""
    roles = await db.get_roles(user_id)
    networks = await db.get_networks(user_id)

    wanted = config.chat_keys_for(roles, networks)
    if not wanted:
        await bot.send_message(chat_id, texts.TEXTS["links_none"])
        log.warning("korisnik %s nema nijedan cet (uloge=%s, mreze=%s)", user_id, roles, networks)
        return

    # Ko je vec unutra ne dobija nov link — nema svrhe, a i zbunjuje.
    already = await db.joined_chat_keys(user_id)
    pending = [key for key in wanted if key not in already]
    if not pending:
        await bot.send_message(chat_id, texts.TEXTS["links_all_joined"])
        return

    await _revoke_stale(bot, user_id, set(pending))

    links: list[tuple[str, str]] = []
    failed: list[str] = []
    has_join_request = False

    for key in pending:
        url = await _create_invite(bot, key, user_id)
        if url is None:
            failed.append(key)
            continue
        rule = config.rule_of(key)
        if rule is not None and rule.join_request:
            has_join_request = True
        links.append((texts.CHAT_TITLES.get(key, key), url))

    if not links:
        log.error("nijedan link nije izdat korisniku %s (pali: %s)", user_id, failed)
        await bot.send_message(chat_id, texts.TEXTS["generic_error"])
        return

    body = texts.TEXTS["links_intro"].format(ttl=config.INVITE_TTL_HOURS)
    if has_join_request:
        body += texts.TEXTS["links_join_request_note"]
    if failed:
        body += texts.TEXTS["links_partial_failure"]
        log.warning("korisniku %s nisu izdati linkovi za: %s", user_id, failed)

    await bot.send_message(chat_id, body, reply_markup=kb.links_keyboard(links))


# ------------------------------------------------------- ponovno izdavanje


@router.callback_query(F.data == f"{kb.CB_STEP}:{kb.STEP_RELINK}")
async def relink_callback(callback: CallbackQuery) -> None:
    await callback.answer()
    if isinstance(callback.message, Message):
        await send_links(callback.bot, callback.message.chat.id, callback.from_user.id)


@router.message(Command("linkovi"))
async def cmd_linkovi(message: Message) -> None:
    """Poruka sa linkovima odskroluje za par dana — ovo je rezervni put do njih."""
    user = message.from_user
    if user is None:
        return
    row = await db.get_user(user.id)
    if row is None or row["status"] != "completed":
        # Ko nije zavrsio upitnik nema sta da dobije; vrati ga na pocetak.
        await message.answer(texts.TEXTS["use_buttons"], reply_markup=kb.start_keyboard())
        return
    await send_links(message.bot, message.chat.id, user.id)


# ------------------------------------------------------- zahtevi za ulazak


@router.chat_join_request()
async def on_join_request(event: ChatJoinRequest) -> None:
    """Zahtev za ulazak u grupu -> obavestenje u admin grupu sa dugmadima."""
    chat_key = config.chat_key_of(event.chat.id)
    if chat_key is None:
        log.info("zahtev za nepoznat cet %s, ignorisem", event.chat.id)
        return

    if config.ADMIN_GROUP_ID is None:
        log.warning("ADMIN_GROUP_ID nije postavljen — zahtev za %s se ne moze odobriti", chat_key)
        return

    user = event.from_user
    roles = await db.get_roles(user.id)
    networks = await db.get_networks(user.id)
    row = await db.get_user(user.id)

    body = texts.TEXTS["join_request_admin"].format(
        chat_title=texts.escape(texts.CHAT_TITLES.get(chat_key, chat_key)),
        full_name=texts.escape(user.full_name),
        username=texts.escape(f"@{user.username}") if user.username else "",
        user_id=user.id,
        roles=texts.escape(", ".join(texts.ROLE_LABELS.get(r, r) for r in sorted(roles)) or "—"),
        networks=texts.escape(
            ", ".join(texts.NETWORK_LABELS.get(n, n) for n in sorted(networks)) or "—"
        ),
        source=texts.escape(row["source"] if row else "—"),
    )

    await event.bot.send_message(
        config.ADMIN_GROUP_ID,
        body,
        reply_markup=kb.join_request_keyboard(user.id, chat_key),
    )


@router.callback_query(F.data.startswith(f"{kb.CB_JOIN_REQUEST}:"))
async def on_join_decision(callback: CallbackQuery) -> None:
    """Odobri/Odbij iz admin grupe."""
    if not config.is_admin(callback.from_user.id):
        await callback.answer()
        return

    parts = (callback.data or "").split(":")
    if len(parts) != 4:
        await callback.answer()
        return
    _, decision, raw_user_id, chat_key = parts

    chat_id = config.chat_id_of(chat_key)
    if chat_id is None:
        await callback.answer()
        return

    try:
        user_id = int(raw_user_id)
    except ValueError:
        await callback.answer()
        return

    try:
        if decision == "ok":
            await callback.bot.approve_chat_join_request(chat_id=chat_id, user_id=user_id)
            verdict = texts.TEXTS["join_request_approved"]
        else:
            await callback.bot.decline_chat_join_request(chat_id=chat_id, user_id=user_id)
            verdict = texts.TEXTS["join_request_declined"]
    except TelegramBadRequest as exc:
        # Najcesce: korisnik je povukao zahtev ili je drugi admin vec odlucio.
        log.info("odluka o zahtevu nije primenjena: %s", exc.message)
        await callback.answer(texts.TEXTS["join_request_gone"], show_alert=True)
        return

    await callback.answer()
    if isinstance(callback.message, Message):
        suffix = verdict.format(admin=texts.escape(callback.from_user.full_name))
        try:
            await callback.message.edit_text(
                f"{callback.message.html_text}\n\n{suffix}", reply_markup=None
            )
        except TelegramBadRequest:
            await callback.message.answer(suffix)


# ------------------------------------------------------- ko je stvarno usao


@router.chat_member(ChatMemberUpdatedFilter(member_status_changed=JOIN_TRANSITION))
async def on_member_joined(event: ChatMemberUpdated) -> None:
    """Jedini pouzdan signal da je korisnik zaista usao u kanal."""
    chat_key = config.chat_key_of(event.chat.id)
    if chat_key is None:
        return

    user_id = event.new_chat_member.user.id

    # Telegram vraca tacan link kojim je usao — tako se zatvara krug
    # sa tabelom invites.
    if event.invite_link is not None:
        await db.mark_invite_used(event.invite_link.invite_link)

    await db.record_membership(user_id, chat_key)
    log.info("korisnik %s usao u %s", user_id, chat_key)


@router.chat_member(ChatMemberUpdatedFilter(member_status_changed=LEAVE_TRANSITION))
async def on_member_left(event: ChatMemberUpdated) -> None:
    """Bez ovoga bi statistika brojala i one koji su odavno izasli."""
    chat_key = config.chat_key_of(event.chat.id)
    if chat_key is None:
        return
    user_id = event.old_chat_member.user.id
    await db.drop_membership(user_id, chat_key)
    log.info("korisnik %s napustio %s", user_id, chat_key)
