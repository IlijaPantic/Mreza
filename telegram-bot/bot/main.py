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
    # Windows konzola podrazumevano nije UTF-8, pa bi nasa slova u logovima
    # izasla kao smece bas tokom lokalnog testiranja. Na Linuxu je no-op.
    for stream in (sys.stdout, sys.stderr):
        reconfigure = getattr(stream, "reconfigure", None)
        if reconfigure is not None:
            try:
                reconfigure(encoding="utf-8")
            except (ValueError, OSError):
                pass

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


async def check_permissions(bot: Bot) -> list[str]:
    """Proverava da je bot admin sa pravom pozivanja u svakom konfigurisanom cetu.

    Vraca listu problema. Pri normalnom pokretanju se samo loguju — bolje je da
    bot radi za kanale koji su ispravni nego da odbije da se digne zbog jednog
    pogresnog ID-a. U --check rezimu ista lista odredjuje izlazni kod.
    """
    problems: list[str] = []

    me = await bot.get_me()
    log.info("bot @%s (id=%s)", me.username, me.id)

    if not config.CONFIGURED_CHATS:
        problems.append("NIJEDAN kanal nije konfigurisan — korisnici nece dobiti nijedan link")
        log.warning(problems[-1])
        return problems

    for key, (chat_id, _rule) in config.CONFIGURED_CHATS.items():
        try:
            member = await bot.get_chat_member(chat_id=chat_id, user_id=me.id)
        except TelegramAPIError as exc:
            problems.append(
                f"{key} ({chat_id}): bot ne vidi cet — dodaj ga kao ADMINISTRATORA. Detalj: {exc}"
            )
            log.error(problems[-1])
            continue

        if member.status != "administrator":
            problems.append(f"{key} ({chat_id}): bot NIJE administrator (status={member.status})")
            log.error(problems[-1])
            continue

        if not getattr(member, "can_invite_users", False):
            problems.append(
                f"{key} ({chat_id}): bot je admin ali NEMA pravo 'Pozivanje korisnika'"
            )
            log.error(problems[-1])
            continue

        log.info("kanal %s (%s): u redu", key, chat_id)

    if config.ADMIN_GROUP_ID is None:
        log.warning("ADMIN_GROUP_ID nije postavljen — zahtevi za ulazak u grupe se nece prijavljivati")

    return problems


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


async def run_check() -> int:
    """`--check`: pregleda podesavanja i izadje, bez pokretanja pollinga.

    Postoji da bi se pre deploya (i pre `systemctl enable`) videlo da li je
    sve na mestu, umesto da se to sazna tek kad prvi covek posalje /start.
    Izlazni kod je 0 samo ako nema nijednog problema — tako se moze staviti
    u skriptu.
    """
    print("Provera podesavanja\n" + "=" * 40)
    print(f"Baza:            {config.DB_PATH}")
    print(f"Admina:          {len(config.ADMIN_IDS)}")
    print(f"Admin grupa:     {config.ADMIN_GROUP_ID or 'NIJE POSTAVLJENA'}")
    print(f"Politika priv.:  {config.PRIVACY_URL or 'nije postavljena'}")
    print(f"Trajanje linka:  {config.INVITE_TTL_HOURS}h")

    configured = list(config.CONFIGURED_CHATS)
    skipped = [r.key for r in config.CHAT_RULES if r.key not in config.CONFIGURED_CHATS]
    print(f"\nCetova podeseno: {len(configured)} ({', '.join(configured) or '—'})")
    if skipped:
        print(f"Preskace se:     {', '.join(skipped)}  (nepopunjeno u .env)")

    bot = Bot(token=config.BOT_TOKEN, default=DefaultBotProperties(parse_mode=ParseMode.HTML))
    try:
        print("\nPrava bota po cetovima\n" + "-" * 40)
        problems = await check_permissions(bot)
    except TelegramAPIError as exc:
        print(f"\nNE MOGU DA SE POVEZEM NA TELEGRAM: {exc}")
        print("Najverovatnije je BOT_TOKEN pogresan ili nije popunjen.")
        return 1
    finally:
        await bot.session.close()

    print("\n" + "=" * 40)
    if problems:
        print(f"PROBLEMA: {len(problems)}\n")
        for item in problems:
            print(f"  • {item}")
        print("\nUputstvo: README.md, korak 2 (dodavanje bota kao administratora).")
        return 1

    print("Sve je u redu. Bot moze da se pokrene.")
    print("\nSto ova provera NE moze da vidi — proveri rucno:")
    print("  1. posalji /start botu i prodji ceo upitnik")
    print("  2. klikni na izdati link i udji u kanal")
    print("  3. posalji /stats — mora te prikazati pod 'Uslo u kanale'")
    print("     (ako je prazno, bot ne dobija chat_member update-e)")
    return 0


async def main() -> int:
    setup_logging()

    check_only = "--check" in sys.argv
    log.info("pokretanje%s…", " (samo provera)" if check_only else "")

    await db.connect(config.DB_PATH)
    try:
        if check_only:
            return await run_check()

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
            await dp.start_polling(
                bot, allowed_updates=ALLOWED_UPDATES, drop_pending_updates=True
            )
        finally:
            await bot.session.close()
        return 0
    finally:
        await db.close()
        log.info("ugasen")


if __name__ == "__main__":
    # SystemExit se NE hvata ovde — inace bi `except` progutao izlazni kod
    # i --check bi uvek vracao 0, pa provera ne bi mogla u skriptu.
    try:
        exit_code = asyncio.run(main())
    except KeyboardInterrupt:
        exit_code = 0
    sys.exit(exit_code)
