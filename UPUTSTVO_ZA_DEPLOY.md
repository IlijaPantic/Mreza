# UPUTSTVO ZA DEPLOY — Mreža

Hetzner Cloud + Docker Compose + Caddy (auto-HTTPS).
Korak po korak za nekoga ko ovo nije ranije radio. Ukupno ~30 min.

> Ovo uputstvo je za **prvi deploy** od nule. Kasnije, kad ažuriraš aplikaciju,
> idi direktno na sekciju **8. Update na novu verziju**.

---

## 0. Šta ti treba pre nego što počneš

- [ ] **Hetzner Cloud nalog** (https://console.hetzner.cloud) sa unetom karticom.
- [ ] **Domen** koji ćeš koristiti + pristup DNS-u registrara.
- [ ] **SSH ključ na laptopu.** Ako nemaš:
  ```bash
  ssh-keygen -t ed25519 -C "deploy@mreza"
  cat ~/.ssh/id_ed25519.pub   # ovaj sadržaj se lepi u Hetzner
  ```
- [ ] Email adresa za prvi admin login.
- [ ] **Jedinstven domen kroz uputstvo:** u celom dokumentu zameni
  `mreza.example.rs` svojim domenom (Caddyfile, `.env` `PUBLIC_BASE_URL`, DNS).

---

## 1. Server na Hetzner-u

1. [Hetzner Cloud Console](https://console.hetzner.cloud) → **Add Server**:
   - **Image**: Ubuntu 24.04
   - **Type**: CX22 (2 vCPU / 4 GB RAM, ~5 €/mes)
   - **Datacenter**: Falkenstein ili Helsinki
   - **SSH key**: dodaj svoj javni ključ
   - **Firewall**: otvori `22`, `80`, `443`
2. **DNS**: kod registrara dodaj **A record** `mreza.example.rs` → IP servera.
   Proveri da se propagiralo:
   ```bash
   nslookup mreza.example.rs
   ```

---

## 2. Osnovni OS setup

```bash
ssh root@TVOJ_IP
```

```bash
apt update && apt upgrade -y
apt install -y docker.io docker-compose-v2 git ufw

# Firewall
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

# Deploy korisnik (ne radi sve kao root)
adduser --disabled-password --gecos "" deploy
usermod -aG sudo,docker deploy
mkdir -p /home/deploy/.ssh
cp /root/.ssh/authorized_keys /home/deploy/.ssh/
chown -R deploy:deploy /home/deploy/.ssh
chmod 700 /home/deploy/.ssh
chmod 600 /home/deploy/.ssh/authorized_keys
```

Otvori **NOVI** terminal (ne zatvaraj root sesiju dok ne potvrdiš):

```bash
ssh deploy@TVOJ_IP
```

---

## 3. Repo i konfiguracijski fajlovi

Kao `deploy` na serveru:

```bash
mkdir -p ~/mreza-anketa && cd ~/mreza-anketa
git clone TVOJ_GIT_REMOTE src
mkdir -p backups
```

Treba ti tri fajla u `~/mreza-anketa/`.

### `Dockerfile`

```bash
nano ~/mreza-anketa/Dockerfile
```

```dockerfile
# --- Frontend build ---
FROM node:22-alpine AS frontend
WORKDIR /app
COPY src/package.json src/package-lock.json ./
RUN npm ci
COPY src/ ./
RUN npm run build

# --- Backend build ---
FROM golang:1.26-alpine AS backend
WORKDIR /app
COPY src/go.mod src/go.sum ./
RUN go mod download
COPY src/ ./
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o /rpcapi ./cmd/rpcapi

# --- Final image ---
FROM alpine:3.20
RUN apk add --no-cache ca-certificates tzdata
WORKDIR /app
COPY --from=backend /rpcapi /app/rpcapi
COPY --from=backend /app/internal/db/migrations /app/internal/db/migrations
COPY --from=frontend /app/dist /app/dist
EXPOSE 8080
ENTRYPOINT ["/app/rpcapi"]
```

### `docker-compose.yml`

```bash
nano ~/mreza-anketa/docker-compose.yml
```

```yaml
services:
  db:
    image: postgres:18-alpine
    restart: unless-stopped
    environment:
      POSTGRES_USER: mreza
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: mreza_anketa
    volumes:
      - db_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U mreza -d mreza_anketa"]
      interval: 5s
      retries: 10

  api:
    build: .
    restart: unless-stopped
    depends_on:
      db:
        condition: service_healthy
    environment:
      DATABASE_URL: postgres://mreza:${POSTGRES_PASSWORD}@db:5432/mreza_anketa?sslmode=disable
      HTTP_ADDR: :8080
      SESSION_SECRET: ${SESSION_SECRET}
      INITIAL_ADMIN_EMAILS: ${INITIAL_ADMIN_EMAILS}
      INITIAL_ADMIN_PASSWORD: ${INITIAL_ADMIN_PASSWORD}
      PUBLIC_BASE_URL: https://mreza.example.rs
      APP_ENV: prod
      # Backend je dostupan SAMO preko Caddy-ja (nema `ports:`, samo `expose`),
      # a Caddy prepisuje X-Forwarded-For. Zato je ovde bezbedno da se veruje
      # tom headeru — i neophodno je, inače bi rate limiter video sve posetioce
      # kao jedan IP (Caddy kontejner) i blokirao ceo sajt posle par prijava.
      TRUST_PROXY_HEADERS: "true"
    expose:
      - "8080"
    volumes:
      - app_dist:/app/dist

  caddy:
    image: caddy:2-alpine
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile:ro
      - app_dist:/srv/dist:ro
      - caddy_data:/data
      - caddy_config:/config
    depends_on:
      - api

volumes:
  db_data:
  app_dist:
  caddy_data:
  caddy_config:
```

> ⚠️ **Ne dodaj `ports:` na `api` servis.** Ako backend postane direktno dostupan
> spolja, a `TRUST_PROXY_HEADERS` je `"true"`, svako može da pošalje izmišljen
> `X-Forwarded-For` i time potpuno zaobiđe rate limit.

### `Caddyfile`

```bash
nano ~/mreza-anketa/Caddyfile
```

Zameni `mreza.example.rs` svojim domenom:

```
mreza.example.rs {
  encode gzip zstd

  handle /mreza.v1.* {
    reverse_proxy api:8080
  }
  handle /auth/* {
    reverse_proxy api:8080
  }
  handle /healthz {
    reverse_proxy api:8080
  }

  handle {
    root * /srv/dist
    try_files {path} /index.html
    file_server
    @assets path /assets/*
    header @assets Cache-Control "public, max-age=31536000, immutable"
  }

  header {
    Strict-Transport-Security "max-age=31536000; includeSubDomains"
    X-Content-Type-Options nosniff
    X-Frame-Options DENY
    Referrer-Policy strict-origin-when-cross-origin
    # CSP: skripte i XHR samo sa sopstvenog origina; fontovi sa Google Fonts
    # (index.html ih učitava). data: za img jer je favicon inline SVG.
    Content-Security-Policy "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'"
  }
}
```

> Posle prvog deploya otvori sajt i pogledaj browser konzolu. Ako CSP nešto
> blokira, videćeš tačan `Refused to load…` red — dopuni odgovarajuću direktivu.

### `.env`

```bash
nano ~/mreza-anketa/.env
```

```
POSTGRES_PASSWORD=ZAMENI
SESSION_SECRET=ZAMENI
INITIAL_ADMIN_EMAILS=tvoj.email@example.rs
INITIAL_ADMIN_PASSWORD=privremena-jaka-lozinka-min-12-chars
```

Generiši secrete:

```bash
echo "POSTGRES_PASSWORD: $(openssl rand -base64 32 | tr -d '/+=' | head -c 32)"
echo "SESSION_SECRET: base64:$(openssl rand -base64 32)"
```

Iskopiraj u `.env`, pa zaključaj fajl:

```bash
chmod 600 ~/mreza-anketa/.env
```

---

## 4. Pokreni

```bash
cd ~/mreza-anketa
docker compose up --build -d
docker compose logs -f api
```

Prvi build traje ~3–5 min. Kad u logu vidiš:

```
INFO listening addr=:8080
INFO bootstrap admin: password set email=tvoj.email@example.rs
```

CTRL+C iz loga (servisi rade u pozadini). Caddy sam uzima Let's Encrypt
sertifikat — traje par sekundi.

**Test:**

```bash
curl https://mreza.example.rs/healthz
```

Otvori u browseru `https://mreza.example.rs` — vidi se forma.

---

## 5. Prvi login (OBAVEZNO)

1. Otvori `https://mreza.example.rs/admin/login`
2. Uloguj se sa `INITIAL_ADMIN_EMAILS` + `INITIAL_ADMIN_PASSWORD` iz `.env`
3. Klik **Promeni lozinku** → postavi novu
4. **Obriši `INITIAL_ADMIN_PASSWORD` iz `.env` na serveru:**
   ```bash
   nano ~/mreza-anketa/.env
   # Postavi: INITIAL_ADMIN_PASSWORD=
   docker compose up -d
   ```
   Bez ovog koraka svaki restart vraća staru lozinku.

---

## 6. Smoke test (5 minuta posle deploya)

1. **Servisi rade:**
   ```bash
   docker compose ps      # db, api, caddy — svi "running" / "healthy"
   ```

2. **Migracije prošle do verzije 3:**
   ```bash
   docker compose exec db psql -U mreza mreza_anketa \
     -c "SELECT version, dirty FROM schema_migrations;"
   # Treba: version=3, dirty=f
   ```

3. **Javna forma radi:** otvori `https://mreza.example.rs/`, popuni test
   prijavu (izaberi bar jednu ulogu i par mreža) i pošalji → vodi te na
   stranicu zahvalnice.

4. **Prijava se vidi u adminu:** `/admin` → **Prijave**. Proveri filtere:
   po **ulozi**, po **društvenoj mreži**, **samo veći domet**, i po datumu.

5. **CSV export radi:** klik **Izvezi CSV** → fajl se preuzima, otvori ga u
   Excel-u i proveri da su naša slova (č, ć, š, ž, đ) ispravna.

6. **Rate limit radi:** pošalji 4 prijave zaredom sa istog uređaja — četvrta
   treba da bude odbijena porukom da sačekaš minut.

Ako nešto padne, prvo `docker compose logs api`, pa sekcija **Ako nešto pukne**.

Posle uspešnog testa obriši test prijave:

```bash
docker compose exec db psql -U mreza mreza_anketa \
  -c "DELETE FROM campaign_submissions WHERE name='TVOJE_TEST_IME';"
```

---

## 7. Backup baze (svaki dan)

```bash
nano ~/mreza-anketa/backup.sh
```

```bash
#!/bin/bash
set -e
TS=$(date +%Y%m%d_%H%M%S)
cd /home/deploy/mreza-anketa
docker compose exec -T db pg_dump -U mreza mreza_anketa | gzip > backups/db_$TS.sql.gz
find backups -name "db_*.sql.gz" -mtime +14 -delete
```

```bash
chmod +x ~/mreza-anketa/backup.sh
crontab -e
# Dodaj:
0 3 * * * /home/deploy/mreza-anketa/backup.sh >> /home/deploy/mreza-anketa/backups/backup.log 2>&1
```

Test ručno:

```bash
~/mreza-anketa/backup.sh
ls -lh ~/mreza-anketa/backups/
```

Restore:

```bash
gunzip -c ~/mreza-anketa/backups/db_DATUM.sql.gz | \
  docker compose exec -T db psql -U mreza mreza_anketa
```

> Baza sadrži lične podatke (imena, telefone, email adrese). Backup fajlovi
> zaslužuju isti tretman kao i sama baza — ne ostavljaj ih na deljenom disku
> i ne šalji ih nešifrovane.

---

## 8. Update na novu verziju

```bash
ssh deploy@TVOJ_IP
cd ~/mreza-anketa/src
git pull
cd ~/mreza-anketa
docker compose up --build -d
docker compose logs -f api   # proveri migracije + "listening"
```

DB migracije se primenjuju automatski pri startu backend-a.

---

## 9. Korisne komande

```bash
# Logovi backend-a (uživo)
docker compose logs -f api

# Restart pojedinačnog servisa
docker compose restart api

# Direktan psql
docker compose exec db psql -U mreza mreza_anketa

# Broj prijava
docker compose exec db psql -U mreza mreza_anketa -c "SELECT count(*) FROM campaign_submissions;"

# Prijave po ulozi
docker compose exec db psql -U mreza mreza_anketa -c \
  "SELECT jsonb_array_elements_text(roles) AS uloga, count(*) FROM campaign_submissions GROUP BY 1 ORDER BY 2 DESC;"

# Prijave po mreži
docker compose exec db psql -U mreza mreza_anketa -c \
  "SELECT jsonb_array_elements_text(networks) AS mreza, count(*) FROM campaign_submissions GROUP BY 1 ORDER BY 2 DESC;"

# Stop / start
docker compose down
docker compose up -d
```

---

## Ako nešto pukne

**Backend ne startuje, log kaže "dirty migration":**
```bash
docker compose exec db psql -U mreza mreza_anketa -c "UPDATE schema_migrations SET dirty=false;"
docker compose restart api
```

**Caddy ne uzima sertifikat:**
- Proveri DNS: `nslookup mreza.example.rs`
- Proveri portove: `sudo ufw status`
- Log: `docker compose logs caddy`

**Svi posetioci dobijaju „previše pokušaja":**
- Najverovatnije `TRUST_PROXY_HEADERS` nije `"true"`, pa backend vidi sve
  zahteve kao da dolaze sa IP-a Caddy kontejnera i deli jedan bucket na sve.
- Proveri: `docker compose exec api env | grep TRUST_PROXY_HEADERS`

**Zaboravio si admin lozinku:**
- Vrati u `.env`: `INITIAL_ADMIN_PASSWORD=nova-lozinka`
- `docker compose up -d` → uloguj se → promeni lozinku → obriši red iz `.env`
