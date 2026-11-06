import { isAbsolute, join } from 'path';

/**
 * Resolves DATABASE_URL for the Prisma Client.
 *
 * PostgreSQL is the only supported runtime database. A relative SQLite `file:`
 * URL is still resolved against `apps/api/prisma` so an old local `.env` fails
 * with a clear "file not found" error instead of pointing at an unexpected path.
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
