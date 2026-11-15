-- Phase 1 migration 0001: existing core schema (students, lectures, attendance, sections)
-- This represents the pre-Phase-1 database. It matches the original SQLite schema.

CREATE TABLE "Lecture" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "studyPeriod" TEXT NOT NULL DEFAULT 'MORNING',
    "section" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "qrToken" TEXT NOT NULL,
    "qrExpiresAt" TIMESTAMP(3) NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Lecture_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Lecture_qrToken_key" ON "Lecture"("qrToken");

CREATE TABLE "Student" (
    "id" TEXT NOT NULL,
    "orderIndex" INTEGER,
    "studentCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "studyPeriod" TEXT NOT NULL DEFAULT 'MORNING',
    "section" TEXT,
    "presentCount" INTEGER NOT NULL DEFAULT 0,
    "absentCount" INTEGER NOT NULL DEFAULT 0,
    "totalSessions" INTEGER,
    "rate" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Student_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Student_studentCode_key" ON "Student"("studentCode");

CREATE TABLE "AttendanceRecord" (
    "id" TEXT NOT NULL,
    "lectureId" TEXT NOT NULL,
    "studentId" TEXT,
    "studentCode" TEXT,
    "studentName" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PRESENT',
    "deviceId" TEXT,
    "ipAddress" TEXT,
    "registeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AttendanceRecord_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AttendanceRecord_lectureId_studentName_key"
    ON "AttendanceRecord"("lectureId", "studentName");

CREATE TABLE "Section" (
    "id" TEXT NOT NULL,
    "studyPeriod" TEXT NOT NULL DEFAULT 'MORNING',
    "name" TEXT NOT NULL,
    "label" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Section_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Section_studyPeriod_name_key" ON "Section"("studyPeriod", "name");

ALTER TABLE "AttendanceRecord"
    ADD CONSTRAINT "AttendanceRecord_lectureId_fkey"
    FOREIGN KEY ("lectureId") REFERENCES "Lecture"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "AttendanceRecord"
    ADD CONSTRAINT "AttendanceRecord_studentId_fkey"
    FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE SET NULL ON UPDATE CASCADE;
