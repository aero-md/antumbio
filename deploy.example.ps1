# Déploiement d'Antumbio vers un hôte Linux via SSH — TEMPLATE.
# Les chemins et le nom de service ci-dessous restent en `redsunsbio` : c'est l'infra
# déjà déployée, seul le nom du projet a changé.
#
# Copiez ce fichier vers `deploy.ps1` (ignoré par git) et renseignez vos valeurs :
# hôte SSH, chemin distant, nom du service systemd.
#
# Migrations : appliquées AUTOMATIQUEMENT à chaque déploiement (toutes les
# migrations/*.sql dans l'ordre, via bun scripts/migrate.mjs sur l'hôte). Idempotentes,
# donc rejouables sans risque. Utiliser -SkipMigrate pour les sauter exceptionnellement.
#
# Prérequis côté hôte : bun, un service systemd, et un .env (DATABASE_URL + VISITOR_SECRET)
# posé manuellement (jamais poussé par ce script).
#
# Usage :
#   .\deploy.ps1                       # build + deploy + migrations + restart service
#   .\deploy.ps1 -SkipBuild            # deploy seul (build/ doit exister)
#   .\deploy.ps1 -SkipMigrate          # ne pas appliquer les migrations
#   .\deploy.ps1 -PiHost user@host     # hôte alternatif

param(
    [string]$PiHost = "user@your-server",
    [string]$RemotePath = "/srv/redsunsbio",
    [string]$ServiceName = "redsunsbio",
    [switch]$SkipBuild,
    [switch]$SkipMigrate
)

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

if (-not $SkipBuild) {
    Write-Host "==> bun run build" -ForegroundColor Cyan
    bun run build
    if ($LASTEXITCODE -ne 0) { throw "Build a échoué" }
}

if (-not (Test-Path "build")) {
    throw "Dossier build/ introuvable - lance 'bun run build' avant ou retire -SkipBuild"
}

$tar = New-TemporaryFile
$tarPath = $tar.FullName

# Éléments à embarquer dans le tarball (chemins relatifs au repo).
# users/ contient les pages — c'est lu au runtime via fs.readFile, donc indispensable.
# scripts/ contient le runner de migrations (migrate.mjs) lancé côté hôte.
$include = @("build", "package.json", "bun.lock", "users", "migrations", "scripts")
$missing = $include | Where-Object { -not (Test-Path $_) }
if ($missing) { throw "Entrées manquantes : $($missing -join ', ')" }

try {
    Write-Host "==> Création du tarball ($($include -join ', '))" -ForegroundColor Cyan
    tar -czf $tarPath $include
    if ($LASTEXITCODE -ne 0) { throw "tar a échoué" }

    $size = [math]::Round((Get-Item $tarPath).Length / 1KB, 1)
    Write-Host "    -> $size Ko compressés" -ForegroundColor DarkGray

    Write-Host "==> Upload vers ${PiHost}:${RemotePath}" -ForegroundColor Cyan
    scp $tarPath "${PiHost}:/tmp/redsunsbio-deploy.tar.gz"
    if ($LASTEXITCODE -ne 0) { throw "scp a échoué" }

    Write-Host "==> Extraction distante + install deps runtime" -ForegroundColor Cyan
    # On préserve .env (secrets) et node_modules existants pour gagner du temps si lockfile inchangé.
    $remoteScript = @"
set -e
mkdir -p '$RemotePath'
cd '$RemotePath'
# wipe sauf .env et node_modules (recréés au besoin)
find . -mindepth 1 -maxdepth 1 ! -name .env ! -name node_modules -exec rm -rf {} +
tar -xzf /tmp/redsunsbio-deploy.tar.gz -C '$RemotePath'
rm /tmp/redsunsbio-deploy.tar.gz
bun install --production --frozen-lockfile
"@
    ssh $PiHost $remoteScript
    if ($LASTEXITCODE -ne 0) {
        Write-Host ""
        Write-Host "Hint: si 'Permission denied', lance cote hote :" -ForegroundColor Yellow
        Write-Host "      sudo chown -R $($PiHost.Split('@')[0]):$($PiHost.Split('@')[0]) $RemotePath" -ForegroundColor Yellow
        Write-Host ""
        throw "Extraction/install distant a échoué"
    }

    # Migrations appliquées AVANT le restart : le schéma est prêt quand le nouveau code
    # prend le trafic. Migrations additives + idempotentes → l'ancien code (encore en vie
    # jusqu'au restart) tolère le nouveau schéma sans souci.
    if (-not $SkipMigrate) {
        Write-Host "==> Application des migrations (bun, .env distant)" -ForegroundColor Cyan
        # On source .env explicitement (DATABASE_URL) en plus de l'auto-load Bun, par robustesse.
        ssh $PiHost "set -e; cd '$RemotePath'; set -a; . ./.env; set +a; bun scripts/migrate.mjs"
        if ($LASTEXITCODE -ne 0) { throw "Migration distante a échoué" }
    }
    else {
        Write-Host "==> Migrations ignorées (-SkipMigrate)" -ForegroundColor DarkGray
    }

    Write-Host "==> Restart service systemd '$ServiceName'" -ForegroundColor Cyan
    ssh $PiHost "sudo systemctl restart $ServiceName && sudo systemctl is-active $ServiceName"
    if ($LASTEXITCODE -ne 0) { throw "Restart service a échoué" }

    Write-Host "==> Done." -ForegroundColor Green
}
finally {
    Remove-Item $tarPath -ErrorAction SilentlyContinue
}
