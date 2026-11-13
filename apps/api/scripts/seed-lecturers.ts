/**
 * One-off seed: create 7 generic LECTURER accounts on the local attendance
 * database. Uses the same policy as the staff API (normalizeStaffId,
 * isValidStaffId, password strength, bcrypt cost 12) and writes STAFF_CREATED
 * audit rows. Existing ids are skipped, never overwritten.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

// Load DATABASE_URL from apps/api/.env without extra deps.
const envPath = join(__dirname, '..', '.env');
const envText = readFileSync(envPath, 'utf8');
for (const line of envText.split(/\r?\n/)) {
  const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*"?([^"\n\r]+)"?\s*$/);
  if (match && !process.env[match[1]]) {
    process.env[match[1]] = match[2];
  }
}

const prisma = new PrismaClient();

const PASSWORD = process.env.LECTURER_SEED_PASSWORD;
if (!PASSWORD) {
  throw new Error(
    'Set LECTURER_SEED_PASSWORD in the environment (never commit the value).',
  );
}
const rounds = 12;

const normalizeStaffId = (value: string) => value.trim().toLowerCase();
const isValidStaffId = (value: string) => /^[a-z0-9][a-z0-9._-]{2,63}$/.test(value);

function validatePasswordStrength(password: string, staffId: string): string | null {
  if (password.length < 12) return 'كلمة المرور قصيرة جدًا';
  if (!/[a-z]/.test(password)) return 'يلزم حرف صغير';
  if (!/[A-Z]/.test(password)) return 'يلزم حرف كبير';
  if (!/[0-9]/.test(password)) return 'يلزم رقم';
  if (!/[^A-Za-z0-9]/.test(password)) return 'يلزم رمز خاص';
  if (staffId && password.toLowerCase().includes(staffId.toLowerCase())) {
    return 'كلمة المرور تحتوي على معرف الموظف';
  }
  return null;
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL not found in apps/api/.env');
  }

  const accounts = Array.from({ length: 7 }, (_, index) => ({
    staffId: normalizeStaffId(`LEC0${index + 1}`),
    fullName: `محاضر ${index + 1}`,
    role: 'LECTURER',
  }));

  console.log('Creating generic lecturer accounts on:', process.env.DATABASE_URL.split('@').pop());
  const results: Array<{ staffId: string; fullName: string; status: string; id?: string }> = [];

  for (const account of accounts) {
    if (!isValidStaffId(account.staffId)) {
      throw new Error(`Invalid staffId ${account.staffId}`);
    }
    const passwordError = validatePasswordStrength(PASSWORD, account.staffId);
    if (passwordError) {
      throw new Error(`Password policy failed for ${account.staffId}: ${passwordError}`);
    }

    const existing = await prisma.staffUser.findUnique({
      where: { staffId: account.staffId },
      select: { id: true, role: true, isActive: true },
    });
    if (existing) {
      results.push({ ...account, status: `SKIPPED (exists, role=${existing.role})` });
      continue;
    }

    const created = await prisma.staffUser.create({
      data: {
        staffId: account.staffId,
        fullName: account.fullName,
        role: account.role,
        passwordHash: await bcrypt.hash(PASSWORD, rounds),
        isActive: true,
      },
      select: { id: true, staffId: true },
    });

    await prisma.auditLog.create({
      data: {
        actorUserId: null,
        action: 'STAFF_CREATED',
        entityType: 'StaffUser',
        entityId: created.id,
        details: `staffId=${created.staffId}; role=${account.role}; source=seed-script-phase3b`,
      },
    });

    results.push({ ...account, status: 'CREATED', id: created.id });
  }

  console.table(results);
  const created = results.filter((row) => row.status === 'CREATED').length;
  const skipped = results.filter((row) => row.status.startsWith('SKIPPED')).length;
  console.log(`Done. Created: ${created}, Skipped: ${skipped}.`);
}

main()
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
