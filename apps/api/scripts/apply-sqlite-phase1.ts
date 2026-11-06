/**
 * LEGACY SQLite tooling: applies the Phase 1 additive SQLite migration to a
 * SQLite database file. Retained for restoring/archiving the original SQLite
 * database (apps/api/prisma/attendance.db); the runtime database is PostgreSQL
 * and uses prisma/migrations via `pnpm run db:migrate:postgres` instead.
 *
 *   pnpm --filter @attendance/api run db:apply-phase1
 *
 * The script is idempotent: it checks PRAGMA table_info before adding columns,
 * uses CREATE TABLE/INDEX IF NOT EXISTS, and backfills one opaque QR token for
 * every student that does not have an active token yet. It also applies the
 * additive 0002 staff-management table. It never deletes data.
 */
import { PrismaClient } from '../prisma/generated/client-sqlite';
import * as crypto from 'crypto';
import * as path from 'path';
import { loadEnvironment } from '../src/common/utils/load-env';

loadEnvironment();

// Legacy SQLite tooling always targets a SQLite file; default to the archived
// local development database unless DATABASE_URL is set explicitly.
const configuredUrl = (process.env.DATABASE_URL || '').trim();
const defaultSqliteUrl = `file:${path
  .join(__dirname, '..', 'prisma', 'attendance.db')
  .replace(/\\/g, '/')}`;
const databaseUrl =
  configuredUrl && configuredUrl.startsWith('file:') ? configuredUrl : defaultSqliteUrl;

const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });

async function tableExists(name: string): Promise<boolean> {
  const rows = await prisma.$queryRawUnsafe<Array<{ name: string }>>(
    `SELECT name FROM sqlite_master WHERE type='table' AND name=?`,
    name,
  );
  return rows.length > 0;
}

async function columns(table: string): Promise<string[]> {
  if (!(await tableExists(table))) return [];
  const rows = await prisma.$queryRawUnsafe<Array<{ name: string }>>(
    `PRAGMA table_info("${table}")`,
  );
  return rows.map((row) => row.name);
}

async function addColumnIfMissing(table: string, column: string, definition: string) {
  const existing = await columns(table);
  if (existing.includes(column)) {
    console.log(`  = ${table}.${column} already exists`);
    return;
  }
  await prisma.$executeRawUnsafe(`ALTER TABLE "${table}" ADD COLUMN "${column}" ${definition}`);
  console.log(`  + ${table}.${column}`);
}

async function exec(statement: string) {
  await prisma.$executeRawUnsafe(statement);
}

async function main() {
  console.log(`SQLite Phase 1 migration on ${databaseUrl}`);

  await addColumnIfMissing('Lecture', 'createdByUserId', 'TEXT');
  await addColumnIfMissing('Lecture', 'conductedByUserId', 'TEXT');

  await exec(`CREATE INDEX IF NOT EXISTS "Lecture_createdByUserId_idx" ON "Lecture"("createdByUserId")`);
  await exec(`CREATE INDEX IF NOT EXISTS "Lecture_conductedByUserId_idx" ON "Lecture"("conductedByUserId")`);

  await exec(`CREATE TABLE IF NOT EXISTS "StaffUser" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "staffId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "failedLoginCount" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" DATETIME,
    "lastLoginAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
  )`);
  await exec(`CREATE UNIQUE INDEX IF NOT EXISTS "StaffUser_staffId_key" ON "StaffUser"("staffId")`);

  await exec(`CREATE TABLE IF NOT EXISTS "StaffSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "revokedAt" DATETIME,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" DATETIME,
    FOREIGN KEY ("userId") REFERENCES "StaffUser"("id") ON DELETE CASCADE ON UPDATE CASCADE
  )`);
  await exec(`CREATE UNIQUE INDEX IF NOT EXISTS "StaffSession_tokenHash_key" ON "StaffSession"("tokenHash")`);
  await exec(`CREATE INDEX IF NOT EXISTS "StaffSession_userId_idx" ON "StaffSession"("userId")`);
  await exec(`CREATE INDEX IF NOT EXISTS "StaffSession_expiresAt_idx" ON "StaffSession"("expiresAt")`);

  await exec(`CREATE TABLE IF NOT EXISTS "AuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "actorUserId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "details" TEXT,
    "ipAddress" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("actorUserId") REFERENCES "StaffUser"("id") ON DELETE SET NULL ON UPDATE CASCADE
  )`);
  await exec(`CREATE INDEX IF NOT EXISTS "AuditLog_actorUserId_idx" ON "AuditLog"("actorUserId")`);
  await exec(`CREATE INDEX IF NOT EXISTS "AuditLog_createdAt_idx" ON "AuditLog"("createdAt")`);

  await exec(`CREATE TABLE IF NOT EXISTS "StudentQrToken" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "studentId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "revokedAt" DATETIME,
    "createdByUserId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY ("createdByUserId") REFERENCES "StaffUser"("id") ON DELETE SET NULL ON UPDATE CASCADE
  )`);
  await exec(`CREATE UNIQUE INDEX IF NOT EXISTS "StudentQrToken_token_key" ON "StudentQrToken"("token")`);
  await exec(`CREATE INDEX IF NOT EXISTS "StudentQrToken_studentId_idx" ON "StudentQrToken"("studentId")`);
  await exec(`CREATE INDEX IF NOT EXISTS "StudentQrToken_revokedAt_idx" ON "StudentQrToken"("revokedAt")`);

  // 0002_staff_management.sql: one-time setup marker store. Additive only.
  await exec(`CREATE TABLE IF NOT EXISTS "SystemSetting" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "value" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
  )`);

  console.log('  + auth/RBAC/audit/QR/system-setting tables ready');

  if (await tableExists('Student')) {
    const students = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
      `SELECT "id" FROM "Student"`,
    );
    const activeRows = await prisma.$queryRawUnsafe<Array<{ studentId: string }>>(
      `SELECT "studentId" FROM "StudentQrToken" WHERE "revokedAt" IS NULL`,
    );
    const withToken = new Set(activeRows.map((row) => row.studentId));
    let issued = 0;

    for (const student of students) {
      if (withToken.has(student.id)) continue;
      const token = `qr_${crypto.randomBytes(24).toString('base64url')}`;
      await prisma.$executeRawUnsafe(
        `INSERT OR IGNORE INTO "StudentQrToken" ("id", "studentId", "token", "createdAt") VALUES (?, ?, ?, CURRENT_TIMESTAMP)`,
        crypto.randomUUID(),
        student.id,
        token,
      );
      issued++;
    }

    console.log(`  + ${issued} QR token(s) backfilled, ${withToken.size} already present`);
  }

  console.log('Done. No rows were deleted.');
}

main()
  .catch((error) => {
    console.error('Migration failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
