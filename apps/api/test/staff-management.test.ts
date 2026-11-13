/**
 * Staff-management and one-time-initial-setup tests.
 *
 * They run against a throwaway PostgreSQL database on the local server and
 * never touch the live attendance database or its data.
 */
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import * as bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const API_DIR = join(__dirname, '..');

// Tests run against a throwaway PostgreSQL database created on the local
// server (runtime is PostgreSQL since the cutover). DATABASE_ADMIN_URL points
// at the maintenance database "postgres" and is configured in apps/api/.env.
const TEST_DB_NAME = `att_test_staff_${process.pid}_${Date.now()}`.slice(0, 63);
const TEST_ADMIN_URL = postgresAdminUrl();
// DATABASE_ADMIN_URL must end with "/postgres" (+ optional query); the test
// database replaces it.
const TEST_DB_URL = TEST_ADMIN_URL.replace(
  /\/postgres(\?.*)?$/,
  `/${TEST_DB_NAME}$1`,
);

// Must be set before PrismaClient / PrismaService is constructed.
process.env.DATABASE_URL = TEST_DB_URL;
process.env.NODE_ENV = 'test';
process.env.COOKIE_SECURE = 'false';
process.env.SESSION_TTL_HOURS = '1';
// The suite performs more than the production default of 10 logins per IP.
process.env.AUTH_LOGIN_MAX_ATTEMPTS = '1000';

const PASSWORDS = {
  owner: 'OwnerSetupPass1!',
  head: 'HeadSetupPass1!',
  registrar: 'RegistrarSetup1!',
  lecturer: 'LecturerPass1!',
  tech: 'TechLecturerPass1!',
  reset: 'ResetLecturerPass1!',
};

const STAFF_IDS = {
  owner: 'owner-test',
  head: 'head1',
  registrar: 'registrar1',
  lecturer: 'lect-new',
  tech: 'tech-new',
};

let app: any;
let prisma: PrismaClient;
let setupService: any;
let setupResult: any;
let baseUrl = '';

const ids: Record<string, string> = {};
const tokens: Record<string, string> = {};

function postgresAdminUrl(): string {
  const url = (process.env.DATABASE_ADMIN_URL || '').trim();
  if (!url.startsWith('postgresql://')) {
    throw new Error(
      'DATABASE_ADMIN_URL is not set: tests need a PostgreSQL maintenance ' +
        'URL (database "postgres") configured in apps/api/.env.',
    );
  }
  return url;
}

function prismaCliPath(): string {
  const candidates = [
    join(API_DIR, 'node_modules', 'prisma', 'build', 'index.js'),
    join(API_DIR, '..', '..', 'node_modules', 'prisma', 'build', 'index.js'),
  ];
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }
  throw new Error('Prisma CLI not found for test setup');
}

async function applySchema(): Promise<void> {
  const admin = new PrismaClient({ datasources: { db: { url: TEST_ADMIN_URL } } });
  try {
    await admin.$executeRawUnsafe(`CREATE DATABASE "${TEST_DB_NAME}"`);
  } finally {
    await admin.$disconnect();
  }

  execFileSync(
    process.execPath,
    [
      prismaCliPath(),
      'migrate',
      'deploy',
      '--schema',
      join(API_DIR, 'prisma', 'schema.prisma'),
    ],
    {
      cwd: API_DIR,
      env: { ...process.env, DATABASE_URL: TEST_DB_URL },
      stdio: 'pipe',
    },
  );
}

async function api(
  path: string,
  options: {
    method?: string;
    token?: string;
    body?: unknown;
    headers?: Record<string, string>;
  } = {},
): Promise<{ status: number; body: any; setCookie: string | null }> {
  const headers: Record<string, string> = { ...(options.headers || {}) };
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  if (options.token) headers.Authorization = `Bearer ${options.token}`;

  const res = await fetch(`${baseUrl}${path}`, {
    method: options.method || 'GET',
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });

  const text = await res.text();
  let body: any = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }
  return { status: res.status, body, setCookie: res.headers.get('set-cookie') };
}

async function login(staffId: string, password: string): Promise<string> {
  const result = await api('/api/auth/login', {
    method: 'POST',
    body: { staffId, password },
  });
  assert.equal(result.status, 200, `login ${staffId} failed: ${JSON.stringify(result.body)}`);
  const match = String(result.setCookie || '').match(/attendance_session=([^;]+)/);
  assert.ok(match, `login ${staffId} did not set the session cookie`);
  return decodeURIComponent(match![1]);
}

