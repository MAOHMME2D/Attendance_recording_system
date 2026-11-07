/**
 * Phase 1 security tests.
 *
 * These tests run against a throwaway PostgreSQL database on the local server.
 * They never touch the live attendance database or its data.
 */
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import * as bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import { io as ioClient, type Socket as ClientSocket } from 'socket.io-client';

const API_DIR = join(__dirname, '..');

// Tests run against a throwaway PostgreSQL database created on the local
// server (runtime is PostgreSQL since the cutover). DATABASE_ADMIN_URL points
// at the maintenance database "postgres" and is configured in apps/api/.env.
const TEST_DB_NAME = `att_test_security_${process.pid}_${Date.now()}`.slice(0, 63);
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

const PASSWORD = 'TestPassword123!';
const STAFF = {
  head: { staffId: 'head1', fullName: 'رئيس القسم', role: 'HEAD_OF_DEPARTMENT' },
  registrar: { staffId: 'registrar1', fullName: 'المسجل', role: 'REGISTRAR' },
  lecturerA: { staffId: 'lecturer-a', fullName: 'محاضر أ', role: 'LECTURER' },
  lecturerB: { staffId: 'lecturer-b', fullName: 'محاضر ب', role: 'LECTURER' },
  techA: { staffId: 'tech-a', fullName: 'محاضر تقني أ', role: 'TECHNICAL_LECTURER' },
  techB: { staffId: 'tech-b', fullName: 'محاضر تقني ب', role: 'TECHNICAL_LECTURER' },
} as const;

type StaffKey = keyof typeof STAFF;

let app: any;
let prisma: PrismaClient;
let baseUrl = '';
let wsUrl = '';
const tokens: Partial<Record<StaffKey, string>> = {};
const userIds: Partial<Record<StaffKey, string>> = {};
let rotatedQr = '';
const ids = {
  sectionOne: '',
  courseStage2: '',
  lectureMine: '',
  lectureOther: '',
  lectureTech: '',
  studentWithTokenId: '',
  studentWithTokenQr: 'qr_phase1_opaque_test_token_0001',
  studentLegacyCode: 'LEGACY-0001',
  revokedQr: 'qr_phase1_revoked_test_token_0002',
  studentRotateId: '',
  rotateOldQr: 'qr_phase1_rotate_old_0003',
};

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

async function login(key: StaffKey, password = PASSWORD): Promise<string> {
  const result = await api('/api/auth/login', {
    method: 'POST',
    body: { staffId: STAFF[key].staffId, password },
  });
  assert.equal(result.status, 200, `login ${key} failed: ${JSON.stringify(result.body)}`);
  const cookie = result.setCookie || '';
  const match = cookie.match(/attendance_session=([^;]+)/);
  assert.ok(match, `login ${key} did not set the session cookie`);
  return decodeURIComponent(match![1]);
}

function connectSocket(token?: string): Promise<ClientSocket> {
  return new Promise((resolve, reject) => {
    const socket = ioClient(`${wsUrl}/attendance`, {
      transports: ['websocket'],
      reconnection: false,
      timeout: 4000,
      extraHeaders: token ? { Cookie: `attendance_session=${token}` } : {},
    });
    const timer = setTimeout(() => {
      socket.close();
      reject(new Error('socket connection timed out'));
    }, 5000);
    socket.once('connect', () => {
      clearTimeout(timer);
      resolve(socket);
    });
    socket.once('connect_error', (error: Error) => {
      clearTimeout(timer);
      reject(error);
    });
  });
}

function waitForEvent<T = any>(
  socket: ClientSocket,
  event: string,
  timeoutMs = 4000,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off(event, handler);
      reject(new Error(`timed out waiting for "${event}"`));
    }, timeoutMs);
    const handler = (payload: T) => {
      clearTimeout(timer);
      resolve(payload);
    };
    socket.once(event, handler);
  });
}

