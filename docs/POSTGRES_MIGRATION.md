# PostgreSQL Migration (APPLIED)

This document previously described a *plan*. PostgreSQL is now the **runtime
database**. The cutover happened on this machine; the SQLite file remains
archived as a backup only.

## Current status

- **Runtime:** PostgreSQL 16.9, portable binaries managed inside the repository
  at `postgresql/` (git-ignored: binaries, `data/`, `wal/`, `logs/`), running
  as the Windows service **`PostgreSQL-Attendance`** (LocalSystem, automatic).
- **Schema:** `apps/api/prisma/schema.prisma` (provider `postgresql`),
  migrations in `apps/api/prisma/migrations/` (0001_init, 0002_online_foundation,
  0003_staff_management) — all applied via `prisma migrate deploy`.
- **Data:** copied from the archived SQLite file with
  `pnpm --filter @attendance/api run db:copy-sqlite-to-postgres`. Verified row
  counts per table: students 297, sections 11, lectures 4, attendance 151,
  QR tokens 297, staff users, audit logs, sessions — all matched, nothing
  deleted.
- **Accounts:** the one-time initial setup ran against PostgreSQL:
  `owner-test` (SYSTEM_OWNER), `head1` (HEAD_OF_DEPARTMENT, adopted with a new
  password and revoked old sessions), `registrar1` (REGISTRAR).
- **SQLite:** retained **only** as legacy tooling
  (`apps/api/prisma/sqlite/schema.prisma` with its generated client at
  `apps/api/generated/client-sqlite`, used by
  `scripts/apply-sqlite-phase1.ts` and nothing else). The old file
  `apps/api/prisma/attendance.db` is untouched.
- **Tests:** all 44 API tests now run against throwaway PostgreSQL databases
  created and dropped by the suites (they read `DATABASE_ADMIN_URL` from
  `apps/api/.env`).

## What changed

| Path | Role |
| --- | --- |
| `apps/api/prisma/schema.prisma` | PostgreSQL runtime schema (main). |
| `apps/api/prisma/migrations/` | PostgreSQL migrations (was `prisma/postgres/migrations/`). |
| `apps/api/prisma/sqlite/schema.prisma` | Legacy SQLite schema, generated client moved to `apps/api/generated/client-sqlite`. |
| `apps/api/src/prisma/database-url.ts` | Postgres-first; passes URLs through, no silent SQLite fallback. |
| `apps/api/scripts/migrate-sqlite-to-postgres.ts` | One-time verified data copy (kept for reference/rollback rebuilds). |
| `apps/api/package.json` | `db:migrate:postgres` = `prisma migrate deploy`; `db:generate` generates both clients. |
| `scripts/install_postgres.ps1` | Installs the portable PostgreSQL (binaries + initdb + start). |
| `scripts/start_postgres.bat` / `scripts/stop_postgres.bat` | Start/stop the bundled server. |
| `scripts/start_api.bat` | Starts PostgreSQL first, then the API. |
| `apps/api/test/*.ts` | Test suites use unique throwaway PostgreSQL databases. |

## Day-to-day commands

PostgreSQL is installed as a **Windows service** `PostgreSQL-Attendance`
(runs as LocalSystem, StartType: Automatic) so the database starts by itself
when the machine boots — `start_postgres.bat` is no longer required in normal
use; `scripts\start_api.bat` only double-checks it before starting the API.

```powershell
# Manual control (needs an administrator window for start/stop)
net start PostgreSQL-Attendance
net stop  PostgreSQL-Attendance

# Apply pending migrations
pnpm --filter @attendance/api run db:migrate:postgres

# Tests (server must be running; suites create/drop their own databases)
pnpm --filter @attendance/api run test
```

## Roles and credentials policy

- `attendance_admin` — maintenance superuser (initdb), used only by scripts for
  creating/dropping test databases. Its password lives in `apps/api/.env`
  (`DATABASE_ADMIN_URL`), git-ignored. Never use it as runtime role.
- `attendance_user` — application role, owner of the `attendance` database,
  used in `DATABASE_URL`.
- Passwords were generated at cutover; keep them in `apps/api/.env` only and
  change them if they were shared. For production on another host, create the
  role/database there and point `DATABASE_URL` at it; never reuse the local
  password.

## Rollback

Nothing was deleted. To fall back to SQLite, restore
`DATABASE_URL=file:./attendance.db` with the **legacy sqlite client**
(re-generate `@prisma/client` from `prisma/sqlite/schema.prisma`) — but the
correct path forward is keeping PostgreSQL; the SQLite file should be treated
as backup-only.
