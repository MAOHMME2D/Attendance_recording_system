/**
 * Phase 4 integration tests: advanced reports & statistics.
 *
 * These tests run against a throwaway PostgreSQL database created on the
 * local server. They never touch the live attendance database or its data.
 */
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import * as bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const API_DIR = join(__dirname, '..');

const TEST_DB_NAME = `att_test_reports_${process.pid}_${Date.now()}`.slice(0, 63);
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
  head: { staffId: 'head1', fullName: 'Reports Head', role: 'HEAD_OF_DEPARTMENT' },
  registrar: { staffId: 'registrar1', fullName: 'Reports Registrar', role: 'REGISTRAR' },
  lecturerA: { staffId: 'lecturer-reports-a', fullName: 'Lecturer A', role: 'LECTURER' },
  lecturerB: { staffId: 'lecturer-reports-b', fullName: 'Lecturer B', role: 'LECTURER' },
  techA: { staffId: 'tech-reports-a', fullName: 'Tech A', role: 'TECHNICAL_LECTURER' },
} as const;

type StaffKey = keyof typeof STAFF;

let app: any;
let prisma: PrismaClient;
let baseUrl = '';
const tokens: Partial<Record<StaffKey, string>> = {};
const userIds: Partial<Record<StaffKey, string>> = {};
const ids: Record<string, string> = {};

