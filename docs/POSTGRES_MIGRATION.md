# PostgreSQL Migration (APPLIED)

This document previously described a *plan*. PostgreSQL is now the **runtime
database**, and the deployable project targets a hosted PostgreSQL instance.

## Current status

- **Runtime:** PostgreSQL is required by the API. The current machine keeps a
  local PostgreSQL under `postgresql/` (git-ignored: binaries, `data/`, `wal/`,
  `logs/`) for its existing data. That folder is local-only and must not be
  uploaded to hosting; production uses the PostgreSQL service/connection string
  provided by the host.
- **Schema:** `apps/api/prisma/schema.prisma` (provider `postgresql`),
  migrations in `apps/api/prisma/migrations/` (0001_init, 0002_online_foundation,
  0003_staff_management) — all applied via `prisma migrate deploy`.
- **Data:** copied once from the archived SQLite file and verified: students
  297, sections 11, lectures 4, attendance 151, QR tokens 297, staff users,
  audit logs, sessions — all matched, nothing deleted. The one-time copy script
  was removed after verification (it remains in git history).
- **Accounts:** the one-time initial setup ran against PostgreSQL:
  `owner-test` (SYSTEM_OWNER), `head1` (HEAD_OF_DEPARTMENT, adopted with a new
  password and revoked old sessions), `registrar1` (REGISTRAR).
- **SQLite:** no longer part of the project. The legacy schema, generated
  client, SQL migration files, both conversion scripts and the archived SQLite
  files (`apps/api/prisma/attendance.db`, `backups/*.db`) were removed during
  the pre-Phase-2 cleanup after an explicit decision. PostgreSQL backups are
  handled by `scripts/backup/backup-postgres.ps1`.
- **Tests:** all 51 API tests now run against throwaway PostgreSQL databases
  created and dropped by the suites (they read `DATABASE_ADMIN_URL` from
  `apps/api/.env`).

## What changed

| Path | Role |
| --- | --- |
| `apps/api/prisma/schema.prisma` | PostgreSQL runtime schema (main). |
| `apps/api/prisma/migrations/` | PostgreSQL migrations (was `prisma/postgres/migrations/`). |
| `apps/api/src/prisma/database-url.ts` | Postgres-first; passes URLs through, no silent SQLite fallback. |
| `apps/api/package.json` | `db:migrate:postgres` = `prisma migrate deploy`; `db:generate` generates the PostgreSQL client only. |
| `apps/api/test/*.ts` | Test suites use unique throwaway PostgreSQL databases. |

## Hosting deployment

The local Windows helpers (`bin/`, portable Node.js, `Run_System.bat`,
`Update_System.bat`, `Create_Update_Package.bat`, and the `start_*.bat` /
`install_postgres.ps1` scripts) were removed: they were only for running the
system on the professor's machine. The hosting provider supplies Node.js and
PostgreSQL.

```bash
# On the hosting server, with DATABASE_URL and DATABASE_ADMIN_URL set:
pnpm install --frozen-lockfile
pnpm db:generate
pnpm db:migrate:deploy
pnpm build

# API
pnpm --filter @attendance/api run start:prod

# Web
pnpm --filter @attendance/web run start
```

Local-only paths that must never be uploaded: `postgresql/`, `node_modules/`,
`.next/`, `dist/`, `.env`, and `apps/api/.env`.

```bash
# Tests (a PostgreSQL server must be reachable; suites create/drop their own databases)
pnpm --filter @attendance/api run test
```

## Roles and credentials policy

- `attendance_admin` — maintenance superuser (initdb), used only by scripts for
  creating/dropping test databases. Its password lives in `apps/api/.env`
  (`DATABASE_ADMIN_URL`), git-ignored. Never use it as runtime role.
- `attendance_user` — application role, owner of the `attendance` database,
  used in `DATABASE_URL`.
- Passwords were generated at cutover; keep them in the hosting environment
  variables only and change them if they were shared. Create the role/database
  on the hosting server and point `DATABASE_URL` at it; never reuse the local
  password.

## Rollback

The runtime path is PostgreSQL only. The legacy SQLite schema, its tooling and
the archived SQLite data files were removed. Falling back to SQLite is not
supported; restore from a PostgreSQL dump made by the backup scripts instead.
