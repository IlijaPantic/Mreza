"""/start i ceo upitnik.

Stanje NIJE u memoriji nego u bazi (users.status + user_roles + user_networks).
Zato korisnik koji ode na pola i vrati se za dva dana nastavlja tacno odakle
je stao, i zato restart bota ne gubi nicije izbore.
"""

from __future__ import annotations

import logging
import re

from aiogram import F, Router
from aiogram.exceptions import TelegramBadRequest
from aiogram.filters import CommandObject, CommandStart
from aiogram.types import CallbackQuery, Message

from bot import config, db, keyboards as kb, texts
from bot.handlers.invites import send_links

log = logging.getLogger(__name__)
router = Router(name="onboarding")

# Telegram dozvoljava do 64 karaktera i skup A-Za-z0-9_- u start payload-u.
# Sve van toga tretiramo kao da payload-a nema, umesto da upisemo smece.
SOURCE_RE = re.compile(r"^[A-Za-z0-9_-]{1,64}$")
DEFAULT_SOURCE = "direct"

STATUS_STARTED = "started"
STATUS_ROLES = "roles"
STATUS_NETWORKS = "networks"
STATUS_COMPLETED = "completed"


def parse_source(payload: str | None) -> str:
    if not payload:
        return DEFAULT_SOURCE
    payload = payload.strip()
    if not SOURCE_RE.match(payload):
        log.info("odbacen nevalidan start payload (%d karaktera)", len(payload))
        return DEFAULT_SOURCE
    return payload


async def _edit_or_send(message: Message, text: str, markup) -> None:
    """Menja poruku u mestu; ako Telegram to odbije, salje novu.

    Edit puca kad je poruka prestara ili je vec identicna — ni jedno ni drugo
    ne sme da zaustavi korisnika.
    """
    try:
        await message.edit_text(text, reply_markup=markup)
    except TelegramBadRequest as exc:
        log.debug("edit_text nije uspeo (%s), saljem novu poruku", exc.message)
        await message.answer(text, reply_markup=markup)


def roles_text() -> str:
    lines = [texts.TEXTS["roles_title"], texts.TEXTS["roles_subtitle"], ""]
    for key in config.ROLE_KEYS:
        lines.append(f"<b>{texts.ROLE_LABELS[key]}</b>")
        lines.append(f"<i>{texts.ROLE_DESCRIPTIONS[key]}</i>")
        lines.append("")
    return "\n".join(lines).strip()


def networks_text() -> str:
    return f"{texts.TEXTS['networks_title']}\n{texts.TEXTS['networks_subtitle']}"


def summary_text(roles: set[str], networks: set[str]) -> str:
    role_lines = [texts.role_line(k) for k in config.ROLE_KEYS if k in roles]
    net_names = [texts.network_line(k) for k in config.NETWORK_KEYS if k in networks]
    return "\n".join(
        [
            texts.TEXTS["summary_title"],
            "",
            texts.TEXTS["summary_roles"],
            *role_lines,
            "",
            texts.TEXTS["summary_networks"],
            ", ".join(net_names) if net_names else texts.TEXTS["summary_networks_none"],
            "",
            texts.TEXTS["summary_question"],
        ]
    )


def welcome_text() -> str:
    consent = (
        texts.TEXTS["consent_with_link"] if config.PRIVACY_URL else texts.TEXTS["consent"]
    )
    return f"{texts.TEXTS['welcome']}\n\n{consent}"


# ------------------------------------------------------------------ /start


@router.message(CommandStart(deep_link=True))
@router.message(CommandStart())
async def cmd_start(message: Message, command: CommandObject) -> None:
    user = message.from_user
    if user is None:
        return

    source = parse_source(command.args)
    await db.upsert_user(user.id, user.username, user.first_name, source)

    row = await db.get_user(user.id)
    status = row["status"] if row else STATUS_STARTED

    if status == STATUS_COMPLETED:
        await message.answer(texts.TEXTS["returning"], reply_markup=kb.returning_keyboard())
        return

    # Nastavi odakle je stao: ko je vec presao na mreze ne mora ponovo kroz uvod.
    if status == STATUS_NETWORKS:
        selected = await db.get_networks(user.id)
        await message.answer(networks_text(), reply_markup=kb.networks_keyboard(selected))
        return

    await message.answer(welcome_text(), reply_markup=kb.start_keyboard())


# ------------------------------------------------------------ koraci


@router.callback_query(F.data == f"{kb.CB_STEP}:{kb.STEP_ROLES}")
async def step_roles(callback: CallbackQuery) -> None:
    user = callback.from_user
    await db.set_status(user.id, STATUS_ROLES)
    selected = await db.get_roles(user.id)
    if isinstance(callback.message, Message):
        await _edit_or_send(callback.message, roles_text(), kb.roles_keyboard(selected))
    await callback.answer()


