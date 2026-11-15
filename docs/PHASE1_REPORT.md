# Phase 1 — Online Foundation: Final Report

Date: 2026-11-05
Branch: `online-foundation`
Status: Phase 1 implementation complete; stopped for review. Phase 2 not started.

> **Historical note:** this report describes the state at the end of Phase 1.
> PostgreSQL later became the runtime database and the legacy SQLite tooling
> mentioned below was removed during the pre-Phase-2 cleanup. See
> `docs/POSTGRES_MIGRATION.md` for the current state.

---

## 1. Executive summary

Phase 1 added a secure online foundation to the **existing** attendance system
without rebuilding it and without changing the student-card workflow:

- Staff-only authentication (login / logout / session lookup).
- Server-side RBAC with deny-by-default authorization.
- Protected REST endpoints, DTO validation, restricted CORS, security headers.
- Authenticated Socket.IO connections and per-lecture room authorization.
- Opaque, revocable student QR tokens with legacy-card compatibility.
- Arabic RTL login screen, session guards, permission-based navigation.
- PostgreSQL preparation (schema, migrations, env, cutover plan).
- 25 automated security/integration tests, all passing.

The student self-service page (`/attend`) and public self check-in API are
disabled. Students have no accounts and no direct website access.

## 2. Branch and working-tree state

- Branch created from the current working state: `online-foundation`.
- Nothing was committed or pushed; all Phase 1 work is in the working tree.
- The pre-existing uncommitted user edit in
  `apps/web/src/app/reports/page.tsx` (report wording changed from Excel to
  PDF) was preserved.
- No unrelated feature was rewritten or removed.

## 3. Database status — existing SQLite preserved

- The live SQLite database `apps/api/prisma/attendance.db` was **not replaced**
  and **no rows were deleted**.
- A byte-for-byte safety backup was created before any schema change:
  `backups/attendance-pre-phase1-20261105-231018.db` (159,744 bytes).
- Only additive changes were applied:
  - `Lecture.createdByUserId` (nullable)
  - `Lecture.conductedByUserId` (nullable)
  - new tables: `StaffUser`, `StaffSession`, `AuditLog`, `StudentQrToken`
- Additive SQL: `apps/api/prisma/sqlite-migrations/0001_online_foundation.sql`
- Idempotent runner: `apps/api/scripts/apply-sqlite-phase1.ts`
  (`pnpm --dir apps/api run db:apply-phase1`).
- 297 opaque QR tokens were backfilled for the 297 existing students.

## 4. Live database verification (read-only)

Verified against the live SQLite file after migration:

| Item | Count |
| --- | ---: |
| Students | 297 |
| Lectures | 4 |
| Attendance records | 151 |
| Sections | 11 |
| QR tokens (total) | 297 |
| QR tokens (active) | 297 |
| Students without an active token | 0 |
| Staff accounts | 0 |

The zero staff count is expected: staff accounts are created only through the
CLI, never through a public endpoint. A staff account must be created before the
first login (see section 14).

## 5. PostgreSQL preparedness

Prepared, but **not executed**:

- PostgreSQL mirror schema: `apps/api/prisma/postgres/schema.prisma`
- Migrations: `0001_init`, `0002_online_foundation`
- Commands:
  - `pnpm --dir apps/api run db:migrate:postgres`
  - `pnpm --dir apps/api run db:push:postgres`
- Environment-driven connection string via `DATABASE_URL`.
- Placeholder-only env examples: `.env.example`, `apps/api/.env.example`.
- Cutover, data-copy, verification and rollback plan:
  `docs/POSTGRES_MIGRATION.md`.

**Important:** no PostgreSQL server, `psql` client, or Docker was available in
this environment. The PostgreSQL migrations were **not run**, **not tested
against a real PostgreSQL instance**, and **no production data was moved**.
The local runtime intentionally remains SQLite so the existing installation
keeps working.

## 6. Staff authentication

- Endpoints:
  - `POST /api/auth/login`
  - `POST /api/auth/logout`
  - `GET /api/auth/me`
- Passwords hashed with **bcrypt** (cost 12); plaintext is never stored.
- Login uses a dummy bcrypt hash for unknown staff IDs to reduce timing leaks.
- Sessions are **opaque random tokens** (32 random bytes, base64url). Only the
  SHA-256 hash is stored in `StaffSession`; the raw token is never stored.
