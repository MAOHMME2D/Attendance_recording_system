# 2>nul & @cls & @powershell -NoProfile -ExecutionPolicy Bypass -Command "$env:UPDATER_ROOT='%~dp0'; [Console]::OutputEncoding = [System.Text.Encoding]::UTF8; Invoke-Expression ([System.IO.File]::ReadAllText('%~f0', [System.Text.Encoding]::UTF8))" & @exit /b %errorlevel%

# ========================================================
# Smart Attendance Recording System - Updater
# ========================================================
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
# UpdaterBuild=2
if ($env:UPDATER_ROOT) {
    $RepoRoot = $env:UPDATER_ROOT.TrimEnd('\', '/')
} else {
    $RepoRoot = (Get-Location).Path
}
Set-Location -LiteralPath $RepoRoot
if (-not (Test-Path (Join-Path $RepoRoot "Run_System.bat"))) {
    Write-Host "[!] Update_System.bat must stay inside the program folder." -ForegroundColor Red
    Write-Host "    Current folder: $RepoRoot" -ForegroundColor Red
    Read-Host "Press Enter to close..."
    return
}

# Official GitHub Repository for updates
$GitHubRepo = "MAOHMME2D/Attendance_recording_system"

Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "   Smart Attendance Recording System - Updater" -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "[*] Program folder: $RepoRoot" -ForegroundColor Cyan
Write-Host "[*] Stopping running services..." -ForegroundColor Yellow
$listeners = netstat -ano | Select-String -Pattern ":(3000|3001)\s"
foreach ($line in $listeners) {
    $procId = ($line.ToString().Trim() -split '\s+')[-1]
    if ($procId -match '^\d+$' -and $procId -ne "0") {
        Stop-Process -Id ([int]$procId) -Force -ErrorAction SilentlyContinue
    }
}
Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" -ErrorAction SilentlyContinue | Where-Object {
    $_.CommandLine -and $_.CommandLine.Contains($RepoRoot)
} | ForEach-Object {
    Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
}
Start-Sleep -Seconds 1

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

# 3. Extract into a temp folder, then copy onto the program folder
Write-Host "[*] Applying update into:" -ForegroundColor Yellow
Write-Host "    $RepoRoot" -ForegroundColor Yellow
$extractRoot = Join-Path $RepoRoot ".update-tmp"
$applied = $false
$sameBuild = $false
try {
    if (Test-Path $extractRoot) {
        Remove-Item -LiteralPath $extractRoot -Recurse -Force
    }
    New-Item -ItemType Directory -Path $extractRoot | Out-Null

    & tar.exe -xf $zipPath -C $extractRoot
    if ($LASTEXITCODE -ne 0) {
        Expand-Archive -Path $zipPath -DestinationPath $extractRoot -Force
    }

    $entries = @(Get-ChildItem -LiteralPath $extractRoot -Force)
    $source = $extractRoot
    if ($entries.Count -eq 1 -and $entries[0].PSIsContainer -and (Test-Path (Join-Path $entries[0].FullName "apps"))) {
        $source = $entries[0].FullName
        Write-Host "[*] Zip has a root folder. Using: $($entries[0].Name)" -ForegroundColor Cyan
    }
    if (-not (Test-Path (Join-Path $source "apps"))) {
        throw "update.zip does not contain the program files (missing apps folder)."
    }

    $keepUpdater = $true
    $zipUpdater = Join-Path $source "Update_System.bat"
    if (Test-Path $zipUpdater) {
        $zipUpdaterText = [System.IO.File]::ReadAllText($zipUpdater)
        if ($zipUpdaterText -match "UpdaterBuild=(\d+)" -and [int]$Matches[1] -ge 2) {
            $keepUpdater = $false
        }
    }

    $oldBuild = Join-Path $RepoRoot "apps\web\.next\standalone\apps\web\.next\BUILD_ID"
    $newBuild = Join-Path $source "apps\web\.next\standalone\apps\web\.next\BUILD_ID"
    $oldId = if (Test-Path $oldBuild) { (Get-Content -LiteralPath $oldBuild -Raw).Trim() } else { "(none)" }
    $newId = if (Test-Path $newBuild) { (Get-Content -LiteralPath $newBuild -Raw).Trim() } else { "(none)" }
    Write-Host "[*] Installed build: $oldId" -ForegroundColor Cyan
    Write-Host "[*] Zip build:       $newId" -ForegroundColor Cyan

    $robocopyArgs = @(
        $source, $RepoRoot,
        "/E", "/R:2", "/W:1",
        "/NFL", "/NDL", "/NJH", "/NJS", "/NC", "/NS", "/NP",
        "/XD", "backups", "node_modules", ".git", ".update-tmp",
        "/XF", "attendance.db", "attendance.db-journal"
    )
    if ($keepUpdater) { $robocopyArgs += @("/XF", "Update_System.bat") }
    $copyLog = Join-Path $RepoRoot "update-copy.log"
    $robocopyArgs += @("/LOG:$copyLog")
    & robocopy.exe @robocopyArgs
    $copyExit = $LASTEXITCODE
    if ($copyExit -ge 8) {
        throw "Could not replace program files (robocopy exit $copyExit). Close the system and run the updater again."
    }

    $applied = $true
    Remove-Item -LiteralPath $zipPath -Force -ErrorAction SilentlyContinue
    if ($oldId -eq $newId -and $newId -ne "(none)") {
        $sameBuild = $true
        Write-Host "[!] Files were copied, but the zip build is the same as the installed build." -ForegroundColor DarkYellow
        Write-Host "    Rebuild the web and API, create a new update.zip, then upload it." -ForegroundColor DarkYellow
    } else {
        Write-Host "[OK] Program files replaced. Build $oldId -> $newId" -ForegroundColor Green
    }
} catch {
    Write-Host "[!] Update was not applied: $($_.Exception.Message)" -ForegroundColor Red
} finally {
    Remove-Item -LiteralPath $extractRoot -Recurse -Force -ErrorAction SilentlyContinue
}

