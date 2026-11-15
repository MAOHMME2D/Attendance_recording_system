/**
 * Creates or updates a staff account.
 *
 *   pnpm --filter @attendance/api run staff:create -- \
 *     --staff-id registrar2 --name "اسم الموظف" --role REGISTRAR --password "strong password"
 *
 * Roles: HEAD_OF_DEPARTMENT | REGISTRAR | LECTURER | TECHNICAL_LECTURER
 *
 * The SYSTEM_OWNER account is intentionally NOT creatable here; it is created
 * only by the one-time `setup:initial` command. If --password is omitted a
 * strong random password is generated and printed once. Passwords are never
 * written to logs or source control.
 */
import { PrismaClient } from '@prisma/client';
import { loadEnvironment } from '../src/common/utils/load-env';
import { resolveDatabaseUrl } from '../src/prisma/database-url';
import {
  generateStrongPassword,
  hashPassword,
  isValidStaffId,
  normalizeStaffId,
  validatePasswordStrength,
} from '../src/common/utils/password';
import { CREATABLE_STAFF_ROLES } from '../src/common/constants/roles';

loadEnvironment();

const databaseUrl = resolveDatabaseUrl();

const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });

function readArg(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  if (index === -1) return undefined;
  return process.argv[index + 1];
}

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

function generatedPasswordFor(staffId: string): string {
  for (let attempt = 0; attempt < 50; attempt++) {
    const candidate = generateStrongPassword();
    if (validatePasswordStrength(candidate, staffId) === null) return candidate;
  }
  fail('Unable to generate a password that satisfies the policy');
}

async function main() {
  const staffId = normalizeStaffId(readArg('staff-id') || '');
  const fullName = (readArg('name') || '').trim();
  const role = (readArg('role') || '').trim().toUpperCase();
  const update = process.argv.includes('--update');
  const suppliedPassword = readArg('password');

  if (!staffId) fail('Missing --staff-id');
  if (!isValidStaffId(staffId)) fail('Invalid --staff-id format');
  if (!fullName) fail('Missing --name');
  if (!role || !(CREATABLE_STAFF_ROLES as readonly string[]).includes(role)) {
    fail(
      `Invalid --role. Allowed: ${CREATABLE_STAFF_ROLES.join(', ')}. ` +
        'SYSTEM_OWNER is created only by setup:initial.',
    );
  }

  const generatePassword = !suppliedPassword;
  const password = suppliedPassword || generatedPasswordFor(staffId);
  const passwordError = validatePasswordStrength(password, staffId);
  if (passwordError) fail(passwordError);

  const passwordHash = await hashPassword(password);
  const existing = await prisma.staffUser.findUnique({ where: { staffId } });

  if (existing?.role === 'SYSTEM_OWNER') {
    fail('The owner test account cannot be changed with this command.');
  }

  if (existing && !update) {
    fail(`Staff id "${staffId}" already exists. Use --update to change it.`);
  }

  if (existing) {
    if (
      existing.role === 'HEAD_OF_DEPARTMENT' &&
      role !== 'HEAD_OF_DEPARTMENT' &&
      existing.isActive
    ) {
      const activeHeads = await prisma.staffUser.count({
        where: { role: 'HEAD_OF_DEPARTMENT', isActive: true },
      });
      if (activeHeads <= 1) {
        fail('Cannot remove the last active HEAD_OF_DEPARTMENT account.');
      }
    }

    await prisma.staffUser.update({
      where: { id: existing.id },
      data: {
        fullName,
        role,
        passwordHash,
        isActive: true,
        failedLoginCount: 0,
        lockedUntil: null,
      },
    });
    await prisma.staffSession.updateMany({
      where: { userId: existing.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    await prisma.auditLog.create({
      data: {
        action: 'STAFF_UPDATED',
        entityType: 'StaffUser',
        entityId: existing.id,
        details: `CLI update; staffId=${staffId}; role=${role}; sessions revoked`,
      },
    });
    console.log(`Updated staff "${staffId}" (${role}). Existing sessions revoked.`);
  } else {
    const created = await prisma.staffUser.create({
      data: { staffId, fullName, role, passwordHash },
    });
    await prisma.auditLog.create({
      data: {
        action: 'STAFF_CREATED',
        entityType: 'StaffUser',
        entityId: created.id,
        details: `CLI create; staffId=${staffId}; role=${role}`,
      },
    });
    console.log(`Created staff "${staffId}" (${role}).`);
  }

  if (generatePassword) {
    console.log(`One-time password: ${password}`);
    console.log(
      'Save it now. To rotate it later, rerun this command with --update --password.',
    );
  }
}

main()
  .catch((error) => {
    console.error('Failed to create staff:', error?.message || error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
