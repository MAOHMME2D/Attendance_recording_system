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
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import * as crypto from 'crypto';
import * as os from 'os';

/** A shown QR code is valid for this long. */
const QR_TTL_MS = 25 * 1000;
/** A new code is generated before the previous one expires. */
const QR_ROTATION_MS = 22 * 1000;

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

    // Validate sections against the course stage and resolve the study period.
    let resolvedPeriod =
      studyPeriod === 'EVENING' ? 'EVENING' : studyPeriod === 'MORNING' ? 'MORNING' : '';
    let resolvedSection: string | null = null;

    if (sectionId) {
      // Stable reference: the section row wins over the free-text name.
      const selected = await this.prisma.section.findUnique({
        where: { id: sectionId },
        select: { name: true, stage: true, studyPeriod: true },
      });
      if (!selected) {
        throw new BadRequestException('الشعبة المحددة غير موجودة');
      }
      if (selected.stage !== course.stage) {
        throw new BadRequestException(
          `الشعبة (${selected.name}) لا تنتمي إلى المرحلة ${course.stage}`,
        );
      }
      if (resolvedPeriod && selected.studyPeriod !== resolvedPeriod) {
        throw new BadRequestException('الشعبة المختارة لا تنتمي إلى هذه الدراسة');
      }
      resolvedPeriod = selected.studyPeriod;
      resolvedSection = normalizeSection(selected.name);
    } else {
      const rawSection = String(section || '').trim();
      if (rawSection && rawSection.toUpperCase() !== 'ALL') {
        const names = parseSectionNames(rawSection);
        if (names.length === 0) {
          throw new BadRequestException('الشعبة غير صالحة');
        }
        const sections = await this.prisma.section.findMany({
          where: {
            stage: course.stage,
            name: { in: names },
            ...(resolvedPeriod ? { studyPeriod: resolvedPeriod } : {}),
          },
          select: { name: true, studyPeriod: true },
        });
        const found = new Set(sections.map((row) => normalizeSection(row.name)));
        const missing = names.filter((name) => !found.has(name));
        if (missing.length > 0) {
          throw new BadRequestException(
            `الشعبة (${missing.join(' / ')}) غير موجودة في المرحلة ${course.stage}`,
          );
        }
        const periods = new Set(sections.map((row) => row.studyPeriod));
        if (periods.size > 1) {
          throw new BadRequestException('الشعب المختارة تنتمي إلى دراستين مختلفتين');
        }
        resolvedPeriod = sections[0].studyPeriod;
        resolvedSection = names.join(',');
      } else if (rawSection.toUpperCase() === 'ALL') {
        resolvedSection = 'ALL';
      }
    }

    if (!resolvedPeriod) resolvedPeriod = 'MORNING';

    const token = this.generateToken();
    const expiresAt = new Date(Date.now() + QR_TTL_MS);

    const lecture = await this.prisma.lecture.create({
      data: {
        name: cleanName,
        studyPeriod: resolvedPeriod,
        section: resolvedSection,
        courseId: course.id,
        qrToken: token,
        qrExpiresAt: expiresAt,
        // The staff member starting the session is the recorded conductor.
        createdByUserId: actor.id,
        conductedByUserId: actor.id,
      },
    });

    await this.audit.log({
      actorUserId: actor.id,
      action: 'LECTURE_CREATE',
      entityType: 'Lecture',
      entityId: lecture.id,
      details: `${cleanName} (${course.code} / stage ${course.stage} / ${lecture.studyPeriod}${lecture.section ? ` / ${lecture.section}` : ''})`,
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
        attendances: {
          orderBy: { registeredAt: 'asc' },
        },
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
        ...this.authorization.lectureScope(actor),
      },
      orderBy: { startedAt: 'desc' },
      include: {
        course: { select: { id: true, code: true, name: true, stage: true } },
        attendances: {
          orderBy: { registeredAt: 'asc' },
        },
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
    const sectionNames = parseSectionNames(lecture.section);

    // Resolve stable section ids for the lecture's names. This is what keeps a
    // renamed section from falling back to the whole stage.
    const sectionRows =
      sectionNames.length > 0
        ? await this.prisma.section.findMany({
            where: {
              stage,
              studyPeriod,
              name: { in: sectionNames },
            },
            select: { id: true },
          })
        : [];
    const sectionIds = sectionRows.map((row) => row.id);

    const candidates = await this.prisma.student.findMany({
      where: { deletedAt: null, stage, studyPeriod },
      orderBy: [{ orderIndex: 'asc' }, { studentCode: 'asc' }],
    });

    const allStudents =
      sectionNames.length === 0
        ? candidates
        : candidates.filter((student) => {
            if (student.sectionId && sectionIds.includes(student.sectionId)) {
              return true;
            }
            // Legacy rows without sectionId still carry the text mirror.
            if (!student.sectionId) {
              const key = normalizeSection(student.section);
              return Boolean(key) && sectionNames.includes(key);
            }
            return false;
          });

    // Stop QR rotation before any write; a failed close leaves the lecture
    // ACTIVE but without a refreshed code, which is safe (the old token still
    // expires according to qrExpiresAt).
    this.stopRotation(id);

    const existingRecords = await this.prisma.attendanceRecord.findMany({
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

    const summary = await this.prisma.$transaction(async (tx) => {
      // For any scoped student who did not attend, record an explicit ABSENT
      // row. Duplicate-key errors are surfaced, never swallowed.
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

      if (missing.length > 0) {
        try {
          await tx.attendanceRecord.createMany({
            data: missing.map((student) => ({
              lectureId: id,
              studentId: student.id,
              studentCode: student.studentCode,
              studentName: student.name,
              status: 'ABSENT',
            })),
          });
        } catch (error) {
          if (isUniqueViolation(error)) {
            throw new BadRequestException(
              'تعذر إنهاء المحاضرة بسبب تسجيل متزامن لطالب. أعد المحاولة.',
            );
          }
          throw error;
        }
      }

      await tx.lecture.update({
        where: { id },
        data: { status: 'CLOSED', closedAt: new Date() },
      });

      await recomputeStudentStats(
        tx,
        allStudents.map((student) => student.id),
      );

      return tx.lecture.findUnique({
        where: { id },
        include: {
          attendances: {
            orderBy: [{ studentCode: 'asc' }, { studentName: 'asc' }],
          },
        },
      });
    });

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

    await this.audit.log({
      actorUserId: actor.id,
      action: 'LECTURE_CLOSE',
      entityType: 'Lecture',
      entityId: id,
      details:
        `stage=${stage}, period=${studyPeriod}, ` +
        `section=${lecture.section || 'ALL'}, students=${allStudents.length}, ` +
        `present=${presentStudents.length}, absent=${absentStudents.length}`,
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
    return this.prisma.lecture.findMany({
      where: { deletedAt: null, ...this.authorization.lectureScope(actor) },
      include: {
        course: { select: { id: true, code: true, name: true, stage: true } },
        _count: {
          select: { attendances: true },
        },
        attendances: {
          orderBy: { registeredAt: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
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
      include: { course: { select: { id: true, code: true, name: true, stage: true } } },
    });
    if (!lecture) {
      throw new NotFoundException('المحاضرة غير موجودة');
    }
    if (!this.authorization.canAccessLecture(actor, lecture)) {
      throw new ForbiddenException('لا تملك صلاحية الوصول إلى هذه المحاضرة');
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
