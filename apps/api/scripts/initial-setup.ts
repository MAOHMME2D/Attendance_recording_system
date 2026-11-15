/**
 * One-time first-run setup. Creates exactly three accounts:
 *   - isolated SYSTEM_OWNER test account
 *   - HEAD_OF_DEPARTMENT
 *   - REGISTRAR
 *
 *   pnpm --filter @attendance/api run setup:initial
 *
 * Passwords may be supplied with --owner-password/--head-password/
 * --registrar-password. Any omitted password is generated locally, satisfies
 * the strong-password policy, and is printed exactly once. Passwords are never
 * written to application logs, the database in plaintext, or the repository.
 *
 * Running the command a second time is rejected by a SystemSetting marker that
 * is written in the same transaction as the accounts.
 */
import { PrismaClient } from '@prisma/client';
import { loadEnvironment } from '../src/common/utils/load-env';
import { resolveDatabaseUrl } from '../src/prisma/database-url';
import { AuditService } from '../src/modules/audit/audit.service';
import { InitialSetupService } from '../src/modules/setup/initial-setup.service';
import { generateStrongPassword, validatePasswordStrength } from '../src/common/utils/password';
import type { PrismaService } from '../src/prisma/prisma.service';

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

function passwordFor(
  label: string,
  staffId: string,
  supplied: string | undefined,
  used: Set<string>,
): { password: string; generated: boolean } {
  if (supplied) {
    const error = validatePasswordStrength(supplied, staffId);
    if (error) fail(`كلمة مرور ${label}: ${error}`);
    if (used.has(supplied)) fail('يجب استخدام كلمة مرور مستقلة لكل حساب');
    used.add(supplied);
    return { password: supplied, generated: false };
  }

  for (let attempt = 0; attempt < 50; attempt++) {
    const candidate = generateStrongPassword();
    if (used.has(candidate)) continue;
    if (validatePasswordStrength(candidate, staffId) !== null) continue;
    used.add(candidate);
    return { password: candidate, generated: true };
  }
  fail(`تعذر توليد كلمة مرور قوية لـ ${label}`);
}

async function main() {
  console.log(`Initial setup against ${databaseUrl}`);

  const service = new InitialSetupService(
    prisma as unknown as PrismaService,
    new AuditService(prisma as unknown as PrismaService),
  );

  if (await service.isCompleted()) {
    fail('تم تنفيذ الإعداد الأولي مسبقًا. لا يمكن تشغيله مرة أخرى.');
  }

  const usedPasswords = new Set<string>();

  const ownerStaffId = readArg('owner-staff-id') || 'owner-test';
  const headStaffId = readArg('head-staff-id') || 'head1';
  const registrarStaffId = readArg('registrar-staff-id') || 'registrar1';

  const ownerPassword = passwordFor(
    'المالك',
    ownerStaffId,
    readArg('owner-password'),
    usedPasswords,
  );
  const headPassword = passwordFor(
    'رئيس القسم',
    headStaffId,
    readArg('head-password'),
    usedPasswords,
  );
  const registrarPassword = passwordFor(
    'المسجل',
    registrarStaffId,
    readArg('registrar-password'),
    usedPasswords,
  );

  const result = await service.run({
    owner: {
      staffId: ownerStaffId,
      fullName: readArg('owner-name') || 'حساب المالك التجريبي',
      password: ownerPassword.password,
    },
    head: {
      staffId: headStaffId,
      fullName: readArg('head-name') || 'رئيس القسم',
      password: headPassword.password,
    },
    registrar: {
      staffId: registrarStaffId,
      fullName: readArg('registrar-name') || 'المسجل',
      password: registrarPassword.password,
    },
  });

  console.log('\nتم الإعداد الأولي بنجاح. الحسابات:');
  for (const account of result.accounts) {
    const note = account.adopted ? ' (تم تبنّي الحساب الموجود)' : '';
    console.log(`  - ${account.staffId} | ${account.role}${note}`);
  }

  const generated = [
    ['owner', ownerStaffId, ownerPassword] as const,
    ['head', headStaffId, headPassword] as const,
    ['registrar', registrarStaffId, registrarPassword] as const,
  ].filter(([, , value]) => value.generated);

  if (generated.length > 0) {
    console.log('\nكلمات المرور المولدة (تُعرض مرة واحدة فقط - احفظها الآن):');
    for (const [, staffId, value] of generated) {
      console.log(`  ${staffId}: ${value.password}`);
    }
    console.log(
      '\nلا تُخزَّن كلمات المرور في السجلات أو قاعدة البيانات بصيغة واضحة.',
    );
  }

  console.log('\nيمكن الآن تعطيل حساب المالك التجريبي بأمر staff:disable-owner.');
}

main()
  .catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes('SystemSetting') || message.includes('no such table')) {
      console.error(
        'جدول SystemSetting غير موجود. شغّل أولًا: pnpm --filter @attendance/api run db:migrate:postgres',
      );
    } else {
      console.error('فشل الإعداد الأولي:', message);
    }
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