if (-not $applied) {
    Write-Host ""
    Write-Host "update.zip was kept in the program folder so you can try again." -ForegroundColor Yellow
    Read-Host "Press Enter to close..."
    return
}

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

# Sync database schema if schema.prisma exists.
# npx from apps\api picks a broken local prisma folder. Use the real CLI at the program root.
$schemaFile = Join-Path $RepoRoot "apps\api\prisma\schema.prisma"
$schemaOk = $true
if (Test-Path $schemaFile) {
    $prismaJs = Join-Path $RepoRoot "node_modules\prisma\build\index.js"
    if (Test-Path $prismaJs) {
        Write-Host "[*] Updating database schema safely..." -ForegroundColor Yellow
        $nodeCmd = if (Test-Path $nodeBin) { $nodeBin } else { "node" }
        & $nodeCmd $prismaJs db push --skip-generate --schema $schemaFile
        if ($LASTEXITCODE -ne 0) {
            $schemaOk = $false
            Write-Host "[!] Database schema was not changed. Existing records are still safe." -ForegroundColor DarkYellow
        } else {
            Write-Host "[OK] Database schema is up to date." -ForegroundColor Green
        }
    } else {
        Write-Host "[*] Prisma CLI not found. Schema step skipped." -ForegroundColor DarkYellow
    }
}

Write-Host ""
Write-Host "========================================================" -ForegroundColor $(if ($schemaOk -and -not $sameBuild) { "Green" } else { "Yellow" })
if (-not $schemaOk) {
    Write-Host "   [!] Files were copied, but the database schema step failed." -ForegroundColor Yellow
} elseif ($sameBuild) {
    Write-Host "   [!] No new version was installed." -ForegroundColor Yellow
    Write-Host "   This computer already has the same build as update.zip." -ForegroundColor Yellow
    Write-Host "   Rebuild web and API, then upload a new update.zip." -ForegroundColor Yellow
} else {
    Write-Host "   [SUCCESS] System updated successfully!" -ForegroundColor Green
    Write-Host "   All student records and attendance data are safe." -ForegroundColor Green
}
Write-Host "========================================================" -ForegroundColor $(if ($schemaOk -and -not $sameBuild) { "Green" } else { "Yellow" })
Write-Host ""

$ans = Read-Host "Launch the system now? (Y/N)"
if ($ans -eq "Y" -or $ans -eq "y") {
    Write-Host "[*] Starting system..." -ForegroundColor Cyan
    $runBat = Join-Path $RepoRoot "Run_System.bat"
    Start-Process -FilePath $runBat
} else {
    Read-Host "Press Enter to close..."
}
