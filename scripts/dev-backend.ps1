<#
.SYNOPSIS
  Ucita .env i pokrene Go backend (cmd/rpcapi) na :8080.

.DESCRIPTION
  Reload-uje PATH, parsuje .env iz root projekta, exportuje varijable u trenutnu sesiju,
  proverava da je Postgres pokrenut, pa pokrece `go run ./cmd/rpcapi`.

  Backend ce primeniti migracije automatski i bootstrap-ovati admine iz INITIAL_ADMIN_EMAILS.
#>

$ErrorActionPreference = "Stop"

# Reload PATH (Scoop tools su u User PATH-u)
$env:Path = [System.Environment]::GetEnvironmentVariable("Path","User") + ";" + [System.Environment]::GetEnvironmentVariable("Path","Machine")

$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $projectRoot

$envPath = Join-Path $projectRoot ".env"

if (-not (Test-Path $envPath)) {
    Write-Host "[ERROR] .env ne postoji u $projectRoot" -ForegroundColor Red
    Write-Host "        Prvo pokreni: .\scripts\dev-env-init.ps1" -ForegroundColor Yellow
    exit 1
}

# Parse .env i postavi env vars
Get-Content $envPath | ForEach-Object {
    $line = $_.Trim()
    if ([string]::IsNullOrWhiteSpace($line) -or $line.StartsWith("#")) {
        return
    }
    $idx = $line.IndexOf("=")
    if ($idx -lt 1) { return }
    $key = $line.Substring(0, $idx).Trim()
    $val = $line.Substring($idx + 1).Trim()
    # Skini surrounding navodnike ako postoje
    if (($val.StartsWith('"') -and $val.EndsWith('"')) -or ($val.StartsWith("'") -and $val.EndsWith("'"))) {
        $val = $val.Substring(1, $val.Length - 2)
    }
    Set-Item -Path "Env:$key" -Value $val
}

Write-Host "[OK] .env ucitan ($((Get-Content $envPath | Where-Object { $_ -match '^[A-Z]' }).Count) varijabli)" -ForegroundColor Green

# Verifikuj Postgres
Write-Host ""
Write-Host "Proveravam Postgres..." -ForegroundColor Cyan
$pgCheck = pg_isready -h localhost -p 5434 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] Postgres nije dostupan na localhost:5434" -ForegroundColor Red
    Write-Host "        Pokreni: pg_ctl -D `"C:\Users\i.pantic\scoop\apps\postgresql\current\data`" -l `"C:\Users\i.pantic\scoop\apps\postgresql\current\data\logfile.txt`" start" -ForegroundColor Yellow
    exit 1
}
Write-Host "[OK] $pgCheck" -ForegroundColor Green

# Pokreni backend
Write-Host ""
Write-Host "Pokrecem backend na $env:HTTP_ADDR..." -ForegroundColor Cyan
Write-Host "  (CTRL+C za stop)" -ForegroundColor DarkGray
Write-Host ""

go run ./cmd/rpcapi
