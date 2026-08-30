"""Sema i upiti. aiosqlite, bez ORM-a.

Jedna deljena konekcija za ceo proces. SQLite podnosi jednog pisca, a bot je
jedan proces sa asinhronim handlerima — WAL i busy_timeout su neophodni jer
se upisi preklapaju (svaki tap na dugme je jedan upis).

Sva vremena su ISO 8601 u UTC, kao tekst.
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone

import aiosqlite

log = logging.getLogger(__name__)

_db: aiosqlite.Connection | None = None

SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
  telegram_id   INTEGER PRIMARY KEY,
  username      TEXT,
  first_name    TEXT,
  source        TEXT,
  status        TEXT,           -- started | roles | networks | completed | blocked
  created_at    TEXT,
  updated_at    TEXT
);

CREATE TABLE IF NOT EXISTS user_roles (
  telegram_id INTEGER,
  role        TEXT,
  PRIMARY KEY (telegram_id, role)
);

CREATE TABLE IF NOT EXISTS user_networks (
  telegram_id INTEGER,
  network     TEXT,
  PRIMARY KEY (telegram_id, network)
);

CREATE TABLE IF NOT EXISTS invites (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  telegram_id  INTEGER,
  chat_key     TEXT,
  invite_link  TEXT,
  created_at   TEXT,
  joined_at    TEXT
);

CREATE TABLE IF NOT EXISTS memberships (
  telegram_id INTEGER,
  chat_key    TEXT,
  joined_at   TEXT,
  PRIMARY KEY (telegram_id, chat_key)
);

-- Slanje na 20k ljudi traje ~13 minuta. Ako se bot restartuje u sredini,
-- bez ovoga se ne bi znalo dokle je stiglo.
CREATE TABLE IF NOT EXISTS broadcasts (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  body          TEXT NOT NULL,
  created_by    INTEGER NOT NULL,
  created_at    TEXT NOT NULL,
  cursor_id     INTEGER NOT NULL DEFAULT 0,  -- poslednji obradjen telegram_id
  sent          INTEGER NOT NULL DEFAULT 0,
  blocked       INTEGER NOT NULL DEFAULT 0,
  failed        INTEGER NOT NULL DEFAULT 0,
  started_at    TEXT,
  finished_at   TEXT
);

CREATE INDEX IF NOT EXISTS idx_users_status    ON users (status);
CREATE INDEX IF NOT EXISTS idx_users_source    ON users (source);
CREATE INDEX IF NOT EXISTS idx_users_created   ON users (created_at);
CREATE INDEX IF NOT EXISTS idx_invites_user    ON invites (telegram_id);
CREATE INDEX IF NOT EXISTS idx_invites_pending ON invites (telegram_id, joined_at);
CREATE INDEX IF NOT EXISTS idx_invites_link    ON invites (invite_link);
"""


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def days_ago_iso(days: int) -> str:
    return (datetime.now(timezone.utc) - timedelta(days=days)).isoformat(timespec="seconds")


async def connect(db_path: str) -> aiosqlite.Connection:
    """Otvara konekciju i primenjuje semu. Poziva se jednom, pri startu."""
    global _db
    conn = await aiosqlite.connect(db_path)
    conn.row_factory = aiosqlite.Row
    # WAL: citanja ne blokiraju upise. busy_timeout: umesto trenutnog
    # "database is locked", sacekaj do 5s da drugi upis zavrsi.
    await conn.execute("PRAGMA journal_mode=WAL")
    await conn.execute("PRAGMA busy_timeout=5000")
    await conn.execute("PRAGMA foreign_keys=ON")
    await conn.executescript(SCHEMA)
    await conn.commit()
    _db = conn
    log.info("baza otvorena: %s", db_path)
    return conn


def db() -> aiosqlite.Connection:
    if _db is None:
        raise RuntimeError("Baza nije otvorena — pozovi connect() pri startu")
    return _db


async def close() -> None:
    global _db
    if _db is not None:
        await _db.close()
        _db = None


# ---------------------------------------------------------------- korisnici


async def upsert_user(
    telegram_id: int,
    username: str | None,
    first_name: str | None,
    source: str,
) -> None:
    """Kreira korisnika ili osvezava ime/username.

    source se upisuje SAMO pri prvom dolasku — inace bi ponovni /start bez
    payload-a prepisao pravi izvor na "direct" i pokvario statistiku.
    """
    await db().execute(
        """
        INSERT INTO users (telegram_id, username, first_name, source, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, 'started', ?, ?)
        ON CONFLICT (telegram_id) DO UPDATE SET
          username   = excluded.username,
          first_name = excluded.first_name,
          updated_at = excluded.updated_at
        """,
        (telegram_id, username, first_name, source, now_iso(), now_iso()),
    )
    await db().commit()


async def get_user(telegram_id: int) -> aiosqlite.Row | None:
    async with db().execute(
        "SELECT * FROM users WHERE telegram_id = ?", (telegram_id,)
    ) as cur:
        return await cur.fetchone()


