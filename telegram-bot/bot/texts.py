"""Svi tekstovi koje korisnik vidi. Srpski, latinica.

Nijedan srpski string ne sme da zivi u logici — ako negde treba nova poruka,
dodaje se ovde pa se referencira kljucem.

Formulacije pitanja i opisa uloga su DOSLOVNO preuzete sa web forme
(src/data/roles.ts, src/data/social-networks.ts, src/components/survey/*),
da bi coveku koji dodje sa sajta bilo isto iskustvo. Ako se tekst promeni
tamo, treba ga promeniti i ovde — nema automatske sinhronizacije.

Poruke idu sa parse_mode=HTML, pa svaka vrednost koju je uneo korisnik
(ime, username) MORA da prodje kroz html.escape pre umetanja.
"""

from __future__ import annotations

import html

# --- Uloge: naziv i opis, isto kao na sajtu ---
ROLE_LABELS: dict[str, str] = {
    "creator": "Kreator medijskog sadržaja",
    "sharer": "Prenosilac medijskog sadržaja",
    "pageowner": "Vlasnik društvenih medija i stranica",
    "verbal": "Učesnik u usmenoj kampanji",
}

ROLE_DESCRIPTIONS: dict[str, str] = {
    "creator": "Pravim sadržaj na zadate teme — postove, video snimke i reelsove.",
    "sharer": "Delim postove kampanje i pravim sopstvene objave na zadate teme.",
    "pageowner": (
        "Imam Facebook i Instagram stranice ili profile većeg dometa i "
        "spreman/na sam da preko njih delim i kreiram sadržaj."
    ),
    "verbal": (
        "Razgovaram sa bliskim ljudima o temama kampanje, uz smernice kako "
        "da se priča."
    ),
}

# --- Mreze ---
NETWORK_LABELS: dict[str, str] = {
    "facebook": "Facebook",
    "instagram": "Instagram",
    "tiktok": "TikTok",
    "youtube": "YouTube",
    "telegram": "Telegram",
    "x": "X / Twitter",
    "blog": "Blog / web stranica",
}

# --- Nazivi cetova (kljucevi su iz config.CHAT_RULES) ---
CHAT_TITLES: dict[str, str] = {
    "TEME": "Teme i materijali",
    "FB": "Facebook ekipa",
    "IG": "Instagram ekipa",
    "TIKTOK": "TikTok ekipa",
    "X": "X / Twitter ekipa",
    "TG": "Telegram ekipa",
    "USMENA": "Usmena kampanja",
    "KREATORI": "Kreatori sadržaja (grupa)",
    "VLASNICI": "Vlasnici stranica (grupa)",
}

# --- Dugmad ---
BUTTONS: dict[str, str] = {
    "start": "Počni",
    "next": "Dalje →",
    "confirm_networks": "Potvrdi",
    "confirm_final": "Potvrđujem",
    "back_to_edit": "Nazad na izmenu",
    "resend_links": "Ponovo mi pošalji linkove",
    "change_choice": "Promeni izbor",
    "need_new_links": "Trebaju mi novi linkovi",
    "approve": "Odobri",
    "decline": "Odbij",
    "broadcast_send": "Pošalji",
    "broadcast_cancel": "Otkaži",
    "privacy": "Politika privatnosti",
}

