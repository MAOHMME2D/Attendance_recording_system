import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AttendanceGateway } from './attendance.gateway';
import { AuthorizationService } from '../auth/authorization.service';
import { AuditService } from '../audit/audit.service';
import { normalizeSection } from '../../common/utils/section.util';
import { normalizeStage } from '../../common/constants/academics';
import { recomputeStudentStats } from '../../common/utils/student-stats.util';
import { isAdministrativeRole } from '../../common/constants/roles';
import { COVER_NOTE_PREFIX } from '../../common/constants/coverage';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import * as crypto from 'crypto';
import * as os from 'os';

/** A shown QR code is valid for this long. */
const QR_TTL_MS = 25 * 1000;
/** A new code is generated before the previous one expires. */
const QR_ROTATION_MS = 22 * 1000;

/** Standard `include` fragment for the lecture's linked sections. */
const LECTURE_SECTIONS_INCLUDE = {
  include: {
    section: {
      select: { id: true, name: true, stage: true, studyPeriod: true },
    },
  },
} as const;

/**
 * Attendance rows carry the student's *current* section, not the lecture's
 * original section. Reports must show where the student belongs today, even
 * when a lecture was recorded for a different section earlier.
 */
const ATTENDANCE_WITH_SECTION_INCLUDE = {
  orderBy: { registeredAt: 'asc' as const },
  include: {
    student: {
      select: {
        section: true,
        sectionRef: { select: { name: true } },
      },
    },
  },
} as const;

type AttendanceWithStudentSection = {
  student?: {
    section: string | null;
    sectionRef: { name: string } | null;
  } | null;
};

/** Flattens the student's current section onto each attendance row. */
function flattenAttendanceSection<T extends AttendanceWithStudentSection>(record: T) {
  const { student, ...rest } = record;
  return {
    ...rest,
    section: student?.sectionRef?.name || student?.section || null,
  };
}

function getAllLocalIPs(): { ip: string; name: string }[] {
  const interfaces = os.networkInterfaces();
  const list: { ip: string; name: string }[] = [];
  for (const name of Object.keys(interfaces)) {
    const lowerName = name.toLowerCase();
    if (
      lowerName.includes('loopback') ||
      lowerName.includes('tailscale') ||
      lowerName.includes('virtual') ||
      lowerName.includes('vmware') ||
      lowerName.includes('vethernet')
    ) {
      continue;
    }
    for (const iface of interfaces[name] || []) {
      if (iface.family === 'IPv4' && !iface.internal) {
        if (iface.address.startsWith('169.254.')) continue;
        list.push({ ip: iface.address, name });
      }
    }
  }

  list.sort((a, b) => {
    const aName = a.name.toLowerCase();
    const bName = b.name.toLowerCase();
    const isAPrio =
      aName.includes('wi-fi') ||
      aName.includes('wlan') ||
      aName.includes('wireless') ||
      aName === 'ethernet';
    const isBPrio =
      bName.includes('wi-fi') ||
      bName.includes('wlan') ||
      bName.includes('wireless') ||
      bName === 'ethernet';
    if (isAPrio && !isBPrio) return -1;
    if (!isAPrio && isBPrio) return 1;
    return 0;
  });

  return list;
}

function getLocalIP(): string {
  const ips = getAllLocalIPs();
  return ips[0]?.ip || '127.0.0.1';
}

/** "1,2" -> ["1", "2"]; "ALL"/empty -> []. */
function parseSectionNames(value?: string | null): string[] {
  const raw = String(value || '').trim();
  if (!raw || raw.toUpperCase() === 'ALL') return [];
  return raw
    .split(',')
    .map((part) => normalizeSection(part))
    .filter(Boolean);
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { code?: string }).code === 'P2002'
  );
}

/**
 * ISO-8601 week key, e.g. "2026-W45". Used to decide whether an attendance in
 * another lecture happened in the same teaching week (parallel sessions of
 * one course).
 */
function isoWeekKey(date: Date): string {
  const d = new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()),
  );
  const dayNum = (d.getUTCDay() + 6) % 7; // Monday = 0 ... Sunday = 6
  d.setUTCDate(d.getUTCDate() - dayNum + 3); // Thursday of the current ISO week
  const firstThursday = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  const firstDayNum = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDayNum + 3);
  const week =
    1 + Math.round((d.getTime() - firstThursday.getTime()) / 604800000);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

@Injectable()
export class LectureService {
  private readonly logger = new Logger(LectureService.name);
  private tokenRotationIntervals: Map<string, NodeJS.Timeout> = new Map();

  constructor(
    private prisma: PrismaService,
    private gateway: AttendanceGateway,
    private authorization: AuthorizationService,
    private audit: AuditService,
  ) {}