@router.callback_query(F.data.startswith(f"{kb.CB_ROLE}:"))
async def toggle_role(callback: CallbackQuery) -> None:
    key = (callback.data or "").split(":", 1)[1]
    if key not in config.ROLE_KEYS:
        await callback.answer()
        return

    await db.toggle_role(callback.from_user.id, key)
    selected = await db.get_roles(callback.from_user.id)
    if isinstance(callback.message, Message):
        try:
            # Samo tastatura se menja — tekst pitanja ostaje isti, pa nema
            # potrebe slati novu poruku niti prepisivati ceo tekst.
            await callback.message.edit_reply_markup(reply_markup=kb.roles_keyboard(selected))
        except TelegramBadRequest:
            pass
    await callback.answer()


@router.callback_query(F.data == f"{kb.CB_STEP}:{kb.STEP_NETWORKS}")
async def step_networks(callback: CallbackQuery) -> None:
    user = callback.from_user
    roles = await db.get_roles(user.id)
    if not roles:
        # Upozorenje ide kao toast, ne kao nova poruka.
        await callback.answer(texts.TEXTS["roles_none_selected"], show_alert=False)
        return

    await db.set_status(user.id, STATUS_NETWORKS)
    selected = await db.get_networks(user.id)
    if isinstance(callback.message, Message):
        await _edit_or_send(callback.message, networks_text(), kb.networks_keyboard(selected))
    await callback.answer()


@router.callback_query(F.data.startswith(f"{kb.CB_NET}:"))
async def toggle_network(callback: CallbackQuery) -> None:
    key = (callback.data or "").split(":", 1)[1]
    if key not in config.NETWORK_KEYS:
        await callback.answer()
        return

    await db.toggle_network(callback.from_user.id, key)
    selected = await db.get_networks(callback.from_user.id)
    if isinstance(callback.message, Message):
        try:
            await callback.message.edit_reply_markup(reply_markup=kb.networks_keyboard(selected))
        except TelegramBadRequest:
            pass
    await callback.answer()


@router.callback_query(F.data == f"{kb.CB_STEP}:{kb.STEP_CONFIRM}")
async def step_confirm(callback: CallbackQuery) -> None:
    user = callback.from_user
    roles = await db.get_roles(user.id)
    if not roles:
        await callback.answer(texts.TEXTS["roles_none_selected"], show_alert=False)
        return

    networks = await db.get_networks(user.id)
    if isinstance(callback.message, Message):
        await _edit_or_send(
            callback.message, summary_text(roles, networks), kb.summary_keyboard()
        )
    await callback.answer()


@router.callback_query(F.data == f"{kb.CB_STEP}:{kb.STEP_BACK}")
async def step_back(callback: CallbackQuery) -> None:
    user = callback.from_user
    await db.set_status(user.id, STATUS_ROLES)
    selected = await db.get_roles(user.id)
    if isinstance(callback.message, Message):
        await _edit_or_send(callback.message, roles_text(), kb.roles_keyboard(selected))
    await callback.answer()


@router.callback_query(F.data == f"{kb.CB_STEP}:{kb.STEP_DONE}")
async def step_done(callback: CallbackQuery) -> None:
    user = callback.from_user
    roles = await db.get_roles(user.id)
    if not roles:
        await callback.answer(texts.TEXTS["roles_none_selected"], show_alert=False)
        return

    await db.set_status(user.id, STATUS_COMPLETED)
    await callback.answer()
    if isinstance(callback.message, Message):
        await send_links(callback.bot, callback.message.chat.id, user.id)


@router.callback_query(F.data == f"{kb.CB_STEP}:{kb.STEP_RESTART}")
async def step_restart(callback: CallbackQuery) -> None:
    """Promena izbora: izbori ostaju kao polazna tacka, status se vraca unazad."""
    user = callback.from_user
    await db.set_status(user.id, STATUS_ROLES)
    selected = await db.get_roles(user.id)
    if isinstance(callback.message, Message):
        await _edit_or_send(callback.message, roles_text(), kb.roles_keyboard(selected))
    await callback.answer()


# ------------------------------------------------ korisnik kuca umesto da klikne


@router.message(F.chat.type == "private", ~F.text.startswith("/"))
async def fallback_text(message: Message) -> None:
    """Blago vraca korisnika na korak na kom je stao."""
    user = message.from_user
    if user is None:
        return

    row = await db.get_user(user.id)
    status = row["status"] if row else None

    if status == STATUS_COMPLETED:
        await message.answer(texts.TEXTS["returning"], reply_markup=kb.returning_keyboard())
        return
    if status == STATUS_NETWORKS:
        selected = await db.get_networks(user.id)
        await message.answer(
            f"{texts.TEXTS['use_buttons']}\n\n{networks_text()}",
            reply_markup=kb.networks_keyboard(selected),
        )
        return
    if status == STATUS_ROLES:
        selected = await db.get_roles(user.id)
        await message.answer(
            f"{texts.TEXTS['use_buttons']}\n\n{roles_text()}",
            reply_markup=kb.roles_keyboard(selected),
        )
        return

    await message.answer(welcome_text(), reply_markup=kb.start_keyboard())
