"""Inline tastature.

callback_data ima tvrd limit od 64 BAJTA. Zato su prefiksi kratki i kljucevi
cetova kratki — `jr:ok:<user_id>:<chat_key>` je oko 25 bajtova, sto ostavlja
prostora. Ako se ikad uvede duzi kljuc ceta, ovo je prvo sto puca.
"""

from __future__ import annotations

from aiogram.types import InlineKeyboardButton, InlineKeyboardMarkup

from bot import config, texts

# Prefiksi callback_data
CB_ROLE = "role"
CB_NET = "net"
CB_STEP = "step"
CB_JOIN_REQUEST = "jr"
CB_BROADCAST = "bc"

# Koraci
STEP_ROLES = "roles"
STEP_NETWORKS = "networks"
STEP_CONFIRM = "confirm"
STEP_DONE = "done"
STEP_BACK = "back"
STEP_RELINK = "relink"
STEP_RESTART = "restart"

CHECKED = "✅"
UNCHECKED = "☐"


def _checkbox(label: str, selected: bool) -> str:
    return f"{CHECKED} {label}" if selected else f"{UNCHECKED} {label}"


def start_keyboard() -> InlineKeyboardMarkup:
    rows = [[InlineKeyboardButton(text=texts.BUTTONS["start"], callback_data=f"{CB_STEP}:{STEP_ROLES}")]]
    if config.PRIVACY_URL:
        rows.append([InlineKeyboardButton(text=texts.BUTTONS["privacy"], url=config.PRIVACY_URL)])
    return InlineKeyboardMarkup(inline_keyboard=rows)


def roles_keyboard(selected: set[str]) -> InlineKeyboardMarkup:
    rows = [
        [
            InlineKeyboardButton(
                text=_checkbox(texts.ROLE_LABELS[key], key in selected),
                callback_data=f"{CB_ROLE}:{key}",
            )
        ]
        for key in config.ROLE_KEYS
    ]
    rows.append(
        [InlineKeyboardButton(text=texts.BUTTONS["next"], callback_data=f"{CB_STEP}:{STEP_NETWORKS}")]
    )
    return InlineKeyboardMarkup(inline_keyboard=rows)


def networks_keyboard(selected: set[str]) -> InlineKeyboardMarkup:
    """Mreze idu u dva stupca — imena su kratka, pa se ne lome."""
    buttons = [
        InlineKeyboardButton(
            text=_checkbox(texts.NETWORK_LABELS[key], key in selected),
            callback_data=f"{CB_NET}:{key}",
        )
        for key in config.NETWORK_KEYS
    ]
    rows = [buttons[i : i + 2] for i in range(0, len(buttons), 2)]
    rows.append(
        [
            InlineKeyboardButton(
                text=texts.BUTTONS["confirm_networks"],
                callback_data=f"{CB_STEP}:{STEP_CONFIRM}",
            )
        ]
    )
    return InlineKeyboardMarkup(inline_keyboard=rows)


def summary_keyboard() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [
                InlineKeyboardButton(
                    text=texts.BUTTONS["confirm_final"],
                    callback_data=f"{CB_STEP}:{STEP_DONE}",
                )
            ],
            [
                InlineKeyboardButton(
                    text=texts.BUTTONS["back_to_edit"],
                    callback_data=f"{CB_STEP}:{STEP_BACK}",
                )
            ],
        ]
    )


def returning_keyboard() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [
                InlineKeyboardButton(
                    text=texts.BUTTONS["resend_links"],
                    callback_data=f"{CB_STEP}:{STEP_RELINK}",
                )
            ],
            [
                InlineKeyboardButton(
                    text=texts.BUTTONS["change_choice"],
                    callback_data=f"{CB_STEP}:{STEP_RESTART}",
                )
            ],
        ]
    )


def links_keyboard(links: list[tuple[str, str]]) -> InlineKeyboardMarkup:
    """links: lista (naziv ceta, url). Svaki link je zasebno dugme."""
    rows = [[InlineKeyboardButton(text=title, url=url)] for title, url in links]
    rows.append(
        [
            InlineKeyboardButton(
                text=texts.BUTTONS["need_new_links"],
                callback_data=f"{CB_STEP}:{STEP_RELINK}",
            )
        ]
    )
    return InlineKeyboardMarkup(inline_keyboard=rows)


def join_request_keyboard(user_id: int, chat_key: str) -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [
                InlineKeyboardButton(
                    text=texts.BUTTONS["approve"],
                    callback_data=f"{CB_JOIN_REQUEST}:ok:{user_id}:{chat_key}",
                ),
                InlineKeyboardButton(
                    text=texts.BUTTONS["decline"],
                    callback_data=f"{CB_JOIN_REQUEST}:no:{user_id}:{chat_key}",
                ),
            ]
        ]
    )


def broadcast_keyboard(broadcast_id: int) -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [
                InlineKeyboardButton(
                    text=texts.BUTTONS["broadcast_send"],
                    callback_data=f"{CB_BROADCAST}:go:{broadcast_id}",
                ),
                InlineKeyboardButton(
                    text=texts.BUTTONS["broadcast_cancel"],
                    callback_data=f"{CB_BROADCAST}:no:{broadcast_id}",
                ),
            ]
        ]
    )
