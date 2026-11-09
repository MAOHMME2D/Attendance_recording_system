/** One-off verification: bcrypt roundtrip for the seeded lecturer accounts. */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const envText = readFileSync(join(__dirname, '..', '.env'), 'utf8');
for (const line of envText.split(/\r?\n/)) {
  const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*"?([^"\n\r]+)"?\s*$/);
  if (match && !process.env[match[1]]) process.env[match[1]] = match[2];
}

const password = process.env.LECTURER_SEED_PASSWORD;
if (!password) {
  throw new Error(
    'Set LECTURER_SEED_PASSWORD in the environment (never commit the value).',
  );
}
const prisma = new PrismaClient();

async function main() {
  for (const staffId of ['lec01', 'lec02', 'lec03', 'lec04', 'lec05', 'lec06', 'lec07']) {
    const user = await prisma.staffUser.findUnique({
      where: { staffId },
      select: { role: true, isActive: true, fullName: true, passwordHash: true },
    });
    const ok = user ? await bcrypt.compare(password, user.passwordHash) : false;
    console.log(
      staffId,
      `role=${user?.role}`,
      `active=${user?.isActive}`,
      `fullName=${user?.fullName}`,
      `passwordMatch=${ok}`,
    );
  }
  await prisma.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