function setupInput() {
  return {
    owner: {
      staffId: STAFF_IDS.owner,
      fullName: 'حساب المالك التجريبي',
      password: PASSWORDS.owner,
    },
    head: {
      staffId: STAFF_IDS.head,
      fullName: 'رئيس القسم',
      password: PASSWORDS.head,
    },
    registrar: {
      staffId: STAFF_IDS.registrar,
      fullName: 'المسجل',
      password: PASSWORDS.registrar,
    },
  };
}

before(async () => {
  await applySchema();

  prisma = new PrismaClient({ datasources: { db: { url: TEST_DB_URL } } });
  await prisma.$connect();

  // Simulate the live installation, which already has a single head account.
  // The setup must adopt it instead of deleting or duplicating it.
  const existingHead = await prisma.staffUser.create({
    data: {
      staffId: STAFF_IDS.head,
      fullName: 'رئيس القسم القديم',
      role: 'HEAD_OF_DEPARTMENT',
      passwordHash: await bcrypt.hash('OldPlaceholderPass1!', 4),
      isActive: true,
    },
  });
  ids.head = existingHead.id;

  const { NestFactory } = await import('@nestjs/core');
  const { AppModule } = await import('../dist/app.module');
  const { IoAdapter } = await import('@nestjs/platform-socket.io');
  const { ValidationPipe } = await import('@nestjs/common');
  const { InitialSetupService } = await import(
    '../dist/modules/setup/initial-setup.service'
  );

  app = await NestFactory.create(AppModule, { logger: ['error', 'warn'] });
  app.useWebSocketAdapter(new IoAdapter(app));
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  await app.listen(0, '127.0.0.1');
  const address = app.getHttpServer().address();
  const port = typeof address === 'object' && address ? address.port : 0;
  baseUrl = `http://127.0.0.1:${port}`;

  setupService = app.get(InitialSetupService);
  setupResult = await setupService.run(setupInput());

  for (const key of ['owner', 'head', 'registrar'] as const) {
    tokens[key] = await login(STAFF_IDS[key], PASSWORDS[key]);
  }
});

after(async () => {
  if (app) await app.close();
  if (prisma) await prisma.$disconnect();
  try {
    const admin = new PrismaClient({ datasources: { db: { url: TEST_ADMIN_URL } } });
    try {
      await admin.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${TEST_DB_NAME}"`);
    } finally {
      await admin.$disconnect();
    }
  } catch {
    // Best-effort cleanup: the test database name is pid/timestamp-unique.
  }
});

describe('one-time initial setup', () => {
  it('creates exactly the three required accounts and marks setup complete', async () => {
    const users = await prisma.staffUser.findMany();
    assert.equal(users.length, 3);

    const roles = users.map((user) => user.role).sort();
    assert.deepEqual(roles, [
      'HEAD_OF_DEPARTMENT',
      'REGISTRAR',
      'SYSTEM_OWNER',
    ]);

    assert.equal(await setupService.isCompleted(), true);
    assert.equal(setupResult.accounts.length, 3);

    const adoptedHead = setupResult.accounts.find(
      (account: any) => account.role === 'HEAD_OF_DEPARTMENT',
    );
    assert.equal(adoptedHead.adopted, true, 'the existing sole head must be adopted');
    assert.equal(adoptedHead.staffId, STAFF_IDS.head);
  });

  it('rejects running the setup a second time', async () => {
    await assert.rejects(
      () => setupService.run(setupInput()),
      (error: any) =>
        error?.getStatus?.() === 409 || /مسبق/.test(String(error?.message)),
    );

    const count = await prisma.staffUser.count();
    assert.equal(count, 3, 'a rejected second run must not create accounts');
  });

  it('stores only bcrypt hashes and never returns plaintext passwords', async () => {
    const users = await prisma.staffUser.findMany();
    const expected: Record<string, string> = {
      [STAFF_IDS.owner]: PASSWORDS.owner,
      [STAFF_IDS.head]: PASSWORDS.head,
      [STAFF_IDS.registrar]: PASSWORDS.registrar,
    };

    for (const user of users) {
      assert.notEqual(user.passwordHash, expected[user.staffId]);
      assert.equal(await bcrypt.compare(expected[user.staffId], user.passwordHash), true);
    }

    const serialized = JSON.stringify(setupResult);
    for (const password of Object.values(PASSWORDS)) {
      assert.equal(serialized.includes(password), false);
    }
  });
});

