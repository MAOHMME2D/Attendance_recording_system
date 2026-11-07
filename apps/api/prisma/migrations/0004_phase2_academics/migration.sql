-- Phase 2 migration 0004: academic stages, courses, lecturer assignments.
--
-- Safe on the live PostgreSQL data:
--   * all existing sections/students belong to stage 2 (decision confirmed by
--     the project owner; stages 1, 3 and 4 start empty)
--   * existing student codes 1001..1297 are renumbered to S2-1001..S2-1297
--   * no row, attendance record or QR token is deleted
--   * new columns are nullable or have a default so old rows stay valid

-- ---------------------------------------------------------------------------
-- Sections: stage + updatedAt, uniqueness becomes (stage, studyPeriod, name)
-- ---------------------------------------------------------------------------
ALTER TABLE "Section" ADD COLUMN "stage" INTEGER NOT NULL DEFAULT 2;
ALTER TABLE "Section" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

DROP INDEX IF EXISTS "Section_studyPeriod_name_key";
CREATE UNIQUE INDEX "Section_stage_studyPeriod_name_key"
    ON "Section"("stage", "studyPeriod", "name");
CREATE INDEX "Section_stage_studyPeriod_idx"
    ON "Section"("stage", "studyPeriod");

-- ---------------------------------------------------------------------------
-- Students: stage, optional section relation, soft-delete marker
-- ---------------------------------------------------------------------------
ALTER TABLE "Student" ADD COLUMN "stage" INTEGER NOT NULL DEFAULT 2;
ALTER TABLE "Student" ADD COLUMN "sectionId" TEXT;
ALTER TABLE "Student" ADD COLUMN "deletedAt" TIMESTAMP(3);

CREATE INDEX "Student_stage_sectionId_idx" ON "Student"("stage", "sectionId");
CREATE INDEX "Student_deletedAt_idx" ON "Student"("deletedAt");

ALTER TABLE "Student"
    ADD CONSTRAINT "Student_sectionId_fkey"
    FOREIGN KEY ("sectionId") REFERENCES "Section"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill the relation without changing the legacy text column.
UPDATE "Student" AS s
SET "sectionId" = sec."id"
FROM "Section" AS sec
WHERE s."section" = sec."name"
  AND s."studyPeriod" = sec."studyPeriod"
  AND sec."stage" = s."stage";

-- Renumber current students to the stage-prefixed format: S2-1001 ... S2-1297.
UPDATE "Student"
SET "studentCode" = 'S' || "stage"::text || '-' || "studentCode"
WHERE "studentCode" ~ '^[0-9]+$';

-- Keep the denormalised code on historical attendance rows in sync.
UPDATE "AttendanceRecord" AS ar
SET "studentCode" = s."studentCode"
FROM "Student" AS s
WHERE ar."studentId" = s."id"
  AND ar."studentCode" IS DISTINCT FROM s."studentCode";

-- ---------------------------------------------------------------------------
-- Courses
-- ---------------------------------------------------------------------------
CREATE TABLE "Course" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "stage" INTEGER NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Course_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Course_stage_code_key" ON "Course"("stage", "code");
CREATE INDEX "Course_stage_idx" ON "Course"("stage");

-- ---------------------------------------------------------------------------
-- Lecturer -> course assignments
-- ---------------------------------------------------------------------------
CREATE TABLE "TeachingAssignment" (
    "id" TEXT NOT NULL,
    "staffUserId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TeachingAssignment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TeachingAssignment_staffUserId_courseId_key"
    ON "TeachingAssignment"("staffUserId", "courseId");
CREATE INDEX "TeachingAssignment_courseId_idx"
    ON "TeachingAssignment"("courseId");

ALTER TABLE "TeachingAssignment"
    ADD CONSTRAINT "TeachingAssignment_staffUserId_fkey"
    FOREIGN KEY ("staffUserId") REFERENCES "StaffUser"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TeachingAssignment"
    ADD CONSTRAINT "TeachingAssignment_courseId_fkey"
    FOREIGN KEY ("courseId") REFERENCES "Course"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Lectures: optional course link (legacy lectures stay with courseId = NULL)
-- ---------------------------------------------------------------------------
ALTER TABLE "Lecture" ADD COLUMN "courseId" TEXT;
CREATE INDEX "Lecture_courseId_idx" ON "Lecture"("courseId");
ALTER TABLE "Lecture"
    ADD CONSTRAINT "Lecture_courseId_fkey"
    FOREIGN KEY ("courseId") REFERENCES "Course"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
