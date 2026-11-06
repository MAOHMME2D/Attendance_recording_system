# Installs the bundled portable PostgreSQL into <repo>/postgresql:
#   1. binaries from postgresql-<ver>-windows-x64-binaries.zip (EDB)
#   2. initdb of the data directory with a superuser password prompt
#   3. start the server, then create the app role and database
#
# Usage (PowerShell):
#   powershell -ExecutionPolicy Bypass -File scripts\install_postgres.ps1 `
#     -Zip "C:\path\to\postgresql-16.9-1-windows-x64-binaries.zip"
# Then copy the printed DATABASE_URL / DATABASE_ADMIN_URL into apps/api/.env.
param(
    [Parameter(Mandatory = $true)][string] $Zip,
    [string] $Superuser = 'attendance_admin'
)

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
$pgRoot = Join-Path $repoRoot 'postgresql'
$dataDir = Join-Path $pgRoot 'data'
$logDir = Join-Path $pgRoot 'logs'
$extractDir = Join-Path $env:TEMP ("pg_extract_" + [guid]::NewGuid().ToString('N'))

if (-not (Test-Path $Zip)) { throw "Zip not found: $Zip" }

New-Item -ItemType Directory -Force $logDir | Out-Null

if (Test-Path (Join-Path $pgRoot 'bin\pg_ctl.exe')) {
    Write-Host "Binaries already present in $pgRoot - skipping extraction." -ForegroundColor Yellow
}
else {
    Write-Host "Extracting $Zip ..."
    Expand-Archive -Path $Zip -DestinationPath $extractDir -Force
    $folderName = (Get-ChildItem $extractDir | Select-Object -First 1).Name
    if (-not $folderName) { throw 'Unexpected zip layout' }
    if (Test-Path $pgRoot) { throw "$pgRoot already exists; please remove it first" }
    Move-Item (Join-Path $extractDir $folderName) $pgRoot
    Remove-Item $extractDir -Recurse -Force
}

if (-not $pgPass) {
    # Do not print the value; just require a strong one (-v matches size only).
    Write-Host "Choose a strong password for the PostgreSQL superuser '$Superuser':" -ForegroundColor Cyan
    do {
        $pgPass = Read-Host 'Password (min 12 chars, mixed case, digit, symbol)' -AsSecureString
        $plain = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
            [Runtime.InteropServices.Marshal]::SecureStringToBSTR($pgPass))
        $min12 = $plain.Length -ge 12
        $complexity = ($plain -cmatch '[A-Z]') -and ($plain -cmatch '[a-z]') -and ($plain -match '\d') -and ($plain -match '[^A-Za-z0-9]')
        if (-not ($min12 -and $complexity)) { Write-Host 'Too weak, try again.' -ForegroundColor Red }
    } while (-not ($min12 -and $complexity))
}

$pwFile = Join-Path $env:TEMP ("pg_pw_" + [guid]::NewGuid().ToString('N') + '.txt')
[IO.File]::WriteAllText($pwFile, $plain)

if (Test-Path (Join-Path $dataDir 'PG_VERSION')) {
    Write-Host "Data directory already initialized: $dataDir" -ForegroundColor Yellow
}
else {
    Write-Host 'Initializing data directory (UTF8, scram-sha-256) ...'
    & (Join-Path $pgRoot 'bin\initdb.exe') `
        -D $dataDir -U $Superuser --pwfile=$pwFile `
        -A scram-sha-256 -E UTF8 -X (Join-Path $pgRoot 'wal') | Out-Host
    if ($LASTEXITCODE -ne 0) { Remove-Item $pwFile -Force; throw 'initdb failed' }
}

Remove-Item $pwFile -Force
$plain = $null

Write-Host 'Starting PostgreSQL ...'
& (Join-Path $pgRoot 'bin\pg_ctl.exe') -D $dataDir -l (Join-Path $logDir 'pg.log') start | Out-Host
Start-Sleep -Seconds 2

Write-Host ''
Write-Host 'PostgreSQL is running on localhost:5432.'
Write-Host "Next: create the app role/database and copy DATABASE_URL / DATABASE_ADMIN_URL into apps/api/.env (see docs/POSTGRES_MIGRATION.md)."