- The token is delivered only as an **HttpOnly, SameSite=Lax** cookie
  (`attendance_session`), with `Secure` when `COOKIE_SECURE=true` or in
  production. The JSON login response contains only `{ expiresAt, user }`.
- Session expiry is enforced server-side; expired/revoked sessions return 401.
- Logout revokes the session and clears the cookie.
- Abuse protection:
  - 10 login attempts per IP per 5 minutes (HTTP 429 afterwards).
  - 5 failed attempts lock the account for 15 minutes.
  - Login success/failure and lockout are written to `AuditLog`.
- Staff accounts are created/updated only by CLI
  (`apps/api/scripts/create-staff.ts`); there is no public registration route.

## 7. Authorization (RBAC)

Roles: `HEAD_OF_DEPARTMENT`, `REGISTRAR`, `LECTURER`, `TECHNICAL_LECTURER`.

- Deny by default: every route requires a valid session unless explicitly
  marked `@Public()`.
- Every permission is granted explicitly in
  `apps/api/src/common/constants/roles.ts`.
- Global guards: `AuthGuard` then `PermissionsGuard` (`APP_GUARD`).
- Role capabilities:
  - **Head of Department / Registrar:** all lectures, reports, students,
    student management, sections, QR issuance, absence reset, audit access.
  - **Lecturer:** create/conduct own lectures, view own lectures, manual
    attendance, student options, limited QR/student read as configured.
  - **Technical Lecturer:** create a lecture (recording themselves as
    conductor), open only lectures where `conductedByUserId` is themselves,
    and scan QR cards. No admin access, no reports, no exports, no student
    list, no manual attendance.
- The server never trusts a user ID, role, or ownership value supplied by the
  client; identity comes from the validated session and ownership is checked
  against the database.
- Lecture ownership rule: administrative roles see all; lecturers see lectures
  they created or conducted; technical lecturers see only lectures they
  conducted.

## 8. API hardening and validation

- Every sensitive endpoint is protected with authentication and explicit
  permissions (lectures, attendance, students, sections, QR operations).
- DTOs with `class-validator` and a global `ValidationPipe` configured with
  `whitelist`, `forbidNonWhitelisted`, and transformation.
- CORS is origin-configured (`CORS_ORIGINS`), credentials enabled, **no
  wildcard**.
- State-changing requests with an unrecognized browser `Origin` are rejected
  (CSRF defense), in addition to SameSite cookies.
- Basic security headers added: `X-Content-Type-Options`, `X-Frame-Options`,
  `Referrer-Policy`, `Permissions-Policy`.
- Public routes are limited to `POST /api/auth/login` and `GET /api/health`.
- `POST /api/attendance/register` (old public self check-in) now returns
  **410 Gone**.
- `/attend` now shows an Arabic notice that student self-attendance is disabled.
- The live university LAN flow keeps working: the start script of that time set
  a non-wildcard `CORS_ORIGINS` for localhost plus the detected LAN IPv4 when the
  operator had not configured it. (The script was later removed during the
  hosting cleanup; set `CORS_ORIGINS` explicitly in production.)

## 9. WebSocket security

- Socket.IO namespace `/attendance` now validates the session cookie or Bearer
  token during the handshake.
- Anonymous or invalid sockets receive `auth:error` and are disconnected.
- `lecture:join` validates that the authenticated staff member may access that
  specific lecture; unauthorized joins receive `lecture:join:denied`.
- WebSocket CORS uses the same configured origins as HTTP.
- A race condition was found and fixed during testing: a fast `lecture:join`
  could arrive before the asynchronous session lookup finished and be treated
  as unauthenticated. The gateway now sets the auth promise synchronously and
  join handlers await it before reading the user.

## 10. Student QR identifiers

- New model `StudentQrToken` issues opaque random identifiers:
  `qr_<24 random bytes base64url>`.
- Tokens are revocable (`revokedAt`) and rotatable; rotation revokes the old
  token and issues a new one without deleting historical rows.
- Scanning resolves the opaque token first, then falls back to the legacy
  sequential `studentCode` so already-printed cards keep working.
- Revoked tokens are rejected and do **not** fall back to a name/code match.
- Full student list (Head/Registrar only) returns the active token; lecturers
  get a minimal options endpoint without QR or statistics.
