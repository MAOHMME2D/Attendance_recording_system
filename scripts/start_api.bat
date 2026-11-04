@echo off
cd /d "%~dp0.."
title Attendance System - API
set API_PORT=3001
set "NODE_PATH=%~dp0..\node_modules;%~dp0..\apps\api\node_modules"

if exist "%~dp0..\bin\node.exe" (
    "%~dp0..\bin\node.exe" apps\api\dist\main.js
) else (
    node apps\api\dist\main.js
)

if errorlevel 1 pause