  /**
   * Generate a cryptographically secure random token
   */
  private generateToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Create a new lecture and start QR token rotation
   */
  async createLecture(
    name: string,
    studyPeriod: string | undefined,
    section: string | undefined,
    courseId: string | undefined,
    actor: AuthenticatedUser,
    sectionId?: string,
    sectionIds?: string[],
  ) {
    const cleanName = String(name || '').trim();
    if (!cleanName) {
      throw new BadRequestException('اسم المحاضرة مطلوب');
    }

    // Resolve the course. Lecturers and technical lecturers may only create
    // lectures for courses assigned to them. Administrators choose explicitly.
    let course: { id: string; code: string; name: string; stage: number } | null = null;
    if (courseId) {
      course = await this.prisma.course.findUnique({
        where: { id: courseId },
        select: { id: true, code: true, name: true, stage: true },
      });
      if (!course) throw new NotFoundException('المادة غير موجودة');
      if (!isAdministrativeRole(actor.role)) {
        if (!(await this.authorization.canAccessCourse(actor, course.id))) {
          throw new ForbiddenException('هذه المادة غير مسندة إليك');
        }
      }
    } else if (!isAdministrativeRole(actor.role)) {
      const assigned = await this.authorization.assignedCourseIds(actor);
      if (assigned.length === 0) {
        throw new ForbiddenException('لم يتم إسناد أي مادة إليك بعد');
      }
      if (assigned.length > 1) {
        throw new BadRequestException('اختر المادة قبل إنشاء المحاضرة');
      }
      course = await this.prisma.course.findUnique({
        where: { id: assigned[0] },
        select: { id: true, code: true, name: true, stage: true },
      });
      if (!course) throw new NotFoundException('المادة غير موجودة');
    } else {
      throw new BadRequestException('اختر المادة قبل إنشاء المحاضرة');
    }

    // A lecture is scoped to one or more Sections. Prefer the stable FK list
    // (sectionIds); a single sectionId / legacy text mirror is accepted for
    // backwards compatibility. At least one section is mandatory.
    const rawSection = String(section || '').trim();
    const sectionText = rawSection.toUpperCase() === 'ALL' ? '' : rawSection;

    // Ids requested through the new multi-select (preferred) or the legacy
    // single field. De-duplicated, trimmed, empties dropped.
    const requestedIds = [
      ...new Set(
        [...(Array.isArray(sectionIds) ? sectionIds : []), ...(sectionId ? [sectionId] : [])]
          .map((value) => String(value || '').trim())
          .filter(Boolean),
      ),
    ];

    if (requestedIds.length === 0 && !sectionText) {
      throw new BadRequestException(
        'اختيار الشعبة إلزامي. اختر شعبة المحاضرة قبل إنشائها.',
      );
    }

    let resolvedPeriod =
      studyPeriod === 'EVENING' ? 'EVENING' : studyPeriod === 'MORNING' ? 'MORNING' : '';
    let selectedSections: Array<{
      id: string;
      name: string;
      studyPeriod: string;
      stage: number;
    }> = [];

    if (requestedIds.length > 0) {
      const found = await this.prisma.section.findMany({
        where: { id: { in: requestedIds } },
        select: { id: true, name: true, stage: true, studyPeriod: true },
      });
      if (found.length !== requestedIds.length) {
        throw new BadRequestException('شعبة واحدة أو أكثر غير موجودة');
      }
      // Keep the caller's order so the first entry is the primary section.
      const byId = new Map(found.map((row) => [row.id, row]));
      selectedSections = requestedIds.map((id) => byId.get(id)!);

      for (const row of selectedSections) {
        if (row.stage !== course.stage) {
          throw new BadRequestException(
            `الشعبة (${row.name}) لا تنتمي إلى المرحلة ${course.stage}`,
          );
        }
      }
      const periods = new Set(selectedSections.map((row) => row.studyPeriod));
      if (periods.size > 1) {
        throw new BadRequestException(
          'لا يمكن إنشاء محاضرة واحدة تجمع شعبًا من فترتين دراسيتين مختلفتين',
        );
      }
      const onlyPeriod = [...periods][0];
      if (resolvedPeriod && onlyPeriod !== resolvedPeriod) {
        throw new BadRequestException('الشعبة المختارة لا تنتمي إلى هذه الدراسة');
      }
      if (
        sectionText &&
        selectedSections.length === 1 &&
        normalizeSection(sectionText) !== normalizeSection(selectedSections[0].name)
      ) {
        throw new BadRequestException(
          'الشعبة المرسلة كنص لا تطابق الشعبة المحددة. أعد الاختيار.',
        );
      }
      resolvedPeriod = onlyPeriod;
    } else {
      const names = parseSectionNames(sectionText);
      if (names.length === 0) {
        throw new BadRequestException('الشعبة غير صالحة');
      }
      if (names.length > 1) {
        throw new BadRequestException(
          'يمكن اختيار عدة شعب فقط عبر المعرف (sectionIds). أرسل معرفات الشعب وليس أسماءها.',
        );
      }
      const found = await this.prisma.section.findMany({
        where: {
          stage: course.stage,
          name: { in: names },
          ...(resolvedPeriod ? { studyPeriod: resolvedPeriod } : {}),
        },
        select: { id: true, name: true, stage: true, studyPeriod: true },
        take: 2,
      });
      const matching = found.find(
        (row) => normalizeSection(row.name) === normalizeSection(sectionText) &&
          (!resolvedPeriod || row.studyPeriod === resolvedPeriod),
      );
      if (!matching) {
        throw new BadRequestException(
          `الشعبة (${sectionText}) غير موجودة في المرحلة ${course.stage}`,
        );
      }
      resolvedPeriod = matching.studyPeriod;
      selectedSections = [matching];
    }

    if (!resolvedPeriod || selectedSections.length === 0) {
      throw new BadRequestException('تعذر تحديد الدراسة والشعبة للمحاضرة');
    }

    const resolvedSectionRow = selectedSections[0];

    // One live session per conductor: opening a second lecture while one is
    // ACTIVE would leave the first orphaned (QR rotation never stops and the
    // restore view only picks the newest).
    const openLecture = await this.prisma.lecture.findFirst({
      where: {
        deletedAt: null,
        status: 'ACTIVE',
        conductedByUserId: actor.id,
      },
      select: { id: true, name: true },
    });
    if (openLecture) {
      throw new BadRequestException(
        `لديك محاضرة مفتوحة حالياً (${openLecture.name}). أنهِها قبل افتتاح محاضرة جديدة.`,
      );
    }

    const token = this.generateToken();
    const expiresAt = new Date(Date.now() + QR_TTL_MS);

    const lecture = await this.prisma.lecture.create({
      data: {
        name: cleanName,
        studyPeriod: resolvedPeriod,
        section: normalizeSection(resolvedSectionRow.name),
        sectionId: resolvedSectionRow.id,
        courseId: course.id,
        qrToken: token,
        qrExpiresAt: expiresAt,
        // The staff member starting the session is the recorded conductor.
        createdByUserId: actor.id,
        conductedByUserId: actor.id,
        lectureSections: {
          create: selectedSections.map((row) => ({ sectionId: row.id })),
        },
      },
    });

    const sectionLabel = selectedSections
      .map((row) => normalizeSection(row.name))
      .join('، ');

    await this.audit.log({
      actorUserId: actor.id,
      action: 'LECTURE_CREATE',
      entityType: 'Lecture',
      entityId: lecture.id,
      details: `${cleanName} (${course.code} / stage ${course.stage} / ${lecture.studyPeriod} / ${selectedSections.length > 1 ? 'sections' : 'section'} ${sectionLabel})`,
    });

    // Start QR token rotation. The database row is the only source of truth for
    // token validity; there is no separate long-lived acceptance cache.
    this.startRotation(lecture.id);

    const localIP = getLocalIP();
    const webPort = process.env.WEB_PORT || 3000;
    const allIPs = getAllLocalIPs();

    this.logger.log(`Lecture created: ${lecture.id} - "${name}" (${course.code})`);

    return {
      ...lecture,
      course,
      serverAddress: `http://${localIP}:${webPort}`,
      availableAddresses: allIPs.map((i) => ({
        name: i.name,
        ip: i.ip,
        url: `http://${i.ip}:${webPort}`,
      })),
    };
  }

