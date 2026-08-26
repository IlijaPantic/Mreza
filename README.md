# Mreža

Prijava dobrovoljnih učesnika u javnoj medijskoj kampanji.

Javna forma na kojoj se čovek prijavi, kaže **kako** želi da učestvuje (kreira
sadržaj, deli ga, ustupa svoje stranice, priča sa ljudima oko sebe) i **čime**
raspolaže (koje društvene mreže, ima li profil većeg dometa, linkovi). Iza toga
stoji admin panel u kom se prijave pretražuju, filtriraju po ulozi i po mreži, i
izvoze u CSV.

Ime i vizuelni motiv dolaze iz same ideje: poruka putuje onoliko daleko koliko
je ljudi prenese — jezgro i čvorovi povezani u mrežu.

---

## Stack

| Sloj | Izbor | Verzija |
|---|---|---|
| Wire kontrakt | Protobuf + Connect RPC (`buf`) | buf 1.70 |
| Backend | Go, `connectrpc.com/connect`, `pgx/v5` | Go 1.26 |
| Baza | PostgreSQL, upiti `sqlc`, migracije `golang-migrate` | PG 18, sqlc 1.31 |
| Frontend | React, TypeScript, Vite, Tailwind, TanStack Form/Query | React 19, TS 5.9, Vite 6, TW 4 |
| Auth | Cookie sesija (`gorilla/sessions`) + bcrypt, opciono Google OAuth | — |

Šema je izvor istine: `.proto` fajlovi generišu i Go server i TS klijent, pa se
promena kontrakta vidi kao kompajlerska greška, a ne kao runtime iznenađenje.

---

## Brzi start (lokalno)

Preduslovi: Go 1.26, Node 20+, PostgreSQL 18 na portu 5434, `buf`, `sqlc`.

```powershell
# 1) .env (interaktivno — pita za admin email i lozinku)
.\scripts\dev-env-init.ps1

# 2) Baza
psql -h localhost -p 5434 -U postgres -c "CREATE DATABASE mreza_anketa_dev;"

# 3) Backend (terminal 1) — sam primenjuje migracije i bootstrap-uje admina
.\scripts\dev-backend.ps1

# 4) Frontend (terminal 2)
.\scripts\dev-frontend.ps1
```

- Javna forma: http://localhost:5173/
- Admin panel: http://localhost:5173/admin

Vite proxy prosleđuje `/mreza.v1.*` i `/auth/*` na backend (`:8080`), pa je sve
na istom originu i session cookie radi bez CORS podešavanja.

PATH reload u novoj PowerShell sesiji:

```powershell
$env:Path = [System.Environment]::GetEnvironmentVariable("Path","User") + ";" + [System.Environment]::GetEnvironmentVariable("Path","Machine")
```

---

## Codegen

Generisani kod je commit-ovan (`internal/gen/`, `src/gen/`) da bi se promene
šeme videle u diff-u. **Nikad se ne menja ručno.**

```bash
buf lint && buf generate   # proto  -> Go server + TS klijent
sqlc generate              # SQL    -> Go DB SDK
```

## Provere pre commita

```bash
gofmt -l cmd internal      # prazno = OK
go vet ./... && go build ./...
npm run typecheck
npm run build
```

---

## Struktura

```
proto/mreza/v1/       wire kontrakt (survey.proto, admin.proto)
cmd/rpcapi/
  main.go             composition root: middleware lanac, rute, rate limiteri
  connect/            handleri (survey.go, admin.go) + interceptori
internal/
  catalog/            uloge i mreže: enum <-> slug <-> labela  ← počni ovde
  db/migrations/      uparene up/down migracije
  db/queries/         sqlc upiti
  middleware/         request id, client ip, body limit, session, logger
  ratelimit/          per-IP token bucket
  auth/ config/ password/ session/
src/
  components/brand/   NetworkMark (logo), NetworkField (graf u hero-u)
  components/survey/  javna forma, RolePicker, NetworkPicker, NetworkIcon
  components/admin/   admin layout, dijalog za lozinku
  components/ui/      Tailwind primitivi (kebab-case fajlovi)
  pages/              javne stranice + admin/
  data/               ROLES, SOCIAL_NETWORKS
  validators/         validacija forme (ogledalo backend pravila)
  lib/                transport, auth, mapiranje grešaka, formatiranje
```

**Engleski u kodu, srpski u UI-ju.** Identifikatori, imena fajlova, komentari i
JSON ključevi su engleski; sve što korisnik vidi je srpski, latinica.

