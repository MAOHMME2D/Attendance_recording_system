@echo off
setlocal
cd /d "%~dp0"

echo ========================================================
echo       Attendance System - Create Update Package
echo ========================================================
echo.

echo [*] Ensuring latest standalone web assets are synced...
if exist "bin\node.exe" (
    "bin\node.exe" apps\web\copy-standalone-assets.js
) else (
    node apps\web\copy-standalone-assets.js
)

echo [*] Packaging compiled code and scripts into update.zip...
if exist "update.zip" del /f /q "update.zip"

tar.exe -a -c -f update.zip apps/api/dist apps/web/.next/standalone/apps/web/.next apps/web/.next/standalone/apps/web/server.js apps/web/.next/standalone/apps/web/package.json apps/web/.next/static apps/web/public apps/web/copy-standalone-assets.js Run_System.bat Stop_System.bat Update_System.bat update.ps1

if exist "update.zip" (
    echo.
    echo ========================================================
    echo   [SUCCESS] Update package created: update.zip
    echo   Size: ~ 2 MB
    echo.
    echo   Next steps:
    echo   1. Upload 'update.zip' to GitHub Releases, OR
    echo   2. Send 'update.zip' to professors via Telegram / Drive.
    echo ========================================================
) else (
    echo.
    echo [ERROR] Failed to create update.zip!
)
echo.
pause
