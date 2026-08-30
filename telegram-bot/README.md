# Mreža — Telegram bot

Bot koji prima ljude, pita ih kako žele da učestvuju u kampanji, i na osnovu
odgovora im izdaje pozivnice za odgovarajuće privatne kanale i grupe.

Ista pitanja i iste formulacije kao na web formi — čovek koji dođe sa sajta
vidi isto iskustvo.

**Tehnologija:** Python 3.11+, aiogram 3, SQLite, polling. Bez Docker-a i bez
baze koja se posebno instalira — bot je jedan proces i jedan fajl baze.

---

## Šta bot radi

1. Čovek otvori `t.me/TVOJ_BOT` (ili sa oznakom izvora: `t.me/TVOJ_BOT?start=fb`)
2. Bira **kako želi da učestvuje** — jedna ili više od četiri uloge
3. Bira **koje društvene mreže ima** — može i da preskoči
4. Vidi rekapitulaciju i potvrdi
5. Dobija jednokratne linkove za kanale koji mu pripadaju

Za grupe **Kreatori** i **Vlasnici stranica** ulazak odobrava organizator ručno
— zahtev stigne u admin grupu sa dugmadima Odobri / Odbij.

### Ko ide u koji kanal

| Uslov | Kanal |
|---|---|
| svi, bez izuzetka | Teme i materijali |
| označio Facebook | Facebook ekipa |
| označio Instagram | Instagram ekipa |
| označio TikTok | TikTok ekipa |
| označio X / Twitter | X ekipa |
| označio Telegram | Telegram ekipa |
| uloga „usmena kampanja" | Usmena kampanja |
| uloga „kreator sadržaja" | Kreatori *(grupa, ručno odobrenje)* |
| uloga „vlasnik stranica" | Vlasnici *(grupa, ručno odobrenje)* |

YouTube i Blog se pamte u bazi, ali za sada nemaju svoj kanal.

Pravila su na jednom mestu — `bot/config.py`, lista `CHAT_RULES`. Menjaš ih tamo,
logiku ne diraš.

---

## 1. Napravi bota kod @BotFather