### Kad dodaješ ulogu ili mrežu

Fiksne liste žive na **tri** mesta i moraju ostati usklađene:

1. `proto/mreza/v1/survey.proto` — nova enum vrednost (nikad ne menjaj postojeće brojeve)
2. `internal/catalog/catalog.go` — slug, labela, mesto u kanonskom redosledu
3. `src/data/roles.ts` ili `src/data/social-networks.ts` — labela i opis za UI

Zatim `buf generate`. Backend odbija svaku vrednost koja nije u katalogu, pa
zaboravljen korak 2 pada odmah, na prvoj prijavi.

---

## Zaštite

| Sloj | Šta radi |
|---|---|
| Rate limit | Per-IP token bucket: 3 prijave/min, 5 login pokušaja/min, 60/min ostalo |
| `TRUST_PROXY_HEADERS` | `X-Forwarded-For` se poštuje samo iza reverse proxy-ja — inače se limit zaobilazi izmišljenim headerom |
| Body limit | 1 MiB po zahtevu |
| Auth | Deny-by-default interceptor; javan je samo `SurveyService.Submit` |
| RBAC | `viewer` čita; `admin` poziva i ukida naloge. Niko ne može da ukine sam sebe |
| Lozinke | bcrypt cost 12; promena tuđe lozinke ne postoji kao operacija |
| Cookie | `HttpOnly`, `SameSite=Lax`, `Secure` kad je `APP_ENV=prod` |
| URL-ovi iz forme | Normalizuju se i moraju biti http(s) — i na backendu i pri renderu u adminu |
| DB | `CHECK` constraint-i drže invarijante (bar jedna uloga, saglasnost obavezna) |

---

## Zamke (pročitaj pre nego što nešto meniš)

Stvari koje se ne vide iz koda, a ujedaju:

- **`TRUST_PROXY_HEADERS` mora biti `"true"` u produkciji iza Caddy-ja.** Ako
  nije, backend vidi sve posetioce kao jedan IP (Caddy kontejner) i blokira ceo
  sajt posle par prijava. Obrnuto, ako je `"true"` a backend je direktno izložen
  (`ports:` na `api` servisu), svako zaobilazi rate limit izmišljenim headerom.

- **Provera URL-ova je namerno duplirana.** `optionalURL` u
  `cmd/rpcapi/connect/survey.go` i `safeExternalHref` u
  `src/lib/submission-labels.ts` rade isto. To nije previd — linkove unosi
  anoniman korisnik, a admin panel ih renderuje kao `<a href>`, pa bi propušten
  `javascript:` link bio XSS ka nalogu sa najviše prava. **Ne uklanjaj nijednu.**

- **npm, ne pnpm.** Node na ovoj mašini je 20.x, a pnpm 11 traži 22+. Ako
  podigneš Node, prelazak na pnpm znači brisanje `package-lock.json` i izmenu
  `scripts/dev-frontend.ps1`.

- **Rate limit je in-memory, dakle single-instance.** Više instanci znači
  efektivni limit `N × konfigurisani`. Skaliranje traži Redis backend.

- **Nema PDF-a i nema geografskih polja.** Za razliku od projekta iz kog je ovaj
  izveden — nema `internal/pdf/`, nema opštine/naselja/biračkog mesta. Ako
  zatrebaju, to je nov feature (migracija + proto + UI), ne „vraćanje" nečega.

- **Google OAuth je opcion.** Bez `GOOGLE_OAUTH_CLIENT_ID` i `_SECRET` radi samo
  password login, a login ekran sam sakriva Google dugme. Ako postaviš jedan,
  moraš sva tri (uključujući callback URL).

- **Docker nije instaliran lokalno.** Postgres se pokreće nativno na portu 5434.
  Docker se koristi samo na serveru, po deploy uputstvu.

---

## Deploy

Hetzner Cloud + Docker Compose + Caddy (auto-HTTPS) — korak po korak u
[`UPUTSTVO_ZA_DEPLOY.md`](UPUTSTVO_ZA_DEPLOY.md).

---

## Pre produkcije

- [ ] Git remote + prvi push
- [ ] Pravni pregled teksta saglasnosti i stranice `/privatnost` — trenutni
      tekst je razuman, ali ga nije pisao pravnik
- [ ] Odluka o captcha zaštiti (npr. Cloudflare Turnstile) pre širokog deljenja
      linka — rate limit po IP-u ne zaustavlja distribuiran spam
- [ ] Obrisati demo prijave iz baze