async def set_status(telegram_id: int, status: str) -> None:
    await db().execute(
        "UPDATE users SET status = ?, updated_at = ? WHERE telegram_id = ?",
        (status, now_iso(), telegram_id),
    )
    await db().commit()


# ------------------------------------------------------------ izbori


async def toggle_role(telegram_id: int, role: str) -> bool:
    """Ukljuci/iskljuci ulogu. Vraca novo stanje (True = izabrana)."""
    async with db().execute(
        "SELECT 1 FROM user_roles WHERE telegram_id = ? AND role = ?",
        (telegram_id, role),
    ) as cur:
        exists = await cur.fetchone() is not None

    if exists:
        await db().execute(
            "DELETE FROM user_roles WHERE telegram_id = ? AND role = ?",
            (telegram_id, role),
        )
    else:
        await db().execute(
            "INSERT OR IGNORE INTO user_roles (telegram_id, role) VALUES (?, ?)",
            (telegram_id, role),
        )
    await db().commit()
    return not exists


async def toggle_network(telegram_id: int, network: str) -> bool:
    async with db().execute(
        "SELECT 1 FROM user_networks WHERE telegram_id = ? AND network = ?",
        (telegram_id, network),
    ) as cur:
        exists = await cur.fetchone() is not None

    if exists:
        await db().execute(
            "DELETE FROM user_networks WHERE telegram_id = ? AND network = ?",
            (telegram_id, network),
        )
    else:
        await db().execute(
            "INSERT OR IGNORE INTO user_networks (telegram_id, network) VALUES (?, ?)",
            (telegram_id, network),
        )
    await db().commit()
    return not exists


async def get_roles(telegram_id: int) -> set[str]:
    async with db().execute(
        "SELECT role FROM user_roles WHERE telegram_id = ?", (telegram_id,)
    ) as cur:
        return {row["role"] for row in await cur.fetchall()}


async def get_networks(telegram_id: int) -> set[str]:
    async with db().execute(
        "SELECT network FROM user_networks WHERE telegram_id = ?", (telegram_id,)
    ) as cur:
        return {row["network"] for row in await cur.fetchall()}


# ------------------------------------------------------------ pozivnice


async def record_invite(telegram_id: int, chat_key: str, invite_link: str) -> None:
    await db().execute(
        "INSERT INTO invites (telegram_id, chat_key, invite_link, created_at) VALUES (?, ?, ?, ?)",
        (telegram_id, chat_key, invite_link, now_iso()),
    )
    await db().commit()


async def unused_invites(telegram_id: int) -> list[aiosqlite.Row]:
    """Pozivnice koje korisnik jos nije iskoristio."""
    async with db().execute(
        "SELECT * FROM invites WHERE telegram_id = ? AND joined_at IS NULL",
        (telegram_id,),
    ) as cur:
        return list(await cur.fetchall())


async def joined_chat_keys(telegram_id: int) -> set[str]:
    async with db().execute(
        "SELECT chat_key FROM memberships WHERE telegram_id = ?", (telegram_id,)
    ) as cur:
        return {row["chat_key"] for row in await cur.fetchall()}


async def mark_invite_used(invite_link: str) -> str | None:
    """Obelezava pozivnicu kao iskoriscenu. Vraca chat_key ili None.

    Telegram u chat_member update-u vraca tacan link kojim je korisnik usao,
    pa je to najpouzdaniji nacin da se sazna u koji cet je otisao.
    """
    async with db().execute(
        "SELECT id, chat_key FROM invites WHERE invite_link = ? AND joined_at IS NULL LIMIT 1",
        (invite_link,),
    ) as cur:
        row = await cur.fetchone()
    if row is None:
        return None
    await db().execute(
        "UPDATE invites SET joined_at = ? WHERE id = ?", (now_iso(), row["id"])
    )
    await db().commit()
    return row["chat_key"]


async def record_membership(telegram_id: int, chat_key: str) -> None:
    await db().execute(
        """
        INSERT INTO memberships (telegram_id, chat_key, joined_at) VALUES (?, ?, ?)
        ON CONFLICT (telegram_id, chat_key) DO NOTHING
        """,
        (telegram_id, chat_key, now_iso()),
    )
    await db().commit()


async def drop_membership(telegram_id: int, chat_key: str) -> None:
    await db().execute(
        "DELETE FROM memberships WHERE telegram_id = ? AND chat_key = ?",
        (telegram_id, chat_key),
    )
    await db().commit()


# ------------------------------------------------------------ statistika


async def _count(sql: str, params: tuple = ()) -> int:
    async with db().execute(sql, params) as cur:
        row = await cur.fetchone()
    return int(row[0]) if row else 0


async def _grouped(sql: str, params: tuple = ()) -> list[tuple[str, int]]:
    async with db().execute(sql, params) as cur:
        return [(str(r[0]), int(r[1])) for r in await cur.fetchall()]