function postgresAdminUrl(): string {
  const url = (process.env.DATABASE_ADMIN_URL || '').trim();
  if (!url.startsWith('postgresql://')) {
    throw new Error(
      'DATABASE_ADMIN_URL is not set: tests need a PostgreSQL maintenance URL.',
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
  options: { method?: string; token?: string; body?: unknown } = {},
): Promise<{ status: number; body: any; setCookie: string | null }> {
  const headers: Record<string, string> = {};
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  if (options.token) headers.Cookie = `attendance_session=${options.token}`;

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
  assert.ok(match && match[1], 'login did not set session cookie');
  return decodeURIComponent(match[1]);
}

const COVER = 'حاضر عبر';

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

  const sectionOne = await prisma.section.create({
    data: { stage: 2, studyPeriod: 'MORNING', name: '1', label: 'Stage2-S1' },
  });
  const sectionTwo = await prisma.section.create({
    data: { stage: 2, studyPeriod: 'EVENING', name: '1', label: 'Stage2-Evening-S1' },
  });
  ids.sectionOne = sectionOne.id;
  ids.sectionTwo = sectionTwo.id;

  const course1 = await prisma.course.create({
    data: { code: 'RPT201', name: 'Reports Course One', stage: 2 },
  });
  const course2 = await prisma.course.create({
    data: { code: 'RPT301', name: 'Reports Course Two', stage: 3 },
  });
  ids.course1 = course1.id;
  ids.course2 = course2.id;

  await prisma.teachingAssignment.createMany({
    data: [
      { staffUserId: userIds.lecturerA, courseId: course1.id },
      { staffUserId: userIds.lecturerB, courseId: course2.id },
      { staffUserId: userIds.techA, courseId: course1.id },
    ],
  });

  // Stage 2 morning students (section 1) + one evening student (section 1 evening)
  const studentSeeds = [
    { code: 'R2-001', name: 'Student Alpha', studyPeriod: 'MORNING', section: '1', sectionId: sectionOne.id },
    { code: 'R2-002', name: 'Student Bravo', studyPeriod: 'MORNING', section: '1', sectionId: sectionOne.id },
    { code: 'R2-003', name: 'Student Charlie', studyPeriod: 'MORNING', section: '1', sectionId: sectionOne.id },
    { code: 'R2-004', name: 'Student Delta', studyPeriod: 'MORNING', section: '1', sectionId: sectionOne.id },
    { code: 'R2-EV1', name: 'Student Echo', studyPeriod: 'EVENING', section: '1', sectionId: sectionTwo.id },
  ];
  const students: Array<{ id: string; code: string }> = [];
  for (const seed of studentSeeds) {
    const created = await prisma.student.create({
      data: {
        studentCode: seed.code,
        name: seed.name,
        stage: 2,
        studyPeriod: seed.studyPeriod,
        section: seed.section,
        sectionId: seed.sectionId,
      },
    });
    students.push({ id: created.id, code: seed.code });
  }
  ids.studentA = students[0].id;
  ids.studentB = students[1].id;
  ids.studentC = students[2].id;
  ids.studentD = students[3].id;
  ids.studentE = students[4].id;

  // L1: CLOSED, course1, morning section, conducted by lecturer A.
  //   A: PRESENT, B: PRESENT with coverage note, C: ABSENT, D: ABSENT, E: ABSENT (evening not in scope of this session? — morning lecture: evening students are out of scope)
  const l1 = await prisma.lecture.create({
    data: {
      name: 'Reports Lecture One',
      studyPeriod: 'MORNING',
      section: '1',
      sectionId: sectionOne.id,
      courseId: course1.id,
      status: 'CLOSED',
      closedAt: new Date('2026-09-01T09:00:00Z'),
      startedAt: new Date('2026-09-01T08:00:00Z'),
      qrToken: 'rpt-qr-closed-1',
      qrExpiresAt: new Date(Date.now() + 3600000),
      createdByUserId: userIds.lecturerA,
      conductedByUserId: userIds.lecturerA,
      lectureSections: { create: [{ sectionId: sectionOne.id }] },
    },
  });
  ids.l1 = l1.id;

  // L2: CLOSED, course1, conducted by lecturer A (substitute conduct).
  //   A: PRESENT, B: PRESENT, C: ABSENT, D: ABSENT
  const l2 = await prisma.lecture.create({
    data: {
      name: 'Reports Lecture Two',
      studyPeriod: 'MORNING',
      section: '1',
      sectionId: sectionOne.id,
      courseId: course1.id,
      status: 'CLOSED',
      closedAt: new Date('2026-09-08T09:00:00Z'),
      startedAt: new Date('2026-09-08T08:00:00Z'),
      qrToken: 'rpt-qr-closed-2',
      qrExpiresAt: new Date(Date.now() + 3600000),
      createdByUserId: userIds.lecturerA,
      conductedByUserId: userIds.lecturerA,
      lectureSections: { create: [{ sectionId: sectionOne.id }] },
    },
  });
  ids.l2 = l2.id;

  // L3: CLOSED, course1, evening section — covers student E.
  //   E: PRESENT
  const l3 = await prisma.lecture.create({
    data: {
      name: 'Reports Lecture Three',
      studyPeriod: 'EVENING',
      section: '1',
      sectionId: sectionTwo.id,
      courseId: course1.id,
      status: 'CLOSED',
      closedAt: new Date('2026-09-09T20:00:00Z'),
      startedAt: new Date('2026-09-09T19:00:00Z'),
      qrToken: 'rpt-qr-closed-3',
      qrExpiresAt: new Date(Date.now() + 3600000),
      createdByUserId: userIds.lecturerA,
      conductedByUserId: userIds.techA, // alternate conductor
      lectureSections: { create: [{ sectionId: sectionTwo.id }] },
    },
  });
  ids.l3 = l3.id;

  // L4: ACTIVE (open) lecture — must not count towards absences.
  const l4 = await prisma.lecture.create({
    data: {
      name: 'Reports Lecture Four',
      studyPeriod: 'MORNING',
      section: '1',
      sectionId: sectionOne.id,
      courseId: course1.id,
      status: 'ACTIVE',
      startedAt: new Date('2026-09-15T08:00:00Z'),
      qrToken: 'rpt-qr-active-4',
      qrExpiresAt: new Date(Date.now() + 3600000),
      createdByUserId: userIds.lecturerA,
      conductedByUserId: userIds.lecturerA,
      lectureSections: { create: [{ sectionId: sectionOne.id }] },
    },
  });
  ids.l4 = l4.id;

  // L5: CLOSED, course2 (lecturer B's course, stage 3) — outside lecturer A's scope.
  const stage3Section = await prisma.section.create({
    data: { stage: 3, studyPeriod: 'MORNING', name: '1', label: 'Stage3-S1' },
  });
  ids.sectionStage3 = stage3Section.id;
  const stage3Student = await prisma.student.create({
    data: {
      studentCode: 'R3-001',
      name: 'Student Foxtrot',
      stage: 3,
      studyPeriod: 'MORNING',
      section: '1',
      sectionId: stage3Section.id,
    },
  });
  ids.studentStage3 = stage3Student.id;
  const l5 = await prisma.lecture.create({
    data: {
      name: 'Reports Lecture Five',
      studyPeriod: 'MORNING',
      section: '1',
      sectionId: stage3Section.id,
      courseId: course2.id,
      status: 'CLOSED',
      closedAt: new Date('2026-09-02T09:00:00Z'),
      startedAt: new Date('2026-09-02T08:00:00Z'),
      qrToken: 'rpt-qr-closed-5',
      qrExpiresAt: new Date(Date.now() + 3600000),
      createdByUserId: userIds.lecturerB,
      conductedByUserId: userIds.lecturerB,
      lectureSections: { create: [{ sectionId: stage3Section.id }] },
    },
  });
  ids.l5 = l5.id;

  // Attendance records (coverage notes represent cross-section credits).
  await prisma.attendanceRecord.createMany({
    data: [
      // L1
      { lectureId: l1.id, studentId: ids.studentA, studentCode: 'R2-001', studentName: 'Student Alpha', status: 'PRESENT' },
      { lectureId: l1.id, studentId: ids.studentB, studentCode: 'R2-002', studentName: 'Student Bravo', status: 'PRESENT', note: `${COVER} الشعبة 1` },
      { lectureId: l1.id, studentId: ids.studentC, studentCode: 'R2-003', studentName: 'Student Charlie', status: 'ABSENT' },
      { lectureId: l1.id, studentId: ids.studentD, studentCode: 'R2-004', studentName: 'Student Delta', status: 'ABSENT' },
      // L2
      { lectureId: l2.id, studentId: ids.studentA, studentCode: 'R2-001', studentName: 'Student Alpha', status: 'PRESENT' },
      { lectureId: l2.id, studentId: ids.studentB, studentCode: 'R2-002', studentName: 'Student Bravo', status: 'PRESENT' },
      { lectureId: l2.id, studentId: ids.studentC, studentCode: 'R2-003', studentName: 'Student Charlie', status: 'ABSENT' },
      { lectureId: l2.id, studentId: ids.studentD, studentCode: 'R2-004', studentName: 'Student Delta', status: 'ABSENT' },
      // L3
      { lectureId: l3.id, studentId: ids.studentE, studentCode: 'R2-EV1', studentName: 'Student Echo', status: 'PRESENT' },
      // L5
      { lectureId: l5.id, studentId: ids.studentStage3, studentCode: 'R3-001', studentName: 'Student Foxtrot', status: 'PRESENT' },
    ],
  });

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
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  await app.listen(0, '127.0.0.1');
  const address = app.getHttpServer().address();
  baseUrl = `http://127.0.0.1:${address.port}`;

  for (const key of Object.keys(STAFF) as StaffKey[]) {
    tokens[key] = await login(key);
  }
});

