@echo off
cd /d "%~dp0.."
title Attendance System - Web
set PORT=3000
set API_PORT=3001
set "NODE_PATH=%~dp0..\node_modules;%~dp0..\apps\web\.next\standalone\node_modules;%~dp0..\apps\web\.next\standalone\apps\web\node_modules"

set "WEB_ENTRY="
if exist "%~dp0..\apps\web\.next\standalone\apps\web\server.js" (
    set "WEB_ENTRY=apps\web\.next\standalone\apps\web\server.js"
) else if exist "%~dp0..\apps\web\.next\standalone\server.js" (
    set "WEB_ENTRY=apps\web\.next\standalone\server.js"
)

if exist "%~dp0..\bin\node.exe" (
    "%~dp0..\bin\node.exe" %WEB_ENTRY%
) else (
    node %WEB_ENTRY%
)

if errorlevel 1 pause