  /**
   * Get a lecture by ID (only if the actor may access it)
   */
  async getLecture(id: string, actor: AuthenticatedUser) {
    const lecture = await this.prisma.lecture.findFirst({
      where: { id, deletedAt: null },
      include: {
        course: { select: { id: true, code: true, name: true, stage: true } },
        sectionRef: { select: { id: true, name: true, stage: true, studyPeriod: true } },
        lectureSections: LECTURE_SECTIONS_INCLUDE,
        conductedBy: {
          select: { id: true, staffId: true, fullName: true, role: true },
        },
        attendances: ATTENDANCE_WITH_SECTION_INCLUDE,
      },
    });

    if (!lecture) {
      throw new NotFoundException('Lecture not found');
    }

    if (!this.authorization.canAccessLecture(actor, lecture)) {
      throw new ForbiddenException('لا تملك صلاحية الوصول إلى هذه المحاضرة');
    }

    const localIP = getLocalIP();
    const webPort = process.env.WEB_PORT || 3000;
    const allIPs = getAllLocalIPs();

    return {
      ...lecture,
      attendances: lecture.attendances.map(flattenAttendanceSection),
      serverAddress: `http://${localIP}:${webPort}`,
      availableAddresses: allIPs.map((i) => ({
        name: i.name,
        ip: i.ip,
        url: `http://${i.ip}:${webPort}`,
      })),
    };
  }

