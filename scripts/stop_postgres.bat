@echo off
cd /d "%~dp0.."
sc query PostgreSQL-Attendance >nul 2>nul
if not errorlevel 1 (
    sc query PostgreSQL-Attendance | findstr /C:"RUNNING" >nul
    if errorlevel 1 (
        echo [*] PostgreSQL service is not running.
        exit /b 0
    )
    net stop PostgreSQL-Attendance
    exit /b %errorlevel%
)

rem --- No service installed: stop a manual portable instance ---
if not exist postgresql\bin\pg_ctl.exe (
    echo [!] PostgreSQL is not installed in this project folder.
    exit /b 1
)
postgresql\bin\pg_ctl.exe -D postgresql\data -l postgresql\logs\pg.log status >nul 2>nul
if %errorlevel%==0 (
    postgresql\bin\pg_ctl.exe -D postgresql\data stop -m fast
) else (
    echo [*] PostgreSQL is not running.
)
