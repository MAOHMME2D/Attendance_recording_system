# PostgreSQL Backup and Restore

This document covers the Phase 1 PostgreSQL backup system for the attendance
system, the restore test procedure, and the Windows Task Scheduler setup.

The scripts never contain credentials. They read `DATABASE_URL` /
`DATABASE_ADMIN_URL` from the process environment first, then from the
gitignored `.env` files at the repository root and `apps/api/.env`. Passwords
are passed to `pg_dump`/`pg_restore` through `PGPASSWORD` for the child process
only and are redacted from log messages.

## Files

| File | Purpose |
| --- | --- |
| `scripts/backup/backup-postgres.ps1` | Creates a unique custom-format dump, validates it, writes the log, applies the retention policy (report-only by default). |
| `scripts/backup/restore-postgres-test.ps1` | Restores a dump into a dedicated throwaway database, compares counts with the source, runs integrity checks, and drops the test database. |
| `scripts/backup/register-backup-task.ps1` | Registers/removes the daily Windows Scheduled Task. |

## Backup location and name

Default destination:

```
%USERPROFILE%\AttendanceSystemBackups
```

Override it with `ATTENDANCE_BACKUP_ROOT` (environment or `.env`) or the
`-BackupRoot` parameter. The folder is outside the project directory and is not
committed to Git.

Each run creates:

```
attendance_YYYYMMDD_HHmmss.dump      # PostgreSQL custom format
logs\backup-YYYYMM.log               # success/failure log
```

The script writes to `<name>.dump.partial`, validates the file, and only then
renames it. Validation checks the `PGDMP` header, the file size, and that
`pg_restore --list` accepts the archive and finds table-data entries. The log
records the file name, size, table-data entry count, SHA-256 hash, and either
`SUCCESS` or `FAILED` with a sanitized error.

## Manual backup

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\backup\backup-postgres.ps1
```

With an explicit destination:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\backup\backup-postgres.ps1 `
  -BackupRoot "D:\AttendanceBackups"
```

Check the exit code (`0` = success, `1` = failure) and the latest log:

```powershell
Get-Content "$env:USERPROFILE\AttendanceSystemBackups\logs\backup-*.log" -Tail 20
Get-FileHash "$env:USERPROFILE\AttendanceSystemBackups\attendance_*.dump" -Algorithm SHA256
```

## Retention policy

Retention is **disabled by default**. No backup is deleted automatically in
this phase.

- `-RetentionDays 0` or the default keeps every backup.
- `ATTENDANCE_BACKUP_RETENTION_DAYS` (or `-RetentionDays N`) sets the period.
- Without `-ApplyRetention`, the script only logs which files **would** be
  deleted (dry run). Do not enable `-ApplyRetention` until the retention period
  is approved.

## Windows Task Scheduler

Run the registration script from an elevated PowerShell window:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\backup\register-backup-task.ps1
```

Defaults:

- Task name: `AttendanceSystem-Postgres-Backup`
- Schedule: daily at `02:00`
- Account: the current Windows user, runs only while that user is logged on
- Destination: `%USERPROFILE%\AttendanceSystemBackups`

Custom time/destination:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\backup\register-backup-task.ps1 `
  -At "01:30" -BackupRoot "D:\AttendanceBackups"
```

Verify and run once manually:

```powershell
Get-ScheduledTask -TaskName "AttendanceSystem-Postgres-Backup" | Format-List
Get-ScheduledTaskInfo -TaskName "AttendanceSystem-Postgres-Backup"
Start-ScheduledTask -TaskName "AttendanceSystem-Postgres-Backup"
Get-Content "$env:USERPROFILE\AttendanceSystemBackups\logs\backup-*.log" -Tail 20
```

Remove the task:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\backup\register-backup-task.ps1 -Unregister
```

For a server that must run backups while no user is logged on, register the
task with a dedicated Windows service account and "Run whether user is logged
on or not". That account needs read access to the project `.env` and write
access to the backup folder. Do not store the PostgreSQL password in the task
action.

## Restore test

The restore script refuses to run unless:

- the target name matches `attendance_restore_test_<suffix>`;
- the target differs from the production `DATABASE_URL` database;
- `-IUnderstandThisIsATestDatabase` is supplied.

It reads the production database only for `SELECT count(*)` comparisons. It
never writes to it.

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\backup\restore-postgres-test.ps1 `
  -BackupFile "$env:USERPROFILE\AttendanceSystemBackups\attendance_YYYYMMDD_HHmmss.dump" `
  -IUnderstandThisIsATestDatabase
```

What it verifies:

- row counts for `Student`, `Section`, `Lecture`, `AttendanceRecord`,
  `StudentQrToken`, `StaffUser`, `AuditLog`, `SystemSetting`, and
  `_prisma_migrations` match the source;
- foreign-key and index counts match the source;
- no attendance row points to a missing lecture/student;
- no QR row points to a missing student;
- student QR tokens and lecture QR values are unique;
- students with more than one active QR token are reported (not modified).

The report is printed and saved next to the backup as
`restore-report-YYYYMMDD_HHmmss.txt`. Keep `-KeepTestDatabase` to inspect the
restored database; otherwise the test database is dropped.

## Verified restore run

On 2026-11-06 the restore test ran on
`attendance_20261106_151204.dump` (SHA-256
`1CD10F61B692B6CEB104ED2E77645AD9EEFC3DE52DDE8C213D07F193885A193E`) and
returned **PASS** with exit code `0`. The test database
`attendance_restore_test_20261106_151306` was dropped automatically.

All nine table counts matched the source: `Student` 297, `Section` 11,
`Lecture` 4, `AttendanceRecord` 151, `StudentQrToken` 297, `StaffUser` 4,
`AuditLog` 24, `SystemSetting` 1, `_prisma_migrations` 3. The restored copy had
the same 8 foreign keys and 25 indexes, with zero orphan rows, zero duplicate
student tokens, zero duplicate lecture QR values, and zero students with
multiple active QR tokens.

Report file:
`%USERPROFILE%\AttendanceSystemBackups\restore-report-20261106_151306.txt`.
Full details are in `docs/PHASE1_FINAL_FIXES_REPORT.md`. A restore is only
considered successful when that report says PASS and the script exited with
code `0`.
