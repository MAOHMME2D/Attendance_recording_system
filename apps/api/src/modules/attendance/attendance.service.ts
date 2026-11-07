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
import { recomputeStudentStats } from '../../common/utils/student-stats.util';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { code?: string }).code === 'P2002'
  );
}

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
    lecture: {
      id: string;
      name: string;
      studyPeriod: string | null;
      section: string | null;
      course?: { stage: number } | null;
    },
    student: {
      name: string;
      studyPeriod: string | null;
      section: string | null;
      sectionId?: string | null;
      sectionRef?: { name: string } | null;
      stage: number;
      deletedAt?: Date | null;
    },
  ) {
    if (student.deletedAt) {
      throw new BadRequestException(
        `الطالب (${student.name}) محذوف من النظام، ولا يمكن تسجيل حضوره.`,
      );
    }

    const normalizePeriod = (value?: string | null) => {
      const v = String(value || '').trim().toUpperCase();
      if (!v) return '';
      if (v === 'MORNING' || v.includes('صباح')) return 'MORNING';
      if (v === 'EVENING' || v.includes('مسائ')) return 'EVENING';
      return v;
    };
    const periodLabel = (value: string) =>
      value === 'MORNING' ? 'الصباحية' : value === 'EVENING' ? 'المسائية' : value;

    if (lecture.course?.stage && student.stage !== lecture.course.stage) {
      throw new BadRequestException(
        `الطالب (${student.name}) من المرحلة ${student.stage}، بينما هذه المحاضرة للمرحلة ${lecture.course.stage}. لا يمكن تسجيل حضوره.`,
      );
    }

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

    // Prefer the stable section row over the legacy text mirror. A student who
    // is linked through sectionId is always compared through that relation.
    const studentSection = normalizeSection(
      student.sectionRef?.name ?? student.section,
    );

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
   * Closed (or archived) lectures are read-only for every role, including
   * administrators. Rejected attempts are written to the audit trail.
   */
  private async assertLectureWritable(
    lecture: { id: string; status: string },
    actor: AuthenticatedUser,
    operation: string,
  ): Promise<void> {
    if (lecture.status === 'ACTIVE') return;

    await this.audit.log({
      actorUserId: actor.id,
      action: 'ATTENDANCE_WRITE_REJECTED',
      entityType: 'Lecture',
      entityId: lecture.id,
      details: `${operation} rejected: lecture is ${lecture.status}`,
    });

    throw new BadRequestException(
      'المحاضرة منتهية. لا يمكن تعديل سجلات الحضور في محاضرة مغلقة.',
    );
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

    const lecture = await this.lectureService.assertCanAccessLecture(
      actor,
      record.lectureId,
    );
    await this.assertLectureWritable(lecture, actor, 'ATTENDANCE_TOGGLE');

    const newStatus = record.status === 'PRESENT' ? 'ABSENT' : 'PRESENT';

    const updated = await this.prisma.attendanceRecord.update({
      where: { id: recordId },
      data: { status: newStatus },
    });

    if (record.studentId) {
      await recomputeStudentStats(this.prisma, [record.studentId]);
    }

    await this.audit.log({
      actorUserId: actor.id,
      action: 'ATTENDANCE_TOGGLE',
      entityType: 'AttendanceRecord',
      entityId: recordId,
      details: `${record.status} -> ${newStatus} in lecture ${record.lectureId}`,
    });

    return updated;
  }

  /**
   * Add a student manually (mark as absent or present). The student must exist
   * and is identified by row id; a display name is only accepted when it is
   * unique, so two students with the same name can never be mixed up.
   */
  async addManual(
    lectureId: string,
    studentIdentifier: string,
    status: string,
    actor: AuthenticatedUser,
  ) {
    const lecture = await this.lectureService.assertCanAccessLecture(actor, lectureId);
    await this.assertLectureWritable(lecture, actor, 'ATTENDANCE_MANUAL');

    const inputClean = studentIdentifier.trim();
    if (!inputClean) {
      throw new BadRequestException('اسم الطالب أو رقمه مطلوب');
    }

    // Resolve by unique student code first.
    let student = await this.prisma.student.findFirst({
      where: { studentCode: inputClean, deletedAt: null },
      include: { sectionRef: { select: { name: true } } },
    });

    if (!student) {
      const matches = await this.prisma.student.findMany({
        where: { name: inputClean, deletedAt: null },
        take: 3,
        include: { sectionRef: { select: { name: true } } },
      });
      if (matches.length > 1) {
        throw new BadRequestException(
          'يوجد أكثر من طالب بهذا الاسم. استخدم رقم الطالب (الباركود) لتحديد الطالب الصحيح.',
        );
      }
      student = matches[0] || null;
    }

    if (!student) {
      throw new BadRequestException(
        'لم يتم العثور على الطالب في قاعدة البيانات. استخدم رقم الطالب أو أضفه أولاً.',
      );
    }

    this.assertStudentBelongsToLecture(lecture, student);

    // Identity is studentId. The studentCode branch only covers legacy rows
    // created before the migration linked studentId.
    const existing = await this.prisma.attendanceRecord.findFirst({
      where: {
        lectureId,
        OR: [
          { studentId: student.id },
          { studentId: null, studentCode: student.studentCode },
        ],
      },
    });

    if (existing) {
      throw new ConflictException(
        `الطالب (${student.name}) مسجل مسبقاً في قائمة هذه المحاضرة`,
      );
    }

    let record;
    try {
      record = await this.prisma.attendanceRecord.create({
        data: {
          lectureId,
          studentId: student.id,
          studentCode: student.studentCode,
          studentName: student.name,
          status,
          registeredAt: new Date(),
        },
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException(
          `الطالب (${student.name}) مسجل مسبقاً في قائمة هذه المحاضرة`,
        );
      }
      throw error;
    }

    this.gateway.emitAttendanceNew(lectureId, {
      id: record.id,
      studentName: record.studentName,
      studentCode: record.studentCode,
      status: record.status,
      registeredAt: record.registeredAt.toISOString(),
    });

    await this.audit.log({
      actorUserId: actor.id,
      action: 'ATTENDANCE_MANUAL',
      entityType: 'AttendanceRecord',
      entityId: record.id,
      details: `${record.studentName} marked ${record.status} in lecture ${lectureId}`,
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
      await this.audit.log({
        actorUserId: actor.id,
        action: 'ATTENDANCE_WRITE_REJECTED',
        entityType: 'Lecture',
        entityId: lectureId,
        details: 'ATTENDANCE_SCAN rejected: lecture is not ACTIVE',
      });
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
      include: {
        student: { include: { sectionRef: { select: { name: true } } } },
      },
    });

    if (!qrToken || !qrToken.student) {
      throw new BadRequestException(
        'بطاقة QR غير صالحة أو تم إلغاؤها. يرجى مراجعة المسجل لإصدار بطاقة جديدة.',
      );
    }

    if (qrToken.student.deletedAt) {
      throw new BadRequestException(
        'بطاقة QR تخص طالباً محذوفاً من النظام. يرجى مراجعة المسجل.',
      );
    }

    const student = qrToken.student;

    // Make sure the student belongs to this lecture's study period & section
    this.assertStudentBelongsToLecture(lecture, student);

    // Identity is studentId, never the display name.
    const existing = await this.prisma.attendanceRecord.findFirst({
      where: {
        lectureId,
        OR: [
          { studentId: student.id },
          { studentId: null, studentCode: student.studentCode },
        ],
      },
    });

    if (existing) {
      // If was previously ABSENT, switch to PRESENT!
      if (existing.status === 'ABSENT') {
        const updated = await this.prisma.attendanceRecord.update({
          where: { id: existing.id },
          data: {
            status: 'PRESENT',
            studentId: student.id,
            studentCode: student.studentCode,
            registeredAt: new Date(),
          },
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
          details: `switched ABSENT->PRESENT for ${student.studentCode} in lecture ${lectureId}`,
        });

        return {
          success: true,
          alreadyRegistered: false,
          switchedFromAbsent: true,
          record: updated,
          studentName: updated.studentName,
          studentCode: updated.studentCode,
          message: `تم تحويل الطالب (${student.name}) من غائب إلى حاضر بنجاح!`,
        };
      }

      return {
        success: true,
        alreadyRegistered: true,
        record: existing,
        studentName: existing.studentName,
        studentCode: existing.studentCode,
        message: `الطالب (${student.name}) مسجل حضور مسبقاً!`,
      };
    }

    // Create attendance record
    let record;
    try {
      record = await this.prisma.attendanceRecord.create({
        data: {
          lectureId,
          studentId: student.id,
          studentCode: student.studentCode,
          studentName: student.name,
          status: 'PRESENT',
          registeredAt: new Date(),
        },
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException(
          `الطالب (${student.name}) سُجل حضوره للتو في هذه المحاضرة. حدّث القائمة.`,
        );
      }
      throw error;
    }

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
      details: `${student.studentCode} attended lecture ${lectureId}`,
    });

    this.logger.log(
      `Camera Scanned Attendance: "${student.studentCode}" → lecture ${lectureId}`,
    );

    return {
      success: true,
      alreadyRegistered: false,
      record,
      studentName: record.studentName,
      studentCode: record.studentCode,
      message: `تم تسجيل حضور الطالب (${student.name}) بنجاح!`,
    };
  }
}
