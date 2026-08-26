<#
.SYNOPSIS
  Interaktivno generise .env fajl za lokalni dev (Windows PowerShell).

.DESCRIPTION
  Pravi .env u root projektu sa razumnim default-ima. Pita te za:
    - INITIAL_ADMIN_EMAILS (email koji koristis za admin login)
    - INITIAL_ADMIN_PASSWORD (lozinka za prvi login, min 8 chars)
    - GOOGLE_OAUTH_CLIENT_ID / SECRET (opciono — preskoci za samo password login)

  Generise SESSION_SECRET automatski (32 random bajta, base64).
  Sve ostalo (DATABASE_URL, HTTP_ADDR, itd) ima default-e za lokalni Postgres na portu 5434.

  Mozes da pokrenes vise puta - pita pre overwrite.
#>

$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$envPath = Join-Path $projectRoot ".env"

Write-Host ""
Write-Host "Mreza anketa - dev .env setup" -ForegroundColor Cyan
Write-Host "Project root: $projectRoot" -ForegroundColor DarkGray
Write-Host ""

if (Test-Path $envPath) {
    $answer = Read-Host ".env vec postoji. Prepisati? (y/N)"
    if ($answer -ne "y" -and $answer -ne "Y") {
        Write-Host "Otkazano. Postojeci .env nije diran." -ForegroundColor Yellow
        exit 0
    }
}

# 1) SESSION_SECRET - random 32 bajta, base64
$bytes = New-Object byte[] 32
[System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
$sessionSecret = "base64:" + [Convert]::ToBase64String($bytes)
Write-Host "[OK] SESSION_SECRET generisan (32 random bajta)" -ForegroundColor Green

# 2) INITIAL_ADMIN_EMAILS
Write-Host ""
Write-Host "Email za admin pristup" -ForegroundColor Cyan
Write-Host "  (Komа-separated ako vise njih. Lowercase.)"
$adminEmail = Read-Host "Email (npr. ime.prezime@gmail.com ili admin@mreza.local)"
$adminEmail = $adminEmail.Trim().ToLower()

if ([string]::IsNullOrWhiteSpace($adminEmail)) {
    Write-Host "[WARN] Nije unesen email - admin bootstrap se preskace. Mozes dodati kasnije u .env." -ForegroundColor Yellow
    $adminEmail = ""
}

# 3) INITIAL_ADMIN_PASSWORD
$adminPassword = ""
if (-not [string]::IsNullOrWhiteSpace($adminEmail)) {
    Write-Host ""
    Write-Host "Inicijalna lozinka za $adminEmail" -ForegroundColor Cyan
    Write-Host "  Min 8 karaktera. Promenite je iz admin UI posle prvog login-a."
    Write-Host "  Enter (prazno) = preskoci (admin moze samo Google OAuth ako ga konfigurises ispod)."
    do {
        $adminPassword = Read-Host "Inicijalna lozinka"
        if ([string]::IsNullOrWhiteSpace($adminPassword)) {
            $adminPassword = ""
            break
        }
        if ($adminPassword.Length -lt 8) {
            Write-Host "[ERR] Mora bar 8 karaktera (uneto $($adminPassword.Length)). Pokusaj ponovo." -ForegroundColor Red
        }
    } while ($adminPassword.Length -gt 0 -and $adminPassword.Length -lt 8)
}

# 4) Google OAuth credentials (OPCIONO)
Write-Host ""
Write-Host "Google OAuth credentials (OPCIONO)" -ForegroundColor Cyan
Write-Host "  Preskoci ako koristis samo password login."
Write-Host "  Ako postavis, omogucujes login sa Gmail nalogom (uz password login)."
Write-Host ""
$clientId = Read-Host "GOOGLE_OAUTH_CLIENT_ID (Enter da preskocis)"
$clientSecret = ""
if (-not [string]::IsNullOrWhiteSpace($clientId)) {
    $clientSecret = Read-Host "GOOGLE_OAUTH_CLIENT_SECRET"
    Write-Host "[OK] OAuth credentials sacuvani" -ForegroundColor Green
} else {
    Write-Host "[INFO] Google OAuth disabled - moze se ukljuciti kasnije izmenom .env." -ForegroundColor DarkGray
    $clientId = ""
}

# 5) Generisi .env
$envContent = @"
# Generisano $(Get-Date -Format "yyyy-MM-dd HH:mm:ss") od scripts/dev-env-init.ps1
# Ovaj fajl je u .gitignore - nikad ga ne commituj.

# --- Backend (Go) ---

# Postgres konekcija (port 5434 jer su 5432/5433 zauzeti od WSL relay-a)
DATABASE_URL=postgres://postgres@localhost:5434/mreza_anketa_dev?sslmode=disable

# HTTP listen adresa
HTTP_ADDR=:8080

# CORS (prazno za dev - Vite proxy resava cross-origin)
CORS_ALLOWED_ORIGINS=

# --- Admin OAuth (Google) - OPCIONO ---
# Ako sva tri prazna -> Google login disabled, samo password login.

GOOGLE_OAUTH_CLIENT_ID=$clientId
GOOGLE_OAUTH_CLIENT_SECRET=$clientSecret
GOOGLE_OAUTH_CALLBACK_URL=http://localhost:5173/auth/google/callback

# --- Session ---

# Random 32+ bajta, koristi se za HMAC-potpis session cookie-ja
SESSION_SECRET=$sessionSecret

# --- Admin bootstrap ---

# Comma-separated lista emailova koji ce biti kreirani kao admin na startup-u (idempotent).
INITIAL_ADMIN_EMAILS=$adminEmail

# Inicijalna lozinka za sve INITIAL_ADMIN_EMAILS (min 8 chars). OVERWRITE-uje postojeci hash.
# Promenite iz admin UI posle prvog login-a; obrisete iz env-a posle.
INITIAL_ADMIN_PASSWORD=$adminPassword

# --- Frontend ---

# Public frontend URL - koristi se za OAuth redirect posle login-a
PUBLIC_BASE_URL=http://localhost:5173

# App environment: dev ili prod
APP_ENV=dev
"@

Set-Content -Path $envPath -Value $envContent -Encoding UTF8

Write-Host ""
Write-Host "[OK] .env kreiran: $envPath" -ForegroundColor Green
Write-Host ""
Write-Host "Sledeci koraci:" -ForegroundColor Cyan
Write-Host "  1. Pokreni backend:    .\scripts\dev-backend.ps1"
Write-Host "  2. (Novi terminal) Pokreni frontend:  .\scripts\dev-frontend.ps1"
Write-Host "  3. Otvori u browseru:  http://localhost:5173/admin/login"
if (-not [string]::IsNullOrWhiteSpace($adminPassword)) {
    Write-Host "  4. Prijavi se sa:      $adminEmail / [lozinka koju si uneo]" -ForegroundColor Green
}
Write-Host ""
