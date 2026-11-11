/**
 * Phase 2 tests: academic stages, sections, courses, lecturer assignments,
 * student management/imports, scoped lectures and read-only follow-up.
 *
 * Like the security suite these tests run against a throwaway PostgreSQL
 * database and never touch the live data.
 */
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import * as bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const API_DIR = join(__dirname, '..');

const TEST_DB_NAME = `att_test_phase2_${process.pid}_${Date.now()}`.slice(0, 63);
const TEST_ADMIN_URL = postgresAdminUrl();
const TEST_DB_URL = TEST_ADMIN_URL.replace(
  /\/postgres(\?.*)?$/,
  `/${TEST_DB_NAME}$1`,
);

process.env.DATABASE_URL = TEST_DB_URL;
process.env.NODE_ENV = 'test';
process.env.COOKIE_SECURE = 'false';
process.env.SESSION_TTL_HOURS = '1';

const PASSWORD = 'TestPassword123!';
const STAFF = {
  head: { staffId: 'head2', fullName: 'رئيس القسم', role: 'HEAD_OF_DEPARTMENT' },
  registrar: { staffId: 'registrar2', fullName: 'المسجل', role: 'REGISTRAR' },
  lecturerA: { staffId: 'lecturer-a2', fullName: 'محاضر أ', role: 'LECTURER' },
  lecturerB: { staffId: 'lecturer-b2', fullName: 'محاضر ب', role: 'LECTURER' },
  techA: { staffId: 'tech-a2', fullName: 'محاضر تقني أ', role: 'TECHNICAL_LECTURER' },
  techB: { staffId: 'tech-b2', fullName: 'محاضر تقني ب', role: 'TECHNICAL_LECTURER' },
} as const;

type StaffKey = keyof typeof STAFF;

let app: any;
let prisma: PrismaClient;
let baseUrl = '';
const tokens: Partial<Record<StaffKey, string>> = {};
const userIds: Partial<Record<StaffKey, string>> = {};

const ids = {
  sectionS1A: '',
  sectionS1B: '',
  sectionS2A: '',
  sectionS2B: '',
  sectionS3A: '',
  courseC1: '',
  courseC2: '',
  courseC3: '',
  studentA: '',
  studentB: '',
  studentC: '',
  studentD: '',
  studentStage3: '',
  codeA: '',
  codeB: '',
  codeC: '',
  codeD: '',
  codeStage3: '',
  closedLectureC1: '',
  activeLectureC1: '',
  closedLectureC2: '',
  tempSection: '',
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

async function login(key: StaffKey): Promise<string> {
  const result = await api('/api/auth/login', {
    method: 'POST',
    body: { staffId: STAFF[key].staffId, password: PASSWORD },
  });
  assert.equal(result.status, 200, `login ${key} failed: ${JSON.stringify(result.body)}`);
  const cookie = result.setCookie || '';
  const match = cookie.match(/attendance_session=([^;]+)/);
  assert.ok(match, `login ${key} did not set the session cookie`);
  return decodeURIComponent(match![1]);
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

  // Sections and courses for stages 1..3. Stage 4 is deliberately empty.
  const s1a = await prisma.section.create({
    data: { stage: 1, studyPeriod: 'MORNING', name: '1', label: 'الأولى 1' },
  });
  const s1b = await prisma.section.create({
    data: { stage: 1, studyPeriod: 'MORNING', name: '2', label: 'الأولى 2' },
  });
  const s2a = await prisma.section.create({
    data: { stage: 2, studyPeriod: 'MORNING', name: '1', label: 'الثانية 1' },
  });
  const s2b = await prisma.section.create({
    data: { stage: 2, studyPeriod: 'MORNING', name: '2', label: 'الثانية 2' },
  });
  const s3a = await prisma.section.create({
    data: { stage: 3, studyPeriod: 'MORNING', name: '1', label: 'الثالثة 1' },
  });
  ids.sectionS1A = s1a.id;
  ids.sectionS1B = s1b.id;
  ids.sectionS2A = s2a.id;
  ids.sectionS2B = s2b.id;
  ids.sectionS3A = s3a.id;

  const c1 = await prisma.course.create({
    data: { code: 'CS201', name: 'الخوارزميات', stage: 2 },
  });
  const c2 = await prisma.course.create({
    data: { code: 'CS202', name: 'قواعد البيانات', stage: 2 },
  });
  const c3 = await prisma.course.create({
    data: { code: 'CS301', name: 'الشبكات', stage: 3 },
  });
  ids.courseC1 = c1.id;
  ids.courseC2 = c2.id;
  ids.courseC3 = c3.id;

  await prisma.teachingAssignment.createMany({
    data: [
      { staffUserId: userIds.lecturerA!, courseId: c1.id },
      { staffUserId: userIds.lecturerA!, courseId: c3.id },
      { staffUserId: userIds.lecturerB!, courseId: c2.id },
      { staffUserId: userIds.techA!, courseId: c1.id },
    ],
  });

  const students = [
    { code: 'S2-8001', name: 'طالب أ', stage: 2, sectionId: s2a.id, section: '1' },
    { code: 'S2-8002', name: 'طالب ب', stage: 2, sectionId: s2a.id, section: '1' },
    { code: 'S2-8003', name: 'طالب ج', stage: 2, sectionId: s2a.id, section: '1' },
    { code: 'S2-8004', name: 'طالب د', stage: 2, sectionId: s2b.id, section: '2' },
    { code: 'S3-9001', name: 'طالب ثالثة', stage: 3, sectionId: s3a.id, section: '1' },
  ];

  const created: Record<string, { id: string; studentCode: string; name: string }> = {};
  for (const student of students) {
    const row = await prisma.student.create({
      data: {
        studentCode: student.code,
        name: student.name,
        stage: student.stage,
        studyPeriod: 'MORNING',
        section: student.section,
        sectionId: student.sectionId,
      },
    });
    created[student.name] = row;
  }

  ids.studentA = created['طالب أ'].id;
  ids.studentB = created['طالب ب'].id;
  ids.studentC = created['طالب ج'].id;
  ids.studentD = created['طالب د'].id;
  ids.studentStage3 = created['طالب ثالثة'].id;
  ids.codeA = created['طالب أ'].studentCode;
  ids.codeB = created['طالب ب'].studentCode;
  ids.codeC = created['طالب ج'].studentCode;
  ids.codeD = created['طالب د'].studentCode;
  ids.codeStage3 = created['طالب ثالثة'].studentCode;

  const closedC1 = await prisma.lecture.create({
    data: {
      name: 'محاضرة مغلقة - الخوارزميات',
      studyPeriod: 'MORNING',
      section: '1',
      courseId: c1.id,
      status: 'CLOSED',
      qrToken: 'phase2-closed-c1',
      qrExpiresAt: new Date(Date.now() + 60 * 60 * 1000),
      createdByUserId: userIds.lecturerA,
      conductedByUserId: userIds.lecturerA,
      closedAt: new Date(),
    },
  });
  ids.closedLectureC1 = closedC1.id;

  const activeC1 = await prisma.lecture.create({
    data: {
      name: 'محاضرة نشطة - الخوارزميات',
      studyPeriod: 'MORNING',
      section: '1',
      courseId: c1.id,
      status: 'ACTIVE',
      qrToken: 'phase2-active-c1',
      qrExpiresAt: new Date(Date.now() + 60 * 60 * 1000),
      createdByUserId: userIds.lecturerA,
      conductedByUserId: userIds.lecturerA,
    },
  });
  ids.activeLectureC1 = activeC1.id;

  const closedC2 = await prisma.lecture.create({
    data: {
      name: 'محاضرة مغلقة - قواعد البيانات',
      studyPeriod: 'MORNING',
      section: '1',
      courseId: c2.id,
      status: 'CLOSED',
      qrToken: 'phase2-closed-c2',
      qrExpiresAt: new Date(Date.now() + 60 * 60 * 1000),
      createdByUserId: userIds.lecturerB,
      conductedByUserId: userIds.lecturerB,
      closedAt: new Date(),
    },
  });
  ids.closedLectureC2 = closedC2.id;

  const records = [
    { lectureId: closedC1.id, student: created['طالب أ'], status: 'PRESENT' },
    { lectureId: closedC1.id, student: created['طالب ب'], status: 'ABSENT' },
    { lectureId: closedC1.id, student: created['طالب ج'], status: 'PRESENT' },
    { lectureId: closedC1.id, student: created['طالب د'], status: 'ABSENT' },
    // Active lecture: must never appear in follow-up statistics.
    { lectureId: activeC1.id, student: created['طالب أ'], status: 'PRESENT' },
    { lectureId: closedC2.id, student: created['طالب أ'], status: 'ABSENT' },
    { lectureId: closedC2.id, student: created['طالب ب'], status: 'PRESENT' },
  ];
  for (const record of records) {
    await prisma.attendanceRecord.create({
      data: {
        lectureId: record.lectureId,
        studentId: record.student.id,
        studentCode: record.student.studentCode,
        studentName: record.student.name,
        status: record.status,
      },
    });
  }

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

  for (const key of Object.keys(STAFF) as StaffKey[]) {
    tokens[key] = await login(key);
  }
});

