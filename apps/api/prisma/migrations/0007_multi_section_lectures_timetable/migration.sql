-- Phase 3b migration 0007: multi-section lectures, weekly timetable,
-- cross-section attendance notes.
--
--   * LectureSection links one lecture to MANY sections. `Lecture.sectionId`
--     stays as the primary/first section for backwards compatibility.
--   * TimetableEntry stores the weekly slot (course, section, day, start/end).
--     It never decides who may sit an exam; it drives cross-section
--     attendance: a student may scan into another section's session of the
--     same course when his own (course, section) pair is timetabled, and at
--     close a student covered elsewhere this week is recorded as
--     "حاضر عبر الشعبة X" instead of ABSENT.
--   * AttendanceRecord gains an optional `note` for such coverage entries.
--   * Backfill is conservative: existing lectures keep exactly their current
--     single section (or none). Nothing else is guessed.

CREATE TABLE "LectureSection" (
    "lectureId" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,

    CONSTRAINT "LectureSection_pkey" PRIMARY KEY ("lectureId", "sectionId")
);

CREATE INDEX "LectureSection_sectionId_idx" ON "LectureSection"("sectionId");

ALTER TABLE "LectureSection"
    ADD CONSTRAINT "LectureSection_lectureId_fkey"
    FOREIGN KEY ("lectureId") REFERENCES "Lecture"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "LectureSection"
    ADD CONSTRAINT "LectureSection_sectionId_fkey"
    FOREIGN KEY ("sectionId") REFERENCES "Section"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "TimetableEntry" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TimetableEntry_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TimetableEntry_courseId_sectionId_dayOfWeek_startTime_key"
    ON "TimetableEntry"("courseId", "sectionId", "dayOfWeek", "startTime");

CREATE INDEX "TimetableEntry_sectionId_dayOfWeek_idx"
    ON "TimetableEntry"("sectionId", "dayOfWeek");

CREATE INDEX "TimetableEntry_courseId_idx"
    ON "TimetableEntry"("courseId");

ALTER TABLE "TimetableEntry"
    ADD CONSTRAINT "TimetableEntry_courseId_fkey"
    FOREIGN KEY ("courseId") REFERENCES "Course"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TimetableEntry"
    ADD CONSTRAINT "TimetableEntry_sectionId_fkey"
    FOREIGN KEY ("sectionId") REFERENCES "Section"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AttendanceRecord" ADD COLUMN "note" TEXT;

INSERT INTO "LectureSection" ("lectureId", "sectionId")
SELECT "id", "sectionId" FROM "Lecture"
WHERE "sectionId" IS NOT NULL
ON CONFLICT DO NOTHING;