after(async () => {
  try {
    if (app) await app.close();
  } finally {
    if (prisma) await prisma.$disconnect();
    try {
      const admin = new PrismaClient({ datasources: { db: { url: TEST_ADMIN_URL } } });
      await admin.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${TEST_DB_NAME}"`);
      await admin.$disconnect();
    } catch {
      // best effort cleanup
    }
  }
});

describe('reports endpoints — permissions', () => {
  it('rejects TECHNICAL_LECTURER with 403 on every reports endpoint', async () => {
    const paths = ['/api/reports/dashboard', '/api/reports/students', '/api/reports/courses', '/api/reports/lecturers', '/api/reports/sections', '/api/reports/stages', '/api/reports/absentees', '/api/reports/options'];
    for (const path of paths) {
      const result = await api(path, { token: tokens.techA });
      assert.equal(result.status, 403, `${path} should be forbidden for technical lecturer`);
    }
  });

  it('allows ADMIN roles full access', async () => {
    const head = await api('/api/reports/dashboard', { token: tokens.head });
    const registrar = await api('/api/reports/dashboard', { token: tokens.registrar });
    assert.equal(head.status, 200);
    assert.equal(registrar.status, 200);
  });

  it('allows lecturer access scoped to assigned courses', async () => {
    const result = await api('/api/reports/dashboard', { token: tokens.lecturerA });
    assert.equal(result.status, 200);
  });
});

