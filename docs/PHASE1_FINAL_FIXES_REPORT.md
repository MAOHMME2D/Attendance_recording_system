# Phase 1 Final Review Fixes — Verification Report

Date: 2026-11-06
Branch: `online-foundation` at `29321b5` (working tree changes only)
Status: All final-review items implemented and verified. **Nothing was committed
or pushed.** Phase 2 was not started.

---

## 1. Scope

This report closes the final Phase 1 review findings:

1. Tested PostgreSQL backup and restore.
2. Atomic protection for the last active Head of Department.
3. QR-only attendance (no `studentCode` / name fallback).
4. No QR token exposure through the student list or other general APIs.
5. CI workflow and backup/restore documentation.

Every result below comes from a command that was actually executed on this
machine. No test is reported as passing without a real run.

## 2. Backup

Script: `scripts/backup/backup-postgres.ps1`

Executed command:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\backup\backup-postgres.ps1
```

Observed result (exit code `0`):

```
2026-11-06 15:12:04 START target_db=attendance host=localhost port=5432 user=attendance_user
2026-11-06 15:12:04 OUTPUT C:\Users\mohammed\AttendanceSystemBackups\attendance_20261106_151204.dump
2026-11-06 15:12:05 SUCCESS file=attendance_20261106_151204.dump size_mb=0.07 table_data_entries=10 sha256=1CD10F61B692B6CEB104ED2E77645AD9EEFC3DE52DDE8C213D07F193885A193E
2026-11-06 15:12:05 RETENTION disabled (0); all backups are kept
```

| Item | Value |
| --- | --- |
| Format | PostgreSQL custom (`pg_dump --format=custom`) |
| File | `C:\Users\mohammed\AttendanceSystemBackups\attendance_20261106_151204.dump` |
| Size | 70,821 bytes (0.07 MB) |
| SHA-256 | `1CD10F61B692B6CEB104ED2E77645AD9EEFC3DE52DDE8C213D07F193885A193E` |
| Table-data entries | 10 |
| Log | `%USERPROFILE%\AttendanceSystemBackups\logs\backup-2026-11.log` |
| Retention | Disabled (0) — nothing is deleted automatically |

The dump was written to a `.partial` file, validated (`PGDMP` header,
non-empty size, `pg_restore --list` accepted it and found table data), and only
then renamed. The destination is outside the repository and is not committed.
No password appears in the script, the log, or Git; `PGPASSWORD` is set for the
child process only and redacted from error output.

The Windows Scheduled Task is prepared in
`scripts/backup/register-backup-task.ps1` (daily 02:00, current Windows user,
`MultipleInstances=IgnoreNew`, 2-hour limit). It requires an elevated PowerShell
window and was not registered automatically.

## 3. Restore test (executed on a separate test database)

Script: `scripts/backup/restore-postgres-test.ps1`

Executed command:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\backup\restore-postgres-test.ps1 `
  -BackupFile "$env:USERPROFILE\AttendanceSystemBackups\attendance_20261106_151204.dump" `
  -IUnderstandThisIsATestDatabase
```

Result: **PASS**, exit code `0`, test database
`attendance_restore_test_20261106_151306` was dropped automatically.
Report file: `%USERPROFILE%\AttendanceSystemBackups\restore-report-20261106_151306.txt`.

### Row counts (source vs restored)

| Table | Source | Restored | Status |
| --- | ---: | ---: | --- |
| `Student` | 297 | 297 | OK |
| `Section` | 11 | 11 | OK |
| `Lecture` | 4 | 4 | OK |
| `AttendanceRecord` | 151 | 151 | OK |
| `StudentQrToken` | 297 | 297 | OK |
| `StaffUser` | 4 | 4 | OK |
| `AuditLog` | 24 | 24 | OK |
| `SystemSetting` | 1 | 1 | OK |
| `_prisma_migrations` | 3 | 3 | OK |

### Structure and data-integrity checks

| Check | Result |
| --- | ---: |
| Foreign keys | 8 (same as source) |
| Indexes | 25 (same as source) |
| Orphan attendance → lecture | 0 |
| Orphan attendance → student | 0 |
| Orphan QR → student | 0 |
| Duplicate student QR tokens | 0 |
| Duplicate lecture QR values | 0 |
| Students with multiple active QR tokens | 0 |

The production database was only read with `SELECT count(*)` queries; it was
never modified. Only the throwaway test database was created and dropped.

Earlier restore attempts failed because Windows PowerShell stripped embedded
double quotes from `psql -c` arguments and treated PostgreSQL `NOTICE` messages
on stderr as fatal. Both issues were fixed: SQL is now written to a temporary
`-f` file, and `$ErrorActionPreference` is temporarily `Continue` while the real
exit code decides success. A leftover test database from one failed attempt was
also dropped, and a final `pg_database` check confirmed no
`attendance_restore_test_*` or `att_test_*` databases remain.

## 4. Last active Head of Department protection

File: `apps/api/src/modules/staff/staff.service.ts`

- Every mutation that can remove an active Head of Department (`update()` and
  `setActive()`) runs inside `prisma.$transaction`.
- The transaction first acquires `pg_advisory_xact_lock(728194001)`. All API
  instances share this key, so the count-then-update sequence cannot interleave.
- The target row is re-read **inside** the transaction; the "last active head"
  count is also read inside the transaction and after the lock.
- Session revocation for deactivation happens inside the same transaction.
- The audit entry is written only after the transaction commits.
- Permission and self-disable checks are repeated inside the transaction.

Tests in `apps/api/test/staff-management.test.ts`:

