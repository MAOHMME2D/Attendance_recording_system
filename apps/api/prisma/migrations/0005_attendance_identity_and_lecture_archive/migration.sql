-- Phase 2 migration 0005: stable attendance identity + lecture archiving.
--
--   * attendance uniqueness moves from the display name to the student row
--   * legacy rows are linked through their unique studentCode only (never by
--     name, and never by guessing)
--   * duplicate identities abort the migration instead of deleting data
--   * lectures gain a soft-delete marker so deleting a lecture no longer
--     removes its attendance history

-- ---------------------------------------------------------------------------
-- Lectures: soft-delete marker
-- ---------------------------------------------------------------------------
ALTER TABLE "Lecture" ADD COLUMN "deletedAt" TIMESTAMP(3);
CREATE INDEX "Lecture_deletedAt_idx" ON "Lecture"("deletedAt");

-- ---------------------------------------------------------------------------
-- AttendanceRecord: backfill studentId from the unique student code
-- ---------------------------------------------------------------------------
UPDATE "AttendanceRecord" AS ar
SET "studentId" = s."id"
FROM "Student" AS s
WHERE ar."studentId" IS NULL
  AND ar."studentCode" IS NOT NULL
  AND btrim(ar."studentCode") = s."studentCode";

-- Abort loudly if the legacy data already contains two rows for the same
-- student in the same lecture. Deleting or merging automatically would lose
-- attendance history, so a human must resolve those rows first.
DO $$
DECLARE
  duplicate RECORD;
BEGIN
  SELECT ar."lectureId", ar."studentId", COUNT(*) AS total
  INTO duplicate
  FROM "AttendanceRecord" AS ar
  WHERE ar."studentId" IS NOT NULL
  GROUP BY ar."lectureId", ar."studentId"
  HAVING COUNT(*) > 1
  LIMIT 1;

  IF FOUND THEN
    RAISE EXCEPTION
      'Migration 0005 aborted: lecture % has % attendance rows for student %. Resolve the duplicate identity before migrating.',
      duplicate."lectureId", duplicate.total, duplicate."studentId";
  END IF;
END $$;

DROP INDEX IF EXISTS "AttendanceRecord_lectureId_studentName_key";
CREATE UNIQUE INDEX "AttendanceRecord_lectureId_studentId_key"
    ON "AttendanceRecord"("lectureId", "studentId");
CREATE INDEX "AttendanceRecord_studentId_idx"
    ON "AttendanceRecord"("studentId");
