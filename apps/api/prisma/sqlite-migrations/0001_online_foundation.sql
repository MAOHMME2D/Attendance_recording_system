-- Additive SQLite migration for the existing local/development database.
-- The TypeScript runner (scripts/apply-sqlite-phase1.ts) applies these
-- statements idempotently because SQLite has no "ADD COLUMN IF NOT EXISTS".
--
-- It creates auth/RBAC/QR tables and adds nullable lecture ownership columns.
-- No table or row is dropped or rewritten.

ALTER TABLE "Lecture" ADD COLUMN "createdByUserId" TEXT;
ALTER TABLE "Lecture" ADD COLUMN "conductedByUserId" TEXT;

CREATE INDEX IF NOT EXISTS "Lecture_createdByUserId_idx" ON "Lecture"("createdByUserId");
CREATE INDEX IF NOT EXISTS "Lecture_conductedByUserId_idx" ON "Lecture"("conductedByUserId");

CREATE TABLE IF NOT EXISTS "StaffUser" (
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
);
CREATE UNIQUE INDEX IF NOT EXISTS "StaffUser_staffId_key" ON "StaffUser"("staffId");

CREATE TABLE IF NOT EXISTS "StaffSession" (
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
);
CREATE UNIQUE INDEX IF NOT EXISTS "StaffSession_tokenHash_key" ON "StaffSession"("tokenHash");
CREATE INDEX IF NOT EXISTS "StaffSession_userId_idx" ON "StaffSession"("userId");
CREATE INDEX IF NOT EXISTS "StaffSession_expiresAt_idx" ON "StaffSession"("expiresAt");

CREATE TABLE IF NOT EXISTS "AuditLog" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "actorUserId" TEXT,
  "action" TEXT NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT,
  "details" TEXT,
  "ipAddress" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("actorUserId") REFERENCES "StaffUser"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "AuditLog_actorUserId_idx" ON "AuditLog"("actorUserId");
CREATE INDEX IF NOT EXISTS "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

CREATE TABLE IF NOT EXISTS "StudentQrToken" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "studentId" TEXT NOT NULL,
  "token" TEXT NOT NULL,
  "revokedAt" DATETIME,
  "createdByUserId" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY ("createdByUserId") REFERENCES "StaffUser"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "StudentQrToken_token_key" ON "StudentQrToken"("token");
CREATE INDEX IF NOT EXISTS "StudentQrToken_studentId_idx" ON "StudentQrToken"("studentId");
CREATE INDEX IF NOT EXISTS "StudentQrToken_revokedAt_idx" ON "StudentQrToken"("revokedAt");
