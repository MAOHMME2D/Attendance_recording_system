@echo off
setlocal
cd /d "%~dp0"

echo ========================================================
echo       Stopping Smart Attendance System...
echo ========================================================
echo.

echo [*] Stopping services and freeing ports 3000 and 3001...
powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort 3000, 3001 -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }" >nul 2>&1

echo.
echo ========================================================
echo   [OK] All services stopped successfully.
echo ========================================================
echo.
pause