TEXTS: dict[str, str] = {
    # --- Korak 1: pozdrav ---
    "welcome": (
        "<b>Mreža — javna kampanja</b>\n\n"
        "Mediji su pod većinskom kontrolom režima. Zato moramo sami da se "
        "organizujemo — svaki profil, svaka stranica i svaki razgovor je kanal "
        "do ljudi do kojih informacija drugačije ne stiže.\n\n"
        "Postaviću ti dva kratka pitanja i na osnovu odgovora te ubaciti u "
        "odgovarajuće kanale. Traje manje od minuta.\n\n"
        "Učešće je u potpunosti dobrovoljno."
    ),
    "consent": (
        "Pritiskom na <b>Počni</b> daješ saglasnost da se tvoje korisničko ime "
        "i izbori iz ovog upitnika obrađuju radi organizovanja kampanje."
    ),
    "consent_with_link": (
        "Pritiskom na <b>Počni</b> daješ saglasnost da se tvoje korisničko ime "
        "i izbori iz ovog upitnika obrađuju radi organizovanja kampanje. "
        "Detalji su u politici privatnosti ispod."
    ),
    # --- Korak 2: uloge ---
    "roles_title": "<b>Kako želite da učestvujete u javnoj kampanji?</b>",
    "roles_subtitle": "Izaberi jedno ili više — možeš da se uključiš na više načina.",
    "roles_none_selected": "Izaberi bar jedan način učešća.",
    # --- Korak 3: mreze ---
    "networks_title": "<b>Koje društvene mreže imaš?</b>",
    "networks_subtitle": (
        "Označi one mreže gde imaš lične profile koje si spreman/na da "
        "dobrovoljno koristiš u ovoj kampanji. Možeš i da preskočiš ovaj deo."
    ),
    # --- Korak 4: rekapitulacija ---
    "summary_title": "<b>Evo šta si izabrao/la:</b>",
    "summary_roles": "<b>Način učešća:</b>",
    "summary_networks": "<b>Mreže:</b>",
    "summary_networks_none": "nijedna",
    "summary_question": "Je li ovako u redu?",
    # --- Korak 5: linkovi ---
    "links_intro": (
        "<b>Spremno.</b> Ispod su tvoji linkovi za pristup.\n\n"
        "Svaki link važi <b>{ttl}h</b> i može se iskoristiti samo jednom, "
        "zato ih ne prosleđuj dalje. Ako isteknu, traži nove dugmetom na dnu "
        "ili komandom /linkovi."
    ),
    "links_join_request_note": (
        "\n\nZa grupe ispod tvoj zahtev odobrava organizator ručno, pa "
        "sačekaj potvrdu."
    ),
    "links_partial_failure": (
        "\n\n⚠️ Za neke kanale link trenutno nije mogao da se napravi. "
        "Probaj ponovo za par minuta dugmetom ispod."
    ),
    "links_none": (
        "Trenutno nema nijednog kanala koji ti odgovara. Organizator je "
        "obavešten — javićemo ti se."
    ),
    "links_all_joined": (
        "Već si ušao/la u sve kanale koji ti pripadaju. Ako ti ipak treba "
        "pristup, javi se organizatoru."
    ),
    # --- Povratak korisnika ---
    "returning": (
        "Već si popunio/la upitnik. Šta ti treba?"
    ),
    # --- Greske i navodjenje ---
    "use_buttons": "Koristi dugmad iznad da nastaviš.",
    "session_expired": "Ova poruka je zastarela. Pošalji /start da nastaviš.",
    "generic_error": (
        "Došlo je do greške. Pokušaj ponovo za par trenutaka, a ako se "
        "ponovi — javi organizatoru."
    ),
    "rate_limited": "Malo si brz/a. Sačekaj par sekundi pa probaj ponovo.",
    # --- Zahtevi za ulazak u grupu (admin grupa) ---
    "join_request_admin": (
        "<b>Novi zahtev za ulazak</b>\n"
        "Grupa: {chat_title}\n"
        "Korisnik: {full_name} {username}\n"
        "ID: <code>{user_id}</code>\n"
        "Uloge: {roles}\n"
        "Mreže: {networks}\n"
        "Izvor: {source}"
    ),
    "join_request_approved": "✅ Odobrio: {admin}",
    "join_request_declined": "❌ Odbio: {admin}",
    "join_request_gone": "Zahtev više ne postoji (korisnik ga je povukao ili je već obrađen).",
    # --- Admin ---
    "admin_stats_title": "<b>Statistika — ukupno</b>",
    "admin_stats7_title": "<b>Statistika — poslednjih 7 dana</b>",
    "admin_stats_users": "Korisnika: <b>{total}</b>",
    "admin_stats_by_status": "<b>Po statusu</b>",
    "admin_stats_by_role": "<b>Po ulozi</b>",
    "admin_stats_by_network": "<b>Po mreži</b>",
    "admin_stats_by_source": "<b>Po izvoru</b>",
    "admin_stats_by_chat": "<b>Ušlo u kanale</b>",
    "admin_stats_empty": "<i>nema podataka</i>",
    "admin_export_caption": "Izvoz: {count} korisnika",
    "admin_broadcast_usage": "Upotreba: /broadcast tekst poruke",
    "admin_broadcast_confirm": (
        "<b>Poruka za slanje:</b>\n\n{preview}\n\n"
        "Primalaca: <b>{count}</b>\n"
        "Procenjeno trajanje: <b>{minutes} min</b>\n\n"
        "Poslati?"
    ),
    "admin_broadcast_started": "Slanje počelo. Javiću kad se završi.",
    "admin_broadcast_cancelled": "Otkazano.",
    "admin_broadcast_done": (
        "<b>Slanje završeno</b>\n"
        "Poslato: {sent}\n"
        "Blokirali bota: {blocked}\n"
        "Ostale greške: {failed}"
    ),
    "admin_broadcast_unfinished": (
        "⚠️ Slanje #{id} nije završeno (poslato {sent} od {total}). "
        "Nastavi sa /broadcast_resume"
    ),
    "admin_broadcast_nothing_to_resume": "Nema nezavršenog slanja.",
    "admin_broadcast_resumed": "Nastavljam slanje #{id}.",
}


def role_line(key: str) -> str:
    """Naziv uloge sa opisom, za rekapitulaciju."""
    return f"• {ROLE_LABELS.get(key, key)}"


def network_line(key: str) -> str:
    return NETWORK_LABELS.get(key, key)


def escape(value: str | None) -> str:
    """HTML-escape za sve sto je uneo korisnik (ime, username).

    Poruke idu sa parse_mode=HTML — bez ovoga bi ime sa < ili & razbilo
    poruku u admin grupi.
    """
    return html.escape(value or "", quote=False)
