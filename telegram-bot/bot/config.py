"""Ucitavanje .env-a i mapiranje uloga/mreza na Telegram cetove.

Ovde je JEDINO mesto gde stoji pravilo "ko ide u koji kanal". Ako se doda nov
kanal ili promeni uslov, menja se samo lista CHAT_RULES — logika u handlerima
se ne dira.

Nijedan srpski string koji korisnik vidi ne zivi ovde; nazivi cetova su u
texts.CHAT_TITLES, a ovde stoje samo kljucevi.
"""

from __future__ import annotations

import os
from dataclasses import dataclass

from dotenv import load_dotenv

load_dotenv()

# --- Kljucevi uloga (moraju se poklapati sa callback_data "role:<kljuc>") ---
ROLE_CREATOR = "creator"
ROLE_SHARER = "sharer"
ROLE_PAGEOWNER = "pageowner"
ROLE_VERBAL = "verbal"

ROLE_KEYS: tuple[str, ...] = (
    ROLE_CREATOR,
    ROLE_SHARER,
    ROLE_PAGEOWNER,
    ROLE_VERBAL,
)

# --- Kljucevi mreza (callback_data "net:<kljuc>") ---
NET_FACEBOOK = "facebook"
NET_INSTAGRAM = "instagram"
NET_TIKTOK = "tiktok"
NET_YOUTUBE = "youtube"
NET_TELEGRAM = "telegram"
NET_X = "x"
NET_BLOG = "blog"

NETWORK_KEYS: tuple[str, ...] = (
    NET_FACEBOOK,
    NET_INSTAGRAM,
    NET_TIKTOK,
    NET_YOUTUBE,
    NET_TELEGRAM,
    NET_X,
    NET_BLOG,
)


@dataclass(frozen=True)
class ChatRule:
    """Jedan cet i uslov pod kojim korisnik dobija link za njega.

    requires_role i requires_network su oba None => cet dobijaju svi.
    join_request=True => link trazi rucno odobrenje admina umesto da pusta odmah.
    """

    key: str
    env_var: str
    join_request: bool = False
    requires_role: str | None = None
    requires_network: str | None = None


# Redosled ovde je i redosled dugmadi u poruci sa linkovima.
CHAT_RULES: tuple[ChatRule, ...] = (
    ChatRule(key="TEME", env_var="CHANNEL_TEME"),
    ChatRule(key="FB", env_var="CHANNEL_FB", requires_network=NET_FACEBOOK),
    ChatRule(key="IG", env_var="CHANNEL_IG", requires_network=NET_INSTAGRAM),
    ChatRule(key="TIKTOK", env_var="CHANNEL_TIKTOK", requires_network=NET_TIKTOK),
    ChatRule(key="X", env_var="CHANNEL_X", requires_network=NET_X),
    ChatRule(key="TG", env_var="CHANNEL_TG", requires_network=NET_TELEGRAM),
    ChatRule(key="USMENA", env_var="CHANNEL_USMENA", requires_role=ROLE_VERBAL),
    # Grupe: ulazak preko zahteva koji admin rucno odobrava.
    ChatRule(
        key="KREATORI",
        env_var="GROUP_KREATORI",
        join_request=True,
        requires_role=ROLE_CREATOR,
    ),
    ChatRule(
        key="VLASNICI",
        env_var="GROUP_VLASNICI",
        join_request=True,
        requires_role=ROLE_PAGEOWNER,
    ),
)

# YouTube i Blog namerno nemaju cet — biraju se u upitniku i cuvaju u bazi,
# ali za sada ne vode nigde.


def _require(name: str) -> str:
    value = os.getenv(name, "").strip()
    if not value:
        raise RuntimeError(f"Obavezna env varijabla nije postavljena: {name}")
    return value


def _parse_admin_ids(raw: str) -> frozenset[int]:
    ids: set[int] = set()
    for part in raw.split(","):
        part = part.strip()
        if not part:
            continue
        try:
            ids.add(int(part))
        except ValueError as exc:
            raise RuntimeError(f"ADMIN_IDS sadrzi nevalidan ID: {part!r}") from exc
    if not ids:
        raise RuntimeError("ADMIN_IDS je prazan — niko ne bi mogao da koristi admin komande")
    return frozenset(ids)


def _optional_chat_id(name: str) -> int | None:
    """Nepopunjen kanal se preskace umesto da obori bota.

    Namerno: tako se moze krenuti sa tri kanala i dodavati ostale kasnije.
    """
    raw = os.getenv(name, "").strip()
    if not raw:
        return None
    try:
        return int(raw)
    except ValueError as exc:
        raise RuntimeError(f"{name} mora biti ceo broj (npr. -1001234567890), dobijeno {raw!r}") from exc


BOT_TOKEN: str = _require("BOT_TOKEN")
ADMIN_IDS: frozenset[int] = _parse_admin_ids(_require("ADMIN_IDS"))
ADMIN_GROUP_ID: int | None = _optional_chat_id("ADMIN_GROUP_ID")

DB_PATH: str = os.getenv("DB_PATH", "./bot.db").strip() or "./bot.db"
INVITE_TTL_HOURS: int = int(os.getenv("INVITE_TTL_HOURS", "2") or "2")

LOG_PATH: str = os.getenv("LOG_PATH", "./bot.log").strip() or "./bot.log"

# Link na politiku privatnosti sa sajta; prikazuje se uz pristanak na obradu.
PRIVACY_URL: str = os.getenv("PRIVACY_URL", "").strip()

# Cetovi koji su stvarno konfigurisani: kljuc -> (chat_id, pravilo).
CONFIGURED_CHATS: dict[str, tuple[int, ChatRule]] = {}
for _rule in CHAT_RULES:
    _chat_id = _optional_chat_id(_rule.env_var)
    if _chat_id is not None:
        CONFIGURED_CHATS[_rule.key] = (_chat_id, _rule)


def chat_keys_for(roles: set[str], networks: set[str]) -> list[str]:
    """Kljucevi cetova koje korisnik dobija, u redosledu iz CHAT_RULES.

    Preskace cetove koji nisu konfigurisani u .env-u.
    """
    keys: list[str] = []
    for rule in CHAT_RULES:
        if rule.key not in CONFIGURED_CHATS:
            continue
        if rule.requires_role is not None and rule.requires_role not in roles:
            continue
        if rule.requires_network is not None and rule.requires_network not in networks:
            continue
        keys.append(rule.key)
    return keys


def chat_id_of(chat_key: str) -> int | None:
    entry = CONFIGURED_CHATS.get(chat_key)
    return entry[0] if entry else None


def rule_of(chat_key: str) -> ChatRule | None:
    entry = CONFIGURED_CHATS.get(chat_key)
    return entry[1] if entry else None


def chat_key_of(chat_id: int) -> str | None:
    """Obrnuto mapiranje: Telegram chat_id -> nas kljuc ceta.

    Treba kad stigne chat_member update — Telegram javlja chat_id, a mi
    radimo sa kljucevima.
    """
    for key, (cid, _rule) in CONFIGURED_CHATS.items():
        if cid == chat_id:
            return key
    return None


def is_admin(user_id: int) -> bool:
    return user_id in ADMIN_IDS
