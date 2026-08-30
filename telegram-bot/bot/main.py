"""Pokretanje bota: logovanje, provere pri startu, dispatcher, polling."""

from __future__ import annotations

import asyncio
import logging
import sys
from logging.handlers import RotatingFileHandler

from aiogram import Bot, Dispatcher
from aiogram.client.default import DefaultBotProperties
from aiogram.enums import ParseMode
from aiogram.exceptions import TelegramAPIError
from aiogram.types import ErrorEvent, Message

from bot import config, db, texts
from bot.handlers import admin, invites, onboarding

log = logging.getLogger(__name__)

# Bez chat_member i chat_join_request Telegram te update-e NE salje, pa bot
# nikad ne bi saznao ko je usao u kanal ni ko trazi ulazak u grupu.
ALLOWED_UPDATES = [
    "message",
    "callback_query",
    "chat_member",
    "chat_join_request",
    "my_chat_member",
]


class RedactToken(logging.Filter):
    """Osigurava da token ne zavrsi u logu ni slucajno.

    Zahtev je bio izricit, a token se lako provuce kroz tekst izuzetka iz
    HTTP sloja — zato se ne oslanjamo na disciplinu nego filtriramo.
    """

    def __init__(self, token: str) -> None:
        super().__init__()
        self._token = token

    def filter(self, record: logging.LogRecord) -> bool:
        if self._token and isinstance(record.msg, str) and self._token in record.msg:
            record.msg = record.msg.replace(self._token, "<TOKEN>")
        if record.args:
            record.args = tuple(
                arg.replace(self._token, "<TOKEN>") if isinstance(arg, str) else arg
                for arg in record.args
            )
        return True


def setup_logging() -> None:
    fmt = logging.Formatter(
        "%(asctime)s %(levelname)-7s %(name)s: %(message)s", datefmt="%Y-%m-%d %H:%M:%S"
    )

    stream = logging.StreamHandler(sys.stdout)
    stream.setFormatter(fmt)

    # Rotacija: bot radi mesecima, log ne sme da pojede disk.
    file_handler = RotatingFileHandler(
        config.LOG_PATH, maxBytes=5 * 1024 * 1024, backupCount=3, encoding="utf-8"
    )
    file_handler.setFormatter(fmt)

    root = logging.getLogger()
    root.setLevel(logging.INFO)
    root.addHandler(stream)
    root.addHandler(file_handler)
    root.addFilter(RedactToken(config.BOT_TOKEN))
    for handler in root.handlers:
        handler.addFilter(RedactToken(config.BOT_TOKEN))


async def check_permissions(bot: Bot) -> None:
    """Proverava da je bot admin sa pravom pozivanja u svakom konfigurisanom cetu.

    Ne prekida pokretanje — bolje je da bot radi za kanale koji su ispravni
    nego da odbije da se digne zbog jednog pogresnog ID-a.
    """
    me = await bot.get_me()
    log.info("bot @%s (id=%s)", me.username, me.id)

    if not config.CONFIGURED_CHATS:
        log.warning("NIJEDAN kanal nije konfigurisan — korisnici nece dobiti nijedan link")
        return

    for key, (chat_id, _rule) in config.CONFIGURED_CHATS.items():
        try:
            member = await bot.get_chat_member(chat_id=chat_id, user_id=me.id)
        except TelegramAPIError as exc:
            log.error("KANAL %s (%s): bot ne moze da procita clanstvo — %s", key, chat_id, exc)
            log.error("  -> dodaj bota kao ADMINISTRATORA u taj kanal")
            continue

        if member.status != "administrator":
            log.error("KANAL %s (%s): bot NIJE administrator (status=%s)", key, chat_id, member.status)
            continue

        if not getattr(member, "can_invite_users", False):
            log.error("KANAL %s (%s): bot je admin ali NEMA pravo 'Pozivanje korisnika'", key, chat_id)
            continue

        log.info("kanal %s (%s): u redu", key, chat_id)

    if config.ADMIN_GROUP_ID is None:
        log.warning("ADMIN_GROUP_ID nije postavljen — zahtevi za ulazak u grupe se nece prijavljivati")


def build_dispatcher() -> Dispatcher:
    dp = Dispatcher()
    # Admin prvi: njegove komande ne smeju da padnu u opsti fallback.
    dp.include_router(admin.router)
    dp.include_router(invites.router)
    dp.include_router(onboarding.router)

    @dp.error()
    async def on_error(event: ErrorEvent) -> None:
        """Nijedan izuzetak ne sme da obori bota."""
        log.exception("neuhvacena greska u handleru: %s", event.exception)

        # Pokusaj da korisniku kazes neutralnu poruku; ako i to padne, cuti.
        message: Message | None = None
        if event.update.message is not None:
            message = event.update.message
        elif event.update.callback_query is not None and isinstance(
            event.update.callback_query.message, Message
        ):
            message = event.update.callback_query.message
        if message is not None:
            try:
                await message.answer(texts.TEXTS["generic_error"])
            except Exception:  # noqa: BLE001
                pass

    return dp


async def main() -> None:
    setup_logging()
    log.info("pokretanje…")

    await db.connect(config.DB_PATH)

    bot = Bot(
        token=config.BOT_TOKEN,
        default=DefaultBotProperties(parse_mode=ParseMode.HTML),
    )
    dp = build_dispatcher()

    try:
        await check_permissions(bot)
        await admin.warn_unfinished_broadcast(bot)

        # drop_pending_updates: posle pada ne obradjuj gomilu zaostalih tapova.
        log.info("polling krece (allowed_updates=%s)", ",".join(ALLOWED_UPDATES))
        await dp.start_polling(bot, allowed_updates=ALLOWED_UPDATES, drop_pending_updates=True)
    finally:
        await db.close()
        await bot.session.close()
        log.info("ugasen")


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except (KeyboardInterrupt, SystemExit):
        pass