after(async () => {
  // Active lectures keep an in-memory QR rotation interval alive. Stop every
  // interval before closing the app so the test process can exit.
  try {
    if (app) {
      const { LectureService } = await import('../dist/modules/lecture/lecture.service');
      const lectureService: any = app.get(LectureService);
      const intervals: Map<string, unknown> = lectureService.tokenRotationIntervals;
      for (const lectureId of Array.from(intervals.keys())) {
        lectureService.stopRotation(lectureId);
      }
    }
  } catch {
    // Cleanup is best-effort; the process must still attempt to close the app.
  }
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

describe('sections and academic stages', () => {
  it('scopes section reads to the stages taught by a lecturer', async () => {
    const result = await api('/api/sections', { token: tokens.lecturerA! });
    assert.equal(result.status, 200);
    assert.ok(Array.isArray(result.body));
    assert.ok(result.body.length > 0);
    for (const section of result.body) {
      assert.ok([2, 3].includes(section.stage), `unexpected stage ${section.stage}`);
    }
    assert.equal(
      result.body.some((section: any) => section.id === ids.sectionS1A),
      false,
      'lecturer must not see a stage they do not teach',
    );

    const outOfScope = await api('/api/sections?stage=1', {
      token: tokens.lecturerA!,
    });
    assert.equal(outOfScope.status, 200);
    assert.deepEqual(outOfScope.body, []);
  });

  it('enforces unique section names per stage and rejects invalid stages', async () => {
    const created = await api('/api/sections', {
      method: 'POST',
      token: tokens.registrar!,
      body: { stage: 1, studyPeriod: 'MORNING', name: '7', label: 'اختبار' },
    });
    assert.equal(created.status, 201, JSON.stringify(created.body));
    ids.tempSection = created.body.id;

    const duplicate = await api('/api/sections', {
      method: 'POST',
      token: tokens.registrar!,
      body: { stage: 1, studyPeriod: 'MORNING', name: '7' },
    });
    assert.equal(duplicate.status, 409);

    const otherStage = await api('/api/sections', {
      method: 'POST',
      token: tokens.registrar!,
      body: { stage: 2, studyPeriod: 'MORNING', name: '7' },
    });
    assert.equal(otherStage.status, 201, JSON.stringify(otherStage.body));
    const cleanup = await api(`/api/sections/${otherStage.body.id}`, {
      method: 'DELETE',
      token: tokens.registrar!,
    });
    assert.equal(cleanup.status, 200);

    const invalidStage = await api('/api/sections', {
      method: 'POST',
      token: tokens.registrar!,
      body: { stage: 5, studyPeriod: 'MORNING', name: '8' },
    });
    assert.equal(invalidStage.status, 400);
  });

  it('renames a section, syncs students and protects non-empty sections', async () => {
    const student = await api('/api/students', {
      method: 'POST',
      token: tokens.head!,
      body: {
        name: 'طالب شعبة مؤقتة',
        stage: 1,
        sectionId: ids.tempSection,
      },
    });
    assert.equal(student.status, 201, JSON.stringify(student.body));
    assert.match(student.body.studentCode, /^S1-\d+$/);

    const renamed = await api(`/api/sections/${ids.tempSection}`, {
      method: 'PUT',
      token: tokens.registrar!,
      body: { name: '77' },
    });
    assert.equal(renamed.status, 200, JSON.stringify(renamed.body));
    assert.equal(renamed.body.stage, 1);

    const list = await api(`/api/students?sectionId=${ids.tempSection}`, {
      token: tokens.head!,
    });
    assert.equal(list.status, 200);
    assert.equal(list.body.length, 1);
    assert.equal(list.body[0].section, '77');
    assert.equal(list.body[0].stage, 1);

    const blocked = await api(`/api/sections/${ids.tempSection}`, {
      method: 'DELETE',
      token: tokens.registrar!,
    });
    assert.equal(blocked.status, 409);

    const removeStudent = await api(`/api/students/${student.body.id}`, {
      method: 'DELETE',
      token: tokens.head!,
    });
    assert.equal(removeStudent.status, 200);
    assert.equal(removeStudent.body.mode, 'HARD');

    const removed = await api(`/api/sections/${ids.tempSection}`, {
      method: 'DELETE',
      token: tokens.registrar!,
    });
    assert.equal(removed.status, 200);
    ids.tempSection = '';
  });
});

describe('courses', () => {
  it('shows assigned courses to a lecturer and everything to the registrar', async () => {
    const mine = await api('/api/courses', { token: tokens.lecturerA! });
    assert.equal(mine.status, 200);
    const mineIds = mine.body.map((course: any) => course.id).sort();
    assert.deepEqual(mineIds, [ids.courseC1, ids.courseC3].sort());
    assert.equal(mine.body.some((course: any) => course.id === ids.courseC2), false);

    const all = await api('/api/courses', { token: tokens.registrar! });
    assert.equal(all.status, 200);
    assert.ok(all.body.length >= 3);
  });

  it('creates courses per stage and rejects duplicate codes inside a stage', async () => {
    const created = await api('/api/courses', {
      method: 'POST',
      token: tokens.registrar!,
      body: { code: 'NEW101', name: 'مادة جديدة', stage: 2 },
    });
    assert.equal(created.status, 201, JSON.stringify(created.body));

    const duplicate = await api('/api/courses', {
      method: 'POST',
      token: tokens.registrar!,
      body: { code: 'NEW101', name: 'مادة مكررة', stage: 2 },
    });
    assert.equal(duplicate.status, 409);

    const otherStage = await api('/api/courses', {
      method: 'POST',
      token: tokens.registrar!,
      body: { code: 'NEW101', name: 'مادة جديدة 3', stage: 3 },
    });
    assert.equal(otherStage.status, 201, JSON.stringify(otherStage.body));

    const updated = await api(`/api/courses/${created.body.id}`, {
      method: 'PUT',
      token: tokens.registrar!,
      body: { name: 'مادة محدثة' },
    });
    assert.equal(updated.status, 200);
    assert.equal(updated.body.name, 'مادة محدثة');

    for (const id of [created.body.id, otherStage.body.id]) {
      const removed = await api(`/api/courses/${id}`, {
        method: 'DELETE',
        token: tokens.registrar!,
      });
      assert.equal(removed.status, 200);
    }
  });

  it('refuses to delete a course that still has lectures', async () => {
    const result = await api(`/api/courses/${ids.courseC2}`, {
      method: 'DELETE',
      token: tokens.registrar!,
    });
    assert.equal(result.status, 409);
  });

  it('denies course management to lecturers', async () => {
    const result = await api('/api/courses', {
      method: 'POST',
      token: tokens.lecturerA!,
      body: { code: 'NOPE', name: 'غير مسموح', stage: 2 },
    });
    assert.equal(result.status, 403);
  });
});

describe('student management and Excel import', () => {
  it('creates students with a stage-prefixed code and rejects duplicates', async () => {
    const created = await api('/api/students', {
      method: 'POST',
      token: tokens.head!,
      body: {
        studentCode: 'S1-CUSTOM-1',
        name: 'طالب مخصص',
        stage: 1,
        sectionId: ids.sectionS1B,
      },
    });
    assert.equal(created.status, 201, JSON.stringify(created.body));
    assert.equal(created.body.studentCode, 'S1-CUSTOM-1');
    assert.equal(created.body.stage, 1);

    const duplicate = await api('/api/students', {
      method: 'POST',
      token: tokens.head!,
      body: {
        studentCode: 'S1-CUSTOM-1',
        name: 'طالب آخر',
        stage: 1,
        sectionId: ids.sectionS1B,
      },
    });
    assert.equal(duplicate.status, 409);

    const auto = await api('/api/students', {
      method: 'POST',
      token: tokens.head!,
      body: { name: 'طالب تلقائي', stage: 1, sectionId: ids.sectionS1B },
    });
    assert.equal(auto.status, 201, JSON.stringify(auto.body));
    assert.match(auto.body.studentCode, /^S1-\d+$/);

    const missingSection = await api('/api/students', {
      method: 'POST',
      token: tokens.head!,
      body: { name: 'طالب بلا شعبة', stage: 1, section: 'DOES-NOT-EXIST' },
    });
    assert.equal(missingSection.status, 400);
  });

  it('moves a student between sections and stages consistently', async () => {
    const created = await api('/api/students', {
      method: 'POST',
      token: tokens.head!,
      body: { name: 'طالب نقل', stage: 1, sectionId: ids.sectionS1B },
    });
    assert.equal(created.status, 201);

    const moveSection = await api(`/api/students/${created.body.id}`, {
      method: 'PUT',
      token: tokens.head!,
      body: { sectionId: ids.sectionS2B },
    });
    assert.equal(moveSection.status, 200, JSON.stringify(moveSection.body));
    assert.equal(moveSection.body.sectionId, ids.sectionS2B);
    assert.equal(moveSection.body.section, '2');
    assert.equal(moveSection.body.stage, 2);

    const stageOnly = await api(`/api/students/${created.body.id}`, {
      method: 'PUT',
      token: tokens.head!,
      body: { stage: 3 },
    });
    assert.equal(stageOnly.status, 400, 'changing stage must go through a section');

    const moveStage = await api(`/api/students/${created.body.id}`, {
      method: 'PUT',
      token: tokens.head!,
      body: { sectionId: ids.sectionS3A },
    });
    assert.equal(moveStage.status, 200);
    assert.equal(moveStage.body.stage, 3);
    assert.equal(moveStage.body.section, '1');

    const cleanup = await api(`/api/students/${created.body.id}`, {
      method: 'DELETE',
      token: tokens.head!,
    });
    assert.equal(cleanup.status, 200);
    assert.equal(cleanup.body.mode, 'HARD');
  });

  it('scopes lecturer student options and denies out-of-stage access', async () => {
    const stage1 = await api('/api/students/options?stage=1', {
      token: tokens.lecturerA!,
    });
    assert.equal(stage1.status, 400);

    const stage2 = await api('/api/students/options?stage=2', {
      token: tokens.lecturerA!,
    });
    assert.equal(stage2.status, 200);
    assert.ok(stage2.body.length >= 4);
    for (const student of stage2.body) assert.equal(student.stage, 2);

    const tech = await api('/api/students/options?stage=2', {
      token: tokens.techA!,
    });
    assert.equal(tech.status, 403);
  });

  it('previews an import and reports duplicates before writing anything', async () => {
    const preview = await api('/api/students/import/preview', {
      method: 'POST',
      token: tokens.head!,
      body: {
        stage: 1,
        sectionId: ids.sectionS1A,
        students: [
          { studentCode: 'S1-IMP-1', name: 'مستورد صحيح' },
          { studentCode: 'S1-IMP-1', name: 'مكرر داخل الملف' },
          { studentCode: ids.codeA, name: 'مكرر في القاعدة' },
          { name: 'مستورد تلقائي' },
          { name: 'شعبة خاطئة', section: 'NOT-A-SECTION' },
        ],
      },
    });
    assert.equal(preview.status, 201, JSON.stringify(preview.body));
    assert.equal(preview.body.summary.total, 5);
    assert.ok(preview.body.summary.valid >= 2);
    assert.ok(preview.body.summary.invalid >= 2);

    const rows = preview.body.rows;
    assert.equal(rows[0].status, 'VALID');
    assert.equal(rows[1].status, 'ERROR');
    assert.match(rows[1].errors.join(' '), /مكرر/);
    assert.equal(rows[2].status, 'ERROR');
    assert.equal(rows[3].status, 'VALID');
    assert.match(rows[3].studentCode, /^S1-\d+$/);
    assert.equal(rows[4].status, 'ERROR');

    const stored = await prisma.student.count({
      where: { studentCode: { in: ['S1-IMP-1'] } },
    });
    assert.equal(stored, 0, 'preview must not write rows');
  });

  it('confirms only valid import rows and never updates existing students', async () => {
    const before = await prisma.student.findUnique({
      where: { studentCode: ids.codeA },
      select: { name: true },
    });

    const confirm = await api('/api/students/import/confirm', {
      method: 'POST',
      token: tokens.head!,
      body: {
        stage: 1,
        sectionId: ids.sectionS1A,
        students: [
          { studentCode: 'S1-IMP-2', name: 'مستورد صحيح 2' },
          { studentCode: ids.codeA, name: 'اسم يجب ألا يغيّر الموجود' },
          { name: 'مستورد تلقائي 2' },
        ],
      },
    });
    assert.equal(confirm.status, 201, JSON.stringify(confirm.body));
    assert.equal(confirm.body.created, 2);
    assert.equal(confirm.body.rejected, 1);
    assert.equal(confirm.body.updated, 0);

    const imported = await prisma.student.findUnique({
      where: { studentCode: 'S1-IMP-2' },
      select: { stage: true, section: true, sectionId: true },
    });
    assert.ok(imported);
    assert.equal(imported!.stage, 1);
    assert.equal(imported!.section, '1');
    assert.equal(imported!.sectionId, ids.sectionS1A);

    const after = await prisma.student.findUnique({
      where: { studentCode: ids.codeA },
      select: { name: true },
    });
    assert.equal(after!.name, before!.name, 'an existing student must not be updated');

    const generated = await prisma.student.count({
      where: { stage: 1, studentCode: { startsWith: 'S1-' } },
    });
    assert.ok(generated >= 2);
  });
});

describe('read-only follow-up for lecturers and technical lecturers', () => {
  it('counts only closed lectures in the overview', async () => {
    const result = await api(`/api/followup/overview?courseId=${ids.courseC1}`, {
      token: tokens.lecturerA!,
    });
    assert.equal(result.status, 200, JSON.stringify(result.body));
    assert.equal(result.body.totals.students, 4);
    assert.equal(result.body.totals.closedLectures, 1);
    assert.equal(result.body.totals.activeLectures, 1);
    assert.equal(result.body.totals.present, 2);
    assert.equal(result.body.totals.absent, 2);
    assert.equal(result.body.totals.attendanceRate, 50);
    assert.equal(result.body.totals.absenceRate, 50);
  });

  it('requires an explicit course when more than one course is assigned', async () => {
    // Silently merging several courses would mix unrelated statistics, so the
    // backend rejects an unscoped overview instead of aggregating everything.
    const result = await api('/api/followup/overview', { token: tokens.lecturerA! });
    assert.equal(result.status, 400, JSON.stringify(result.body));

    const stage3 = await api(`/api/followup/overview?courseId=${ids.courseC3}`, {
      token: tokens.lecturerA!,
    });
    assert.equal(stage3.status, 200, JSON.stringify(stage3.body));
    assert.deepEqual(
      stage3.body.courses.map((course: any) => course.id),
      [ids.courseC3],
    );
    assert.equal(stage3.body.totals.students, 1);
    assert.equal(stage3.body.totals.closedLectures, 0);
  });

  it('lists scoped students with pagination, search and sorting', async () => {
    const all = await api(
      `/api/followup/students?courseId=${ids.courseC1}&pageSize=100`,
      { token: tokens.lecturerA! },
    );
    assert.equal(all.status, 200);
    assert.equal(all.body.pagination.total, 4);
    assert.equal(all.body.items.length, 4);
    for (const item of all.body.items) {
      assert.equal(item.stage, 2);
      assert.ok(item.attendanceRate >= 0 && item.attendanceRate <= 100);
    }

    const page1 = await api(
      `/api/followup/students?courseId=${ids.courseC1}&page=1&pageSize=2`,
      { token: tokens.lecturerA! },
    );
    assert.equal(page1.body.pagination.totalPages, 2);
    assert.equal(page1.body.items.length, 2);
    const page2 = await api(
      `/api/followup/students?courseId=${ids.courseC1}&page=2&pageSize=2`,
      { token: tokens.lecturerA! },
    );
    assert.equal(page2.body.items.length, 2);

    const ascending = await api(
      `/api/followup/students?courseId=${ids.courseC1}&sort=attendanceRate_asc&pageSize=100`,
      { token: tokens.lecturerA! },
    );
    const rates = ascending.body.items.map((item: any) => item.attendanceRate);
    assert.deepEqual(rates, [...rates].sort((a: number, b: number) => a - b));

    const search = await api(
      `/api/followup/students?courseId=${ids.courseC1}&search=${encodeURIComponent(ids.codeA)}`,
      { token: tokens.lecturerA! },
    );
    assert.equal(search.body.pagination.total, 1);
    assert.equal(search.body.items[0].id, ids.studentA);

    const section = await api(
      `/api/followup/students?courseId=${ids.courseC1}&sectionId=${ids.sectionS2A}&pageSize=100`,
      { token: tokens.lecturerA! },
    );
    assert.equal(section.body.pagination.total, 3);
    assert.equal(section.body.items.some((item: any) => item.id === ids.studentD), false);

    const serialized = JSON.stringify(all.body);
    assert.equal(serialized.includes('qrToken'), false);
    assert.equal(serialized.includes('qr_'), false);
  });

  it('shows a student detail with closed-only statistics and no QR data', async () => {
    const result = await api(
      `/api/followup/students/${ids.studentA}?courseId=${ids.courseC1}`,
      { token: tokens.lecturerA! },
    );
    assert.equal(result.status, 200, JSON.stringify(result.body));
    assert.equal(result.body.student.id, ids.studentA);
    assert.equal(result.body.stats.present, 1);
    assert.equal(result.body.stats.absent, 0);
    assert.equal(result.body.stats.totalLectures, 1);
    assert.equal(result.body.stats.attendanceRate, 100);
    assert.equal(result.body.stats.excludedActiveLectures, 1);
    assert.equal(result.body.lectures.length, 1);
    assert.equal(result.body.lectures[0].courseId, ids.courseC1);
    assert.equal(JSON.stringify(result.body).includes('qr_'), false);
  });

  it('enforces the course and stage scope', async () => {
    const foreignCourse = await api(
      `/api/followup/overview?courseId=${ids.courseC1}`,
      { token: tokens.lecturerB! },
    );
    assert.equal(foreignCourse.status, 403);

    const tech = await api(`/api/followup/overview?courseId=${ids.courseC1}`, {
      token: tokens.techA!,
    });
    assert.equal(tech.status, 200);
    assert.equal(tech.body.totals.present, 2);

    const techForeign = await api(
      `/api/followup/overview?courseId=${ids.courseC2}`,
      { token: tokens.techA! },
    );
    assert.equal(techForeign.status, 403);

    const noAssignments = await api('/api/followup/overview', {
      token: tokens.techB!,
    });
    assert.equal(noAssignments.status, 200);
    assert.deepEqual(noAssignments.body.courses, []);
    assert.equal(noAssignments.body.totals.students, 0);

    const admin = await api(`/api/followup/overview?courseId=${ids.courseC1}`, {
      token: tokens.head!,
    });
    assert.equal(admin.status, 200);

    const outOfScopeStudent = await api(
      `/api/followup/students/${ids.studentStage3}?courseId=${ids.courseC1}`,
      { token: tokens.lecturerA! },
    );
    assert.equal(outOfScopeStudent.status, 404);
  });

  it('is read-only: there is no write endpoint', async () => {
    const result = await api('/api/followup/students', {
      method: 'POST',
      token: tokens.lecturerA!,
      body: {},
    });
    assert.ok(result.status === 404 || result.status === 405, `got ${result.status}`);
  });

  it('scopes the assigned course list for lecturer B', async () => {
    const result = await api(
      `/api/followup/students?courseId=${ids.courseC2}&pageSize=100`,
      { token: tokens.lecturerB! },
    );
    assert.equal(result.status, 200);
    assert.equal(result.body.pagination.total, 4);
    for (const item of result.body.items) assert.equal(item.stage, 2);
  });
});

describe('safe deletion', () => {
  it('soft-deletes a student with attendance history and rejects their QR card', async () => {
    const created = await api('/api/students', {
      method: 'POST',
      token: tokens.head!,
      body: { name: 'طالب محذوف', stage: 2, sectionId: ids.sectionS2B },
    });
    assert.equal(created.status, 201);

    const qr = await api(`/api/students/${created.body.id}/qr`, {
      token: tokens.head!,
    });
    assert.equal(qr.status, 200);

    await prisma.attendanceRecord.create({
      data: {
        lectureId: ids.activeLectureC1,
        studentId: created.body.id,
        studentCode: created.body.studentCode,
        studentName: created.body.name,
        status: 'PRESENT',
      },
    });

    const removed = await api(`/api/students/${created.body.id}`, {
      method: 'DELETE',
      token: tokens.head!,
    });
    assert.equal(removed.status, 200);
    assert.equal(removed.body.mode, 'SOFT');

    const stillThere = await prisma.student.findUnique({
      where: { id: created.body.id },
      select: { deletedAt: true },
    });
    assert.ok(stillThere?.deletedAt, 'the student row must be kept');

    const records = await prisma.attendanceRecord.count({
      where: { studentId: created.body.id },
    });
    assert.equal(records, 1, 'attendance history must be preserved');

    const list = await api('/api/students', { token: tokens.head! });
    assert.equal(list.status, 200);
    assert.equal(
      list.body.some((student: any) => student.id === created.body.id),
      false,
      'soft-deleted students must not be listed',
    );

    const scan = await api(`/api/attendance/${ids.activeLectureC1}/scan-student`, {
      method: 'POST',
      token: tokens.lecturerA!,
      body: { studentCode: qr.body.token },
    });
    assert.equal(scan.status, 400);
    assert.match(String(scan.body.message), /محذوف/);
  });

  it('hard-deletes a student without attendance history', async () => {
    const created = await api('/api/students', {
      method: 'POST',
      token: tokens.head!,
      body: { name: 'طالب بلا سجل', stage: 1, sectionId: ids.sectionS1B },
    });
    assert.equal(created.status, 201);

    const removed = await api(`/api/students/${created.body.id}`, {
      method: 'DELETE',
      token: tokens.head!,
    });
    assert.equal(removed.status, 200);
    assert.equal(removed.body.mode, 'HARD');

    const gone = await prisma.student.findUnique({ where: { id: created.body.id } });
    assert.equal(gone, null);
  });

  // The API enforces one open lecture per conductor (Phase 3). The seeded
  // fixture lecture keeps lecturer A busy for the deletion tests above, so it
  // is closed here — after those tests, before the lecture-conduct tests that
  // create lectures with this account.
  it('closes the seeded lecture fixture once deletion tests are done', async () => {
    const closed = await api(`/api/lectures/${ids.activeLectureC1}/close`, {
      method: 'PATCH',
      token: tokens.lecturerA!,
    });
    assert.equal(closed.status, 200, JSON.stringify(closed.body));
    assert.ok(
      closed.body.present + closed.body.absent >= 3,
      'closing must record the three seeded section-1 students',
    );
  });
});

describe('lectures, assignments and attendance scoping', () => {
  it('requires a course when a lecturer teaches more than one', async () => {
    const result = await api('/api/lectures', {
      method: 'POST',
      token: tokens.lecturerA!,
      body: { name: 'بدون مادة', studyPeriod: 'MORNING', section: '1' },
    });
    assert.equal(result.status, 400);
  });

  it('requires administrators to choose a course explicitly', async () => {
    const result = await api('/api/lectures', {
      method: 'POST',
      token: tokens.head!,
      body: { name: 'بدون مادة إداري', studyPeriod: 'MORNING', section: '1' },
    });
    assert.equal(result.status, 400);
  });

  it('rejects a course outside the lecturer assignments', async () => {
    const result = await api('/api/lectures', {
      method: 'POST',
      token: tokens.lecturerA!,
      body: {
        name: 'مادة غير مسندة',
        studyPeriod: 'MORNING',
        section: '1',
        courseId: ids.courseC2,
      },
    });
    assert.equal(result.status, 403);
  });

  it('rejects a section that belongs to another stage', async () => {
    const result = await api('/api/lectures', {
      method: 'POST',
      token: tokens.lecturerA!,
      body: {
        name: 'شعبة من مرحلة أخرى',
        studyPeriod: 'MORNING',
        section: '3',
        courseId: ids.courseC1,
      },
    });
    assert.equal(result.status, 400);
  });

  it('auto-selects the only assigned course for a technical lecturer', async () => {
    const result = await api('/api/lectures', {
      method: 'POST',
      token: tokens.techA!,
      body: { name: 'محاضرة تقني', studyPeriod: 'MORNING', section: '1' },
    });
    assert.equal(result.status, 201, JSON.stringify(result.body));
    assert.equal(result.body.courseId, ids.courseC1);
    assert.equal(result.body.course.id, ids.courseC1);

    const qr = await api(`/api/students/${ids.studentA}/qr`, {
      token: tokens.head!,
    });
    assert.equal(qr.status, 200);

    const scan = await api(`/api/attendance/${result.body.id}/scan-student`, {
      method: 'POST',
      token: tokens.techA!,
      body: { studentCode: qr.body.token },
    });
    assert.equal(scan.status, 201, JSON.stringify(scan.body));
    assert.equal(scan.body.success, true);

    const closed = await api(`/api/lectures/${result.body.id}/close`, {
      method: 'PATCH',
      token: tokens.techA!,
    });
    assert.equal(closed.status, 200, JSON.stringify(closed.body));
    assert.ok(closed.body.present + closed.body.absent > 0);
  });

  it('prevents a technical lecturer from opening a lecture for another course', async () => {
    const result = await api('/api/lectures', {
      method: 'POST',
      token: tokens.techA!,
      body: {
        name: 'مادة تقني غير مسندة',
        studyPeriod: 'MORNING',
        section: '1',
        courseId: ids.courseC2,
      },
    });
    assert.equal(result.status, 403);
  });

  it('validates manual attendance against the lecture stage', async () => {
    const created = await api('/api/lectures', {
      method: 'POST',
      token: tokens.lecturerA!,
      body: {
        name: 'محاضرة تحقق المرحلة',
        studyPeriod: 'MORNING',
        section: '1',
        courseId: ids.courseC1,
      },
    });
    assert.equal(created.status, 201, JSON.stringify(created.body));

    const wrongStage = await api(`/api/attendance/${created.body.id}/manual`, {
      method: 'POST',
      token: tokens.lecturerA!,
      body: { studentName: ids.codeStage3 },
    });
    assert.equal(wrongStage.status, 400);
    assert.match(String(wrongStage.body.message), /المرحلة/);

    const correct = await api(`/api/attendance/${created.body.id}/manual`, {
      method: 'POST',
      token: tokens.lecturerA!,
      body: { studentName: ids.codeA },
    });
    assert.equal(correct.status, 201, JSON.stringify(correct.body));

    const closed = await api(`/api/lectures/${created.body.id}/close`, {
      method: 'PATCH',
      token: tokens.lecturerA!,
    });
    assert.equal(closed.status, 200);
    assert.ok(closed.body.present + closed.body.absent > 0);
  });

  it('lets the registrar add a second lecturer to the same course and revoke it', async () => {
    const created = await api('/api/assignments', {
      method: 'POST',
      token: tokens.registrar!,
      body: { staffUserId: userIds.lecturerB, courseId: ids.courseC1 },
    });
    assert.equal(created.status, 201, JSON.stringify(created.body));

    const duplicate = await api('/api/assignments', {
      method: 'POST',
      token: tokens.registrar!,
      body: { staffUserId: userIds.lecturerB, courseId: ids.courseC1 },
    });
    assert.equal(duplicate.status, 409);

    const allowed = await api('/api/lectures', {
      method: 'POST',
      token: tokens.lecturerB!,
      body: {
        name: 'محاضرة محاضر ب في مادة أ',
        studyPeriod: 'MORNING',
        section: '1',
        courseId: ids.courseC1,
      },
    });
    assert.equal(allowed.status, 201, JSON.stringify(allowed.body));

    const revoked = await api(`/api/assignments/${created.body.id}`, {
      method: 'DELETE',
      token: tokens.registrar!,
    });
    assert.equal(revoked.status, 200);

    const denied = await api('/api/lectures', {
      method: 'POST',
      token: tokens.lecturerB!,
      body: {
        name: 'محاضرة بعد سحب التعيين',
        studyPeriod: 'MORNING',
        section: '1',
        courseId: ids.courseC1,
      },
    });
    assert.equal(denied.status, 403);
  });

  it('rejects assignments to non-teaching staff', async () => {
    const result = await api('/api/assignments', {
      method: 'POST',
      token: tokens.registrar!,
      body: { staffUserId: userIds.registrar, courseId: ids.courseC1 },
    });
    assert.equal(result.status, 400);
  });

  it('denies assignment management to lecturers', async () => {
    const result = await api('/api/assignments', {
      method: 'POST',
      token: tokens.lecturerA!,
      body: { staffUserId: userIds.lecturerA, courseId: ids.courseC1 },
    });
    assert.equal(result.status, 403);
  });
});

describe('phase 2 review regressions', () => {
  const reg: {
    lockedLectureId?: string;
    lockedRecordId?: string;
    statsSectionId?: string;
    statsStudentId?: string;
  } = {};

  it('never widens a section close to the whole stage (C1)', async () => {
    const section = await prisma.section.create({
      data: { stage: 2, studyPeriod: 'MORNING', name: 'REG-EMPTY' },
    });
    const lecture = await prisma.lecture.create({
      data: {
        name: 'محاضرة شعبة فارغة',
        studyPeriod: 'MORNING',
        section: section.name,
        courseId: ids.courseC1,
        status: 'ACTIVE',
        qrToken: `reg-empty-${Date.now()}`,
        qrExpiresAt: new Date(Date.now() + 3600_000),
        createdByUserId: userIds.lecturerA,
        conductedByUserId: userIds.lecturerA,
      },
    });

    const closed = await api(`/api/lectures/${lecture.id}/close`, {
      method: 'PATCH',
      token: tokens.lecturerA!,
    });
    assert.equal(closed.status, 200, JSON.stringify(closed.body));
    assert.equal(closed.body.total, 0);
    assert.equal(closed.body.present, 0);
    assert.equal(closed.body.absent, 0);
    assert.equal(
      await prisma.attendanceRecord.count({ where: { lectureId: lecture.id } }),
      0,
      'a section without students must not fall back to every stage-2 student',
    );
  });

  it('archives a lecture, keeps its records and excludes it from statistics (M3)', async () => {
    const section = await prisma.section.create({
      data: { stage: 2, studyPeriod: 'MORNING', name: 'REG-ARCH' },
    });
    const student = await prisma.student.create({
      data: {
        studentCode: `S2-REGARCH-${Date.now()}`,
        name: 'طالب أرشيف',
        stage: 2,
        studyPeriod: 'MORNING',
        section: section.name,
        sectionId: section.id,
      },
    });
    const lecture = await prisma.lecture.create({
      data: {
        name: 'محاضرة أرشيف',
        studyPeriod: 'MORNING',
        section: section.name,
        courseId: ids.courseC1,
        status: 'CLOSED',
        qrToken: `reg-arch-${Date.now()}`,
        qrExpiresAt: new Date(Date.now() + 3600_000),
        createdByUserId: userIds.lecturerA,
        conductedByUserId: userIds.lecturerA,
        closedAt: new Date(),
      },
    });
    await prisma.attendanceRecord.create({
      data: {
        lectureId: lecture.id,
        studentId: student.id,
        studentCode: student.studentCode,
        studentName: student.name,
        status: 'PRESENT',
      },
    });

    const before = await api(`/api/followup/overview?courseId=${ids.courseC1}`, {
      token: tokens.lecturerA!,
    });
    assert.equal(before.status, 200);

    const archived = await api(`/api/lectures/${lecture.id}`, {
      method: 'DELETE',
      token: tokens.head!,
    });
    assert.equal(archived.status, 200, JSON.stringify(archived.body));
    assert.equal(archived.body.archived, true);
    assert.equal(archived.body.attendanceRecords, 1);

    const row = await prisma.lecture.findUnique({ where: { id: lecture.id } });
    assert.ok(row?.deletedAt, 'archiving is a soft delete');
    assert.equal(
      await prisma.attendanceRecord.count({ where: { lectureId: lecture.id } }),
      1,
      'attendance history must survive archiving',
    );

    const after = await api(`/api/followup/overview?courseId=${ids.courseC1}`, {
      token: tokens.lecturerA!,
    });
    assert.equal(after.status, 200);
    assert.equal(after.body.totals.present, before.body.totals.present - 1);
    assert.equal(
      after.body.totals.closedLectures,
      before.body.totals.closedLectures - 1,
    );

    const listed = await api('/api/lectures', { token: tokens.head! });
    assert.equal(listed.status, 200);
    assert.equal(
      listed.body.some((lectureRow: any) => lectureRow.id === lecture.id),
      false,
    );

    const qr = await api('/api/lectures/validate-qr', {
      method: 'POST',
      token: tokens.lecturerA!,
      body: { token: row!.qrToken },
    });
    assert.equal(qr.status, 201);
    assert.equal(qr.body.valid, false);

    const refreshed = await prisma.student.findUnique({
      where: { id: student.id },
      select: { presentCount: true, absentCount: true, totalSessions: true },
    });
    assert.equal(refreshed?.presentCount, 0);
    assert.equal(refreshed?.absentCount, 0);
    assert.equal(refreshed?.totalSessions, 0);
  });

  it('uses studentId as identity and allows duplicate names in one section (C2)', async () => {
    const section = await prisma.section.create({
      data: { stage: 2, studyPeriod: 'MORNING', name: 'REG-DUP' },
    });
    const sameName = 'طالب اسم مكرر';
    const first = await prisma.student.create({
      data: {
        studentCode: `S2-REGD1-${Date.now()}`,
        name: sameName,
        stage: 2,
        studyPeriod: 'MORNING',
        section: section.name,
        sectionId: section.id,
      },
    });
    const second = await prisma.student.create({
      data: {
        studentCode: `S2-REGD2-${Date.now()}`,
        name: sameName,
        stage: 2,
        studyPeriod: 'MORNING',
        section: section.name,
        sectionId: section.id,
      },
    });

    const lecture = await api('/api/lectures', {
      method: 'POST',
      token: tokens.lecturerA!,
      body: {
        name: 'محاضرة تكرار الاسم',
        studyPeriod: 'MORNING',
        courseId: ids.courseC1,
        sectionId: section.id,
      },
    });
    assert.equal(lecture.status, 201, JSON.stringify(lecture.body));
    const lectureId = lecture.body.id;

    const qr = await api(`/api/students/${first.id}/qr`, {
      token: tokens.head!,
    });
    assert.equal(qr.status, 200);
    const scan = await api(`/api/attendance/${lectureId}/scan-student`, {
      method: 'POST',
      token: tokens.lecturerA!,
      body: { studentCode: qr.body.token },
    });
    assert.equal(scan.status, 201, JSON.stringify(scan.body));
    assert.equal(scan.body.record.studentId, first.id);

    const ambiguous = await api(`/api/attendance/${lectureId}/manual`, {
      method: 'POST',
      token: tokens.lecturerA!,
      body: { studentName: sameName },
    });
    assert.equal(ambiguous.status, 400);
    assert.match(String(ambiguous.body.message), /أكثر من طالب/);

    const secondRow = await api(`/api/attendance/${lectureId}/manual`, {
      method: 'POST',
      token: tokens.lecturerA!,
      body: { studentName: second.studentCode, status: 'PRESENT' },
    });
    assert.equal(secondRow.status, 201, JSON.stringify(secondRow.body));
    assert.equal(secondRow.body.studentId, second.id);
    assert.equal(secondRow.body.studentName, sameName);

    const duplicate = await api(`/api/attendance/${lectureId}/manual`, {
      method: 'POST',
      token: tokens.lecturerA!,
      body: { studentName: first.studentCode },
    });
    assert.equal(duplicate.status, 409);

    const rows = await prisma.attendanceRecord.findMany({
      where: { lectureId },
    });
    assert.equal(rows.length, 2);
    assert.deepEqual(
      rows.map((row) => row.studentId).sort(),
      [first.id, second.id].sort(),
    );

    const closed = await api(`/api/lectures/${lectureId}/close`, {
      method: 'PATCH',
      token: tokens.lecturerA!,
    });
    assert.equal(closed.status, 200, JSON.stringify(closed.body));

    reg.lockedLectureId = lectureId;
    reg.lockedRecordId = rows.find((row) => row.studentId === first.id)!.id;
  });

  it('blocks every attendance write on a closed lecture and audits it (M2)', async () => {
    const lectureId = reg.lockedLectureId!;
    const recordId = reg.lockedRecordId!;

    const toggle = await api(`/api/attendance/${recordId}/toggle`, {
      method: 'PATCH',
      token: tokens.lecturerA!,
    });
    assert.equal(toggle.status, 400);

    const manual = await api(`/api/attendance/${lectureId}/manual`, {
      method: 'POST',
      token: tokens.lecturerA!,
      body: { studentName: ids.codeA },
    });
    assert.equal(manual.status, 400);

    const scan = await api(`/api/attendance/${lectureId}/scan-student`, {
      method: 'POST',
      token: tokens.lecturerA!,
      body: { studentCode: 'qr_anything' },
    });
    assert.equal(scan.status, 400);

    const adminToggle = await api(`/api/attendance/${recordId}/toggle`, {
      method: 'PATCH',
      token: tokens.head!,
    });
    assert.equal(adminToggle.status, 400, 'no role may bypass the closed lock');

    const auditCount = await prisma.auditLog.count({
      where: {
        action: 'ATTENDANCE_WRITE_REJECTED',
        entityId: lectureId,
      },
    });
    assert.ok(auditCount >= 3);
  });

  it('rejects an expired QR token even though the row still exists (M4)', async () => {
    const token = `reg-expired-${Date.now()}`;
    await prisma.lecture.create({
      data: {
        name: 'محاضرة رمز منتهي',
        studyPeriod: 'MORNING',
        section: '1',
        courseId: ids.courseC1,
        status: 'ACTIVE',
        qrToken: token,
        qrExpiresAt: new Date(Date.now() - 1000),
        createdByUserId: userIds.lecturerA,
        conductedByUserId: userIds.lecturerA,
      },
    });

    const result = await api('/api/lectures/validate-qr', {
      method: 'POST',
      token: tokens.lecturerA!,
      body: { token },
    });
    assert.equal(result.status, 201);
    assert.equal(result.body.valid, false);
    assert.match(String(result.body.reason), /انتهت/);
  });

  it('rate limits failures per account/IP without penalising successful logins (M5)', async () => {
    const previousLimit = process.env.AUTH_ACCOUNT_IP_MAX_FAILED_ATTEMPTS;
    const previousIpLimit = process.env.AUTH_IP_MAX_FAILED_ATTEMPTS;
    process.env.AUTH_ACCOUNT_IP_MAX_FAILED_ATTEMPTS = '2';
    process.env.AUTH_IP_MAX_FAILED_ATTEMPTS = '1000';
    try {
      for (let attempt = 1; attempt <= 3; attempt++) {
        const ok = await api('/api/auth/login', {
          method: 'POST',
          body: { staffId: STAFF.lecturerB.staffId, password: PASSWORD },
        });
        assert.equal(
          ok.status,
          200,
          `successful login #${attempt} must not consume the failure budget`,
        );
      }

      for (let attempt = 1; attempt <= 2; attempt++) {
        const bad = await api('/api/auth/login', {
          method: 'POST',
          body: { staffId: STAFF.lecturerB.staffId, password: 'WrongPassword!' },
        });
        assert.equal(bad.status, 401);
      }

      const limited = await api('/api/auth/login', {
        method: 'POST',
        body: { staffId: STAFF.lecturerB.staffId, password: PASSWORD },
      });
      assert.equal(limited.status, 429);
    } finally {
      if (previousLimit === undefined) {
        delete process.env.AUTH_ACCOUNT_IP_MAX_FAILED_ATTEMPTS;
      } else {
        process.env.AUTH_ACCOUNT_IP_MAX_FAILED_ATTEMPTS = previousLimit;
      }
      if (previousIpLimit === undefined) {
        delete process.env.AUTH_IP_MAX_FAILED_ATTEMPTS;
      } else {
        process.env.AUTH_IP_MAX_FAILED_ATTEMPTS = previousIpLimit;
      }
    }

    const recovered = await api('/api/auth/login', {
      method: 'POST',
      body: { staffId: STAFF.lecturerB.staffId, password: PASSWORD },
    });
    assert.equal(recovered.status, 200, JSON.stringify(recovered.body));
    const staff = await prisma.staffUser.findUnique({
      where: { staffId: STAFF.lecturerB.staffId },
      select: { failedLoginCount: true },
    });
    assert.equal(staff?.failedLoginCount, 0);
  });

  it('renames a section without breaking its lectures and protects them (M6)', async () => {
    const section = await prisma.section.create({
      data: { stage: 2, studyPeriod: 'MORNING', name: 'REG-RENAME-OLD' },
    });
    const lecture = await prisma.lecture.create({
      data: {
        name: 'محاضرة إعادة تسمية',
        studyPeriod: 'MORNING',
        section: 'REG-RENAME-OLD',
        courseId: ids.courseC1,
        status: 'CLOSED',
        qrToken: `reg-rename-${Date.now()}`,
        qrExpiresAt: new Date(Date.now() + 3600_000),
        createdByUserId: userIds.lecturerA,
        conductedByUserId: userIds.lecturerA,
        closedAt: new Date(),
      },
    });

    const renamed = await api(`/api/sections/${section.id}`, {
      method: 'PUT',
      token: tokens.registrar!,
      body: { name: 'REG-RENAME-NEW' },
    });
    assert.equal(renamed.status, 200, JSON.stringify(renamed.body));

    const synced = await prisma.lecture.findUnique({ where: { id: lecture.id } });
    assert.equal(synced?.section, 'REG-RENAME-NEW');

    const moved = await api(`/api/sections/${section.id}`, {
      method: 'PUT',
      token: tokens.registrar!,
      body: { stage: 1 },
    });
    assert.equal(moved.status, 409);

    const removed = await api(`/api/sections/${section.id}`, {
      method: 'DELETE',
      token: tokens.registrar!,
    });
    assert.equal(removed.status, 409);
  });

  it('requires an explicit stage for resets and scopes the reset (C3)', async () => {
    const section = await prisma.section.create({
      data: { stage: 2, studyPeriod: 'MORNING', name: 'REG-RESET' },
    });
    const first = await prisma.student.create({
      data: {
        studentCode: `S2-REGR1-${Date.now()}`,
        name: 'تصفير أول',
        stage: 2,
        studyPeriod: 'MORNING',
        section: section.name,
        sectionId: section.id,
      },
    });
    const second = await prisma.student.create({
      data: {
        studentCode: `S2-REGR2-${Date.now()}`,
        name: 'تصفير ثاني',
        stage: 2,
        studyPeriod: 'MORNING',
        section: section.name,
        sectionId: section.id,
      },
    });
    const lecture = await prisma.lecture.create({
      data: {
        name: 'محاضرة تصفير',
        studyPeriod: 'MORNING',
        section: section.name,
        courseId: ids.courseC1,
        status: 'CLOSED',
        qrToken: `reg-reset-${Date.now()}`,
        qrExpiresAt: new Date(Date.now() + 3600_000),
        createdByUserId: userIds.lecturerA,
        conductedByUserId: userIds.lecturerA,
        closedAt: new Date(),
      },
    });
    await prisma.attendanceRecord.createMany({
      data: [
        {
          lectureId: lecture.id,
          studentId: first.id,
          studentCode: first.studentCode,
          studentName: first.name,
          status: 'ABSENT',
        },
        {
          lectureId: lecture.id,
          studentId: second.id,
          studentCode: second.studentCode,
          studentName: second.name,
          status: 'PRESENT',
        },
      ],
    });
    const stage3Before = await prisma.attendanceRecord.count({
      where: { studentId: ids.studentStage3 },
    });

    const missingStage = await api('/api/students/reset-absences', {
      method: 'POST',
      token: tokens.head!,
      body: { resetType: 'ABSENCES_ONLY' },
    });
    assert.equal(missingStage.status, 400);

    const invalidStage = await api('/api/students/reset-absences', {
      method: 'POST',
      token: tokens.head!,
      body: { stage: 9, resetType: 'ABSENCES_ONLY' },
    });
    assert.equal(invalidStage.status, 400);

    const reset = await api('/api/students/reset-absences', {
      method: 'POST',
      token: tokens.head!,
      body: {
        stage: 2,
        sectionId: section.id,
        resetType: 'ABSENCES_ONLY',
      },
    });
    assert.equal(reset.status, 201, JSON.stringify(reset.body));
    assert.equal(reset.body.count, 2);

    assert.equal(
      await prisma.attendanceRecord.count({
        where: { studentId: first.id, status: 'ABSENT' },
      }),
      0,
    );
    assert.equal(
      await prisma.attendanceRecord.count({
        where: { studentId: second.id, status: 'PRESENT' },
      }),
      1,
    );
    assert.equal(
      await prisma.attendanceRecord.count({
        where: { studentId: ids.studentStage3 },
      }),
      stage3Before,
      'a reset must never touch another stage',
    );

    const audit = await prisma.auditLog.findFirst({
      where: { action: 'ATTENDANCE_RESET_ABSENCES' },
      orderBy: { createdAt: 'desc' },
    });
    assert.ok(audit);
    assert.match(String(audit?.details), /REG-RESET/);
    assert.match(String(audit?.details), /count=2/);

    const stored = await prisma.student.findUnique({
      where: { id: second.id },
      select: {
        presentCount: true,
        absentCount: true,
        totalSessions: true,
      },
    });
    assert.equal(stored?.presentCount, 1);
    assert.equal(stored?.absentCount, 0);
    assert.equal(stored?.totalSessions, 1);

    reg.statsSectionId = section.id;
    reg.statsStudentId = second.id;
  });

  it('shows one closed-only statistic everywhere and ignores stored counters (M1)', async () => {
    const section = await prisma.section.findUnique({
      where: { id: reg.statsSectionId! },
    });
    assert.ok(section);
    const student = await prisma.student.findUnique({
      where: { id: reg.statsStudentId! },
    });
    assert.ok(student);

    const active = await prisma.lecture.create({
      data: {
        name: 'محاضرة نشطة لا تُحتسب',
        studyPeriod: 'MORNING',
        section: section!.name,
        courseId: ids.courseC1,
        status: 'ACTIVE',
        qrToken: `reg-stats-active-${Date.now()}`,
        qrExpiresAt: new Date(Date.now() + 3600_000),
        createdByUserId: userIds.lecturerA,
        conductedByUserId: userIds.lecturerA,
      },
    });
    await prisma.attendanceRecord.create({
      data: {
        lectureId: active.id,
        studentId: student!.id,
        studentCode: student!.studentCode,
        studentName: student!.name,
        status: 'PRESENT',
      },
    });
    await prisma.student.update({
      where: { id: student!.id },
      data: {
        presentCount: 999,
        absentCount: 999,
        totalSessions: 1998,
        rate: 100,
      },
    });

    const list = await api(`/api/students?sectionId=${reg.statsSectionId}`, {
      token: tokens.head!,
    });
    assert.equal(list.status, 200);
    const row = list.body.find(
      (candidate: any) => candidate.id === reg.statsStudentId,
    );
    assert.ok(row);
    assert.equal(row.presentCount, 1);
    assert.equal(row.absentCount, 0);
    assert.equal(row.totalLectures, 1);

    const followup = await api(
      `/api/followup/students?courseId=${ids.courseC1}&sectionId=${reg.statsSectionId}&pageSize=100`,
      { token: tokens.lecturerA! },
    );
    assert.equal(followup.status, 200);
    const followupRow = followup.body.items.find(
      (candidate: any) => candidate.id === reg.statsStudentId,
    );
    assert.ok(followupRow);
    assert.equal(followupRow.presentCount, 1);
    assert.equal(followupRow.absentCount, 0);
    assert.equal(followupRow.totalLectures, 1);
  });

  it('rejects follow-up section filters outside the course scope (M7)', async () => {
    const stage1 = await prisma.section.create({
      data: { stage: 1, studyPeriod: 'MORNING', name: 'REG-S1' },
    });

    const foreign = await api(
      `/api/followup/overview?courseId=${ids.courseC1}&sectionId=${stage1.id}`,
      { token: tokens.lecturerA! },
    );
    assert.equal(foreign.status, 403);

    const mismatch = await api(
      `/api/followup/students/${ids.studentD}?courseId=${ids.courseC1}&sectionId=${ids.sectionS2A}`,
      { token: tokens.lecturerA! },
    );
    assert.equal(mismatch.status, 404);

    const invalidStage = await api(
      `/api/followup/overview?courseId=${ids.courseC1}&stage=abc`,
      { token: tokens.lecturerA! },
    );
    assert.equal(invalidStage.status, 400);
  });
});

describe('phase 3 section identity, scoping and concurrency', () => {
  // Lecturer A still conducts an ACTIVE lecture left by M1, so the lecture
  // creations below use the technical lecturer (his earlier sessions were
  // closed) to exercise the create/scan/close path without tripping the
  // one-open-lecture-per-conductor guard.
  const p3: { lectureId?: string } = {};

  it('rejects creating a lecture without a section', async () => {
    const result = await api('/api/lectures', {
      method: 'POST',
      token: tokens.techA!,
      body: { name: 'محاضرة بلا شعبة', studyPeriod: 'MORNING' },
    });
    assert.equal(result.status, 400, JSON.stringify(result.body));
    assert.match(String(result.body.message), /الشعبة/);
  });

  it('rejects the ALL pseudo-section', async () => {
    const result = await api('/api/lectures', {
      method: 'POST',
      token: tokens.techA!,
      body: { name: 'محاضرة كافة الشعب', studyPeriod: 'MORNING', section: 'ALL' },
    });
    assert.equal(result.status, 400);
  });

  it('rejects a section text that contradicts the sectionId', async () => {
    const result = await api('/api/lectures', {
      method: 'POST',
      token: tokens.techA!,
      body: {
        name: 'محاضرة متضاربة',
        studyPeriod: 'MORNING',
        section: '2',
        sectionId: ids.sectionS2A,
      },
    });
    assert.equal(result.status, 400);
    assert.match(String(result.body.message), /تطابق/);
  });

  it('rejects an unknown sectionId', async () => {
    const result = await api('/api/lectures', {
      method: 'POST',
      token: tokens.techA!,
      body: {
        name: 'محاضرة شعبة وهمية',
        studyPeriod: 'MORNING',
        sectionId: 'not-a-real-section-id',
      },
    });
    assert.equal(result.status, 400);
  });

  it('binds the lecture to the Section row and records the real conductor', async () => {
    const result = await api('/api/lectures', {
      method: 'POST',
      token: tokens.techA!,
      body: {
        name: 'محاضرة هوية الشعبة',
        studyPeriod: 'MORNING',
        sectionId: ids.sectionS2A,
      },
    });
    assert.equal(result.status, 201, JSON.stringify(result.body));
    assert.equal(result.body.sectionId, ids.sectionS2A);

    // The create response is the raw row; the read endpoint hydrates the
    // relations that the UI needs (sectionRef, conductedBy).
    const read = await api(`/api/lectures/${result.body.id}`, {
      token: tokens.techA!,
    });
    assert.equal(read.status, 200);
    assert.equal(read.body.sectionRef.id, ids.sectionS2A);
    assert.equal(read.body.sectionRef.name, '1');
    assert.equal(read.body.conductedBy.id, userIds.techA);
    assert.equal(read.body.conductedBy.fullName, 'محاضر تقني أ');

    const stored = await prisma.lecture.findUnique({
      where: { id: result.body.id },
      select: { sectionId: true, section: true, conductedByUserId: true },
    });
    assert.equal(stored?.sectionId, ids.sectionS2A);
    assert.equal(stored?.section, '1');
    assert.equal(stored?.conductedByUserId, userIds.techA);

    p3.lectureId = result.body.id;
  });

  it('refuses a student from another section of the same stage', async () => {
    // طالب د (codeD) belongs to section S2B, the lecture above to S2A.
    const qr = await api(`/api/students/${ids.studentD}/qr`, {
      token: tokens.head!,
    });
    assert.equal(qr.status, 200);

    const scan = await api(
      `/api/attendance/${p3.lectureId}/scan-student`,
      {
        method: 'POST',
        token: tokens.techA!,
        body: { studentCode: qr.body.token },
      },
    );
    assert.equal(scan.status, 400, JSON.stringify(scan.body));
    assert.match(String(scan.body.message), /الشعبة/);

    assert.equal(
      await prisma.attendanceRecord.count({ where: { lectureId: p3.lectureId } }),
      0,
      'a foreign-section scan must not create a record',
    );
  });

  it('keeps concurrent duplicates of the same scan down to one record', async () => {
    const student = await prisma.student.findUnique({
      where: { studentCode: ids.codeA },
    });
    assert.ok(student);
    const qr = await api(`/api/students/${student.id}/qr`, {
      token: tokens.head!,
    });
    assert.equal(qr.status, 200);

    // Fire 8 scans of the same QR at once, as two devices (or a double read)
    // would. The DB unique key plus the per-lecture advisory lock must leave
    // exactly one PRESENT row.
    const attempts = await Promise.all(
      Array.from({ length: 8 }, () =>
        api(`/api/attendance/${p3.lectureId}/scan-student`, {
          method: 'POST',
          token: tokens.techA!,
          body: { studentCode: qr.body.token },
        }),
      ),
    );

    const confirmed = attempts.filter(
      (res) => res.status === 201 && res.body.success && !res.body.alreadyRegistered,
    );
    const duplicates = attempts.filter(
      (res) => res.status === 201 && res.body.alreadyRegistered,
    );
    assert.ok(
      confirmed.length + duplicates.length === attempts.length,
      `every scan must succeed: statuses ${attempts.map((a) => a.status).join(',')}`,
    );
    assert.equal(
      confirmed.length,
      1,
      `exactly one scan may register the student (${confirmed.length} did)`,
    );

    const rows = await prisma.attendanceRecord.findMany({
      where: { lectureId: p3.lectureId },
    });
    assert.equal(rows.length, 1);
    assert.equal(rows[0].status, 'PRESENT');
    assert.equal(rows[0].studentId, student.id);
  });

  it('treats a repeated sequential scan of the same student as alreadyRegistered', async () => {
    const student = await prisma.student.findUnique({
      where: { studentCode: ids.codeA },
    });
    assert.ok(student);
    const qr = await api(`/api/students/${student.id}/qr`, {
      token: tokens.head!,
    });
    assert.equal(qr.status, 200);

    const scan = await api(`/api/attendance/${p3.lectureId}/scan-student`, {
      method: 'POST',
      token: tokens.techA!,
      body: { studentCode: qr.body.token },
    });
    assert.equal(scan.status, 201, JSON.stringify(scan.body));
    assert.equal(scan.body.alreadyRegistered, true);

    assert.equal(
      await prisma.attendanceRecord.count({ where: { lectureId: p3.lectureId } }),
      1,
      'a rescan must not create a second row',
    );
  });

  it('closes the section lecture once and records absences atomically', async () => {
    const closed = await api(`/api/lectures/${p3.lectureId}/close`, {
      method: 'PATCH',
      token: tokens.techA!,
    });
    assert.equal(closed.status, 200, JSON.stringify(closed.body));
    // Section S2A has three students: one scanned PRESENT, two recorded ABSENT.
    assert.equal(closed.body.total, 3);
    assert.equal(closed.body.present, 1);
    assert.equal(closed.body.absent, 2);
    assert.equal(closed.body.absentStudents.length, 2);

    const rows = await prisma.attendanceRecord.findMany({
      where: { lectureId: p3.lectureId },
      select: { studentId: true, status: true },
    });
    assert.equal(rows.length, 3);
    assert.deepEqual(
      rows.map((row) => row.status).sort(),
      ['ABSENT', 'ABSENT', 'PRESENT'],
    );

    // A second close must not duplicate absences or touch the first result.
    const second = await api(`/api/lectures/${p3.lectureId}/close`, {
      method: 'PATCH',
      token: tokens.techA!,
    });
    assert.equal(second.status, 400, JSON.stringify(second.body));
    assert.match(String(second.body.message), /closed|مغلقة|مؤرشفة/i);
    assert.equal(
      await prisma.attendanceRecord.count({ where: { lectureId: p3.lectureId } }),
      3,
    );
  });

  it('rejects scanning a closed lecture', async () => {
    const student = await prisma.student.findUnique({
      where: { studentCode: ids.codeB },
    });
    assert.ok(student);
    const qr = await api(`/api/students/${student.id}/qr`, {
      token: tokens.head!,
    });
    assert.equal(qr.status, 200);

    const scan = await api(`/api/attendance/${p3.lectureId}/scan-student`, {
      method: 'POST',
      token: tokens.techA!,
      body: { studentCode: qr.body.token },
    });
    assert.equal(scan.status, 400, JSON.stringify(scan.body));
    assert.match(String(scan.body.message), /منتهية|مغلقة/);
  });
});

describe('phase 3b timetable and multi-section lectures', () => {
  const p3b: {
    multiLectureId?: string;
    sundayLectureId?: string;
    mondayLectureId?: string;
    c3Id?: string;
    eveningSectionId?: string;
  } = {};

  it('lets the registrar create and list a weekly timetable entry', async () => {
    const create = await api('/api/timetable', {
      method: 'POST',
      token: tokens.registrar!,
      body: {
        courseId: ids.courseC1,
        sectionId: ids.sectionS2A,
        dayOfWeek: 1,
        startTime: '08:00',
        endTime: '09:30',
      },
    });
    assert.equal(create.status, 201, JSON.stringify(create.body));
    assert.equal(create.body.dayLabel, 'الإثنين');

    const list = await api(`/api/timetable?courseId=${ids.courseC1}`, {
      token: tokens.registrar!,
    });
    assert.equal(list.status, 200);
    assert.ok(
      (list.body as any[]).some((entry) => entry.id === create.body.id),
      'timetable list must include the created entry',
    );
  });

  it('lets the head of department manage the timetable too', async () => {
    const entry = await api('/api/timetable', {
      method: 'POST',
      token: tokens.head!,
      body: {
        courseId: ids.courseC1,
        sectionId: ids.sectionS2B,
        dayOfWeek: 0,
        startTime: '08:00',
        endTime: '09:30',
      },
    });
    assert.equal(entry.status, 201, JSON.stringify(entry.body));
  });

  it('rejects timetable writes from a lecturer', async () => {
    const denied = await api('/api/timetable', {
      method: 'POST',
      token: tokens.lecturerA!,
      body: {
        courseId: ids.courseC1,
        sectionId: ids.sectionS2B,
        dayOfWeek: 2,
        startTime: '10:00',
        endTime: '11:30',
      },
    });
    assert.equal(denied.status, 403);
  });

  it('rejects overlapping slots for the same section', async () => {
    const overlap = await api('/api/timetable', {
      method: 'POST',
      token: tokens.registrar!,
      body: {
        courseId: ids.courseC1,
        sectionId: ids.sectionS2A,
        dayOfWeek: 1,
        startTime: '08:30',
        endTime: '10:00',
      },
    });
    assert.equal(overlap.status, 409, JSON.stringify(overlap.body));
  });

  it('rejects an exact duplicate slot', async () => {
    const duplicate = await api('/api/timetable', {
      method: 'POST',
      token: tokens.registrar!,
      body: {
        courseId: ids.courseC1,
        sectionId: ids.sectionS2A,
        dayOfWeek: 1,
        startTime: '08:00',
        endTime: '09:30',
      },
    });
    assert.equal(duplicate.status, 409);
  });

  it('rejects impossible times and mixed-stage entries', async () => {
    const badTime = await api('/api/timetable', {
      method: 'POST',
      token: tokens.registrar!,
      body: {
        courseId: ids.courseC1,
        sectionId: ids.sectionS2A,
        dayOfWeek: 3,
        startTime: '09:30',
        endTime: '08:00',
      },
    });
    assert.equal(badTime.status, 400);

    const wrongStage = await api('/api/timetable', {
      method: 'POST',
      token: tokens.registrar!,
      body: {
        courseId: ids.courseC1,
        sectionId: ids.sectionS3A,
        dayOfWeek: 3,
        startTime: '10:00',
        endTime: '11:00',
      },
    });
    assert.equal(wrongStage.status, 400);
  });

  it('creates one lecture covering two sections and stores the links', async () => {
    const created = await api('/api/lectures', {
      method: 'POST',
      token: tokens.techA!,
      body: {
        name: 'محاضرة الشعبة المزدوجة',
        studyPeriod: 'MORNING',
        courseId: ids.courseC1,
        sectionIds: [ids.sectionS2A, ids.sectionS2B],
      },
    });
    assert.equal(created.status, 201, JSON.stringify(created.body));
    // The first sectionId is the primary (legacy) reference.
    assert.equal(created.body.sectionId, ids.sectionS2A);

    const read = await api(`/api/lectures/${created.body.id}`, {
      token: tokens.techA!,
    });
    assert.equal(read.status, 200);
    const linked = new Set(
      (read.body.lectureSections ?? []).map(
        (row: any) => row.sectionId ?? row.section?.id,
      ),
    );
    assert.deepEqual(
      [...linked].sort(),
      [ids.sectionS2A, ids.sectionS2B].sort(),
    );

    p3b.multiLectureId = created.body.id;
  });

  it('rejects unknown section ids and mixed-stage batches', async () => {
    const unknown = await api('/api/lectures', {
      method: 'POST',
      token: tokens.techA!,
      body: {
        name: 'شعبة وهمية',
        studyPeriod: 'MORNING',
        courseId: ids.courseC1,
        sectionIds: [ids.sectionS2A, 'not-a-real-section'],
      },
    });
    assert.equal(unknown.status, 400);

    const mixedStage = await api('/api/lectures', {
      method: 'POST',
      token: tokens.techA!,
      body: {
        name: 'شعب من مرحلتين',
        studyPeriod: 'MORNING',
        courseId: ids.courseC1,
        sectionIds: [ids.sectionS2A, ids.sectionS3A],
      },
    });
    assert.equal(mixedStage.status, 400);
  });

  it('rejects a batch mixing morning and evening sections', async () => {
    const created = await api('/api/sections', {
      method: 'POST',
      token: tokens.registrar!,
      body: { stage: 2, studyPeriod: 'EVENING', name: 'EV-TEST' },
    });
    assert.equal(created.status, 201, JSON.stringify(created.body));
    p3b.eveningSectionId = created.body.id;

    const mixedPeriod = await api('/api/lectures', {
      method: 'POST',
      token: tokens.techA!,
      body: {
        name: 'فترتان مختلفتان',
        studyPeriod: 'MORNING',
        courseId: ids.courseC1,
        sectionIds: [ids.sectionS2A, p3b.eveningSectionId],
      },
    });
    assert.equal(mixedPeriod.status, 400);
  });

  it('deduplicates repeated section ids in one lecture', async () => {
    const created = await api('/api/lectures', {
      method: 'POST',
      token: tokens.head!,
      body: {
        name: 'محاضرة مكررة الشعب',
        studyPeriod: 'MORNING',
        courseId: ids.courseC1,
        sectionIds: [ids.sectionS2B, ids.sectionS2B, ids.sectionS2B],
      },
    });
    assert.equal(created.status, 201, JSON.stringify(created.body));
    assert.equal(
      await prisma.lectureSection.count({ where: { lectureId: created.body.id } }),
      1,
    );

    await api(`/api/lectures/${created.body.id}/close`, {
      method: 'PATCH',
      token: tokens.head!,
    });
  });

  it('scans students from every section of the multi-section lecture', async () => {
    const qrA = await api(`/api/students/${ids.studentA}/qr`, {
      token: tokens.head!,
    });
    assert.equal(qrA.status, 200);
    const qrD = await api(`/api/students/${ids.studentD}/qr`, {
      token: tokens.head!,
    });
    assert.equal(qrD.status, 200);

    const scanA = await api(`/api/attendance/${p3b.multiLectureId}/scan-student`, {
      method: 'POST',
      token: tokens.techA!,
      body: { studentCode: qrA.body.token },
    });
    assert.equal(scanA.status, 201, JSON.stringify(scanA.body));

    const scanD = await api(`/api/attendance/${p3b.multiLectureId}/scan-student`, {
      method: 'POST',
      token: tokens.techA!,
      body: { studentCode: qrD.body.token },
    });
    assert.equal(scanD.status, 201, JSON.stringify(scanD.body));
  });

  it('closes the multi-section lecture with absences for the union only', async () => {
    const closed = await api(`/api/lectures/${p3b.multiLectureId}/close`, {
      method: 'PATCH',
      token: tokens.techA!,
    });
    assert.equal(closed.status, 200, JSON.stringify(closed.body));
    // Union of S2A (A, B, C) and S2B (D).
    assert.equal(closed.body.total, 4);
    // A and D scanned. C is covered because the seeded fixture lecture
    // "محاضرة مغلقة - الخوارزميات" (course C1, same ISO week) has C as PRESENT.
    assert.equal(closed.body.present, 3, JSON.stringify(closed.body));
    // B never attended any session of the course this week.
    assert.equal(closed.body.absent, 1, JSON.stringify(closed.body));

    const foreign = await prisma.attendanceRecord.count({
      where: {
        lectureId: p3b.multiLectureId,
        student: { studentCode: { startsWith: 'S3-' } },
      },
    });
    assert.equal(foreign, 0, 'students outside the linked sections must not be recorded');
  });

  it('lets a timetabled student attend a parallel session in another section', async () => {
    // Sunday session for S2B. Student A (S2A) attends; the course is timetabled
    // for his own section, so the scan is legitimate.
    const created = await api('/api/lectures', {
      method: 'POST',
      token: tokens.techA!,
      body: {
        name: 'محاضرة الأحد شعبة 2',
        studyPeriod: 'MORNING',
        courseId: ids.courseC1,
        sectionId: ids.sectionS2B,
      },
    });
    assert.equal(created.status, 201, JSON.stringify(created.body));
    p3b.sundayLectureId = created.body.id;

    const qrA = await api(`/api/students/${ids.studentA}/qr`, {
      token: tokens.head!,
    });
    assert.equal(qrA.status, 200);

    const scan = await api(`/api/attendance/${p3b.sundayLectureId}/scan-student`, {
      method: 'POST',
      token: tokens.techA!,
      body: { studentCode: qrA.body.token },
    });
    assert.equal(scan.status, 201, JSON.stringify(scan.body));
    assert.equal(scan.body.success, true);

    const record = await prisma.attendanceRecord.findFirst({
      where: { lectureId: p3b.sundayLectureId, studentId: ids.studentA },
    });
    assert.ok(record);
    assert.equal(record.status, 'PRESENT');
    assert.match(String(record.note), /الشعبة/);

    const closed = await api(`/api/lectures/${p3b.sundayLectureId}/close`, {
      method: 'PATCH',
      token: tokens.techA!,
    });
    assert.equal(closed.status, 200);
  });

  it('records a covered student as present with a note instead of absent', async () => {
    // Monday session for S2A. Student A already attended a parallel session
    // of the same course this week, so the close must mark him present
    // ("حاضر عبر الشعبة …"), never absent. B and C are absent as usual.
    const created = await api('/api/lectures', {
      method: 'POST',
      token: tokens.techA!,
      body: {
        name: 'محاضرة الاثنين شعبة 1',
        studyPeriod: 'MORNING',
        courseId: ids.courseC1,
        sectionId: ids.sectionS2A,
      },
    });
    assert.equal(created.status, 201, JSON.stringify(created.body));
    p3b.mondayLectureId = created.body.id;

    const closed = await api(`/api/lectures/${p3b.mondayLectureId}/close`, {
      method: 'PATCH',
      token: tokens.techA!,
    });
    assert.equal(closed.status, 200, JSON.stringify(closed.body));
    // A covered via the Sunday/multi lecture; C covered via the seeded
    // fixture for the same course this week; only B is absent.
    assert.equal(closed.body.present, 2, JSON.stringify(closed.body));
    assert.equal(closed.body.absent, 1, JSON.stringify(closed.body));

    const record = await prisma.attendanceRecord.findFirst({
      where: { lectureId: p3b.mondayLectureId, studentId: ids.studentA },
    });
    assert.ok(record);
    assert.equal(record.status, 'PRESENT');
    assert.match(String(record.note), /حاضر عبر/);

    const audit = await prisma.auditLog.findFirst({
      where: { action: 'ATTENDANCE_COVERED', entityId: p3b.mondayLectureId },
    });
    assert.ok(audit, 'coverage must be audited');

    // Follow-up must count the student ONCE for each physical attendance;
    // the covered row is display credit only. Compute the expectation from
    // the seeded rows instead of hard-coding a brittle fixture count.
    const rows = await prisma.attendanceRecord.findMany({
      where: {
        studentId: ids.studentA,
        lecture: { courseId: ids.courseC1, status: 'CLOSED', deletedAt: null },
      },
      select: { status: true, note: true },
    });
    const expectedPresent = rows.filter(
      (row) => row.status === 'PRESENT' && !(row.note ?? '').startsWith('حاضر عبر'),
    ).length;
    const expectedAbsent = rows.filter((row) => row.status === 'ABSENT').length;

    const detail = await api(
      `/api/followup/students/${ids.studentA}?courseId=${ids.courseC1}`,
      { token: tokens.head! },
    );
    assert.equal(detail.status, 200, JSON.stringify(detail.body));
    assert.equal(detail.body.stats.present, expectedPresent, JSON.stringify(detail.body.stats));
    assert.equal(detail.body.stats.absent, expectedAbsent);
    assert.equal(detail.body.stats.totalLectures, expectedPresent + expectedAbsent);

    const coveredRow = (detail.body.lectures ?? []).find(
      (lecture: any) => lecture.lectureId === p3b.mondayLectureId,
    );
    assert.ok(coveredRow, 'the covered lecture must still be listed');
    assert.equal(coveredRow.status, 'PRESENT');
    assert.match(String(coveredRow.note), /حاضر عبر/);
  });

  it('rejects cross-section scans without a timetable entry', async () => {
    const course = await api('/api/courses', {
      method: 'POST',
      token: tokens.head!,
      body: { code: 'CS299', name: 'مادة بدون جدول', stage: 2 },
    });
    assert.equal(course.status, 201, JSON.stringify(course.body));
    p3b.c3Id = course.body.id;

    const assignment = await api('/api/assignments', {
      method: 'POST',
      token: tokens.registrar!,
      body: { staffUserId: userIds.techA, courseId: p3b.c3Id },
    });
    assert.equal(assignment.status, 201, JSON.stringify(assignment.body));

    const lecture = await api('/api/lectures', {
      method: 'POST',
      token: tokens.techA!,
      body: {
        name: 'محاضرة بلا جدول موازٍ',
        studyPeriod: 'MORNING',
        courseId: p3b.c3Id,
        sectionId: ids.sectionS2A,
      },
    });
    assert.equal(lecture.status, 201, JSON.stringify(lecture.body));

    const qrD = await api(`/api/students/${ids.studentD}/qr`, {
      token: tokens.head!,
    });
    assert.equal(qrD.status, 200);

    const scan = await api(`/api/attendance/${lecture.body.id}/scan-student`, {
      method: 'POST',
      token: tokens.techA!,
      body: { studentCode: qrD.body.token },
    });
    assert.equal(scan.status, 400, JSON.stringify(scan.body));
    assert.match(String(scan.body.message), /الشعبة/);

    await api(`/api/lectures/${lecture.body.id}/close`, {
      method: 'PATCH',
      token: tokens.techA!,
    });
  });
});

describe('registration privacy and current-section reports', () => {
  it('only the staff member who opened a lecture can resume it', async () => {
    // Close every still-open lecture so the creation below is allowed and the
    // "other roles see nothing" assertions are unambiguous.
    const openLectures = await prisma.lecture.findMany({
      where: { status: 'ACTIVE' },
      select: { id: true },
    });
    for (const openLecture of openLectures) {
      await api(`/api/lectures/${openLecture.id}/close`, {
        method: 'PATCH',
        token: tokens.head!,
      });
    }

    const created = await api('/api/lectures', {
      method: 'POST',
      token: tokens.lecturerA!,
      body: {
        name: 'محاضرة خصوصية التسجيل',
        studyPeriod: 'MORNING',
        courseId: ids.courseC1,
        sectionId: ids.sectionS2A,
      },
    });
    assert.equal(created.status, 201, JSON.stringify(created.body));

    const mine = await api('/api/lectures/active/current', {
      token: tokens.lecturerA!,
    });
    assert.equal(mine.status, 200, JSON.stringify(mine.body));
    assert.equal(mine.body.id, created.body.id);

    for (const otherToken of [tokens.lecturerB!, tokens.head!]) {
      const other = await api('/api/lectures/active/current', {
        token: otherToken,
      });
      assert.equal(other.status, 200, JSON.stringify(other.body));
      assert.equal(other.body.status, 'NONE');
    }

    for (const otherToken of [tokens.lecturerB!, tokens.head!]) {
      const manual = await api(`/api/attendance/${created.body.id}/manual`, {
        method: 'POST',
        token: otherToken,
        body: { studentName: ids.codeA, status: 'PRESENT' },
      });
      assert.equal(manual.status, 403, JSON.stringify(manual.body));
    }

    const closed = await api(`/api/lectures/${created.body.id}/close`, {
      method: 'PATCH',
      token: tokens.lecturerA!,
    });
    assert.equal(closed.status, 200, JSON.stringify(closed.body));
  });

  it('shows each student’s current section instead of the old lecture section', async () => {
    const currentSection = await prisma.section.findUnique({
      where: { id: ids.sectionS2B },
    });
    assert.ok(currentSection);

    const lecture = await prisma.lecture.create({
      data: {
        name: 'محاضرة تقرير الشعبة الحالية',
        studyPeriod: 'MORNING',
        section: '1',
        sectionId: ids.sectionS1A,
        status: 'CLOSED',
        qrToken: 'phase2-current-section-report',
        qrExpiresAt: new Date(Date.now() + 60 * 60 * 1000),
        createdByUserId: userIds.lecturerA,
        conductedByUserId: userIds.lecturerA,
        closedAt: new Date(),
      },
    });
    await prisma.attendanceRecord.create({
      data: {
        lectureId: lecture.id,
        studentId: ids.studentA,
        studentCode: ids.codeA,
        studentName: 'طالب أ',
        status: 'PRESENT',
      },
    });

    await prisma.student.update({
      where: { id: ids.studentA },
      data: { sectionId: ids.sectionS2B, section: currentSection!.name },
    });

    const report = await api(`/api/lectures/${lecture.id}`, {
      token: tokens.head!,
    });
    assert.equal(report.status, 200, JSON.stringify(report.body));
    const row = report.body.attendances.find(
      (entry: any) => entry.studentId === ids.studentA,
    );
    assert.ok(row, 'attendance row must be present');
    assert.equal(
      row.section,
      currentSection!.name,
      'reports must show the student’s current section',
    );
  });
});
