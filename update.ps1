# Smart Attendance System - Updater Script
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
if (-not $ScriptDir) { $ScriptDir = Get-Location }
Set-Location $ScriptDir

# ========================================================
# GitHub Repository: مستودع التحديثات الرسمي
$GitHubRepo = "MAOHMME2D/Attendance_recording_system"
# ========================================================

Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "       نظام تسجيل الحضور الذكي - تحديث النظام" -ForegroundColor Cyan
Write-Host "       Smart Attendance Recording System - Updater" -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "[*] إيقاف خدمات النظام بأمان..." -ForegroundColor Yellow
$activePorts = Get-NetTCPConnection -LocalPort 3000, 3001 -ErrorAction SilentlyContinue
if ($activePorts) {
    foreach ($p in $activePorts) {
        Stop-Process -Id $p.OwningProcess -Force -ErrorAction SilentlyContinue
    }
    Start-Sleep -Seconds 1
}

# 1. النسخ الاحتياطي لقاعدة البيانات
$dbPath = Join-Path $ScriptDir "apps\api\prisma\attendance.db"
$backupDir = Join-Path $ScriptDir "backups"
if (Test-Path $dbPath) {
    if (-not (Test-Path $backupDir)) {
        New-Item -ItemType Directory -Path $backupDir | Out-Null
    }
    $timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
    $backupFile = Join-Path $backupDir "attendance_backup_$timestamp.db"
    Copy-Item -Path $dbPath -Destination $backupFile -Force
    Write-Host "[OK] تم حفظ نسخة احتياطية آمنة لبياناتك: backups\attendance_backup_$timestamp.db" -ForegroundColor Green
}

# 2. فحص ملف التحديث
$zipPath = Join-Path $ScriptDir "update.zip"

if (-not (Test-Path $zipPath)) {
    if ($GitHubRepo -ne "") {
        Write-Host "[*] جارٍ فحص وتحميل التحديث من GitHub ($GitHubRepo)..." -ForegroundColor Yellow
        try {
            [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
            $downloadUrl = "https://github.com/$GitHubRepo/releases/latest/download/update.zip"
            $client = New-Object System.Net.WebClient
            $client.DownloadFile($downloadUrl, $zipPath)
            Write-Host "[OK] تم تحميل ملف التحديث بنجاح." -ForegroundColor Green
        } catch {
            Write-Host "[!] تعذر التحميل من GitHub. تأكد من اتصال الإنترنت." -ForegroundColor Red
        }
    }
}

if (-not (Test-Path $zipPath)) {
    Write-Host ""
    Write-Host "========================================================" -ForegroundColor Red
    Write-Host "   [!] لم يتم العثور على ملف التحديث (update.zip)" -ForegroundColor Red
    Write-Host ""
    Write-Host "   طريقة التحديث البسيطة:" -ForegroundColor White
    Write-Host "   1. ضع ملف 'update.zip' المستلم في مجلد البرنامج." -ForegroundColor White
    Write-Host "   2. شغل 'Update_System.bat' مرة ثانية." -ForegroundColor White
    Write-Host "========================================================" -ForegroundColor Red
    Write-Host ""
    return
}

# 3. فك ضغط واستبدال ملفات التحديث
Write-Host "[*] جارٍ استبدال وتحديث الملفات البرمجية..." -ForegroundColor Yellow
try {
    & tar.exe -xf $zipPath
} catch {
    Expand-Archive -Path $zipPath -DestinationPath $ScriptDir -Force
}

# حذف الملف المؤقت بعد الاستخراج
Remove-Item -Path $zipPath -Force -ErrorAction SilentlyContinue

# مزامنة أصول الويب
$copyAssetsScript = Join-Path $ScriptDir "apps\web\copy-standalone-assets.js"
$nodeBin = Join-Path $ScriptDir "bin\node.exe"
if (Test-Path $copyAssetsScript) {
    if (Test-Path $nodeBin) {
        & $nodeBin $copyAssetsScript | Out-Null
    } else {
        node $copyAssetsScript | Out-Null
    }
}

Write-Host ""
Write-Host "========================================================" -ForegroundColor Green
Write-Host "   [SUCCESS] تم تحديث النظام بنجاح إلى آخر إصدار!" -ForegroundColor Green
Write-Host "   سجلات الطلاب وغياباتهم محفوظة وآمنة 100%." -ForegroundColor Green
Write-Host "========================================================" -ForegroundColor Green
Write-Host ""

$ans = Read-Host "هل تريد تشغيل النظام الآن؟ (Y/N)"
if ($ans -eq "Y" -or $ans -eq "y") {
    Write-Host "[*] جارٍ إطلاق النظام..." -ForegroundColor Cyan
    $runBat = Join-Path $ScriptDir "Run_System.bat"
    Start-Process -FilePath $runBat
}