before(async () => {
  await applySchema();

  prisma = new PrismaClient({ datasources: { db: { url: TEST_DB_URL } } });
  await prisma.$connect();

  const passwordHash = await bcrypt.hash(PASSWORD, 4);
  for (const key of Object.keys(STAFF) as StaffKey[]) {
    const staff = STAFF[key];
    const created = await prisma.staffUser.create({
      data: {
        staffId: staff.staffId,
        fullName: staff.fullName,
        role: staff.role,
        passwordHash,
        isActive: true,
      },
    });
    userIds[key] = created.id;
  }

  // Phase 2 academic structure: one stage-2 section and course. Lecturer A and
  // technical lecturer A are assigned to it; the admin roles need no assignment.
  const sectionOne = await prisma.section.create({
    data: { stage: 2, studyPeriod: 'MORNING', name: '1', label: 'الشعبة الأولى' },
  });
  ids.sectionOne = sectionOne.id;

  const courseStage2 = await prisma.course.create({
    data: { code: 'CS201', name: 'مادة اختبار', stage: 2 },
  });
  ids.courseStage2 = courseStage2.id;

  await prisma.teachingAssignment.createMany({
    data: [
      { staffUserId: userIds.lecturerA!, courseId: courseStage2.id },
      { staffUserId: userIds.techA!, courseId: courseStage2.id },
    ],
  });

  const studentWithToken = await prisma.student.create({
    data: {
      studentCode: 'STUDENT-0001',
      name: 'طالب أول',
      stage: 2,
      studyPeriod: 'MORNING',
      section: '1',
      sectionId: sectionOne.id,
      qrTokens: {
        create: { token: ids.studentWithTokenQr },
      },
    },
  });
  ids.studentWithTokenId = studentWithToken.id;

  await prisma.student.create({
    data: {
      studentCode: ids.studentLegacyCode,
      name: 'طالب ثانٍ',
      stage: 2,
      studyPeriod: 'MORNING',
      section: '1',
      sectionId: sectionOne.id,
      qrTokens: {
        create: {
          token: ids.revokedQr,
          revokedAt: new Date(),
        },
      },
    },
  });

  const studentRotate = await prisma.student.create({
    data: {
      studentCode: 'ROTATE-0003',
      name: 'طالب ثالث',
      stage: 2,
      studyPeriod: 'MORNING',
      section: '1',
      sectionId: sectionOne.id,
      qrTokens: {
        create: { token: ids.rotateOldQr },
      },
    },
  });
  ids.studentRotateId = studentRotate.id;

  // Lecture owned and conducted by lecturer A.
  const lectureMine = await prisma.lecture.create({
    data: {
      name: 'محاضرة المحاضر أ',
      studyPeriod: 'MORNING',
      section: '1',
      courseId: courseStage2.id,
      status: 'ACTIVE',
      qrToken: 'lecture-qr-mine-0001',
      qrExpiresAt: new Date(Date.now() + 60 * 60 * 1000),
      createdByUserId: userIds.lecturerA,
      conductedByUserId: userIds.lecturerA,
    },
  });
  ids.lectureMine = lectureMine.id;

  // Lecture owned and conducted by lecturer B.
  const lectureOther = await prisma.lecture.create({
    data: {
      name: 'محاضرة المحاضر ب',
      studyPeriod: 'MORNING',
      section: '1',
      courseId: courseStage2.id,
      status: 'ACTIVE',
      qrToken: 'lecture-qr-other-0002',
      qrExpiresAt: new Date(Date.now() + 60 * 60 * 1000),
      createdByUserId: userIds.lecturerB,
      conductedByUserId: userIds.lecturerB,
    },
  });
  ids.lectureOther = lectureOther.id;

  // Lecture conducted by technical lecturer A.
  const lectureTech = await prisma.lecture.create({
    data: {
      name: 'محاضرة المحاضر التقني',
      studyPeriod: 'MORNING',
      section: '1',
      courseId: courseStage2.id,
      status: 'ACTIVE',
      qrToken: 'lecture-qr-tech-0003',
      qrExpiresAt: new Date(Date.now() + 60 * 60 * 1000),
      createdByUserId: userIds.techA,
      conductedByUserId: userIds.techA,
    },
  });
  ids.lectureTech = lectureTech.id;

  // Boot the real compiled Nest application (guards, DTO validation, Socket.IO
  // gateway). Decorator metadata requires the compiled output: tsx/esbuild does
  // not emit `emitDecoratorMetadata`, so importing src directly breaks Nest DI.
  const { NestFactory } = await import('@nestjs/core');
  const { AppModule } = await import('../dist/app.module');
  const { IoAdapter } = await import('@nestjs/platform-socket.io');
  const { ValidationPipe } = await import('@nestjs/common');

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
  wsUrl = `http://127.0.0.1:${port}`;

  // Establish one session per role. Kept under the 10-per-IP limiter.
  for (const key of Object.keys(STAFF) as StaffKey[]) {
    tokens[key] = await login(key);
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

describe('staff authentication', () => {
  it('logs in with valid credentials and never exposes the raw session token in JSON', async () => {
    const result = await api('/api/auth/login', {
      method: 'POST',
      body: { staffId: STAFF.head.staffId, password: PASSWORD },
    });

    assert.equal(result.status, 200);
    assert.equal(result.body.user.staffId, STAFF.head.staffId);
    assert.equal(result.body.user.role, 'HEAD_OF_DEPARTMENT');
    assert.ok(Array.isArray(result.body.user.permissions));
    assert.ok(result.body.expiresAt);
    assert.equal(result.body.token, undefined, 'raw token must not be in the JSON body');
    assert.ok(String(result.setCookie).includes('attendance_session='));
    assert.ok(String(result.setCookie).toLowerCase().includes('httponly'));
  });

  it('rejects a wrong password with 401', async () => {
    const result = await api('/api/auth/login', {
      method: 'POST',
      body: { staffId: STAFF.lecturerA.staffId, password: 'WrongPassword123!' },
    });
    assert.equal(result.status, 401);
    assert.equal(result.setCookie, null);
  });

  it('returns the current user for a valid session and rejects after logout', async () => {
    // Use a dedicated login so the shared test tokens stay valid.
    const sessionToken = await login('techB');

    const me = await api('/api/auth/me', { token: sessionToken });
    assert.equal(me.status, 200);
    assert.equal(me.body.role, 'TECHNICAL_LECTURER');

    const logout = await api('/api/auth/logout', {
      method: 'POST',
      token: sessionToken,
    });
    assert.equal(logout.status, 200);

    const afterLogout = await api('/api/auth/me', { token: sessionToken });
    assert.equal(afterLogout.status, 401);
  });
});

describe('unauthenticated access', () => {
  it('blocks protected HTTP endpoints without a session', async () => {
    for (const path of ['/api/students', '/api/lectures', '/api/sections']) {
      const result = await api(path);
      assert.equal(result.status, 401, `${path} should require authentication`);
    }
  });

  it('keeps the admin student QR endpoint closed', async () => {
    const result = await api(`/api/students/${ids.studentWithTokenId}/qr`);
    assert.equal(result.status, 401);
  });

  it('disables public student self check-in', async () => {
    const result = await api('/api/attendance/register', {
      method: 'POST',
      body: { token: 'anything', studentIdentifier: 'anything' },
    });
    assert.equal(result.status, 410);
  });
});

describe('role-based access control', () => {
  it('allows the head of department and registrar to read the full student list', async () => {
    for (const key of ['head', 'registrar'] as StaffKey[]) {
      const result = await api('/api/students', { token: tokens[key]! });
      assert.equal(result.status, 200);
    }
  });

  it('denies the full student list to a lecturer', async () => {
    const result = await api('/api/students', { token: tokens.lecturerA! });
    assert.equal(result.status, 403);
  });

  it('denies student data entirely to a technical lecturer', async () => {
    const full = await api('/api/students', { token: tokens.techA! });
    assert.equal(full.status, 403);

    const options = await api('/api/students/options', { token: tokens.techA! });
    assert.equal(options.status, 403);
  });

  it('lists only its own lectures to a technical lecturer', async () => {
    const result = await api('/api/lectures', { token: tokens.techA! });
    assert.equal(result.status, 200);
    assert.ok(Array.isArray(result.body));
    assert.ok(result.body.length >= 1);
    assert.ok(
      result.body.some((lecture: any) => lecture.id === ids.lectureTech),
      'technical lecturer must see the lecture it conducts',
    );
    assert.equal(
      result.body.some((lecture: any) => lecture.id === ids.lectureMine),
      false,
      'technical lecturer must not see lectures it does not conduct',
    );
    for (const lecture of result.body) {
      assert.equal(lecture.conductedByUserId, userIds.techA);
    }
  });

  it('cannot manage courses or assignments', async () => {
    const course = await api('/api/courses', {
      method: 'POST',
      token: tokens.techA!,
      body: { code: 'TECH-1', name: 'غير مسموح', stage: 2 },
    });
    assert.equal(course.status, 403);

    const assignment = await api('/api/assignments', {
      method: 'POST',
      token: tokens.techA!,
      body: { staffUserId: userIds.techA, courseId: ids.courseStage2 },
    });
    assert.equal(assignment.status, 403);
  });

  it('allows the registrar to manage sections', async () => {
    const result = await api('/api/sections', {
      method: 'POST',
      token: tokens.registrar!,
      body: { studyPeriod: 'MORNING', name: '99', label: 'شعبة اختبار' },
    });
    assert.equal(result.status, 201);
  });

  it('denies section management to a lecturer', async () => {
    const result = await api('/api/sections', {
      method: 'POST',
      token: tokens.lecturerA!,
      body: { studyPeriod: 'MORNING', name: '98' },
    });
    assert.equal(result.status, 403);
  });
});

describe('technical lecturer restrictions', () => {
  it('can only open lectures it conducts', async () => {
    const own = await api(`/api/lectures/${ids.lectureTech}`, { token: tokens.techA! });
    assert.equal(own.status, 200);

    const foreign = await api(`/api/lectures/${ids.lectureMine}`, {
      token: tokens.techA!,
    });
    assert.equal(foreign.status, 403);

    const otherTech = await api(`/api/lectures/${ids.lectureTech}`, {
      token: tokens.techB!,
    });
    assert.equal(otherTech.status, 403);
  });

  it('cannot add attendance manually', async () => {
    const result = await api(`/api/attendance/${ids.lectureTech}/manual`, {
      method: 'POST',
      token: tokens.techA!,
      body: { studentName: ids.studentLegacyCode },
    });
    assert.equal(result.status, 403);
  });

  it('can scan a card into its own lecture', async () => {
    const result = await api(`/api/attendance/${ids.lectureTech}/scan-student`, {
      method: 'POST',
      token: tokens.techA!,
      body: { studentCode: ids.studentWithTokenQr },
    });
    assert.equal(result.status, 201);
    assert.equal(result.body.success, true);
  });
});

describe('lecturer isolation', () => {
  it('prevents reading another lecturer lecture, attendance and actions', async () => {
    const lecture = await api(`/api/lectures/${ids.lectureMine}`, {
      token: tokens.lecturerB!,
    });
    assert.equal(lecture.status, 403);

    const attendance = await api(`/api/attendance/${ids.lectureMine}`, {
      token: tokens.lecturerB!,
    });
    assert.equal(attendance.status, 403);

    const close = await api(`/api/lectures/${ids.lectureMine}/close`, {
      method: 'PATCH',
      token: tokens.lecturerB!,
    });
    assert.equal(close.status, 403);
  });

  it('lets each lecturer read their own lecture', async () => {
    const mine = await api(`/api/lectures/${ids.lectureMine}`, {
      token: tokens.lecturerA!,
    });
    assert.equal(mine.status, 200);

    const other = await api(`/api/lectures/${ids.lectureOther}`, {
      token: tokens.lecturerB!,
    });
    assert.equal(other.status, 200);
  });

  it('lets administrative roles read any lecture', async () => {
    const result = await api(`/api/lectures/${ids.lectureOther}`, {
      token: tokens.registrar!,
    });
    assert.equal(result.status, 200);
  });
});

describe('student QR-only attendance', () => {
  it('accepts an active opaque QR token', async () => {
    const result = await api(`/api/attendance/${ids.lectureMine}/scan-student`, {
      method: 'POST',
      token: tokens.lecturerA!,
      body: { studentCode: ids.studentWithTokenQr },
    });
    assert.equal(result.status, 201);
    assert.equal(result.body.success, true);
    assert.equal(result.body.studentName, 'طالب أول');
  });

  it('rejects a legacy sequential student code', async () => {
    const result = await api(`/api/attendance/${ids.lectureMine}/scan-student`, {
      method: 'POST',
      token: tokens.lecturerA!,
      body: { studentCode: ids.studentLegacyCode },
    });
    assert.equal(result.status, 400);
    assert.match(String(result.body.message), /QR|رمز/);

    const records = await prisma.attendanceRecord.count({
      where: { lectureId: ids.lectureMine, studentCode: ids.studentLegacyCode },
    });
    assert.equal(records, 0, 'a studentCode must never create an attendance record');
  });

  it('rejects a full student name', async () => {
    const result = await api(`/api/attendance/${ids.lectureMine}/scan-student`, {
      method: 'POST',
      token: tokens.lecturerA!,
      body: { studentCode: 'طالب ثانٍ' },
    });
    assert.equal(result.status, 400);
  });

  it('rejects an unknown QR token', async () => {
    const result = await api(`/api/attendance/${ids.lectureMine}/scan-student`, {
      method: 'POST',
      token: tokens.lecturerA!,
      body: { studentCode: 'qr_unknown_token_9999' },
    });
    assert.equal(result.status, 400);
  });

  it('rejects a revoked QR token instead of falling back to studentCode or name', async () => {
    const result = await api(`/api/attendance/${ids.lectureMine}/scan-student`, {
      method: 'POST',
      token: tokens.lecturerA!,
      body: { studentCode: ids.revokedQr },
    });
    assert.equal(result.status, 400);

    const records = await prisma.attendanceRecord.count({
      where: {
        lectureId: ids.lectureMine,
        studentId: (
          await prisma.student.findUnique({
            where: { studentCode: ids.studentLegacyCode },
            select: { id: true },
          })
        )?.id,
      },
    });
    assert.equal(records, 0, 'a revoked token must not register attendance');
  });

  it('revokes the old card on rotation and accepts only the new token', async () => {
    const rotated = await api(`/api/students/${ids.studentRotateId}/qr/rotate`, {
      method: 'POST',
      token: tokens.head!,
    });
    assert.equal(rotated.status, 201, JSON.stringify(rotated.body));
    rotatedQr = rotated.body.token;
    assert.notEqual(rotatedQr, ids.rotateOldQr);
    assert.match(rotatedQr, /^qr_/);

    const oldCard = await api(`/api/attendance/${ids.lectureMine}/scan-student`, {
      method: 'POST',
      token: tokens.lecturerA!,
      body: { studentCode: ids.rotateOldQr },
    });
    assert.equal(oldCard.status, 400, 'the old card must be rejected after rotation');

    const newCard = await api(`/api/attendance/${ids.lectureMine}/scan-student`, {
      method: 'POST',
      token: tokens.lecturerA!,
      body: { studentCode: rotatedQr },
    });
    assert.equal(newCard.status, 201, JSON.stringify(newCard.body));
    assert.equal(newCard.body.studentName, 'طالب ثالث');
  });

  it('never exposes QR tokens in the student list', async () => {
    const result = await api('/api/students', { token: tokens.head! });
    assert.equal(result.status, 200);
    assert.ok(Array.isArray(result.body));
    assert.ok(result.body.length > 0);

    for (const student of result.body) {
      assert.equal(
        Object.prototype.hasOwnProperty.call(student, 'qrToken'),
        false,
        'GET /students must not contain a qrToken field',
      );
    }

    const serialized = JSON.stringify(result.body);
    for (const secret of [ids.studentWithTokenQr, ids.revokedQr, rotatedQr, ids.rotateOldQr]) {
      assert.equal(serialized.includes(secret), false, 'student list leaked a QR token');
    }
  });

  it('keeps the dedicated QR endpoint authorized and revocable', async () => {
    const authorized = await api(`/api/students/${ids.studentWithTokenId}/qr`, {
      token: tokens.head!,
    });
    assert.equal(authorized.status, 200);
    assert.equal(authorized.body.token, ids.studentWithTokenQr);

    const forbidden = await api(`/api/students/${ids.studentWithTokenId}/qr`, {
      token: tokens.lecturerA!,
    });
    assert.equal(forbidden.status, 403);
  });
});

describe('core lecture flow', () => {
  it('creates a lecture with the actor as conductor, then closes it', async () => {
    const created = await api('/api/lectures', {
      method: 'POST',
      token: tokens.lecturerA!,
      body: {
        name: 'محاضرة اختبار',
        studyPeriod: 'MORNING',
        section: '1',
        courseId: ids.courseStage2,
      },
    });
    assert.equal(created.status, 201);
    assert.equal(created.body.createdByUserId, userIds.lecturerA);
    assert.equal(created.body.conductedByUserId, userIds.lecturerA);
    assert.equal(created.body.status, 'ACTIVE');

    const closed = await api(`/api/lectures/${created.body.id}/close`, {
      method: 'PATCH',
      token: tokens.lecturerA!,
    });
    assert.equal(closed.status, 200);
    assert.equal(closed.body.lectureId, created.body.id);
    assert.ok(
      closed.body.present + closed.body.absent > 0,
      'closing a lecture must produce attendance rows',
    );

    const reloaded = await api(`/api/lectures/${created.body.id}`, {
      token: tokens.lecturerA!,
    });
    assert.equal(reloaded.status, 200);
    assert.equal(reloaded.body.status, 'CLOSED');
  });
});

describe('WebSocket room authorization', () => {
  it('rejects anonymous sockets', async () => {
    const socket = ioClient(`${wsUrl}/attendance`, {
      transports: ['websocket'],
      reconnection: false,
      timeout: 4000,
    });
    try {
      const error = await new Promise<any>((resolve, reject) => {
        const timer = setTimeout(
          () => reject(new Error('timed out waiting for "auth:error"')),
          4000,
        );
        socket.once('auth:error', (payload: any) => {
          clearTimeout(timer);
          resolve(payload);
        });
        socket.once('connect_error', (err: Error) => {
          clearTimeout(timer);
          reject(err);
        });
      });
      assert.ok(error.message);
    } finally {
      socket.close();
    }
  });

  it('denies joining another lecturer lecture room', async () => {
    const socket = await connectSocket(tokens.lecturerB!);
    try {
      const denied = waitForEvent(socket, 'lecture:join:denied');
      socket.emit('lecture:join', { lectureId: ids.lectureMine });
      const payload = await denied;
      assert.match(payload.message, /صلاحية الانضمام/, `unexpected denial: ${payload.message}`);
    } finally {
      socket.close();
    }
  });

  it('allows joining an authorized lecture room', async () => {
    const socket = await connectSocket(tokens.lecturerA!);
    try {
      const joined = waitForEvent(socket, 'lecture:joined');
      socket.emit('lecture:join', { lectureId: ids.lectureMine });
      const payload = await joined;
      assert.equal(payload.lectureId, ids.lectureMine);
    } finally {
      socket.close();
    }
  });
});
