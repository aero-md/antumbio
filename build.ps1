# redsunsbio - Build & Run Script
# SvelteKit fullstack (adapter-node)

param(
    [switch]$Run,
    [string]$Env = "Development"
)

$ErrorActionPreference = "Stop"
$root = $PSScriptRoot

Write-Host "redsunsbio Build Script" -ForegroundColor Cyan
Write-Host ""

# 1. Install deps si node_modules absent
if (-not (Test-Path "$root/node_modules")) {
    Write-Host "Installing dependencies..." -ForegroundColor Yellow
    Push-Location $root
    bun install
    Pop-Location
}

# 2. Build SvelteKit
Write-Host "Building SvelteKit..." -ForegroundColor Yellow
Push-Location $root
bun run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "Build failed!" -ForegroundColor Red
    Pop-Location
    exit 1
}
Pop-Location
Write-Host "Build OK." -ForegroundColor Green

# 3. Run optionnel
if ($Run) {
    Write-Host ""
    Write-Host "Starting server ($Env)..." -ForegroundColor Yellow
    Push-Location $root
    if ($Env -eq "Production") {
        $env:NODE_ENV = "production"
        node build
    } else {
        bun run dev
    }
    Pop-Location
}
