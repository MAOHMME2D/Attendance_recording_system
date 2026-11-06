/**
 * One-time data migration: archived SQLite database -> PostgreSQL.
 *
 *   pnpm --filter @attendance/api run db:copy-sqlite-to-postgres
 *
 * - Source: legacy SQLite file (default the archived apps/api/prisma/attendance.db;
 *   override with SOURCE_SQLITE_URL). Read-only; the file is never modified.
 * - Target: DATABASE_URL (PostgreSQL). The migrations must already be applied
 *   (`pnpm run db:migrate:postgres`).
 * - Safety: aborts if any target table is not empty, copies primary keys and QR
 *   tokens verbatim, and verifies row counts afterwards. Never deletes rows.
 */
import { PrismaClient as SqliteClient } from '../prisma/generated/client-sqlite';
import { PrismaClient as PgClient } from '@prisma/client';
import * as path from 'path';
import { loadEnvironment } from '../src/common/utils/load-env';

loadEnvironment();

const sourceUrl =
  (process.env.SOURCE_SQLITE_URL || '').trim() ||
  `file:${path.join(__dirname, '..', 'prisma', 'attendance.db').replace(/\\/g, '/')}`;

const targetUrl = (process.env.DATABASE_URL || '').trim();
if (!targetUrl.startsWith('postgresql://')) {
  console.error('DATABASE_URL must be a PostgreSQL URL. Aborting.');
  process.exit(1);
}

const sqlite = new SqliteClient({ datasources: { db: { url: sourceUrl } } });
const pg = new PgClient({ datasources: { db: { url: targetUrl } } });

const TABLES = [
  'staffUser',
  'section',
  'student',
  'lecture',
  'attendanceRecord',
  'studentQrToken',
  'auditLog',
  'staffSession',
  'systemSetting',
] as const;

type Row = Record<string, unknown>;

function chunk<T>(rows: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let index = 0; index < rows.length; index += size) {
    out.push(rows.slice(index, index + size));
  }
  return out;
}

async function readAll(table: string): Promise<Row[]> {
  // The legacy client exposes the raw-identifier variants; findMany returns
  // Date/boolean values already parsed by Prisma.
  return (await (sqlite as any)[table].findMany({})) as Row[];
}

async function count(pgClient: PgClient, model: string): Promise<number> {
  return (await (pgClient as any)[model].count()) as number;
}

async function main() {
  console.log(`Copy SQLite -> PostgreSQL`);
  console.log(`  source: ${sourceUrl}`);
  console.log(`  target: ${targetUrl.replace(/:\/\/.*@/, '://***@')}`);

  await sqlite.$connect();
  await pg.$connect();

  // 1) Pre-flight: every target table must be empty.
  for (const table of TABLES) {
    const existing = await count(pg, table);
    if (existing !== 0) {
      throw new Error(
        `Target table "${table}" is not empty (${existing} rows). Aborting to avoid duplicates.`,
      );
    }
  }

  // Be explicit about what is about to be imported.
  const sourceCounts: Record<string, number> = {};
  for (const table of TABLES) {
    sourceCounts[table] = await count(sqlite as unknown as PgClient, table);
    console.log(`  ${table}: ${sourceCounts[table]} row(s) to copy`);
  }

  // 2) Copy in FK-safe order (prisma createMany, preserving ids and dates).
  //    Skip tables with zero rows silently.
  const modelsNeedingSkip = new Set<string>();

  async function copyTable(model: string, batchSize = 200) {
    const rows = await readAll(model);
    if (rows.length === 0) return;
    for (const batch of chunk(rows, batchSize)) {
      // @updatedAt / defaults also accept explicit values on createMany.
      (await (pg as any)[model].createMany({
        data: batch,
        skipDuplicates: modelsNeedingSkip.has(model),
      })) as unknown;
    }
  }

  await copyTable('staffUser');
  await copyTable('section');
  await copyTable('student');
  await copyTable('lecture');
  await copyTable('attendanceRecord');
  await copyTable('studentQrToken');
  await copyTable('auditLog');
  await copyTable('staffSession');
  await copyTable('systemSetting');

  // 3) Verify counts.
  let mismatches = 0;
  for (const table of TABLES) {
    const copied = await count(pg, table);
    const match = copied === sourceCounts[table];
    console.log(
      `  verify ${table}: source=${sourceCounts[table]} target=${copied} ${match ? 'OK' : 'MISMATCH'}`,
    );
    if (!match) mismatches++;
  }
  if (mismatches > 0) {
    throw new Error(
      `${mismatches} table(s) mismatch row counts. Review before continuing.`,
    );
  }

  console.log('Done. No rows were deleted in either database.');
}

main()
  .catch((error) => {
    console.error('Migration failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await sqlite.$disconnect();
    await pg.$disconnect();
  });