  /**
   * Get the active lecture visible to the actor (if any)
   */
  async getActiveLecture(actor: AuthenticatedUser) {
    const lecture = await this.prisma.lecture.findFirst({
      where: {
        status: 'ACTIVE',
        deletedAt: null,
        // Registration is private to the staff member who opened the lecture.
        // A second lecturer (or an administrator) must not resume it.
        conductedByUserId: actor.id,
      },
      orderBy: { startedAt: 'desc' },
      include: {
        course: { select: { id: true, code: true, name: true, stage: true } },
        sectionRef: { select: { id: true, name: true, stage: true, studyPeriod: true } },
        lectureSections: LECTURE_SECTIONS_INCLUDE,
        conductedBy: {
          select: { id: true, staffId: true, fullName: true, role: true },
        },
        attendances: ATTENDANCE_WITH_SECTION_INCLUDE,
      },
    });

    if (!lecture) {
      return { status: 'NONE', attendances: [] };
    }

    // Ensure QR rotation is active
    if (!this.tokenRotationIntervals.has(lecture.id)) {
      this.startRotation(lecture.id);
    }

    const localIP = getLocalIP();
    const webPort = process.env.WEB_PORT || 3000;
    const allIPs = getAllLocalIPs();

    return {
      ...lecture,
      attendances: lecture.attendances.map(flattenAttendanceSection),
      serverAddress: `http://${localIP}:${webPort}`,
      availableAddresses: allIPs.map((i) => ({
        name: i.name,
        ip: i.ip,
        url: `http://${i.ip}:${webPort}`,
      })),
    };
  }