- `cannot be deactivated or demoted` — both return `409`, one active head remains.
- `serializes two concurrent deactivations so one active head always remains` —
  exactly one request succeeds and one returns `409`; active heads = 1.
- `serializes deactivation against demotion of the last two heads` — exactly one
  succeeds and one returns `409`; active heads = 1.

## 5. QR-only attendance

File: `apps/api/src/modules/attendance/attendance.service.ts`

- `scanStudent` rejects any value that does not start with `qr_`.
- Resolution goes through `StudentQrToken` only, with `revokedAt: null`.
- Unknown and revoked tokens are rejected; there is no fallback to
  `studentCode` or full name.
- The existing checks remain: active lecture, study-period/section match, and
  duplicate prevention (an existing `ABSENT` record is switched to `PRESENT`).
- The unused legacy `register()` method was deleted. The controller comment and
  `ScanStudentDto` now document the QR-only rule.
- The separate `POST /attendance/:lectureId/manual` endpoint still exists but is
  protected by `ATTENDANCE_MANUAL` and is an explicit manual-attendance feature,
  not a QR fallback.

Tests in `apps/api/test/security.test.ts`:

- accepts an active opaque QR token;
- rejects a legacy sequential `studentCode` (and creates no record);
- rejects a full student name;
- rejects an unknown QR token;
- rejects a revoked QR token (and creates no record);
- rotates a token, rejects the old card, accepts only the new one.

## 6. QR token exposure

- `GET /students` no longer selects or returns `qrToken`
  (`student.service.ts`, `StudentListItem`/`StudentWithStats` in the web app).
- `GET /students/options` selects only non-secret fields.
- QR values are available only through `GET /students/:id/qr` and rotated only
  through `POST /students/:id/qr/rotate`, both protected by `PERMISSIONS.QR_ISSUE`.
- `StudentQrCardModal` and `BulkStudentCardsModal` now fetch tokens from the
  dedicated endpoint instead of reading them from the list.
- `ensureQrToken` and `rotateQrToken` run in a transaction with a per-student
  `pg_advisory_xact_lock(hashtext(studentId))`, so concurrent issuance or
  rotation cannot create two active tokens.
- The test `never exposes QR tokens in the student list` checks that no student
  object has a `qrToken` field and that no known token value appears in the
  serialized response. `keeps the dedicated QR endpoint authorized and
  revocable` verifies the endpoint returns the token to the Head account and
  returns `403` to a lecturer.

## 7. CI

File: `.github/workflows/ci.yml`

Runs on every push and pull request with a PostgreSQL 16 service:

1. checkout;
2. pnpm `10.28.2` + Node 20 with pnpm cache;
3. `pnpm install --frozen-lockfile`;
4. `prisma generate`;
5. `prisma migrate deploy` against the CI database;
6. API TypeScript check;
7. web TypeScript check;
8. API integration tests;
9. production web build.

Only CI-local credentials are used; no production secret is present in the
workflow file.

## 8. Verification evidence (executed on 2026-11-06)

| Command | Result |
| --- | --- |
| `pnpm --filter @attendance/api run typecheck` | exit `0`, no errors |
| `pnpm --filter @attendance/web run typecheck` | exit `0`, no errors |
| `pnpm --filter @attendance/api test` | **51 / 51 passing**, 0 failing, 14 suites |
| `NEXT_DIST_DIR=.next-verify pnpm --filter @attendance/web exec next build` | production build succeeded; 7 routes generated |

The web build used `.next-verify` because the running production server
(PID 14664, port 3000) holds `.next` on Windows. CI keeps the default `.next`.
The `.next-verify` output was removed and `apps/web/tsconfig.json` was restored
after Next.js auto-edited it. `pnpm install --force --frozen-lockfile` was used
once to repair emptied package folders; the lockfile did not change.

## 9. Files changed

Modified:

- `.gitignore`
- `package.json`
- `apps/api/src/modules/attendance/attendance.controller.ts`
- `apps/api/src/modules/attendance/attendance.service.ts`
- `apps/api/src/modules/attendance/dto/scan-student.dto.ts`
- `apps/api/src/modules/staff/staff.service.ts`
- `apps/api/src/modules/student/student.controller.ts`
- `apps/api/src/modules/student/student.service.ts`
- `apps/api/test/security.test.ts`
- `apps/api/test/staff-management.test.ts`
- `apps/web/next.config.js`
- `apps/web/package.json`
- `apps/web/src/app/students/page.tsx`
- `apps/web/src/components/cards/BulkStudentCardsModal.tsx`
- `apps/web/src/components/cards/StudentQrCardModal.tsx`
- `apps/web/src/lib/api.ts`

Added:

- `.github/workflows/ci.yml`
- `docs/BACKUP_RESTORE.md`
- `scripts/backup/backup-postgres.ps1`
- `scripts/backup/restore-postgres-test.ps1`
- `scripts/backup/register-backup-task.ps1`

## 10. Constraints honored and remaining operational steps

Honored:

- no commit and no push;
- no production data deletion or replacement;
- no destructive migration (tests use `prisma migrate deploy`);
- no password or staff-account changes;
- UI changed only where required to stop reading QR tokens from the list.

Remaining operational steps (require approval / elevation, not part of the code
change):

1. Register the scheduled backup task from an elevated PowerShell:
   `scripts\backup\register-backup-task.ps1`, then run it once via
   `Start-ScheduledTask` and confirm a new `SUCCESS` log line.
2. Decide and approve a retention period before using `-ApplyRetention`.
3. Let the first CI run complete on push/PR (nothing was pushed in this session).
