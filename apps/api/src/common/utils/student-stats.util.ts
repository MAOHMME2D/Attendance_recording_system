import type { Prisma } from '@prisma/client';
import { notCoveredWhere } from './coverage.util';

/** The slice of the Prisma client needed to recompute cached counters. */
export type StudentStatsDb = Pick<Prisma.TransactionClient, 'attendanceRecord' | 'student'>;

/**
 * Recomputes the denormalised present/absent counters from the source of truth:
 * attendance records that belong to a CLOSED lecture which has not been
 * archived. Active lectures and archived lectures are deliberately excluded so
 * every screen shows the same numbers.
 */
export async function recomputeStudentStats(
  db: StudentStatsDb,
  studentIds: Array<string | null | undefined>,
): Promise<void> {
  const ids = Array.from(
    new Set(studentIds.filter((id): id is string => Boolean(id))),
  );
  if (ids.length === 0) return;

  const grouped = await db.attendanceRecord.groupBy({
    by: ['studentId', 'status'],
    where: {
      studentId: { in: ids },
      lecture: { status: 'CLOSED', deletedAt: null },
      // System-generated "حاضر عبر…" rows are display credits, not physical
      // attendances; they must not inflate counters.
      ...notCoveredWhere(),
    },
    _count: { _all: true },
  });

  const totals = new Map<string, { present: number; absent: number }>();
  for (const row of grouped) {
    if (!row.studentId) continue;
    const count =
      typeof row._count === 'object' && row._count !== null
        ? (row._count._all ?? 0)
        : 0;
    const entry = totals.get(row.studentId) || { present: 0, absent: 0 };
    if (row.status === 'PRESENT') entry.present += count;
    else if (row.status === 'ABSENT') entry.absent += count;
    totals.set(row.studentId, entry);
  }

  for (const id of ids) {
    const entry = totals.get(id) || { present: 0, absent: 0 };
    const total = entry.present + entry.absent;
    const rate = total > 0 ? Math.round((entry.present / total) * 100) : 100;

    await db.student.updateMany({
      where: { id },
      data: {
        presentCount: entry.present,
        absentCount: entry.absent,
        totalSessions: total,
        rate,
      },
    });
  }
}
