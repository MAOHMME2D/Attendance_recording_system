import { isAbsolute, join } from 'path';

/**
 * Resolves DATABASE_URL for the Prisma Client.
 *
 * PostgreSQL is the runtime database. Relative SQLite `file:` URLs are converted
 * to absolute paths (Prisma CLI resolves them against apps/api/prisma, the
 * generated legacy SQLite client may resolve them elsewhere) so the legacy
 * SQLite tooling and the `prisma` CLI keep opening the same database file.
 */
export function resolveDatabaseUrl(): string {
  const configured = (process.env.DATABASE_URL || '').trim();
  const prismaDir = join(__dirname, '..', '..', 'prisma');

  if (configured && !configured.startsWith('file:')) {
    return configured;
  }

  if (configured.startsWith('file:')) {
    const raw = configured.slice('file:'.length);
    if (isAbsolute(raw)) return configured;
    if (raw.startsWith('//')) return configured;

    const relative = raw.replace(/^\.\//, '');
    return `file:${join(prismaDir, relative).replace(/\\/g, '/')}`;
  }

  return '';
}
