@echo off
cd /d "%~dp0.."
sc query PostgreSQL-Attendance >nul 2>nul
if not errorlevel 1 (
    sc query PostgreSQL-Attendance | findstr /C:"RUNNING" >nul
    if not errorlevel 1 (
        echo [*] PostgreSQL service is already running.
        exit /b 0
    )
    echo [*] Starting PostgreSQL service ...
    net start PostgreSQL-Attendance
    if errorlevel 1 (
        echo [!] Could not start the service ^(needs an administrator window^).
        exit /b 1
    )
    exit /b 0
)

rem --- No service installed: fallback to manual portable start ---
if not exist postgresql\bin\pg_ctl.exe (
    echo [!] PostgreSQL is not installed in this project folder.
    echo     Run: scripts\install_postgres.ps1  ^(see docs\POSTGRES_MIGRATION.md^)
    exit /b 1
)
if not exist postgresql\data\PG_VERSION (
    echo [!] PostgreSQL data directory is missing: run scripts\install_postgres.ps1
    exit /b 1
)
postgresql\bin\pg_ctl.exe -D postgresql\data -l postgresql\logs\pg.log status >nul 2>nul
if %errorlevel%==3 (
    postgresql\bin\pg_ctl.exe -D postgresql\data -l postgresql\logs\pg.log start
) else if %errorlevel%==0 (
    echo [*] PostgreSQL is already running.
) else (
    echo [!] pg_ctl status failed with code %errorlevel% ^(check postgresql\logs\pg.log^)
    exit /b %errorlevel%
)
