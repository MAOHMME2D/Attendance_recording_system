import type { Prisma } from '@prisma/client';
import { COVER_NOTE_PREFIX } from '../constants/coverage';

/**
 * Where-clause fragment matching rows that are NOT system-generated coverage
 * credits ("حاضر عبر…"). `note` is nullable: a plain `NOT startsWith` would
 * silently drop NULL rows in three-valued logic, so both cases are covered
 * explicitly.
 */
export function notCoveredWhere(): Prisma.AttendanceRecordWhereInput {
  return {
    OR: [{ note: null }, { note: { not: { startsWith: COVER_NOTE_PREFIX } } }],
  };
}
