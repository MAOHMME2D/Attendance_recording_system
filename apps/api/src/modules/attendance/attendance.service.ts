import {
  Injectable,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { LectureService } from '../lecture/lecture.service';
import { AttendanceGateway } from '../lecture/attendance.gateway';
import { AuditService } from '../audit/audit.service';
import { normalizeSection } from '../../common/utils/section.util';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import type { Student } from '@prisma/client';

@Injectable()
export class AttendanceService {
  private readonly logger = new Logger(AttendanceService.name);

  constructor(
    private prisma: PrismaService,
    private lectureService: LectureService,
    private gateway: AttendanceGateway,
    private audit: AuditService,
  ) {}

  /**
   * Rejects students whose study period or section does not match the lecture.
   * Without this check a student from section 3 could scan the QR of a
   * section 1 lecture and be recorded as present.
   */
  private assertStudentBelongsToLecture(
    lecture: { name: string; studyPeriod: string | null; section: string | null },
    student: { name: string; studyPeriod: string | null; section: string | null },
  ) {
    const normalizePeriod = (value?: string | null) => {
      const v = String(value || '').trim().toUpperCase();
      if (!v) return '';
      if (v === 'MORNING' || v.includes('صباح')) return 'MORNING';
      if (v === 'EVENING' || v.includes('مسائ')) return 'EVENING';
      return v;
    };
    const periodLabel = (value: string) =>
      value === 'MORNING' ? 'الصباحية' : value === 'EVENING' ? 'المسائية' : value;

    const lecturePeriod = normalizePeriod(lecture.studyPeriod);
    const studentPeriod = normalizePeriod(student.studyPeriod);

    if (lecturePeriod && studentPeriod && lecturePeriod !== studentPeriod) {
      throw new BadRequestException(
        `الطالب (${student.name}) من الدراسة ${periodLabel(studentPeriod)}، بينما هذه المحاضرة ${periodLabel(lecturePeriod)}. لا يمكن تسجيل حضوره.`,
      );
    }

    const lectureSection = String(lecture.section || '').trim();
    if (!lectureSection || lectureSection.toUpperCase() === 'ALL') {
      return;
    }

    const allowedSections = lectureSection
      .split(',')
      .map((s) => normalizeSection(s))
      .filter(Boolean);

    if (allowedSections.length === 0) {
      return;
    }

    const studentSection = normalizeSection(student.section);

    if (!studentSection) {
      throw new BadRequestException(
        `شعبة الطالب (${student.name}) غير محددة في قاعدة البيانات، ولا يمكن تسجيل حضوره في محاضرة مخصصة للشعبة (${allowedSections.join(' / ')}).`,
      );
    }

    if (!allowedSections.includes(studentSection)) {
      throw new BadRequestException(
        `الطالب (${student.name}) من الشعبة (${studentSection})، بينما هذه المحاضرة مخصصة للشعبة (${allowedSections.join(' / ')}). لا يمكن تسجيل حضوره.`,
      );
    }
  }

  /**
   * Get attendance list for a lecture
   */
  async getByLecture(lectureId: string, actor: AuthenticatedUser) {
    await this.lectureService.assertCanAccessLecture(actor, lectureId);
    return this.prisma.attendanceRecord.findMany({
      where: { lectureId },
      orderBy: { registeredAt: 'asc' },
    });
  }

  /**
   * Toggle a student's status between PRESENT and ABSENT
   */
  async toggleStatus(recordId: string, actor: AuthenticatedUser) {
    const record = await this.prisma.attendanceRecord.findUnique({
      where: { id: recordId },
    });

    if (!record) {
      throw new BadRequestException('السجل غير موجود');
    }

    await this.lectureService.assertCanAccessLecture(actor, record.lectureId);

    const newStatus = record.status === 'PRESENT' ? 'ABSENT' : 'PRESENT';

    const updated = await this.prisma.attendanceRecord.update({
      where: { id: recordId },
      data: { status: newStatus },
    });

    return updated;
  }

  /**
   * Add a student manually (mark as absent or present)
   */
  async addManual(
    lectureId: string,
    studentIdentifier: string,
    status: string,
    actor: AuthenticatedUser,
  ) {
    await this.lectureService.assertCanAccessLecture(actor, lectureId);
    const inputClean = studentIdentifier.trim();

    // Look up in student DB
    let resolvedName = inputClean;
    let resolvedStudentId: string | null = null;
    let resolvedStudentCode: string | null = null;

    const studentByCode = await this.prisma.student.findUnique({
      where: { studentCode: inputClean },
    });

    if (studentByCode) {
      resolvedName = studentByCode.name;
      resolvedStudentId = studentByCode.id;
      resolvedStudentCode = studentByCode.studentCode;
    } else {
      const studentByName = await this.prisma.student.findFirst({
        where: { name: inputClean },
      });
      if (studentByName) {
        resolvedName = studentByName.name;
        resolvedStudentId = studentByName.id;
        resolvedStudentCode = studentByName.studentCode;
      }
    }

    // Check duplicate
    const existing = await this.prisma.attendanceRecord.findFirst({
      where: {
        lectureId,
        OR: [
          { studentName: resolvedName },
          ...(resolvedStudentId ? [{ studentId: resolvedStudentId }] : []),
        ],
      },
    });

    if (existing) {
      throw new ConflictException(`الطالب (${resolvedName}) مسجل مسبقاً في قائمة هذه المحاضرة`);
    }

    const record = await this.prisma.attendanceRecord.create({
      data: {
        lectureId,
        studentId: resolvedStudentId,
        studentCode: resolvedStudentCode,
        studentName: resolvedName,
        status,
        registeredAt: new Date(),
      },
    });

    this.gateway.emitAttendanceNew(lectureId, {
      id: record.id,
      studentName: record.studentName,
      studentCode: record.studentCode,
      status: record.status,
      registeredAt: record.registeredAt.toISOString(),
    });

    return record;
  }

  /**
   * Scan student QR via laptop camera - instantly registers attendance.
   *
   * QR-only policy: the scanned value must be an active opaque StudentQrToken.
   * studentCode and full name are deliberately rejected because they are
   * guessable and would let anyone mark a student present without their card.
   * Revoked tokens (including old cards after a rotation) are rejected too.
   */
  async scanStudent(
    lectureId: string,
    studentIdentifier: string,
    actor: AuthenticatedUser,
  ) {
    const lecture = await this.lectureService.assertCanAccessLecture(actor, lectureId);

    if (lecture.status !== 'ACTIVE') {
      throw new BadRequestException('المحاضرة منتهية وغير نشطة حالياً');
    }

    const inputClean = studentIdentifier.trim();
    if (!inputClean) {
      throw new BadRequestException('رمز الطالب غير صالح');
    }

    if (!inputClean.startsWith('qr_')) {
      throw new BadRequestException(
        'طريقة المسح غير صالحة: يجب استخدام بطاقة QR الخاصة بالطالب. لا يُسمح بتسجيل الحضور برقم الطالب أو الاسم.',
      );
    }

    // Resolve through StudentQrToken only. A token that is unknown or revoked
    // is rejected; there is no fallback to studentCode or name.
    const qrToken = await this.prisma.studentQrToken.findFirst({
      where: { token: inputClean, revokedAt: null },
      include: { student: true },
    });

    if (!qrToken || !qrToken.student) {
      throw new BadRequestException(
        'بطاقة QR غير صالحة أو تم إلغاؤها. يرجى مراجعة المسجل لإصدار بطاقة جديدة.',
      );
    }

    const student: Student = qrToken.student;
    const resolvedName = student.name;
    const resolvedStudentId = student.id;
    const resolvedStudentCode = student.studentCode;

    // Make sure the student belongs to this lecture's study period & section
    this.assertStudentBelongsToLecture(lecture, student);

    // Check if already registered in this lecture
    const existing = await this.prisma.attendanceRecord.findFirst({
      where: {
        lectureId,
        OR: [
          { studentName: resolvedName },
          ...(resolvedStudentId ? [{ studentId: resolvedStudentId }] : []),
        ],
      },
    });

    if (existing) {
      // If was previously ABSENT, switch to PRESENT!
      if (existing.status === 'ABSENT') {
        const updated = await this.prisma.attendanceRecord.update({
          where: { id: existing.id },
          data: { status: 'PRESENT', registeredAt: new Date() },
        });

        this.gateway.emitAttendanceNew(lectureId, {
          id: updated.id,
          studentName: updated.studentName,
          studentCode: updated.studentCode,
          status: updated.status,
          registeredAt: updated.registeredAt.toISOString(),
        });

        await this.audit.log({
          actorUserId: actor.id,
          action: 'ATTENDANCE_SCAN',
          entityType: 'AttendanceRecord',
          entityId: updated.id,
          details: `switched ABSENT->PRESENT for ${updated.studentName} in lecture ${lectureId}`,
        });

        return {
          success: true,
          alreadyRegistered: false,
          switchedFromAbsent: true,
          record: updated,
          studentName: updated.studentName,
          studentCode: updated.studentCode,
          message: `تم تحويل الطالب (${resolvedName}) من غائب إلى حاضر بنجاح!`,
        };
      }

      return {
        success: true,
        alreadyRegistered: true,
        record: existing,
        studentName: existing.studentName,
        studentCode: existing.studentCode,
        message: `الطالب (${resolvedName}) مسجل حضور مسبقاً!`,
      };
    }

    // 4. Create attendance record
    const record = await this.prisma.attendanceRecord.create({
      data: {
        lectureId,
        studentId: resolvedStudentId,
        studentCode: resolvedStudentCode,
        studentName: resolvedName,
        status: 'PRESENT',
        registeredAt: new Date(),
      },
    });

    this.gateway.emitAttendanceNew(lectureId, {
      id: record.id,
      studentName: record.studentName,
      studentCode: record.studentCode,
      status: record.status,
      registeredAt: record.registeredAt.toISOString(),
    });

    await this.audit.log({
      actorUserId: actor.id,
      action: 'ATTENDANCE_SCAN',
      entityType: 'AttendanceRecord',
      entityId: record.id,
      details: `${record.studentName} attended lecture ${lectureId}`,
    });

    this.logger.log(`Camera Scanned Attendance: "${resolvedName}" (${resolvedStudentCode || 'No-ID'}) → lecture ${lectureId}`);

    return {
      success: true,
      alreadyRegistered: false,
      record,
      studentName: record.studentName,
      studentCode: record.studentCode,
      message: `تم تسجيل حضور الطالب (${resolvedName}) بنجاح!`,
    };
  }
}
