@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0.."
title Attendance System - API
set API_PORT=3001
set "NODE_PATH=%~dp0..\node_modules;%~dp0..\apps\api\node_modules"

rem CORS is opt-in (no wildcards). If the operator did not configure origins in
rem .env/process env, allow only this machine's UI plus its LAN address so the
rem existing LAN usage keeps working. Production deployments must set
rem CORS_ORIGINS explicitly to their real HTTPS origin(s).
if not defined CORS_ORIGINS (
    for /f "usebackq delims=" %%i in (`powershell -NoProfile -Command "(Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue | Where-Object { $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254.*' } | Select-Object -First 1 -ExpandProperty IPAddress)"`) do set "LAN_IP=%%i"
    if defined LAN_IP (
        set "CORS_ORIGINS=http://localhost:3000,http://127.0.0.1:3000,http://!LAN_IP!:3000"
    ) else (
        set "CORS_ORIGINS=http://localhost:3000,http://127.0.0.1:3000"
    )
    echo [*] CORS origins: !CORS_ORIGINS!
)

call scripts\start_postgres.bat

if exist "%~dp0..\bin\node.exe" (
    "%~dp0..\bin\node.exe" apps\api\dist\main.js
) else (
    node apps\api\dist\main.js
)

if errorlevel 1 pause
