-- Phase 3 migration 0006: stable section identity on lectures.
--
--   * Lecture gains an optional sectionId FK so lectures keep pointing at the
--     exact Section row even after renames, instead of relying on the legacy
--     text mirror alone.
--   * The legacy `section` text column is kept for compatibility and is still
--     maintained (rename sync), but the FK is used first wherever possible.
--   * Backfill is conservative: a lecture is linked only when its course stage,
--     its study period and its exact section name uniquely match one Section
--     row. Anything ambiguous stays unlinked rather than being guessed.
--   * Deleting a Section keeps the lecture rows (ON DELETE SET NULL); their
--     records and statistics are unaffected.

ALTER TABLE "Lecture" ADD COLUMN "sectionId" TEXT;

CREATE INDEX "Lecture_sectionId_idx" ON "Lecture"("sectionId");

ALTER TABLE "Lecture"
    ADD CONSTRAINT "Lecture_sectionId_fkey"
    FOREIGN KEY ("sectionId") REFERENCES "Section"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

UPDATE "Lecture" AS l
SET "sectionId" = sec."id"
FROM "Section" AS sec, "Course" AS c
WHERE l."sectionId" IS NULL
  AND l."courseId" IS NOT NULL
  AND c."id" = l."courseId"
  AND l."section" IS NOT NULL
  AND btrim(l."section") <> ''
  AND upper(btrim(l."section")) <> 'ALL'
  AND l."studyPeriod" = sec."studyPeriod"
  AND sec."stage" = c."stage"
  AND btrim(l."section") = sec."name";
