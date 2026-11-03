@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"

echo ========================================================
echo       Starting Smart Attendance Recording System...
echo ========================================================
echo.

rem Select Node.js binary (bundled portable or system)
if exist "%~dp0bin\node.exe" (
    set "NODE_BIN=%~dp0bin\node.exe"
    echo [*] Using bundled Portable Node.js...
) else (
    set "NODE_BIN=node"
    echo [*] Using system Node.js...
)

echo [*] Freeing ports 3000 and 3001...
powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort 3000, 3001 -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }" >nul 2>&1

echo [*] Starting API Server on port 3001 (minimized in taskbar)...
start "Attendance System - API" /min cmd /k "title Attendance System - API && set API_PORT=3001 && set NODE_PATH=%~dp0node_modules;%~dp0apps\api\node_modules && "!NODE_BIN!" apps\api\dist\main.js"

echo [*] Starting Web Dashboard on port 3000 (minimized in taskbar)...
start "Attendance System - Web" /min cmd /k "title Attendance System - Web && set PORT=3000 && set API_PORT=3001 && set NODE_PATH=%~dp0node_modules;%~dp0apps\web\.next\standalone\node_modules;%~dp0apps\web\.next\standalone\apps\web\node_modules && "!NODE_BIN!" apps\web\.next\standalone\apps\web\server.js"

echo [*] Waiting for services to initialize...
ping 127.0.0.1 -n 4 >nul

echo [*] Opening Browser at http://localhost:3000 ...
start http://localhost:3000

echo.
echo ========================================================
echo   System is now running successfully!
echo   Dashboard URL: http://localhost:3000
echo.
echo   Keep this window open while using the system.
echo   To stop the system, close this window or run:
echo   Stop_System.bat
echo ========================================================
echo.
pause