async def stats(since: str | None = None) -> dict[str, object]:
    """Statistika; `since` je ISO datum ili None za sve vreme."""
    where = "WHERE created_at >= ?" if since else ""
    params: tuple = (since,) if since else ()

    total = await _count(f"SELECT count(*) FROM users {where}", params)
    by_status = await _grouped(
        f"SELECT status, count(*) FROM users {where} GROUP BY status ORDER BY 2 DESC", params
    )
    by_source = await _grouped(
        f"SELECT source, count(*) FROM users {where} GROUP BY source ORDER BY 2 DESC", params
    )

    join = "JOIN users u ON u.telegram_id = t.telegram_id"
    sub_where = "WHERE u.created_at >= ?" if since else ""
    by_role = await _grouped(
        f"SELECT t.role, count(*) FROM user_roles t {join} {sub_where} GROUP BY t.role ORDER BY 2 DESC",
        params,
    )
    by_network = await _grouped(
        f"SELECT t.network, count(*) FROM user_networks t {join} {sub_where} GROUP BY t.network ORDER BY 2 DESC",
        params,
    )
    by_chat = await _grouped(
        f"SELECT t.chat_key, count(*) FROM memberships t {join} {sub_where} GROUP BY t.chat_key ORDER BY 2 DESC",
        params,
    )

    return {
        "total": total,
        "by_status": by_status,
        "by_role": by_role,
        "by_network": by_network,
        "by_source": by_source,
        "by_chat": by_chat,
    }


async def export_rows() -> list[dict[str, object]]:
    """Svi korisnici sa spojenim ulogama, mrezama i cetovima — za CSV."""
    async with db().execute(
        """
        SELECT
          u.telegram_id,
          u.username,
          u.first_name,
          u.source,
          u.status,
          u.created_at,
          (SELECT group_concat(role, ' | ')     FROM user_roles    r WHERE r.telegram_id = u.telegram_id) AS roles,
          (SELECT group_concat(network, ' | ')  FROM user_networks n WHERE n.telegram_id = u.telegram_id) AS networks,
          (SELECT group_concat(chat_key, ' | ') FROM memberships   m WHERE m.telegram_id = u.telegram_id) AS chats
        FROM users u
        ORDER BY u.created_at
        """
    ) as cur:
        return [dict(row) for row in await cur.fetchall()]


# ------------------------------------------------------------ slanje svima


async def completed_count() -> int:
    return await _count("SELECT count(*) FROM users WHERE status = 'completed'")


async def create_broadcast(body: str, created_by: int) -> int:
    cur = await db().execute(
        "INSERT INTO broadcasts (body, created_by, created_at) VALUES (?, ?, ?)",
        (body, created_by, now_iso()),
    )
    await db().commit()
    return int(cur.lastrowid or 0)


async def get_broadcast(broadcast_id: int) -> aiosqlite.Row | None:
    async with db().execute(
        "SELECT * FROM broadcasts WHERE id = ?", (broadcast_id,)
    ) as cur:
        return await cur.fetchone()


async def unfinished_broadcast() -> aiosqlite.Row | None:
    async with db().execute(
        "SELECT * FROM broadcasts WHERE started_at IS NOT NULL AND finished_at IS NULL ORDER BY id DESC LIMIT 1"
    ) as cur:
        return await cur.fetchone()


async def mark_broadcast_started(broadcast_id: int) -> None:
    await db().execute(
        "UPDATE broadcasts SET started_at = COALESCE(started_at, ?) WHERE id = ?",
        (now_iso(), broadcast_id),
    )
    await db().commit()


async def broadcast_batch(cursor_id: int, limit: int) -> list[aiosqlite.Row]:
    """Sledeca grupa primalaca, po rastucem telegram_id (stabilan kursor)."""
    async with db().execute(
        """
        SELECT telegram_id FROM users
        WHERE status = 'completed' AND telegram_id > ?
        ORDER BY telegram_id
        LIMIT ?
        """,
        (cursor_id, limit),
    ) as cur:
        return list(await cur.fetchall())


async def update_broadcast_progress(
    broadcast_id: int, cursor_id: int, sent: int, blocked: int, failed: int
) -> None:
    await db().execute(
        "UPDATE broadcasts SET cursor_id = ?, sent = ?, blocked = ?, failed = ? WHERE id = ?",
        (cursor_id, sent, blocked, failed, broadcast_id),
    )
    await db().commit()


async def mark_broadcast_finished(broadcast_id: int) -> None:
    await db().execute(
        "UPDATE broadcasts SET finished_at = ? WHERE id = ?", (now_iso(), broadcast_id)
    )
    await db().commit()


async def mark_blocked(telegram_id: int) -> None:
    await db().execute(
        "UPDATE users SET status = 'blocked', updated_at = ? WHERE telegram_id = ?",
        (now_iso(), telegram_id),
    )
    await db().commit()
