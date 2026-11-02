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

# 2. Look for update.zip (local first, then GitHub)
$zipPath = Join-Path $RepoRoot "update.zip"

if (-not (Test-Path $zipPath)) {
    if ($GitHubRepo -ne "") {
        Write-Host "[*] Checking for updates on GitHub ($GitHubRepo)..." -ForegroundColor Yellow
        try {
            [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
            $downloadUrl = "https://github.com/$GitHubRepo/releases/latest/download/update.zip"
            $client = New-Object System.Net.WebClient
            $client.DownloadFile($downloadUrl, $zipPath)
            Write-Host "[OK] Update downloaded successfully from GitHub." -ForegroundColor Green
        } catch {
            Write-Host "[!] No update found on GitHub (no release published yet, or no internet)." -ForegroundColor DarkYellow
        }
    }
}

if (-not (Test-Path $zipPath)) {
    Write-Host ""
    Write-Host "========================================================" -ForegroundColor Red
    Write-Host "   [!] No update file found (update.zip)" -ForegroundColor Red
    Write-Host ""
    Write-Host "   How to update:" -ForegroundColor White
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