describe('no public registration', () => {
  it('has no public staff registration endpoint', async () => {
    const authRegister = await api('/api/auth/register', {
      method: 'POST',
      body: {
        staffId: 'attacker',
        fullName: 'Attacker',
        role: 'HEAD_OF_DEPARTMENT',
        password: 'AttackerPass123!',
      },
    });
    assert.equal(authRegister.status, 404);

    const staffRegister = await api('/api/staff/register', {
      method: 'POST',
      body: { staffId: 'attacker' },
    });
    assert.equal(staffRegister.status, 404);
  });

  it('requires an authenticated session for staff administration', async () => {
    const list = await api('/api/staff');
    assert.equal(list.status, 401);

    const create = await api('/api/staff', {
      method: 'POST',
      body: {
        staffId: 'nobody',
        fullName: 'Nobody',
        role: 'LECTURER',
        password: PASSWORDS.lecturer,
      },
    });
    assert.equal(create.status, 401);
  });
});

describe('registrar staff management', () => {
  it('creates lecturers and technical lecturers', async () => {
    const lecturer = await api('/api/staff', {
      method: 'POST',
      token: tokens.registrar,
      body: {
        staffId: STAFF_IDS.lecturer,
        fullName: 'محاضر جديد',
        role: 'LECTURER',
        password: PASSWORDS.lecturer,
      },
    });
    assert.equal(lecturer.status, 201, JSON.stringify(lecturer.body));
    assert.equal(lecturer.body.role, 'LECTURER');
    assert.equal(lecturer.body.passwordHash, undefined);
    assert.equal(lecturer.body.password, undefined);
    ids.lecturer = lecturer.body.id;

    const tech = await api('/api/staff', {
      method: 'POST',
      token: tokens.registrar,
      body: {
        staffId: STAFF_IDS.tech,
        fullName: 'محاضر تقني جديد',
        role: 'TECHNICAL_LECTURER',
        password: PASSWORDS.tech,
      },
    });
    assert.equal(tech.status, 201, JSON.stringify(tech.body));
    assert.equal(tech.body.role, 'TECHNICAL_LECTURER');
    ids.tech = tech.body.id;
  });

  it('cannot create a head of department', async () => {
    const result = await api('/api/staff', {
      method: 'POST',
      token: tokens.registrar,
      body: {
        staffId: 'head-2',
        fullName: 'رئيس قسم آخر',
        role: 'HEAD_OF_DEPARTMENT',
        password: PASSWORDS.lecturer,
      },
    });
    assert.equal(result.status, 403);
  });

  it('cannot create another registrar or a system owner', async () => {
    const registrar = await api('/api/staff', {
      method: 'POST',
      token: tokens.registrar,
      body: {
        staffId: 'registrar-2',
        fullName: 'مسجل آخر',
        role: 'REGISTRAR',
        password: PASSWORDS.lecturer,
      },
    });
    assert.equal(registrar.status, 403);

    const owner = await api('/api/staff', {
      method: 'POST',
      token: tokens.registrar,
      body: {
        staffId: 'owner-2',
        fullName: 'مالك آخر',
        role: 'SYSTEM_OWNER',
        password: PASSWORDS.lecturer,
      },
    });
    assert.ok(owner.status === 400 || owner.status === 403);
  });

  it('lists only the roles it is allowed to manage', async () => {
    const result = await api('/api/staff', { token: tokens.registrar });
    assert.equal(result.status, 200);
    const roles = result.body.map((user: any) => user.role);
    assert.ok(roles.includes('LECTURER'));
    assert.ok(roles.includes('TECHNICAL_LECTURER'));
    assert.equal(roles.includes('HEAD_OF_DEPARTMENT'), false);
    assert.equal(roles.includes('SYSTEM_OWNER'), false);
  });

  it('edits lecturer data', async () => {
    const result = await api(`/api/staff/${ids.lecturer}`, {
      method: 'PATCH',
      token: tokens.registrar,
      body: { fullName: 'محاضر معدّل' },
    });
    assert.equal(result.status, 200, JSON.stringify(result.body));
    assert.equal(result.body.fullName, 'محاضر معدّل');
  });

  it('deactivates and reactivates a lecturer', async () => {
    const deactivated = await api(`/api/staff/${ids.lecturer}/status`, {
      method: 'PATCH',
      token: tokens.registrar,
      body: { isActive: false },
    });
    assert.equal(deactivated.status, 200);
    assert.equal(deactivated.body.isActive, false);

    const blockedLogin = await api('/api/auth/login', {
      method: 'POST',
      body: { staffId: STAFF_IDS.lecturer, password: PASSWORDS.lecturer },
    });
    assert.equal(blockedLogin.status, 401);

    const reactivated = await api(`/api/staff/${ids.lecturer}/status`, {
      method: 'PATCH',
      token: tokens.registrar,
      body: { isActive: true },
    });
    assert.equal(reactivated.status, 200);
    assert.equal(reactivated.body.isActive, true);
  });

  it('resets a password and revokes existing sessions', async () => {
    const result = await api(`/api/staff/${ids.lecturer}/password`, {
      method: 'PATCH',
      token: tokens.registrar,
      body: { password: PASSWORDS.reset },
    });
    assert.equal(result.status, 200, JSON.stringify(result.body));
    assert.equal(result.body.success, true);
    assert.equal(JSON.stringify(result.body).includes(PASSWORDS.reset), false);

    const oldPassword = await api('/api/auth/login', {
      method: 'POST',
      body: { staffId: STAFF_IDS.lecturer, password: PASSWORDS.lecturer },
    });
    assert.equal(oldPassword.status, 401);

    const newPassword = await api('/api/auth/login', {
      method: 'POST',
      body: { staffId: STAFF_IDS.lecturer, password: PASSWORDS.reset },
    });
    assert.equal(newPassword.status, 200);
  });

  it('cannot edit, disable, or reset the system owner account', async () => {
    const owner = await prisma.staffUser.findUnique({
      where: { staffId: STAFF_IDS.owner },
    });
    assert.ok(owner);

    const edit = await api(`/api/staff/${owner!.id}`, {
      method: 'PATCH',
      token: tokens.registrar,
      body: { fullName: 'اسم جديد' },
    });
    assert.equal(edit.status, 403);

    const disable = await api(`/api/staff/${owner!.id}/status`, {
      method: 'PATCH',
      token: tokens.registrar,
      body: { isActive: false },
    });
    assert.equal(disable.status, 403);

    const reset = await api(`/api/staff/${owner!.id}/password`, {
      method: 'PATCH',
      token: tokens.registrar,
      body: { password: PASSWORDS.reset },
    });
    assert.equal(reset.status, 403);

    const reloaded = await prisma.staffUser.findUnique({ where: { id: owner!.id } });
    assert.equal(reloaded?.isActive, true);
  });

  it('cannot edit, disable, or reset the head of department account', async () => {
    const head = await prisma.staffUser.findUnique({
      where: { staffId: STAFF_IDS.head },
    });
    assert.ok(head);

    const edit = await api(`/api/staff/${head!.id}`, {
      method: 'PATCH',
      token: tokens.registrar,
      body: { fullName: 'اسم جديد' },
    });
    assert.equal(edit.status, 403);

    const disable = await api(`/api/staff/${head!.id}/status`, {
      method: 'PATCH',
      token: tokens.registrar,
      body: { isActive: false },
    });
    assert.equal(disable.status, 403);

    const reset = await api(`/api/staff/${head!.id}/password`, {
      method: 'PATCH',
      token: tokens.registrar,
      body: { password: PASSWORDS.reset },
    });
    assert.equal(reset.status, 403);
  });

  it('cannot promote itself to head of department', async () => {
    const self = await prisma.staffUser.findUnique({
      where: { staffId: STAFF_IDS.registrar },
    });
    assert.ok(self);

    const result = await api(`/api/staff/${self!.id}`, {
      method: 'PATCH',
      token: tokens.registrar,
      body: { role: 'HEAD_OF_DEPARTMENT' },
    });
    assert.equal(result.status, 403);
  });

  it('rejects duplicate staff ids', async () => {
    const result = await api('/api/staff', {
      method: 'POST',
      token: tokens.registrar,
      body: {
        staffId: STAFF_IDS.lecturer,
        fullName: 'مكرر',
        role: 'LECTURER',
        password: PASSWORDS.lecturer,
      },
    });
    assert.equal(result.status, 409);
  });
});