  /**
   * Close a lecture and calculate present vs absent from the student database.
   *
   * Scope rules:
   *   stage       <- the lecture course (required; no global fallback)
   *   studyPeriod <- the lecture
   *   section     <- the lecture sections, matched through sectionId when the
   *                  student has one and through the legacy text mirror only
   *                  for rows that are not linked yet
   *
   * A section with no students produces zero records; it never widens to the
   * whole stage.
   */
  async closeLecture(id: string, actor: AuthenticatedUser, ipAddress?: string) {
    const lecture = await this.prisma.lecture.findUnique({
      where: { id },
      include: { course: { select: { id: true, code: true, name: true, stage: true } } },
    });

    if (!lecture) {
      throw new NotFoundException('Lecture not found');
    }

    if (!this.authorization.canAccessLecture(actor, lecture)) {
      throw new ForbiddenException('لا تملك صلاحية إنهاء هذه المحاضرة');
    }

    if (lecture.status !== 'ACTIVE') {
      throw new BadRequestException('Lecture is already closed');
    }

    if (!lecture.course) {
      throw new BadRequestException(
        'لا يمكن إنهاء محاضرة غير مرتبطة بمادة. أنشئ المحاضرة من صفحة المحاضرات.',
      );
    }

    const stage = normalizeStage(lecture.course.stage);
    const studyPeriod = lecture.studyPeriod || 'MORNING';

    // The LectureSection rows are the primary scope (multi-section lectures).
    // A lecture created before the multi-section migration keeps its single
    // section through the same table (backfilled in 0007); the legacy text
    // mirror is only resolved for rows that predate even that.
    const linkedSections = await this.prisma.lectureSection.findMany({
      where: { lectureId: id },
      select: {
        section: { select: { id: true, name: true } },
      },
    });

    const sectionIds: string[] = [];
    const sectionNames: string[] = [];
    for (const row of linkedSections) {
      if (!sectionIds.includes(row.section.id)) {
        sectionIds.push(row.section.id);
      }
      const key = normalizeSection(row.section.name);
      if (key && !sectionNames.includes(key)) {
        sectionNames.push(key);
      }
    }

    if (sectionIds.length === 0) {
      const sectionNamesLegacy = parseSectionNames(lecture.section);
      if (lecture.sectionId) {
        sectionIds.push(lecture.sectionId);
        const legacyRow = await this.prisma.section.findUnique({
          where: { id: lecture.sectionId },
          select: { name: true },
        });
        const key = normalizeSection(legacyRow?.name);
        if (key) sectionNames.push(key);
      } else if (sectionNamesLegacy.length > 0) {
        const rows = await this.prisma.section.findMany({
          where: { stage, studyPeriod, name: { in: sectionNamesLegacy } },
          select: { id: true, name: true },
        });
        sectionIds.push(...rows.map((row) => row.id));
        for (const row of rows) {
          const key = normalizeSection(row.name);
          if (key && !sectionNames.includes(key)) sectionNames.push(key);
        }
      }
    }

    // Stop QR rotation before any write; a failed close leaves the lecture
    // ACTIVE but without a refreshed code, which is safe (the old token still
    // expires according to qrExpiresAt).
    this.stopRotation(id);

    const txResult = await this.prisma.$transaction(async (tx) => {
      // Serialize scanning/writing against closing: every attendance writer
      // takes the same per-lecture advisory lock inside its transaction, so a
      // scan committed before the close is counted as attended, and a scan
      // arriving afterwards is rejected by the CLOSED status below.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${id}::text))`;

      // Guard the status transition itself so two concurrent closes (or a
      // close racing an archive) have exactly one winner.
      const transition = await tx.lecture.updateMany({
        where: { id, status: 'ACTIVE', deletedAt: null },
        data: { status: 'CLOSED', closedAt: new Date() },
      });
      if (transition.count === 0) {
        throw new BadRequestException('المحاضرة مغلقة بالفعل أو مؤرشفة');
      }

      // Students are resolved inside the transaction. A section whose row has
      // no students produces zero records; it never widens to the whole stage.
      // Only the legacy fallback scope (a lecture born without any section)
      // still covers the stage rows.
      const initialCandidates = await tx.student.findMany({
        where: { deletedAt: null, stage, studyPeriod },
        orderBy: [{ orderIndex: 'asc' }, { studentCode: 'asc' }],
      });

      // Filter repeating students and include carry-over students based on course enrollment
      let candidates = initialCandidates;
      if (lecture.courseId) {
        const customSettings = await tx.systemSetting.findMany({
          where: { key: { startsWith: 'STUDENT_COURSES_' } },
        });
        const customMap = new Map<string, { academicStatus: string; courseIds: string[] }>();
        const carryOverStudentIds: string[] = [];

        for (const s of customSettings) {
          try {
            const studentId = s.key.replace('STUDENT_COURSES_', '');
            const parsed = JSON.parse(s.value);
            if (parsed && Array.isArray(parsed.courseIds)) {
              customMap.set(studentId, parsed);
              if (
                parsed.academicStatus !== 'REGULAR' &&
                parsed.courseIds.includes(lecture.courseId)
              ) {
                carryOverStudentIds.push(studentId);
              }
            }
          } catch {}
        }

        // Repeating students in this stage who passed this course are excluded (never marked absent)
        candidates = initialCandidates.filter((student) => {
          const custom = customMap.get(student.id);
          if (custom && custom.academicStatus !== 'REGULAR') {
            return custom.courseIds.includes(lecture.courseId!);
          }
          return true;
        });

        // Carry-over students from other stages taking this course
        if (carryOverStudentIds.length > 0) {
          const existingIds = new Set(candidates.map((c) => c.id));
          const neededIds = carryOverStudentIds.filter((cid) => !existingIds.has(cid));
          if (neededIds.length > 0) {
            const carryOverStudents = await tx.student.findMany({
              where: {
                id: { in: neededIds },
                deletedAt: null,
                studyPeriod,
              },
            });
            candidates = candidates.concat(carryOverStudents);
          }
        }
      }

      const existingRecords = await tx.attendanceRecord.findMany({
        where: { lectureId: id },
        select: { studentId: true, studentCode: true },
      });

      const attendedStudentIds = new Set(
        existingRecords.map((record) => record.studentId).filter(Boolean),
      );
      const attendedCodes = new Set(
        existingRecords
          .map((record) => String(record.studentCode || '').trim())
          .filter(Boolean),
      );

      const sectionScoped = sectionIds.length > 0 || sectionNames.length > 0;
      const allStudents = sectionScoped
        ? candidates.filter((student) => {
            if (student.sectionId && sectionIds.includes(student.sectionId)) {
              return true;
            }
            // Legacy rows without sectionId still carry the text mirror.
            const key = normalizeSection(student.section);
            if (Boolean(key) && sectionNames.includes(key)) {
              return true;
            }
            // If already attended (e.g. cross-section or carry-over attendee)
            if (attendedStudentIds.has(student.id)) {
              return true;
            }
            return false;
          })
        : candidates;

      // For any scoped student who did not attend, they are either covered by
      // a parallel session of the same course this week, or explicitly
      // recorded as ABSENT. Coverage only applies when the student's own
      // (course, section) pair is timetabled — the college schedule decides,
      // not the attendance writer.
      const missing = allStudents.filter((student) => {
        if (attendedStudentIds.has(student.id)) return false;
        if (
          student.studentCode &&
          attendedCodes.has(String(student.studentCode).trim())
        ) {
          return false;
        }
        return true;
      });

      const coveredElsewhere = new Map<string, string>(); // studentId -> covering section label
      if (missing.length > 0 && lecture.courseId) {
        const studentSectionIds = [
          ...new Set(missing.map((student) => student.sectionId).filter(Boolean)),
        ] as string[];

        if (studentSectionIds.length > 0) {
          // Only students whose section runs this course may ride on a
          // parallel session of it.
          const timetabled = await tx.timetableEntry.findMany({
            where: {
              courseId: lecture.courseId,
              sectionId: { in: studentSectionIds },
            },
            select: { sectionId: true },
          });
          const timetabledSections = new Set(
            timetabled.map((row) => row.sectionId),
          );

          if (timetabledSections.size > 0) {
            const candidates = missing.filter(
              (student) =>
                student.sectionId && timetabledSections.has(student.sectionId),
            );
            if (candidates.length > 0) {
              const weekKey = isoWeekKey(new Date());
              const elsewhere = await tx.attendanceRecord.findMany({
                where: {
                  status: 'PRESENT',
                  studentId: { in: candidates.map((student) => student.id) },
                  lecture: {
                    courseId: lecture.courseId,
                    id: { not: id },
                    deletedAt: null,
                  },
                },
                select: {
                  studentId: true,
                  lecture: {
                    select: {
                      name: true,
                      closedAt: true,
                      createdAt: true,
                      lectureSections: {
                        select: { section: { select: { name: true } } },
                        orderBy: { sectionId: 'asc' },
                        take: 1,
                      },
                      sectionRef: { select: { name: true } },
                    },
                  },
                },
              });
              for (const row of elsewhere) {
                if (!row.studentId) continue;
                const when = row.lecture.closedAt ?? row.lecture.createdAt;
                if (isoWeekKey(when) !== weekKey) continue;
                if (!coveredElsewhere.has(row.studentId)) {
                  const label =
                    row.lecture.lectureSections?.[0]?.section?.name ||
                    row.lecture.sectionRef?.name ||
                    row.lecture.name;
                  coveredElsewhere.set(row.studentId, label);
                }
              }
            }
          }
        }
      }

      const covered = missing.filter((student) =>
        coveredElsewhere.has(student.id),
      );
      const absent = missing.filter(
        (student) => !coveredElsewhere.has(student.id),
      );

      try {
        if (absent.length > 0) {
          await tx.attendanceRecord.createMany({
            data: absent.map((student) => ({
              lectureId: id,
              studentId: student.id,
              studentCode: student.studentCode,
              studentName: student.name,
              status: 'ABSENT',
            })),
          });
        }
        if (covered.length > 0) {
          await tx.attendanceRecord.createMany({
            data: covered.map((student) => ({
              lectureId: id,
              studentId: student.id,
              studentCode: student.studentCode,
              studentName: student.name,
              status: 'PRESENT',
              note: `${COVER_NOTE_PREFIX} ${coveredElsewhere.get(student.id)}`,
            })),
          });
        }
      } catch (error) {
        if (isUniqueViolation(error)) {
          throw new BadRequestException(
            'تعذر إنهاء المحاضرة بسبب تسجيل متزامن لطالب. أعد المحاولة.',
          );
        }
        throw error;
      }

      await recomputeStudentStats(
        tx,
        allStudents.map((student) => student.id),
      );

      const finalLecture = await tx.lecture.findUnique({
        where: { id },
        include: {
          attendances: {
            orderBy: [{ studentCode: 'asc' }, { studentName: 'asc' }],
          },
          lectureSections: LECTURE_SECTIONS_INCLUDE,
        },
      });

      return {
        lecture: finalLecture,
        scopedCount: allStudents.length,
        coveredCount: covered.length,
        coveredNames: covered.map((student) => student.name),
      };
    });

    const { lecture: summary, scopedCount, coveredCount = 0, coveredNames = [] } =
      txResult ?? {
        lecture: null,
        scopedCount: 0,
        coveredCount: 0,
        coveredNames: [] as string[],
      };

    if (!summary) {
      throw new NotFoundException('Lecture not found');
    }

    const presentStudents = summary.attendances.filter((a) => a.status === 'PRESENT');
    const absentStudents = summary.attendances.filter((a) => a.status === 'ABSENT');

    const result = {
      lectureId: id,
      lectureName: summary.name,
      present: presentStudents.length,
      absent: absentStudents.length,
      total: summary.attendances.length,
      presentStudents,
      absentStudents,
    };

    this.gateway.emitLectureClosed(id, result);

    if (coveredCount > 0) {
      await this.audit.log({
        actorUserId: actor.id,
        action: 'ATTENDANCE_COVERED',
        entityType: 'Lecture',
        entityId: id,
        details:
          `${coveredCount} طالب حُوسب حضورهم من محاضرة أخرى لنفس المادة هذا الأسبوع: ` +
          coveredNames.slice(0, 10).join('، ') +
          (coveredNames.length > 10 ? '، …' : ''),
        ipAddress,
      });
    }

    await this.audit.log({
      actorUserId: actor.id,
      action: 'LECTURE_CLOSE',
      entityType: 'Lecture',
      entityId: id,
      details:
        `stage=${stage}, period=${studyPeriod}, ` +
        `section=${lecture.section || 'ALL'}, students=${scopedCount}, ` +
        `present=${presentStudents.length}, absent=${absentStudents.length}, covered=${coveredCount}`,
      ipAddress,
    });

    this.logger.log(
      `Lecture closed: ${id} - Present: ${presentStudents.length}, Absent: ${absentStudents.length}`,
    );

    return result;
  }

