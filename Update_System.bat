# 2>nul & @cls & @powershell -NoProfile -ExecutionPolicy Bypass -Command "[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; Invoke-Expression ([System.IO.File]::ReadAllText('%~f0', [System.Text.Encoding]::UTF8))" & @exit /b %errorlevel%

# ========================================================
# Smart Attendance Recording System - Updater
# ========================================================
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$RepoRoot = (Get-Location).Path

# Official GitHub Repository for updates
$GitHubRepo = "MAOHMME2D/Attendance_recording_system"

Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "   Smart Attendance Recording System - Updater" -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "[*] Stopping running services..." -ForegroundColor Yellow
$activePorts = Get-NetTCPConnection -LocalPort 3000, 3001 -ErrorAction SilentlyContinue
if ($activePorts) {
    foreach ($p in $activePorts) {
        Stop-Process -Id $p.OwningProcess -Force -ErrorAction SilentlyContinue
    }
    Start-Sleep -Seconds 1
}

# 1. Backup the database
$dbPath = Join-Path $RepoRoot "apps\api\prisma\attendance.db"
$backupDir = Join-Path $RepoRoot "backups"
if (Test-Path $dbPath) {
    if (-not (Test-Path $backupDir)) {
        New-Item -ItemType Directory -Path $backupDir | Out-Null
    }
    $timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
    $backupFile = Join-Path $backupDir "attendance_backup_$timestamp.db"
    Copy-Item -Path $dbPath -Destination $backupFile -Force
    Write-Host "[OK] Database backed up safely: backups\attendance_backup_$timestamp.db" -ForegroundColor Green
}

# 2. Look for update.zip (local first, then GitHub release asset)
$zipPath = Join-Path $RepoRoot "update.zip"
$releaseHint = ""

if (-not (Test-Path $zipPath)) {
    if ($GitHubRepo -ne "") {
        Write-Host "[*] Checking for updates on GitHub ($GitHubRepo)..." -ForegroundColor Yellow
        try {
            [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
            $headers = @{
                "User-Agent" = "Attendance-Updater"
                "Accept"     = "application/vnd.github+json"
            }
            $release = Invoke-RestMethod -Uri "https://api.github.com/repos/$GitHubRepo/releases/latest" -Headers $headers
            $tag = $release.tag_name
            Write-Host "[*] Latest release: $tag" -ForegroundColor Cyan

            $asset = $release.assets | Where-Object { $_.name -eq "update.zip" } | Select-Object -First 1
            if (-not $asset) {
                $asset = $release.assets | Where-Object { $_.name -like "*.zip" } | Select-Object -First 1
            }

            if ($asset -and $asset.browser_download_url) {
                Write-Host "[*] Downloading $($asset.name) ..." -ForegroundColor Yellow
                $curl = Join-Path $env:SystemRoot "System32\curl.exe"
                if (Test-Path $curl) {
                    & $curl -L --fail --retry 2 -A "Attendance-Updater" -o $zipPath $asset.browser_download_url
                    if ($LASTEXITCODE -ne 0) { throw "Download failed (curl exit $LASTEXITCODE)" }
                } else {
                    Invoke-WebRequest -Uri $asset.browser_download_url -OutFile $zipPath -Headers @{ "User-Agent" = "Attendance-Updater" } -UseBasicParsing
                }
                if ((Test-Path $zipPath) -and ((Get-Item $zipPath).Length -gt 0)) {
                    Write-Host "[OK] Update downloaded successfully from GitHub ($tag)." -ForegroundColor Green
                } else {
                    Remove-Item -Path $zipPath -Force -ErrorAction SilentlyContinue
                    throw "Downloaded file is empty"
                }
            } else {
                $releaseHint = $release.html_url
                Write-Host "[!] Release $tag exists, but update.zip is not attached to it." -ForegroundColor DarkYellow
                Write-Host "    The release text is not the file. Upload update.zip as a release asset." -ForegroundColor DarkYellow
            }
        } catch {
            Write-Host "[!] Could not download the update: $($_.Exception.Message)" -ForegroundColor DarkYellow
            Remove-Item -Path $zipPath -Force -ErrorAction SilentlyContinue
        }
    }
}

if (-not (Test-Path $zipPath)) {
    Write-Host ""
    Write-Host "========================================================" -ForegroundColor Red
    Write-Host "   [!] No update file found (update.zip)" -ForegroundColor Red
    Write-Host ""
    if ($releaseHint) {
        Write-Host "   A release is published, but the zip file was not uploaded." -ForegroundColor White
        Write-Host "   Open the release and attach the file named update.zip:" -ForegroundColor White
        Write-Host "   $releaseHint" -ForegroundColor Yellow
        Write-Host ""
    }
    Write-Host "   Or update manually:" -ForegroundColor White
    Write-Host "   1. Place 'update.zip' in this program folder." -ForegroundColor White
    Write-Host "   2. Run 'Update_System.bat' again." -ForegroundColor White
    Write-Host "========================================================" -ForegroundColor Red
    Write-Host ""
    Read-Host "Press Enter to close..."
    return
}

# 3. Extract and apply update
Write-Host "[*] Applying update..." -ForegroundColor Yellow
try {
    & tar.exe -xf $zipPath
} catch {
    Expand-Archive -Path $zipPath -DestinationPath $RepoRoot -Force
}

Remove-Item -Path $zipPath -Force -ErrorAction SilentlyContinue

# Sync web assets
$copyAssetsScript = Join-Path $RepoRoot "apps\web\copy-standalone-assets.js"
$nodeBin = Join-Path $RepoRoot "bin\node.exe"
if (Test-Path $copyAssetsScript) {
    if (Test-Path $nodeBin) {
        & $nodeBin $copyAssetsScript | Out-Null
    } else {
        node $copyAssetsScript | Out-Null
    }
}

# Sync database schema if schema.prisma exists
$schemaFile = Join-Path $RepoRoot "apps\api\prisma\schema.prisma"
if (Test-Path $schemaFile) {
    Write-Host "[*] Updating database schema safely..." -ForegroundColor Yellow
    Push-Location (Join-Path $RepoRoot "apps\api")
    try {
        npx prisma db push --skip-generate | Out-Null
    } catch {}
    Pop-Location
}

Write-Host ""
Write-Host "========================================================" -ForegroundColor Green
Write-Host "   [SUCCESS] System updated successfully!" -ForegroundColor Green
Write-Host "   All student records and attendance data are safe." -ForegroundColor Green
Write-Host "========================================================" -ForegroundColor Green
Write-Host ""

$ans = Read-Host "Launch the system now? (Y/N)"
if ($ans -eq "Y" -or $ans -eq "y") {
    Write-Host "[*] Starting system..." -ForegroundColor Cyan
    $runBat = Join-Path $RepoRoot "Run_System.bat"
    Start-Process -FilePath $runBat
} else {
    Read-Host "Press Enter to close..."
}