describe('lecturers cannot create accounts', () => {
  it('denies staff management to a lecturer and a technical lecturer', async () => {
    const lecturerToken = await login(STAFF_IDS.lecturer, PASSWORDS.reset);
    const techToken = await login(STAFF_IDS.tech, PASSWORDS.tech);

    for (const token of [lecturerToken, techToken]) {
      const create = await api('/api/staff', {
        method: 'POST',
        token,
        body: {
          staffId: 'sneaky',
          fullName: 'Sneaky',
          role: 'LECTURER',
          password: PASSWORDS.lecturer,
        },
      });
      assert.equal(create.status, 403);

      const list = await api('/api/staff', { token });
      assert.equal(list.status, 403);
    }
  });
});

describe('last active head of department protection', () => {
  it('cannot be deactivated or demoted', async () => {
    const head = await prisma.staffUser.findUnique({
      where: { staffId: STAFF_IDS.head },
    });
    assert.ok(head);

    // The owner account is allowed to manage staff, so this asserts the
    // last-active-head invariant itself rather than the self-disable guard.
    const deactivate = await api(`/api/staff/${head!.id}/status`, {
      method: 'PATCH',
      token: tokens.owner,
      body: { isActive: false },
    });
    assert.equal(deactivate.status, 409);

    const demote = await api(`/api/staff/${head!.id}`, {
      method: 'PATCH',
      token: tokens.owner,
      body: { role: 'LECTURER' },
    });
    assert.equal(demote.status, 409);

    const activeHeads = await prisma.staffUser.count({
      where: { role: 'HEAD_OF_DEPARTMENT', isActive: true },
    });
    assert.equal(activeHeads, 1);
  });

  async function ensureTwoActiveHeads() {
    const first = await prisma.staffUser.findUnique({
      where: { staffId: STAFF_IDS.head },
    });
    assert.ok(first);
    await prisma.staffUser.update({
      where: { id: first!.id },
      data: { role: 'HEAD_OF_DEPARTMENT', isActive: true },
    });

    const second = await prisma.staffUser.upsert({
      where: { staffId: 'head-concurrent' },
      update: { role: 'HEAD_OF_DEPARTMENT', isActive: true },
      create: {
        staffId: 'head-concurrent',
        fullName: 'رئيس قسم متزامن',
        role: 'HEAD_OF_DEPARTMENT',
        passwordHash: await bcrypt.hash(PASSWORDS.head, 4),
        isActive: true,
      },
    });

    return { first: first!, second };
  }

  it('serializes two concurrent deactivations so one active head always remains', async () => {
    const { first, second } = await ensureTwoActiveHeads();

    const [a, b] = await Promise.all([
      api(`/api/staff/${first.id}/status`, {
        method: 'PATCH',
        token: tokens.owner,
        body: { isActive: false },
      }),
      api(`/api/staff/${second.id}/status`, {
        method: 'PATCH',
        token: tokens.owner,
        body: { isActive: false },
      }),
    ]);

    assert.deepEqual(
      [a.status, b.status].sort((x, y) => x - y),
      [200, 409],
      `expected exactly one rejection: ${a.status}/${b.status}`,
    );

    const activeHeads = await prisma.staffUser.count({
      where: { role: 'HEAD_OF_DEPARTMENT', isActive: true },
    });
    assert.equal(activeHeads, 1, 'concurrent deactivations must never leave zero active heads');
  });

  it('serializes deactivation against demotion of the last two heads', async () => {
    const { first, second } = await ensureTwoActiveHeads();

    const [deactivate, demote] = await Promise.all([
      api(`/api/staff/${first.id}/status`, {
        method: 'PATCH',
        token: tokens.owner,
        body: { isActive: false },
      }),
      api(`/api/staff/${second.id}`, {
        method: 'PATCH',
        token: tokens.owner,
        body: { role: 'LECTURER' },
      }),
    ]);

    assert.deepEqual(
      [deactivate.status, demote.status].sort((x, y) => x - y),
      [200, 409],
      `expected exactly one rejection: ${deactivate.status}/${demote.status}`,
    );

    const activeHeads = await prisma.staffUser.count({
      where: { role: 'HEAD_OF_DEPARTMENT', isActive: true },
    });
    assert.equal(activeHeads, 1, 'role changes must not remove the last active head');
  });
});

