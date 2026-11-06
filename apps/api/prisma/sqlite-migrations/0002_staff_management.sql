-- Additive SQLite migration: staff management and one-time setup marker.
-- The TypeScript runner (scripts/apply-sqlite-phase1.ts) applies the same
-- statement idempotently with CREATE TABLE IF NOT EXISTS.
--
-- No table or row is dropped or rewritten.

CREATE TABLE IF NOT EXISTS "SystemSetting" (
  "key" TEXT NOT NULL PRIMARY KEY,
  "value" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);