  /**
   * Get all lectures the actor is allowed to see (for reports). Archived
   * lectures stay in the database but are not shown.
   */
  async getAllLectures(actor: AuthenticatedUser) {
    const lectures = await this.prisma.lecture.findMany({
      where: { deletedAt: null, ...this.authorization.lectureScope(actor) },
      include: {
        course: { select: { id: true, code: true, name: true, stage: true } },
        sectionRef: { select: { id: true, name: true, stage: true, studyPeriod: true } },
        lectureSections: LECTURE_SECTIONS_INCLUDE,
        conductedBy: {
          select: { id: true, staffId: true, fullName: true, role: true },
        },
        _count: {
          select: { attendances: true },
        },
        attendances: ATTENDANCE_WITH_SECTION_INCLUDE,
      },
      orderBy: { createdAt: 'desc' },
    });

    return lectures.map((lecture) => ({
      ...lecture,
      attendances: lecture.attendances.map(flattenAttendanceSection),
    }));
  }

  /**
   * Fetch a lecture and fail unless the actor may access it.
   * Used by attendance operations and the WebSocket gateway.
   */
  async assertCanAccessLecture(
    actor: Pick<AuthenticatedUser, 'id' | 'role'>,
    lectureId: string,
  ) {
    const lecture = await this.prisma.lecture.findFirst({
      where: { id: lectureId, deletedAt: null },
      include: {
        course: { select: { id: true, code: true, name: true, stage: true } },
        sectionRef: { select: { id: true, name: true, stage: true, studyPeriod: true } },
        lectureSections: LECTURE_SECTIONS_INCLUDE,
      },
    });
    if (!lecture) {
      throw new NotFoundException('المحاضرة غير موجودة');
    }
    if (!this.authorization.canAccessLecture(actor, lecture)) {
      throw new ForbiddenException('لا تملك صلاحية الوصول إلى هذه المحاضرة');
    }
    return lecture;
  }