describe('deleting staff accounts', () => {
  async function createAccount(staffId: string) {
    const created = await api('/api/staff', {
      method: 'POST',
      token: tokens.registrar,
      body: {
        staffId,
        fullName: `حساب ${staffId}`,
        role: 'LECTURER',
        password: 'Short6',
      },
    });
    assert.equal(created.status, 201, JSON.stringify(created.body));
    return created.body.id as string;
  }

  it('accepts a six-character password without complexity rules', async () => {
    const staffId = 'six-pass';
    const created = await api('/api/staff', {
      method: 'POST',
      token: tokens.registrar,
      body: {
        staffId,
        fullName: 'حساب بكلمة مرور قصيرة',
        role: 'LECTURER',
        password: 'abcdef',
      },
    });
    assert.equal(created.status, 201, JSON.stringify(created.body));

    const token = await login(staffId, 'abcdef');
    assert.ok(token);

    const deleted = await api(`/api/staff/${created.body.id}`, {
      method: 'DELETE',
      token: tokens.registrar,
    });
    assert.equal(deleted.status, 200, JSON.stringify(deleted.body));
  });

  it('permanently deletes an account that has no teaching history', async () => {
    const userId = await createAccount('delete-me');
    const deleted = await api(`/api/staff/${userId}`, {
      method: 'DELETE',
      token: tokens.registrar,
    });
    assert.equal(deleted.status, 200, JSON.stringify(deleted.body));
    assert.equal(deleted.body.archived, false);

    const row = await prisma.staffUser.findUnique({ where: { id: userId } });
    assert.equal(row, null);
  });

  it('archives an account with linked lectures and revokes its sessions', async () => {
    const userId = await createAccount('archive-me');
    const session = await prisma.staffSession.create({
      data: {
        userId,
        tokenHash: `test-token-${userId}`,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      },
    });
    const lecture = await prisma.lecture.create({
      data: {
        name: 'محاضرة مرتبطة بالحساب',
        qrToken: `qr_test_${userId}`,
        qrExpiresAt: new Date(Date.now() + 60 * 60 * 1000),
        createdByUserId: userId,
        conductedByUserId: userId,
      },
    });

    const deleted = await api(`/api/staff/${userId}`, {
      method: 'DELETE',
      token: tokens.registrar,
    });
    assert.equal(deleted.status, 200, JSON.stringify(deleted.body));
    assert.equal(deleted.body.archived, true);

    const row = await prisma.staffUser.findUnique({ where: { id: userId } });
    assert.ok(row, 'archived accounts stay in the database');
    assert.equal(row!.isActive, false);

    const revoked = await prisma.staffSession.findUnique({
      where: { id: session.id },
    });
    assert.ok(revoked!.revokedAt, 'archiving must end every active session');

    const keptLecture = await prisma.lecture.findUnique({
      where: { id: lecture.id },
    });
    assert.equal(keptLecture!.conductedByUserId, userId);
  });

  it('refuses to delete your own account or the system owner', async () => {
    // Earlier protection tests may revoke the head's sessions, so sign in again.
    const headToken = await login(STAFF_IDS.head, PASSWORDS.head);

    const self = await api(`/api/staff/${ids.head}`, {
      method: 'DELETE',
      token: headToken,
    });
    assert.equal(self.status, 400);

    const ownerRow = await prisma.staffUser.findUnique({
      where: { staffId: STAFF_IDS.owner },
    });
    assert.ok(ownerRow);
    const owner = await api(`/api/staff/${ownerRow!.id}`, {
      method: 'DELETE',
      token: headToken,
    });
    assert.equal(owner.status, 403);
  });
});

describe('staff management audit trail', () => {
  it('records setup, create, edit, deactivate, reactivate, password reset, and deletion', async () => {
    const logs = await prisma.auditLog.findMany();
    const actions = new Set(logs.map((log) => log.action));

    for (const action of [
      'SYSTEM_INITIAL_SETUP',
      'STAFF_CREATED',
      'STAFF_UPDATED',
      'STAFF_DEACTIVATED',
      'STAFF_REACTIVATED',
      'STAFF_PASSWORD_RESET',
      'STAFF_DELETED',
      'STAFF_ARCHIVED',
    ]) {
      assert.ok(actions.has(action), `missing audit action ${action}`);
    }

    const serialized = JSON.stringify(logs);
    for (const password of Object.values(PASSWORDS)) {
      assert.equal(serialized.includes(password), false, 'audit logs leaked a password');
    }
  });
});