describe('reports calculations', () => {
  it('dashboard reports closed lectures, open lectures and coverage-filtered rates', async () => {
    const result = await api('/api/reports/dashboard', { token: tokens.head });
    assert.equal(result.status, 200);
    const totals = result.body.totals;
    // Closed: L1, L2, L3, L5 = 4 · open: L4 = 1
    assert.equal(totals.closedLectures, 4);
    assert.equal(totals.openLectures, 1);
    // Coverage rows excluded: present = A(L1,L2)+B(L2)+E(L3)+F(L5) = 5? B(L1) excluded.
    // present=4 (A twice + B once + E once) + F(L5) once => 5
    assert.equal(totals.present, 5);
    // absent = C,D in L1 + C,D in L2 = 4
    assert.equal(totals.absent, 4);
    assert.equal(totals.attendanceRate, Math.round((5 / 9) * 100));
  });

  it('dashboard and course detail numbers match (parity)', async () => {
    const dash = await api('/api/reports/dashboard', { token: tokens.head });
    const courses = await api('/api/reports/courses', { token: tokens.head });
    assert.equal(dash.status, 200);
    assert.equal(courses.status, 200);
    const sumPresent = courses.body.items.reduce((sum: number, item: any) => sum + item.present, 0);
    const sumAbsent = courses.body.items.reduce((sum: number, item: any) => sum + item.absent, 0);
    assert.equal(sumPresent, dash.body.totals.present);
    assert.equal(sumAbsent, dash.body.totals.absent);
  });

  it('students report counts only CLOSED lectures and excludes coverage', async () => {
    const result = await api('/api/reports/students?pageSize=50', { token: tokens.head });
    assert.equal(result.status, 200);
    const items = result.body.items;
    const byCode = new Map(items.map((item: any) => [item.studentCode, item]));
    // Student A: 2 present in L1+L2
    assert.equal((byCode.get('R2-001') as any).present, 2);
    assert.equal((byCode.get('R2-001') as any).absent, 0);
    // Student B: coverage in L1 (excluded), present in L2 = 1
    assert.equal((byCode.get('R2-002') as any).present, 1);
    assert.equal((byCode.get('R2-002') as any).absent, 0);
    // Student C: absent in L1 and L2
    assert.equal((byCode.get('R2-003') as any).absent, 2);
    // Rates
    assert.equal((byCode.get('R2-003') as any).absenceRate, 100);
  });

  it('paginates students report correctly', async () => {
    const page1 = await api('/api/reports/students?pageSize=2&page=1&sort=name', { token: tokens.head });
    const page2 = await api('/api/reports/students?pageSize=2&page=2&sort=name', { token: tokens.head });
    assert.equal(page1.status, 200);
    assert.equal(page2.status, 200);
    assert.equal(page1.body.items.length, 2);
    assert.equal(page2.body.items.length, 2);
    assert.equal(page1.body.pagination.total, 6);
    assert.equal(page1.body.pagination.totalPages, 3);
  });

  it('section filter narrows students and lecture stats', async () => {
    const result = await api(`/api/reports/students?sectionId=${ids.sectionTwo}&pageSize=50`, { token: tokens.head });
    assert.equal(result.status, 200);
    assert.equal(result.body.items.length, 1);
    assert.equal(result.body.items[0].studentCode, 'R2-EV1');
  });

  it('stage filter outside lecturer assignment is forbidden', async () => {
    const result = await api('/api/reports/students?stage=3', { token: tokens.lecturerA });
    assert.equal(result.status, 403);
  });

  it('lecturer scope excludes other lecturers courses', async () => {
    const result = await api('/api/reports/courses', { token: tokens.lecturerA });
    assert.equal(result.status, 200);
    const codes = result.body.items.map((item: any) => item.code);
    assert.ok(codes.includes('RPT201'));
    assert.ok(!codes.includes('RPT301'), 'lecturer A must not see lecturer B course');
  });

  it('course students drill-down matches parent course', async () => {
    const parent = await api('/api/reports/courses', { token: tokens.head });
    const courseRow = parent.body.items.find((item: any) => item.code === 'RPT201');
    const drill = await api(`/api/reports/courses/${courseRow.id}/students`, { token: tokens.head });
    assert.equal(drill.status, 200);
    const totalPresent = drill.body.items.reduce((sum: number, item: any) => sum + item.present, 0);
    const totalAbsent = drill.body.items.reduce((sum: number, item: any) => sum + item.absent, 0);
    assert.equal(totalPresent, courseRow.present);
    assert.equal(totalAbsent, courseRow.absent);
  });

  it('lecturer detail shows conducted lectures with stats', async () => {
    const result = await api(`/api/reports/lecturers/${userIds.lecturerA}`, { token: tokens.head });
    assert.equal(result.status, 200);
    assert.equal(result.body.totals.conductedLectures, 2); // L1, L2 (L3 is conducted by tech A)
    assert.equal(result.body.totals.studentsPresent, 3);   // A(L1), A(L2), B(L2)
    assert.equal(result.body.totals.studentsAbsent, 4);    // C,D (L1) + C,D (L2)

    const tech = await api(`/api/reports/lecturers/${userIds.techA}`, { token: tokens.head });
    assert.equal(tech.status, 200);
    assert.equal(tech.body.totals.conductedLectures, 1); // L3
    assert.equal(tech.body.totals.studentsPresent, 1);   // E
    assert.equal(tech.body.totals.studentsAbsent, 0);
  });

  it('lecturer detail is self-or-admin', async () => {
    const self = await api(`/api/reports/lecturers/${userIds.lecturerA}`, { token: tokens.lecturerA });
    const other = await api(`/api/reports/lecturers/${userIds.lecturerB}`, { token: tokens.lecturerA });
    assert.equal(self.status, 200);
    assert.equal(other.status, 403);
  });

  it('absentees list honours the threshold parameter', async () => {
    const threshold2 = await api('/api/reports/absentees?threshold=2', { token: tokens.head });
    const threshold5 = await api('/api/reports/absentees?threshold=5', { token: tokens.head });
    assert.equal(threshold2.status, 200);
    assert.equal(threshold5.status, 200);
    // C and D have 2 absences in L1+L2 → visible at threshold 2, hidden at 5
    const codes2 = threshold2.body.items.map((item: any) => item.studentCode);
    assert.ok(codes2.includes('R2-003'));
    assert.ok(codes2.includes('R2-004'));
    assert.equal(threshold5.body.pagination.total, 0);
  });

  it('date range filters lectures and records', async () => {
    const result = await api('/api/reports/students?from=2026-09-05&to=2026-09-10&pageSize=50', { token: tokens.head });
    assert.equal(result.status, 200);
    const byCode = new Map(result.body.items.map((item: any) => [item.studentCode, item]));
    // L2 (Sep 8): A present, B present, C/D absent; L3 (Sep 9): E present.
    assert.equal((byCode.get('R2-001') as any).present, 1);
    assert.equal((byCode.get('R2-003') as any).absent, 1);
  });

  it('student detail reports per-lecture rows with coverage note visible but excluded from stats', async () => {
    const result = await api(`/api/reports/students/${ids.studentB}`, { token: tokens.head });
    assert.equal(result.status, 200);
    const lectures = result.body.lectures;
    const l1 = lectures.find((row: any) => row.lectureId === ids.l1);
    assert.ok(l1, 'L1 should be listed');
    // Coverage row is present in the listing with its note
    assert.equal(l1.status, 'PRESENT');
    assert.ok(l1.note && l1.note.startsWith(COVER));
    // But statistics only count non-coverage records: B present only in L2
    assert.equal(result.body.stats.present, 1);
    assert.equal(result.body.stats.absent, 0);
  });

  it('student detail returns 404 for out-of-scope student', async () => {
    const result = await api(`/api/reports/students/${ids.studentStage3}`, { token: tokens.lecturerA });
    assert.equal(result.status, 404);
  });

  it('absentee threshold input validation', async () => {
    const invalid = await api('/api/reports/absentees?threshold=0', { token: tokens.head });
    assert.equal(invalid.status, 400);
  });

  it('stages comparison aggregates across all scoped stages', async () => {
    const result = await api('/api/reports/stages', { token: tokens.head });
    assert.equal(result.status, 200);
    const stage2 = result.body.items.find((item: any) => item.stage === 2);
    assert.equal(stage2.students, 5);
    assert.equal(stage2.closedLectures, 3); // L1, L2, L3
    assert.equal(stage2.present, 4);
    assert.equal(stage2.absent, 4);
  });

  it('sections comparison includes evening section student', async () => {
    const result = await api('/api/reports/sections', { token: tokens.head });
    assert.equal(result.status, 200);
    const evening = result.body.items.find((item: any) => item.id === ids.sectionTwo);
    assert.equal(evening.students, 1);
    assert.equal(evening.closedLectures, 1); // L3
    assert.equal(evening.present, 1);
  });
});