  /**
   * Stricter than {@link assertCanAccessLecture}: attendance registration is
   * private to the staff member who opened the lecture. Even administrative
   * roles may only *read* another lecturer's session through reports; they
   * cannot scan, toggle or add records to it.
   */
  async assertCanRegisterLecture(
    actor: Pick<AuthenticatedUser, 'id' | 'role'>,
    lectureId: string,
  ) {
    const lecture = await this.assertCanAccessLecture(actor, lectureId);
    // A closed/archived lecture is rejected by the caller's writable check
    // (HTTP 400) for every role, so ownership is only enforced while the
    // lecture is actually open for registration.
    if (lecture.status === 'ACTIVE') {
      if (
        lecture.conductedByUserId !== actor.id &&
        lecture.createdByUserId !== actor.id
      ) {
        throw new ForbiddenException(
          'التسجيل متاح فقط لمن فتح هذه المحاضرة. لا يمكنك الدخول على تسجيل محاضرة أخرى.',
        );
      }
    }
    return lecture;
  }

  async canAccessLecture(
    actor: Pick<AuthenticatedUser, 'id' | 'role'>,
    lectureId: string,
  ): Promise<boolean> {
    const lecture = await this.prisma.lecture.findFirst({
      where: { id: lectureId, deletedAt: null },
    });
    if (!lecture) return false;
    return this.authorization.canAccessLecture(actor, lecture);
  }

