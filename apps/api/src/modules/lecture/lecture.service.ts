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
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import * as crypto from 'crypto';
import * as os from 'os';

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

@Injectable()
export class LectureService {
  private readonly logger = new Logger(LectureService.name);
  private tokenRotationIntervals: Map<string, NodeJS.Timeout> = new Map();
  private activeTokens: Map<string, { lectureId: string; lectureName: string; expiresAt: Date }> =
    new Map();

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
    actor: AuthenticatedUser,
  ) {
    const cleanName = String(name || '').trim();
    if (!cleanName) {
      throw new BadRequestException('اسم المحاضرة مطلوب');
    }

    const token = this.generateToken();
    const expiresAt = new Date(Date.now() + 25 * 1000);

    const lecture = await this.prisma.lecture.create({
      data: {
        name: cleanName,
        studyPeriod: studyPeriod === 'EVENING' ? 'EVENING' : 'MORNING',
        section: section ? section.trim() : null,
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
      details: `${cleanName} (${lecture.studyPeriod}${lecture.section ? ` / ${lecture.section}` : ''})`,
    });

    // Store token in active cache (valid for 3 minutes for scanned students)
    this.activeTokens.set(token, {
      lectureId: lecture.id,
      lectureName: name,
      expiresAt: new Date(Date.now() + 180 * 1000),
    });

    // Start QR token rotation
    this.startRotation(lecture.id);

    const localIP = getLocalIP();
    const webPort = process.env.WEB_PORT || 3000;
    const allIPs = getAllLocalIPs();

    this.logger.log(`Lecture created: ${lecture.id} - "${name}"`);

    return {
      ...lecture,
      serverAddress: `http://${localIP}:${webPort}`,
      availableAddresses: allIPs.map(i => ({
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
    const lecture = await this.prisma.lecture.findUnique({
      where: { id },
      include: {
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
      availableAddresses: allIPs.map(i => ({
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
        ...this.authorization.lectureScope(actor),
      },
      orderBy: { startedAt: 'desc' },
      include: {
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
      availableAddresses: allIPs.map(i => ({
        name: i.name,
        ip: i.ip,
        url: `http://${i.ip}:${webPort}`,
      })),
    };
  }

  /**
   * Close a lecture and calculate present vs absent from student database
   */
  async closeLecture(id: string, actor: AuthenticatedUser, ipAddress?: string) {
    const lecture = await this.prisma.lecture.findUnique({
      where: { id },
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

    // Stop QR rotation
    this.stopRotation(id);

    // 1. Get students registered for this lecture's studyPeriod & section(s)
    let periodStudents = await this.prisma.student.findMany({
      where: lecture.studyPeriod ? { studyPeriod: lecture.studyPeriod } : {},
      orderBy: [{ orderIndex: 'asc' }, { studentCode: 'asc' }],
    });

    // If no students matched the studyPeriod, fallback to all students to avoid dropping the cohort
    if (periodStudents.length === 0) {
      periodStudents = await this.prisma.student.findMany({
        orderBy: [{ orderIndex: 'asc' }, { studentCode: 'asc' }],
      });
    }

    let allStudents = periodStudents;
    if (lecture.section && lecture.section !== 'ALL') {
      const selectedSections = lecture.section
        .split(',')
        .map(s => normalizeSection(s))
        .filter(Boolean);

      const matchedStudents = periodStudents.filter(student => {
        if (!student.section) return false;
        const studentSec = normalizeSection(student.section);
        return selectedSections.includes(studentSec);
      });

      if (matchedStudents.length > 0) {
        allStudents = matchedStudents;
      }
    }

    // 2. Get all attendance records currently registered for this lecture
    const existingRecords = await this.prisma.attendanceRecord.findMany({
      where: { lectureId: id },
    });

    const attendedStudentIds = new Set(
      existingRecords.map(r => r.studentId).filter(Boolean)
    );
    const attendedCodes = new Set(
      existingRecords.map(r => String(r.studentCode || '').trim()).filter(Boolean)
    );
    const attendedNames = new Set(
      existingRecords.map(r => r.studentName.trim().toLowerCase())
    );

    // 3. For any student in target group who did NOT attend, auto-record them as ABSENT
    for (const student of allStudents) {
      const hasAttended = (student.id && attendedStudentIds.has(student.id)) ||
        (student.studentCode && attendedCodes.has(String(student.studentCode).trim())) ||
        attendedNames.has(student.name.trim().toLowerCase());

      if (!hasAttended) {
        try {
          await this.prisma.attendanceRecord.create({
            data: {
              lectureId: id,
              studentId: student.id,
              studentCode: student.studentCode,
              studentName: student.name,
              status: 'ABSENT',
            },
          });
        } catch (e) {
          // ignore potential duplicate
        }
      }
    }

    // 4. Update student statistics (presentCount, absentCount, totalSessions, rate)
    for (const student of allStudents) {
      const records = await this.prisma.attendanceRecord.findMany({
        where: { studentId: student.id },
      });
      const p = records.filter(r => r.status === 'PRESENT').length;
      const a = records.filter(r => r.status === 'ABSENT').length;
      const total = p + a;
      const rate = total > 0 ? Math.round((p / total) * 100) : 100;
      await this.prisma.student.update({
        where: { id: student.id },
        data: { presentCount: p, absentCount: a, totalSessions: total, rate },
      });
    }

    // 5. Mark lecture CLOSED
    const updated = await this.prisma.lecture.update({
      where: { id },
      data: {
        status: 'CLOSED',
        closedAt: new Date(),
      },
      include: {
        attendances: {
          orderBy: [{ studentCode: 'asc' }, { studentName: 'asc' }],
        },
      },
    });

    const presentStudents = updated.attendances.filter(a => a.status === 'PRESENT');
    const absentStudents = updated.attendances.filter(a => a.status === 'ABSENT');

    const summary = {
      lectureId: id,
      lectureName: updated.name,
      present: presentStudents.length,
      absent: absentStudents.length,
      total: updated.attendances.length,
      presentStudents,
      absentStudents,
    };

    // Clean tokens for this lecture
    for (const [t, info] of this.activeTokens.entries()) {
      if (info.lectureId === id) {
        this.activeTokens.delete(t);
      }
    }

    // Emit lecture closed event
    this.gateway.emitLectureClosed(id, summary);

    await this.audit.log({
      actorUserId: actor.id,
      action: 'LECTURE_CLOSE',
      entityType: 'Lecture',
      entityId: id,
      details: `present=${presentStudents.length}, absent=${absentStudents.length}`,
      ipAddress,
    });

    this.logger.log(`Lecture closed: ${id} - Present: ${presentStudents.length}, Absent: ${absentStudents.length}`);

    return summary;
  }

  /**
   * Get all lectures the actor is allowed to see (for reports)
   */
  async getAllLectures(actor: AuthenticatedUser) {
    return this.prisma.lecture.findMany({
      where: this.authorization.lectureScope(actor),
      include: {
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
    const lecture = await this.prisma.lecture.findUnique({ where: { id: lectureId } });
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
    const lecture = await this.prisma.lecture.findUnique({ where: { id: lectureId } });
    if (!lecture) return false;
    return this.authorization.canAccessLecture(actor, lecture);
  }

  /**
   * Validate a QR token and confirm the actor may access its lecture.
   */
  async validateQrToken(token: string, actor?: AuthenticatedUser): Promise<{
    valid: boolean;
    lectureId?: string;
    lectureName?: string;
    reason?: string;
  }> {
    const cached = this.activeTokens.get(token);
    let lectureId = cached?.lectureId;
    let lectureName = cached?.lectureName;

    if (cached) {
      if (Date.now() > cached.expiresAt.getTime()) {
        this.activeTokens.delete(token);
        return { valid: false, reason: 'انتهت صلاحية رمز QR. يرجى مسح الرمز الجديد المعروض على الشاشة.' };
      }
    } else {
      const lecture = await this.prisma.lecture.findFirst({
        where: { qrToken: token },
      });
      if (!lecture) {
        return { valid: false, reason: 'رمز QR غير صالح أو منتهي الصلاحية' };
      }
      lectureId = lecture.id;
      lectureName = lecture.name;
    }

    const lecture = await this.prisma.lecture.findUnique({
      where: { id: lectureId },
    });

    if (!lecture) {
      return { valid: false, reason: 'المحاضرة غير موجودة' };
    }

    if (lecture.status !== 'ACTIVE') {
      return { valid: false, reason: 'تم إنهاء هذه المحاضرة' };
    }

    if (actor && !this.authorization.canAccessLecture(actor, lecture)) {
      return { valid: false, reason: 'لا تملك صلاحية الوصول إلى هذه المحاضرة' };
    }

    return { valid: true, lectureId: lecture.id, lectureName: lectureName || lecture.name };
  }

  /**
   * Start automatic token rotation for a lecture
   */
  private startRotation(lectureId: string) {
    this.stopRotation(lectureId);

    const interval = setInterval(async () => {
      try {
        const lecture = await this.prisma.lecture.findUnique({ where: { id: lectureId } });
        if (!lecture || lecture.status !== 'ACTIVE') {
          this.stopRotation(lectureId);
          return;
        }

        const newToken = this.generateToken();
        const newExpiresAt = new Date(Date.now() + 25 * 1000);

        await this.prisma.lecture.update({
          where: { id: lectureId },
          data: {
            qrToken: newToken,
            qrExpiresAt: newExpiresAt,
          },
        });

        // Store in active cache for 3 minutes
        this.activeTokens.set(newToken, {
          lectureId,
          lectureName: lecture.name,
          expiresAt: new Date(Date.now() + 180 * 1000),
        });

        // Purge expired tokens from cache
        const now = Date.now();
        for (const [t, info] of this.activeTokens.entries()) {
          if (info.expiresAt.getTime() < now) {
            this.activeTokens.delete(t);
          }
        }

        const localIP = getLocalIP();
        const webPort = process.env.WEB_PORT || 3000;
        const allIPs = getAllLocalIPs();

        this.gateway.emitQrRefreshed(lectureId, {
          token: newToken,
          expiresAt: newExpiresAt.toISOString(),
          lectureId,
          serverAddress: `http://${localIP}:${webPort}`,
          availableAddresses: allIPs.map(i => ({
            name: i.name,
            ip: i.ip,
            url: `http://${i.ip}:${webPort}`,
          })),
        });
      } catch (error) {
        this.logger.error(`Failed to rotate QR token for lecture ${lectureId}`, error);
      }
    }, 22000);

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
   * Delete a lecture and all its attendance records
   */
  async deleteLecture(id: string, actor: AuthenticatedUser, ipAddress?: string) {
    const lecture = await this.prisma.lecture.findUnique({ where: { id } });
    if (!lecture) {
      throw new NotFoundException('Lecture not found');
    }

    if (!this.authorization.canAccessLecture(actor, lecture)) {
      throw new ForbiddenException('لا تملك صلاحية حذف هذه المحاضرة');
    }

    // Stop rotation if active
    this.stopRotation(id);

    // Clean tokens for this lecture
    for (const [t, info] of this.activeTokens.entries()) {
      if (info.lectureId === id) {
        this.activeTokens.delete(t);
      }
    }

    // Delete attendance records first, then the lecture
    await this.prisma.attendanceRecord.deleteMany({ where: { lectureId: id } });
    await this.prisma.lecture.delete({ where: { id } });

    await this.audit.log({
      actorUserId: actor.id,
      action: 'LECTURE_DELETE',
      entityType: 'Lecture',
      entityId: id,
      details: lecture.name,
      ipAddress,
    });

    this.logger.log(`Lecture deleted: ${id}`);
    return { success: true };
  }
}
