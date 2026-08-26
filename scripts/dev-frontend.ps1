<#
.SYNOPSIS
  Pokrece Vite dev server (React frontend) na :5173.

.DESCRIPTION
  Reload-uje PATH, proverava da node_modules postoji (instalira ako fali),
  pa pokrece `npm run dev`. Vite proxy preusmerava /mreza.v1.* i /auth na backend (:8080).
#>

$ErrorActionPreference = "Stop"

# Reload PATH
$env:Path = [System.Environment]::GetEnvironmentVariable("Path","User") + ";" + [System.Environment]::GetEnvironmentVariable("Path","Machine")

$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $projectRoot

# Instaliraj deps ako fali
if (-not (Test-Path "node_modules")) {
    Write-Host "node_modules ne postoji - instaliram (npm install)..." -ForegroundColor Cyan
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[ERROR] npm install pao" -ForegroundColor Red
        exit 1
    }
}

Write-Host ""
Write-Host "Pokrecem Vite dev server na http://localhost:5173..." -ForegroundColor Cyan
Write-Host "  Public anketa: http://localhost:5173/" -ForegroundColor DarkGray
Write-Host "  Admin panel:   http://localhost:5173/admin" -ForegroundColor DarkGray
Write-Host "  (CTRL+C za stop)" -ForegroundColor DarkGray
Write-Host ""

npm run dev
