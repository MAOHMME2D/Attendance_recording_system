/**
 * Safely disables (or reactivates) the isolated SYSTEM_OWNER test account.
 *
 *   pnpm --filter @attendance/api run staff:disable-owner
 *   pnpm --filter @attendance/api run staff:disable-owner -- --reactivate
 *
 * This is the only supported way to change the owner account after setup.
 * The account is deliberately immutable through the staff-management API.
 */
import { PrismaClient } from '@prisma/client';
import { loadEnvironment } from '../src/common/utils/load-env';
import { resolveDatabaseUrl } from '../src/prisma/database-url';
import { SYSTEM_OWNER_ROLE } from '../src/common/constants/roles';

loadEnvironment();

const databaseUrl = resolveDatabaseUrl();
const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });

async function main() {
  const reactivate = process.argv.includes('--reactivate');
  const staffIdArgIndex = process.argv.indexOf('--staff-id');
  const staffId =
    staffIdArgIndex !== -1 ? process.argv[staffIdArgIndex + 1] : undefined;

  const owner = staffId
    ? await prisma.staffUser.findUnique({ where: { staffId } })
    : await prisma.staffUser.findFirst({ where: { role: SYSTEM_OWNER_ROLE } });

  if (!owner || owner.role !== SYSTEM_OWNER_ROLE) {
    console.error('No SYSTEM_OWNER account was found.');
    process.exitCode = 1;
    return;
  }

  await prisma.staffUser.update({
    where: { id: owner.id },
    data: {
      isActive: reactivate,
      ...(reactivate ? { failedLoginCount: 0, lockedUntil: null } : {}),
    },
  });

  if (!reactivate) {
    await prisma.staffSession.updateMany({
      where: { userId: owner.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  await prisma.auditLog.create({
    data: {
      action: reactivate ? 'SYSTEM_OWNER_REACTIVATED' : 'SYSTEM_OWNER_DISABLED',
      entityType: 'StaffUser',
      entityId: owner.id,
      details: `CLI; staffId=${owner.staffId}; sessions revoked=${!reactivate}`,
    },
  });

  console.log(
    reactivate
      ? `SYSTEM_OWNER "${owner.staffId}" reactivated.`
      : `SYSTEM_OWNER "${owner.staffId}" disabled and all sessions revoked.`,
  );
}

main()
  .catch((error) => {
    console.error('Failed to update the owner account:', error?.message || error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
