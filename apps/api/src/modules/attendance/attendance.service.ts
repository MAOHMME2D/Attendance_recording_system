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
   * Rejects students who may not attend this lecture.
   *
   * Policy:
   *   1. Stage and study period must match the lecture's course — always.
   *   2. The student's section must be one of the lecture's sections — OR the
   *      course is timetabled for the student's own section, in which case
   *      the student may attend a parallel session of the same course
   *      (cross-section attendance). Such rows carry a `note` so the
   *      lecturer sees the student came from another section.
   *
   * Returns 'OWN' when the student belongs to the lecture's sections (the
   * normal case) or 'CROSS' when they are covered by the timetable rule.
   */
  private async assertStudentBelongsToLecture(
    lecture: {
      id: string;
      name: string;
      studyPeriod: string | null;
      section: string | null;
      sectionId?: string | null;
      courseId?: string | null;
      course?: { id?: string; stage: number } | null;
      lectureSections?: Array<{
        sectionId: string;
        section?: { name: string } | null;
      }> | null;
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
  ): Promise<'OWN' | 'CROSS'> {
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

    // Build the lecture's section set from the linked LectureSection rows
    // (multi-section lectures), falling back to the legacy single FK / text.
    const linked = lecture.lectureSections ?? [];
    const lectureSectionIds =
      linked.length > 0
        ? linked.map((row) => row.sectionId)
        : lecture.sectionId
          ? [lecture.sectionId]
          : [];
    const lectureSectionNames =
      linked.length > 0
        ? linked
            .map((row) => normalizeSection(row.section?.name))
            .filter((key): key is string => Boolean(key))
        : (() => {
            const key = normalizeSection(String(lecture.section || ''));
            return key ? [key] : [];
          })();

    const studentSection = normalizeSection(
      student.sectionRef?.name ?? student.section,
    );

    const studentInLectureSection =
      (student.sectionId && lectureSectionIds.includes(student.sectionId)) ||
      (studentSection && lectureSectionNames.includes(studentSection)) ||
      (lectureSectionIds.length === 0 && lectureSectionNames.length === 0); // unscoped legacy lecture

    if (studentInLectureSection) {
      return 'OWN';
    }

    // Timetabled parallel session: the course runs for the student's own
    // section too, so attending another section's sitting is legitimate.
    const courseId = lecture.courseId ?? lecture.course?.id ?? null;
    if (courseId && student.sectionId) {
      const entry = await this.prisma.timetableEntry.findFirst({
        where: { courseId, sectionId: student.sectionId },
        select: { id: true },
      });
      if (entry) {
        return 'CROSS';
      }
    }

    const lectureSectionDisplay =
      lectureSectionNames.length > 0
        ? lectureSectionNames.join(' / ')
        : 'غير محددة';
    const studentSectionDisplay = studentSection || 'غير محددة';
    throw new BadRequestException(
      `الطالب (${student.name}) من الشعبة (${studentSectionDisplay})، بينما هذه المحاضرة مخصصة للشعبة (${lectureSectionDisplay}). لا يمكن تسجيل حضوره.`,
    );
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

    const lecture = await this.lectureService.assertCanRegisterLecture(
      actor,
      record.lectureId,
    );
    await this.assertLectureWritable(lecture, actor, 'ATTENDANCE_TOGGLE');

    const updated = await this.prisma.$transaction(async (tx) => {
      // Serialize against scan/close/minual writes on the same lecture.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${record.lectureId}::text))`;

      const fresh = await tx.lecture.findUnique({
        where: { id: record.lectureId },
        select: { status: true, deletedAt: true },
      });
      // The lecture may have been closed between the pre-check and here.
      if (!fresh || fresh.status !== 'ACTIVE' || fresh.deletedAt) {
        return null;
      }

      // Re-read inside the transaction so two concurrent toggles cannot both
      // compute the same flip.
      const current = await tx.attendanceRecord.findUnique({
        where: { id: recordId },
      });
      if (!current) {
        return null;
      }
      const newStatus = current.status === 'PRESENT' ? 'ABSENT' : 'PRESENT';

      const result = await tx.attendanceRecord.update({
        where: { id: recordId },
        data: { status: newStatus },
      });

      if (result.studentId) {
        await recomputeStudentStats(tx, [result.studentId]);
      }
      return result;
    });

    if (!updated) {
      await this.audit.log({
        actorUserId: actor.id,
        action: 'ATTENDANCE_WRITE_REJECTED',
        entityType: 'Lecture',
        entityId: record.lectureId,
        details: 'ATTENDANCE_TOGGLE rejected: lecture closed concurrently',
      });
      throw new BadRequestException(
        'المحاضرة منتهية. لا يمكن تعديل سجلات الحضور في محاضرة مغلقة.',
      );
    }

    await this.audit.log({
      actorUserId: actor.id,
      action: 'ATTENDANCE_TOGGLE',
      entityType: 'AttendanceRecord',
      entityId: recordId,
      details: `${record.status} -> ${updated.status} in lecture ${record.lectureId}`,
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
    const lecture = await this.lectureService.assertCanRegisterLecture(actor, lectureId);
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

    const scope = await this.assertStudentBelongsToLecture(lecture, student);

    // Serialize the write against scan/close on the same lecture.
    const record = await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lectureId}::text))`;

      const fresh = await tx.lecture.findUnique({
        where: { id: lectureId },
        select: { status: true, deletedAt: true },
      });
      if (!fresh || fresh.status !== 'ACTIVE' || fresh.deletedAt) {
        return null;
      }

      // Identity is studentId. The studentCode branch only covers legacy rows
      // created before the migration linked studentId.
      const existing = await tx.attendanceRecord.findFirst({
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

      try {
        return await tx.attendanceRecord.create({
          data: {
            lectureId,
            studentId: student.id,
            studentCode: student.studentCode,
            studentName: student.name,
            status,
            registeredAt: new Date(),
            note:
              scope === 'CROSS'
                ? `طالب من الشعبة ${student.sectionRef?.name ?? student.section ?? 'غير محددة'}`
                : undefined,
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
    });

    if (!record) {
      await this.audit.log({
        actorUserId: actor.id,
        action: 'ATTENDANCE_WRITE_REJECTED',
        entityType: 'Lecture',
        entityId: lectureId,
        details: 'ATTENDANCE_MANUAL rejected: lecture closed concurrently',
      });
      throw new BadRequestException(
        'المحاضرة منتهية. لا يمكن تعديل سجلات الحضور في محاضرة مغلقة.',
      );
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
    const lecture = await this.lectureService.assertCanRegisterLecture(actor, lectureId);

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
    const scope = await this.assertStudentBelongsToLecture(lecture, student);

    const duplicateResult = (dup: {
      studentName: string;
      studentCode: string | null;
    }) => ({
      success: true,
      alreadyRegistered: true,
      record: dup,
      studentName: dup.studentName,
      studentCode: dup.studentCode,
      message: `الطالب (${dup.studentName}) مسجل حضور مسبقاً!`,
    });

    type ScanOutcome =
      | { kind: 'CREATED'; record: any }
      | { kind: 'SWITCHED'; record: any }
      | { kind: 'DUP'; record: any }
      | { kind: 'LECTURE_CLOSED' };

    let outcome: ScanOutcome;
    try {
      outcome = await this.prisma.$transaction(async (tx) => {
        // Serialize attendance writes per lecture with a transaction-scoped
        // advisory lock. The DB unique key stays the final guard, but the lock
        // makes a second device wait and re-read instead of colliding.
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lectureId}::text))`;

        const fresh = await tx.lecture.findUnique({
          where: { id: lectureId },
          select: { status: true, deletedAt: true },
        });
        if (!fresh || fresh.status !== 'ACTIVE' || fresh.deletedAt) {
          return { kind: 'LECTURE_CLOSED' };
        }

        // Identity is studentId, never the display name. The studentCode
        // branch only covers legacy rows created before migration 0005.
        const existing = await tx.attendanceRecord.findFirst({
          where: {
            lectureId,
            OR: [
              { studentId: student.id },
              { studentId: null, studentCode: student.studentCode },
            ],
          },
        });

        if (existing) {
          // A previously recorded ABSENT row (created by the close, or a
          // manual list) is switched so the lecture keeps one row per student.
          if (existing.status === 'ABSENT') {
            const updated = await tx.attendanceRecord.update({
              where: { id: existing.id },
              data: {
                status: 'PRESENT',
                studentId: student.id,
                studentCode: student.studentCode,
                registeredAt: new Date(),
                note:
                  scope === 'CROSS'
                    ? `طالب من الشعبة ${student.sectionRef?.name ?? student.section ?? 'غير محددة'}`
                    : existing.note,
              },
            });
            return { kind: 'SWITCHED', record: updated };
          }
          return { kind: 'DUP', record: existing };
        }

        const record = await tx.attendanceRecord.create({
          data: {
            lectureId,
            studentId: student.id,
            studentCode: student.studentCode,
            studentName: student.name,
            status: 'PRESENT',
            registeredAt: new Date(),
            note:
              scope === 'CROSS'
                ? `طالب من الشعبة ${student.sectionRef?.name ?? student.section ?? 'غير محددة'}`
                : undefined,
          },
        });
        return { kind: 'CREATED', record };
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        // A concurrent device won the unique key just before this transaction;
        // the row is the same attendance. Answer as an already registered scan
        // instead of surfacing a conflict error.
        const dup = await this.prisma.attendanceRecord.findFirst({
          where: {
            lectureId,
            OR: [
              { studentId: student.id },
              { studentId: null, studentCode: student.studentCode },
            ],
          },
        });
        if (dup) {
          return duplicateResult(dup);
        }
      }
      throw error;
    }

    if (!outcome || outcome.kind === 'LECTURE_CLOSED') {
      await this.audit.log({
        actorUserId: actor.id,
        action: 'ATTENDANCE_WRITE_REJECTED',
        entityType: 'Lecture',
        entityId: lectureId,
        details: 'ATTENDANCE_SCAN rejected: lecture closed concurrently',
      });
      throw new BadRequestException(
        'المحاضرة منتهية. لا يمكن تسجيل الحضور في محاضرة مغلقة.',
      );
    }

    const newRecord = outcome.record as any;

    // Already registered - an informational success, not an error.
    if (outcome.kind === 'DUP') {
      return {
        success: true,
        alreadyRegistered: true,
        record: newRecord,
        studentName: newRecord.studentName,
        studentCode: newRecord.studentCode,
        message: `الطالب (${student.name}) مسجل حضور مسبقاً!`,
      };
    }

    this.gateway.emitAttendanceNew(lectureId, {
      id: newRecord.id,
      studentName: newRecord.studentName,
      studentCode: newRecord.studentCode,
      status: newRecord.status,
      registeredAt: new Date(newRecord.registeredAt).toISOString(),
    });

    if (outcome.kind === 'SWITCHED') {
      await this.audit.log({
        actorUserId: actor.id,
        action: 'ATTENDANCE_SCAN',
        entityType: 'AttendanceRecord',
        entityId: newRecord.id,
        details: `switched ABSENT->PRESENT for ${student.studentCode} in lecture ${lectureId}`,
      });

      return {
        success: true,
        alreadyRegistered: false,
        switchedFromAbsent: true,
        record: newRecord,
        studentName: newRecord.studentName,
        studentCode: newRecord.studentCode,
        message: `تم تحويل الطالب (${student.name}) من غائب إلى حاضر بنجاح!`,
      };
    }

    await this.audit.log({
      actorUserId: actor.id,
      action: 'ATTENDANCE_SCAN',
      entityType: 'AttendanceRecord',
      entityId: newRecord.id,
      details: `${student.studentCode} attended lecture ${lectureId}`,
    });

    this.logger.log(
      `Camera Scanned Attendance: "${student.studentCode}" → lecture ${lectureId}`,
    );

    return {
      success: true,
      alreadyRegistered: false,
      record: newRecord,
      studentName: newRecord.studentName,
      studentCode: newRecord.studentCode,
      message: `تم تسجيل حضور الطالب (${student.name}) بنجاح!`,
    };
  }
}