- Existing cards remain valid: 297/297 live students have an active token and
  the old `studentCode` fallback is still accepted.

## 11. Arabic RTL frontend

- New `/login` page: Arabic RTL, staff ID + password, client validation,
  inline Arabic errors, loading spinner, redirect to a safe internal `next`
  path, and a notice that student access is disabled.
- `AuthProvider` loads `/api/auth/me` with `credentials: 'include'`, exposes
  `user`, `loading`, `login`, `logout`, `can(permission)` and broadcasts a
  global unauthorized event on 401.
- `RequireAuth` shows a loading state, redirects anonymous users to
  `/login?next=...`, and renders an Arabic 403 panel when the role lacks the
  permission.
- `middleware.ts` adds a coarse cookie-presence page guard; it is explicitly
  not the authorization boundary — the API remains authoritative.
- Navbar now shows the staff name/role, permission-based links, and logout.
- Student and report pages are wrapped in page-level permission guards.
- The existing Arabic RTL layout, Cairo font, scanner, cards and PDF report
  were preserved.

## 12. Tests

Added `apps/api/test/security.test.ts` (25 tests) using a throwaway SQLite
database in the OS temp folder. The live database is never touched.

Coverage:

- Login success, wrong password, no raw token in JSON, HttpOnly cookie.
- `/api/auth/me` and logout invalidation.
- Unauthenticated access to students, lectures, sections and QR endpoints.
- Public self check-in disabled (410).
- RBAC: Head/Registrar allowed; Lecturer denied the full student list;
  Technical Lecturer denied student data, options, lecture listing and manual
  attendance.
- Technical Lecturer can scan only into its own lecture; other technical
  lecturers are denied.
- Lecturer isolation for lecture read, attendance read and close.
- Opaque QR acceptance, legacy student-code acceptance, revoked-token rejection.
- Core lecture create → close flow with conductor recording and attendance rows.
- WebSocket: anonymous rejection, cross-lecturer room denial, authorized join.

Result: **25 passed, 0 failed**.

The suite also exposed and drove the fix for the WebSocket authentication race.

## 13. Build and type checks

| Check | Result |
| --- | --- |
| `pnpm --dir apps/api run typecheck` | Passed |
| `pnpm --dir apps/api run test` | 25/25 passed |
| `pnpm --dir apps/web exec tsc --noEmit` | Passed |
| `pnpm --dir apps/web run build` | Passed (next build + standalone asset copy) |

Notes:

- No lint script is configured in either package, so no lint command was run;
  TypeScript checks are the static gate.
- The web build initially failed because server layouts imported a runtime
  constant from a `'use client'` module. This was fixed by importing only the
  permission **type** and passing a string literal.
- The local pnpm `next`/`react` package folders were empty (environment
  corruption); they were restored with an offline frozen install before the
  build succeeded. No application source was changed for this.

## 14. Limitations, operational steps, and stop point

Limitations / explicitly not done:

- **PostgreSQL runtime cutover was not executed or tested** (no server
  available). Only preparation is complete.
- No automatic SQLite → PostgreSQL data migration; the documented manual,
  reviewed import plan must be followed on real infrastructure.
- No backups/restore management, academic-year reset, warnings, offline sync,
  advanced analytics, academic-structure redesign, or student accounts.
- Staff accounts must be created before login (live DB currently has 0).
- The QR token is stored as an opaque random value; hashing tokens at rest is a
  possible future hardening step but would change lookup design.

Before using the system for real:

1. Copy `.env.example` to `.env` (git-ignored) and set `CORS_ORIGINS` for the
   real web origin(s). Use `COOKIE_SECURE=true` only behind HTTPS.
2. Create staff accounts, for example:

   ```bash
   pnpm --dir apps/api run staff:create -- \
     --staff-id head1 --name "رئيس القسم" --role HEAD_OF_DEPARTMENT
   ```

   Add a Registrar and the required lecturers. The CLI prints a one-time
   password if `--password` is omitted; rotate it later with
   `--update --password`.
3. Rebuild the API (`pnpm --dir apps/api run build`) and web
   (`pnpm --dir apps/web run build`) before running the launcher, since the
   runtime uses compiled output.
4. For PostgreSQL, follow `docs/POSTGRES_MIGRATION.md` and do not claim the
   cutover until its verification checklist passes on real hardware.

Phase 1 ends here. Phase 2 has **not** been started.