1. U Telegramu otvori [@BotFather](https://t.me/BotFather)
2. Pošalji `/newbot`
3. Unesi ime bota (šta ljudi vide, npr. `Mreža`)
4. Unesi korisničko ime — **mora se završavati sa `bot`** (npr. `mreza_kampanja_bot`)
5. BotFather ti vrati **token**, nešto kao `7123456789:AAF...`

> ⚠️ Token je kao lozinka. Ko ga ima, upravlja botom. Ne šalji ga nikome i ne
> stavljaj ga u poruke ni u dokumenta.

Još kod BotFather-a, korisno:

- `/setdescription` — tekst koji se vidi pre nego što neko pokrene bota
- `/setuserpic` — slika bota
- `/setprivacy` → **Enable** (bot ne čita poruke u grupama, ne treba mu)

---

## 2. Dodaj bota u kanale

Za **svaki** kanal i grupu iz tabele gore:

1. Otvori kanal → **Manage Channel** (Uredi kanal) → **Administrators**
2. **Add Administrator** → nađi svog bota po korisničkom imenu
3. Uključi mu pravo **Invite Users via Link** (Pozivanje korisnika preko linka)

   Ovo je jedino pravo koje mu je neophodno. Ostalo možeš da isključiš.

4. Za grupe **Kreatori** i **Vlasnici** dodatno: kanal/grupa mora biti
   **privatna** da bi ulazak preko zahteva imao smisla

Isto uradi i za **admin grupu** — grupu u kojoj vi organizatori odobravate
zahteve. Tu botu treba samo da može da šalje poruke.

---

## 3. Saznaj ID svakog kanala

ID kanala nije ime nego broj koji počinje sa `-100`.

Najlakši način:

1. Pošalji bilo koju poruku u kanal
2. Prosledi (forward) tu poruku botu [@userinfobot](https://t.me/userinfobot)
3. On ti odgovori sa `Id: -1001234567890` — to je ID kanala

Isto uradi za admin grupu.

**Svoj lični ID** dobiješ tako što @userinfobot-u pošalješ bilo šta — treba ti
za `ADMIN_IDS`.

---

## 4. Popuni `.env`

Kopiraj primer i popuni:

```bash
cp .env.example .env
nano .env
```

Minimum da bot proradi:

```
BOT_TOKEN=7123456789:AAF...        # iz koraka 1
ADMIN_IDS=123456789                # tvoj lični ID
CHANNEL_TEME=-1001234567890        # bar jedan kanal
```

Ostalo možeš da dodaješ postepeno. **Nepopunjen kanal bot jednostavno
preskoči** — možeš krenuti sa tri kanala i dodati ostale kad ih napraviš.

Preporučeno da popuniš i:

```
ADMIN_GROUP_ID=-1009876543210      # bez ovoga ne možeš odobravati zahteve
PRIVACY_URL=https://tvoj-sajt/privatnost
```

---

## 5. Pokreni lokalno (za probu)

Potreban ti je Python 3.11 ili noviji. Provera:

```bash
python --version
```

Zatim, iz foldera `telegram-bot`:

```bash
python -m venv .venv

# Windows:
.venv\Scripts\activate
# Linux/Mac:
source .venv/bin/activate

pip install -r requirements.txt
```

### Prvo provera, pa pokretanje

```bash
python -m bot.main --check
```

Ovo pregleda podešavanja i **izađe** — ne pokreće bota. Ispiše šta je
podešeno, koji se kanali preskaču, i za svaki kanal da li je bot administrator
sa pravom pozivanja:

```
Cetova podeseno: 3 (TEME, FB, KREATORI)
Preskace se:     IG, TIKTOK, X, TG, USMENA, VLASNICI  (nepopunjeno u .env)

Prava bota po cetovima
----------------------------------------
bot @mreza_kampanja_bot (id=7123456789)
kanal TEME (-1001234567890): u redu

Sve je u redu. Bot moze da se pokrene.
```

Ako nešto nije u redu, kaže tačno šta i vrati grešku (izlazni kod 1), pa može
i u skriptu. Najčešće:

| Poruka | Šta da uradiš |
|---|---|
| `NE MOGU DA SE POVEZEM NA TELEGRAM` | `BOT_TOKEN` je pogrešan ili prazan |
| `bot ne vidi cet` | Bot nije dodat u taj kanal (korak 2) |
| `bot NIJE administrator` | Dodat je, ali kao običan član |
| `NEMA pravo 'Pozivanje korisnika'` | Admin je, ali mu je to pravo isključeno |

Kad provera prođe, pokreni bota:

```bash
python -m bot.main
```

Zaustavljanje: `Ctrl+C`.

### Šta provera NE može da vidi

`--check` potvrđuje podešavanja, ali ne i da update-i zaista stižu. To se
proverava samo rukom, i traje par minuta:

- [ ] Pošalji `/start` — stiže pozdrav sa dugmetom **Počni**
- [ ] Prođi upitnik — kvačice se menjaju **u istoj poruci**, bez novih poruka
- [ ] Klikni **Dalje** bez ijedne izabrane uloge — mora iskočiti upozorenje
- [ ] Potvrdi — stižu linkovi, svaki kao zasebno dugme
- [ ] Klikni link i uđi u kanal
- [ ] Pošalji `/stats` — moraš se videti pod **„Ušlo u kanale"**
      *(ako je prazno, bot ne dobija `chat_member` update-e — najčešće zato
      što nije administrator u tom kanalu)*
- [ ] Klikni isti link opet — mora biti potrošen, jednokratni je
- [ ] Pošalji `/linkovi` — stižu novi linkovi
- [ ] Ako imaš grupu sa odobravanjem: zahtev stiže u admin grupu sa dugmadima
- [ ] Pošalji `/start` ponovo — nudi **Ponovo mi pošalji linkove** / **Promeni izbor**
- [ ] Neka neko ko nije admin pošalje `/stats` — bot mu **ne sme** odgovoriti

### Testiraj na probnom botu, ne na pravom

Napravi **poseban** bot kod @BotFather (npr. `mreza_test_bot`) i dva-tri
**privatna** kanala u kojima si samo ti. Razlog: `/broadcast` na pravom botu
šalje poruku svim stvarnim ljudima, a to se ne može povući.

U `.env` za probu koristi i drugu bazu, da se test podaci ne pomešaju sa
pravima:

```
DB_PATH=./test.db
```

---

## 6. Pusti na server (VPS)

Pretpostavka: Ubuntu server i korisnik `deploy`, kao u glavnom uputstvu za
deploy sajta.

```bash
ssh deploy@TVOJ_IP

sudo apt update && sudo apt install -y python3-venv git

git clone TVOJ_GIT_REMOTE mreza
cd mreza/telegram-bot

python3 -m venv .venv
.venv/bin/pip install -r requirements.txt

cp .env.example .env
nano .env          # popuni kao u koraku 4
chmod 600 .env     # da .env može da čita samo tvoj korisnik
```

Proveri podešavanja pre nego što ga pustiš kao servis:

```bash
.venv/bin/python -m bot.main --check
```

Mora se završiti sa „Sve je u redu". Tek onda nastavi — ovako se problem sa
pravima vidi odmah, a ne tek kad prvi čovek pošalje `/start`.

Ako radi, napravi servis koji se sam diže:

```bash
sudo cp deploy/bot.service /etc/systemd/system/mreza-bot.service
sudo nano /etc/systemd/system/mreza-bot.service
```

U fajlu proveri da se `User`, `WorkingDirectory` i `ExecStart` poklapaju sa tvojim
stvarnim putanjama (podrazumevano je `/home/deploy/mreza-bot`; ako si klonirao u
`/home/deploy/mreza/telegram-bot`, ispravi na to).

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now mreza-bot
sudo systemctl status mreza-bot
```

### Logovi

```bash
# uživo
sudo journalctl -u mreza-bot -f

# poslednjih 200 redova
sudo journalctl -u mreza-bot -n 200

# fajl log (rotira se automatski na 5 MB)
tail -f ~/mreza/telegram-bot/bot.log
```

### Restart posle izmene koda

```bash
cd ~/mreza && git pull
sudo systemctl restart mreza-bot
```

---

## 7. Admin komande

Rade samo ljudima čiji je ID u `ADMIN_IDS`. Svima ostalima bot na njih **ne
odgovara ništa** — ne treba ni da saznaju da postoje.

| Komanda | Šta radi |
|---|---|
| `/stats` | Ukupno korisnika, po statusu, po ulozi, po mreži, **po izvoru**, i ko je stvarno ušao u kanale |
| `/stats7` | Isto, ali samo poslednjih 7 dana |
| `/export` | CSV sa svim korisnicima, stiže kao dokument |
| `/broadcast tekst` | Poruka svima koji su završili upitnik — prvo traži potvrdu |
| `/broadcast_resume` | Nastavlja slanje koje je prekinuto restartom |

**Izvor (`source`) je najkorisniji broj u `/stats`.** Ako link deliš kao
`t.me/TVOJ_BOT?start=fb` sa Facebooka i `?start=ig` sa Instagrama, statistika ti
tačno kaže koji kanal dovodi ljude, a koji ne vredi.

Oznaka izvora sme da sadrži samo slova, cifre, `_` i `-`, najviše 64 znaka.
Sve ostalo se upisuje kao `direct`.

### O slanju svima

Šalje se oko 25 poruka u sekundi, što je ispod Telegramovog limita. Za 20.000
ljudi to je **oko 13 minuta**. Bot za to vreme normalno radi sa ostalima.

Napredak se pamti, pa ako se bot restartuje u sredini, `/broadcast_resume`
nastavlja tačno odakle je stalo — niko ne dobija poruku dvaput.

Ko je blokirao bota automatski dobija status `blocked` i više mu se ne šalje.

---

## 8. Ako nešto ne radi

**Bot ne odgovara na `/start`**
- Radi li servis? `sudo systemctl status mreza-bot`
- Pogledaj log: `sudo journalctl -u mreza-bot -n 50`

**„KANAL … NIJE administrator" u logu**
- Bot nije dodat kao administrator u taj kanal (korak 2)

**„NEMA pravo 'Pozivanje korisnika'"**
- Bot jeste admin, ali mu je isključeno pravo za pozivanje. Uključi ga.

**Korisnik kaže da link ne radi**
- Linkovi važe 2 sata i jednokratni su. Neka pošalje `/linkovi` ili pritisne
  **Trebaju mi novi linkovi** — dobiće sveže.

**Zahtevi za ulazak u grupe ne stižu**
- `ADMIN_GROUP_ID` nije popunjen, ili bot nije član te grupe

**Statistika „Ušlo u kanale" je prazna**
- Bot mora biti **administrator** u kanalu da bi uopšte video ko ulazi.
  Telegram ne daje spisak članova kanala na drugi način.

---

## 9. Baza

Jedan fajl, `bot.db` (SQLite). Bekap je obično kopiranje:

```bash
sudo systemctl stop mreza-bot
cp bot.db bot.db.backup-$(date +%F)
sudo systemctl start mreza-bot
```

Tabele: `users`, `user_roles`, `user_networks`, `invites`, `memberships`,
`broadcasts`.

**Broj telefona se ne prikuplja** — bot ga ni ne traži.

---

## 10. Struktura koda

```
bot/
  main.py              pokretanje, provere dozvola, polling
  config.py            .env + PRAVILA ko ide u koji kanal  ← počni ovde
  texts.py             svi tekstovi koje korisnik vidi
  db.py                šema i upiti
  keyboards.py         inline tastature
  handlers/
    onboarding.py      /start i upitnik
    invites.py         izdavanje linkova, zahtevi, praćenje ulazaka
    admin.py           admin komande
```

**Nijedan tekst na srpskom nije u logici** — sve je u `texts.py`. Ako menjaš
formulaciju, menjaš je samo tamo.

Tekstovi pitanja su preuzeti sa web forme (`src/data/roles.ts`,
`src/components/survey/`). Ako ih promeniš na sajtu, promeni ih i u `texts.py`
— nema automatske sinhronizacije.