  /**
   * Validate a QR token and confirm the actor may access its lecture.
   *
   * `Lecture.qrExpiresAt` is the only authority. An expired token is rejected
   * even if the process restarted or the token was seen recently, and the
   * rotation interval never extends an old code.
   */
  async validateQrToken(token: string, actor?: AuthenticatedUser): Promise<{
    valid: boolean;
    lectureId?: string;
    lectureName?: string;
    reason?: string;
  }> {
    const clean = String(token || '').trim();
    if (!clean) {
      return { valid: false, reason: 'رمز QR غير صالح أو منتهي الصلاحية' };
    }

    const lecture = await this.prisma.lecture.findFirst({
      where: { qrToken: clean, deletedAt: null },
    });

    if (!lecture) {
      return { valid: false, reason: 'رمز QR غير صالح أو منتهي الصلاحية' };
    }

    if (Date.now() > lecture.qrExpiresAt.getTime()) {
      return {
        valid: false,
        reason: 'انتهت صلاحية رمز QR. يرجى مسح الرمز الجديد المعروض على الشاشة.',
      };
    }

    if (lecture.status !== 'ACTIVE') {
      return { valid: false, reason: 'تم إنهاء هذه المحاضرة' };
    }

    if (actor && !this.authorization.canAccessLecture(actor, lecture)) {
      return { valid: false, reason: 'لا تملك صلاحية الوصول إلى هذه المحاضرة' };
    }

    return { valid: true, lectureId: lecture.id, lectureName: lecture.name };
  }

  /**
   * Start automatic token rotation for a lecture
   */
  private startRotation(lectureId: string) {
    this.stopRotation(lectureId);

    const interval = setInterval(async () => {
      try {
        const lecture = await this.prisma.lecture.findUnique({
          where: { id: lectureId },
          select: { id: true, name: true, status: true, deletedAt: true },
        });
        if (!lecture || lecture.status !== 'ACTIVE' || lecture.deletedAt) {
          this.stopRotation(lectureId);
          return;
        }

        const newToken = this.generateToken();
        const newExpiresAt = new Date(Date.now() + QR_TTL_MS);

        await this.prisma.lecture.update({
          where: { id: lectureId },
          data: {
            qrToken: newToken,
            qrExpiresAt: newExpiresAt,
          },
        });

        const localIP = getLocalIP();
        const webPort = process.env.WEB_PORT || 3000;
        const allIPs = getAllLocalIPs();

        this.gateway.emitQrRefreshed(lectureId, {
          token: newToken,
          expiresAt: newExpiresAt.toISOString(),
          lectureId,
          serverAddress: `http://${localIP}:${webPort}`,
          availableAddresses: allIPs.map((i) => ({
            name: i.name,
            ip: i.ip,
            url: `http://${i.ip}:${webPort}`,
          })),
        });
      } catch (error) {
        this.logger.error(`Failed to rotate QR token for lecture ${lectureId}`, error);
      }
    }, QR_ROTATION_MS);

    this.tokenRotationIntervals.set(lectureId, interval);
    this.logger.log(`Started QR rotation for lecture ${lectureId}`);
  }

  /**
   * Stop token rotation
   */
  private stopRotation(lectureId: string) {
    const interval = this.tokenRotationIntervals.get(lectureId);
    if (interval) {
      clearInterval(interval);
      this.tokenRotationIntervals.delete(lectureId);
    }
  }

  /**
   * Archive a lecture. Attendance records are kept forever; archived lectures
   * are excluded from listings and from every statistic.
   */
  async deleteLecture(id: string, actor: AuthenticatedUser, ipAddress?: string) {
    const lecture = await this.prisma.lecture.findUnique({
      where: { id },
      include: { course: { select: { id: true, code: true, name: true, stage: true } } },
    });
    if (!lecture || lecture.deletedAt) {
      throw new NotFoundException('Lecture not found');
    }

    if (!this.authorization.canAccessLecture(actor, lecture)) {
      throw new ForbiddenException('لا تملك صلاحية حذف هذه المحاضرة');
    }

    this.stopRotation(id);

    const affected = await this.prisma.attendanceRecord.findMany({
      where: { lectureId: id, studentId: { not: null } },
      select: { studentId: true },
      distinct: ['studentId'],
    });
    const recordCount = await this.prisma.attendanceRecord.count({
      where: { lectureId: id },
    });

    await this.prisma.$transaction(async (tx) => {
      await tx.lecture.update({
        where: { id },
        data: {
          deletedAt: new Date(),
          status: 'CLOSED',
          closedAt: lecture.closedAt || new Date(),
        },
      });
      await recomputeStudentStats(
        tx,
        affected.map((row) => row.studentId),
      );
    });

    await this.audit.log({
      actorUserId: actor.id,
      action: 'LECTURE_ARCHIVE',
      entityType: 'Lecture',
      entityId: id,
      details:
        `${lecture.name} (stage ${lecture.course?.stage ?? '-'}, ` +
        `${lecture.studyPeriod}, section ${lecture.section || 'ALL'}), ` +
        `attendanceRecords=${recordCount}`,
      ipAddress,
    });

    this.logger.log(`Lecture archived: ${id} (records preserved: ${recordCount})`);
    return {
      success: true,
      archived: true,
      attendanceRecords: recordCount,
    };
  }
}
