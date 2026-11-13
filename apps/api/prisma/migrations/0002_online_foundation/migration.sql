-- Phase 1 migration 0002: staff authentication, RBAC sessions, audit log,
-- lecture ownership, and opaque/revocable student QR tokens.
-- Additive only: no existing rows are deleted.

ALTER TABLE "Lecture" ADD COLUMN "createdByUserId" TEXT;
ALTER TABLE "Lecture" ADD COLUMN "conductedByUserId" TEXT;

CREATE INDEX "Lecture_createdByUserId_idx" ON "Lecture"("createdByUserId");
CREATE INDEX "Lecture_conductedByUserId_idx" ON "Lecture"("conductedByUserId");

CREATE TABLE "StaffUser" (
    "id" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "failedLoginCount" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "StaffUser_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "StaffUser_staffId_key" ON "StaffUser"("staffId");

CREATE TABLE "StaffSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3),
    CONSTRAINT "StaffSession_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "StaffSession_tokenHash_key" ON "StaffSession"("tokenHash");
CREATE INDEX "StaffSession_userId_idx" ON "StaffSession"("userId");
CREATE INDEX "StaffSession_expiresAt_idx" ON "StaffSession"("expiresAt");

CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorUserId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "details" TEXT,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AuditLog_actorUserId_idx" ON "AuditLog"("actorUserId");
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

CREATE TABLE "StudentQrToken" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StudentQrToken_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "StudentQrToken_token_key" ON "StudentQrToken"("token");
CREATE INDEX "StudentQrToken_studentId_idx" ON "StudentQrToken"("studentId");
CREATE INDEX "StudentQrToken_revokedAt_idx" ON "StudentQrToken"("revokedAt");

ALTER TABLE "Lecture"
    ADD CONSTRAINT "Lecture_createdByUserId_fkey"
    FOREIGN KEY ("createdByUserId") REFERENCES "StaffUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Lecture"
    ADD CONSTRAINT "Lecture_conductedByUserId_fkey"
    FOREIGN KEY ("conductedByUserId") REFERENCES "StaffUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "StaffSession"
    ADD CONSTRAINT "StaffSession_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "StaffUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AuditLog"
    ADD CONSTRAINT "AuditLog_actorUserId_fkey"
    FOREIGN KEY ("actorUserId") REFERENCES "StaffUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "StudentQrToken"
    ADD CONSTRAINT "StudentQrToken_studentId_fkey"
    FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "StudentQrToken"
    ADD CONSTRAINT "StudentQrToken_createdByUserId_fkey"
    FOREIGN KEY ("createdByUserId") REFERENCES "StaffUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
