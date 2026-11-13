import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';

/**
 * Exact phrase the caller must type to confirm a full academic-year reset.
 * Kept in the backend so the UI cannot weaken the confirmation.
 */
export const ACADEMIC_YEAR_RESET_PHRASE = 'بدء سنة دراسية جديدة';

export interface AcademicYearSummary {
  students: number;
  sections: number;
  courses: number;
  lectures: number;
  attendanceRecords: number;
  timetableEntries: number;
  teachingAssignments: number;
  enrollments: number;
}

@Injectable()
export class SystemService {
  private readonly logger = new Logger(SystemService.name);

  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  /** Counts shown in the confirmation dialog before a destructive reset. */
  async academicYearSummary(): Promise<AcademicYearSummary> {
    const [
      students,
      sections,
      courses,
      lectures,
      attendanceRecords,
      timetableEntries,
      teachingAssignments,
      enrollments,
    ] = await this.prisma.$transaction([
      this.prisma.student.count(),
      this.prisma.section.count(),
      this.prisma.course.count(),
      this.prisma.lecture.count(),
      this.prisma.attendanceRecord.count(),
      this.prisma.timetableEntry.count(),
      this.prisma.teachingAssignment.count(),
      this.prisma.systemSetting.count({
        where: { key: { startsWith: 'STUDENT_COURSES_' } },
      }),
    ]);

    return {
      students,
      sections,
      courses,
      lectures,
      attendanceRecords,
      timetableEntries,
      teachingAssignments,
      enrollments,
    };
  }

  /**
   * Starts a brand-new academic year: deletes every academic record (students,
   * courses, sections, lectures, attendance, timetable, assignments, QR tokens
   * and per-student course enrollments) while keeping staff accounts,
   * sessions, audit logs and system settings intact.
   *
   * Runs in one transaction so a failure leaves the previous year untouched.
   */
  async resetAcademicYear(
    confirm: string,
    actor?: AuthenticatedUser,
    ipAddress?: string,
  ) {
    if (String(confirm || '').trim() !== ACADEMIC_YEAR_RESET_PHRASE) {
      throw new BadRequestException(
        `للتأكيد اكتب العبارة التالية بالضبط: ${ACADEMIC_YEAR_RESET_PHRASE}`,
      );
    }

    const deleted = await this.prisma.$transaction(async (tx) => {
      // Attendance first: it references both lectures and students.
      const attendance = await tx.attendanceRecord.deleteMany({});
      await tx.lectureSection.deleteMany({});
      const lectures = await tx.lecture.deleteMany({});
      const timetableEntries = await tx.timetableEntry.deleteMany({});
      const teachingAssignments = await tx.teachingAssignment.deleteMany({});
      const qrTokens = await tx.studentQrToken.deleteMany({});
      const students = await tx.student.deleteMany({});
      const courses = await tx.course.deleteMany({});
      const sections = await tx.section.deleteMany({});
      const enrollments = await tx.systemSetting.deleteMany({
        where: { key: { startsWith: 'STUDENT_COURSES_' } },
      });

      return {
        students: students.count,
        sections: sections.count,
        courses: courses.count,
        lectures: lectures.count,
        attendanceRecords: attendance.count,
        timetableEntries: timetableEntries.count,
        teachingAssignments: teachingAssignments.count,
        qrTokens: qrTokens.count,
        enrollments: enrollments.count,
      };
    });

    if (actor) {
      await this.audit.log({
        actorUserId: actor.id,
        action: 'ACADEMIC_YEAR_RESET',
        entityType: 'System',
        details:
          `students=${deleted.students}, sections=${deleted.sections}, ` +
          `courses=${deleted.courses}, lectures=${deleted.lectures}, ` +
          `attendance=${deleted.attendanceRecords}, timetable=${deleted.timetableEntries}, ` +
          `assignments=${deleted.teachingAssignments}, qrTokens=${deleted.qrTokens}, ` +
          `enrollments=${deleted.enrollments}`,
        ipAddress: ipAddress || null,
      });
    }

    this.logger.log(
      `ACADEMIC_YEAR_RESET completed: ${JSON.stringify(deleted)}`,
    );

    return {
      success: true,
      deleted,
      message:
        `تم بدء سنة دراسية جديدة: حُذف ${deleted.students} طالب، ` +
        `${deleted.sections} شعبة، ${deleted.courses} مادة، ` +
        `${deleted.lectures} محاضرة و${deleted.attendanceRecords} سجل حضور.`,
    };
  }
}
