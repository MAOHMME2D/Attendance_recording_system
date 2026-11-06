import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { normalizeSection } from '../../common/utils/section.util';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import * as crypto from 'crypto';

@Injectable()
export class StudentService {
  private readonly logger = new Logger(StudentService.name);

  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  /**
   * Get all students with their attendance statistics and lecture details
   * Sorted strictly by Excel Column A order (orderIndex)
   */
  async getAllWithStats(studyPeriod?: string, section?: string) {
    const whereClause: any = {};
    if (studyPeriod) {
      whereClause.studyPeriod = studyPeriod;
    }
    if (section && section !== 'ALL') {
      whereClause.section = normalizeSection(section);
    }

    const students = await this.prisma.student.findMany({
      where: whereClause,
      include: {
        qrTokens: {
          where: { revokedAt: null },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
        attendances: {
          include: {
            lecture: {
              select: {
                id: true,
                name: true,
                status: true,
                startedAt: true,
              },
            },
          },
          orderBy: { registeredAt: 'desc' },
        },
      },
      orderBy: [
        { orderIndex: 'asc' },
        { studentCode: 'asc' },
      ],
    });

    return students.map((student, idx) => {
      const lecturePresent = student.attendances.filter(a => a.status === 'PRESENT').length;
      const lectureAbsent = student.attendances.filter(a => a.status === 'ABSENT').length;

      // The counters stored on Student are recalculated from AttendanceRecord every time a
      // lecture is closed (see LectureService.closeLecture), so they already include these
      // records. Adding the records on top of them double-counts every lecture.
      // Attendance records are the source of truth; the stored counters are only used as a
      // baseline for students that have no records yet (e.g. imported from Excel).
      const hasRecords = student.attendances.length > 0;
      const totalPresent = hasRecords ? lecturePresent : (student.presentCount || 0);
      const totalAbsent = hasRecords ? lectureAbsent : (student.absentCount || 0);
      const totalSessions = hasRecords
        ? totalPresent + totalAbsent
        : Math.max(student.totalSessions || 0, totalPresent + totalAbsent);

      return {
        id: student.id,
        orderIndex: student.orderIndex != null ? student.orderIndex : (idx + 1),
        studentCode: student.studentCode, // الباركود (عمود G)
        name: student.name, // اسم الطالب (عمود B)
        studyPeriod: student.studyPeriod || 'MORNING', // صباحي / مسائي
        section: student.section || '', // الشعبة (عمود C)
        qrToken: student.qrTokens[0]?.token || null,
        presentCount: totalPresent, // عدد الحضور (عمود D)
        absentCount: totalAbsent, // عدد مرات الغياب (عمود E)
        totalLectures: totalSessions, // إجمالي المحاضرات (عمود F)
        createdAt: student.createdAt,
        history: student.attendances.map(a => ({
          attendanceId: a.id,
          lectureId: a.lecture.id,
          lectureName: a.lecture.name,
          lectureDate: a.lecture.startedAt,
          status: a.status,
          registeredAt: a.registeredAt,
        })),
      };
    });
  }

  /**
   * Look up a student by their ID/Code
   */
  async findByCode(code: string) {
    const trimmed = code.trim();
    const student = await this.prisma.student.findUnique({
      where: { studentCode: trimmed },
    });

    if (!student) {
      const byName = await this.prisma.student.findFirst({
        where: { name: trimmed },
      });
      return byName || null;
    }

    return student;
  }

  /**
   * Minimal student list for lecturers who need manual attendance options.
   * Does not expose QR credentials or full attendance history.
   */
  async getOptions(studyPeriod?: string, section?: string) {
    const where: any = {};
    if (studyPeriod) where.studyPeriod = studyPeriod;
    if (section && section !== 'ALL') where.section = normalizeSection(section);

    const students = await this.prisma.student.findMany({
      where,
      select: {
        id: true,
        name: true,
        studentCode: true,
        studyPeriod: true,
        section: true,
        orderIndex: true,
      },
      orderBy: [{ orderIndex: 'asc' }, { studentCode: 'asc' }],
    });

    return students;
  }

  // ============================================================
  // Opaque, revocable student QR credentials
  // ============================================================

  private generateQrToken(): string {
    return `qr_${crypto.randomBytes(24).toString('base64url')}`;
  }

  /** Returns the active token, creating one if the student has none. */
  async ensureQrToken(studentId: string, actorId?: string) {
    const existing = await this.prisma.studentQrToken.findFirst({
      where: { studentId, revokedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    if (existing) return existing;

    return this.issueQrToken(studentId, actorId);
  }

  private async issueQrToken(studentId: string, actorId?: string) {
    // Retry on the (very unlikely) unique collision.
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        return await this.prisma.studentQrToken.create({
          data: {
            studentId,
            token: this.generateQrToken(),
            createdByUserId: actorId || null,
          },
        });
      } catch (error: any) {
        const isUnique =
          error?.code === 'P2002' ||
          String(error?.message || '').toLowerCase().includes('unique');
        if (!isUnique || attempt === 4) throw error;
      }
    }
    throw new BadRequestException('تعذر إصدار رمز QR للطالب');
  }

  /** Revokes the current token and returns a fresh one. */
  async rotateQrToken(studentId: string, actor: AuthenticatedUser) {
    const student = await this.prisma.student.findUnique({ where: { id: studentId } });
    if (!student) {
      throw new NotFoundException('الطالب غير موجود');
    }

    await this.prisma.studentQrToken.updateMany({
      where: { studentId, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    const token = await this.issueQrToken(studentId, actor.id);

    await this.audit.log({
      actorUserId: actor.id,
      action: 'STUDENT_QR_ROTATE',
      entityType: 'Student',
      entityId: studentId,
      details: student.studentCode,
    });

    return token;
  }

  /** Ensures tokens exist for every student (used by the migration script). */
  async backfillQrTokens(): Promise<number> {
    const students = await this.prisma.student.findMany({
      where: { qrTokens: { none: { revokedAt: null } } },
      select: { id: true },
    });
    for (const student of students) {
      await this.issueQrToken(student.id);
    }
    return students.length;
  }

  /**
   * Create a single student
   * Columns: A: orderIndex, B: name, C: section, D: presentCount, E: absentCount, F: totalSessions, G: studentCode (barcode)
   */
  async create(data: {
    studentCode: string;
    name: string;
    studyPeriod?: string;
    section?: string;
    orderIndex?: number;
    presentCount?: number;
    absentCount?: number;
    totalSessions?: number;
    rate?: number;
  }, actor?: AuthenticatedUser) {
    const cleanCode = data.studentCode.trim();
    const cleanName = data.name.trim();

    if (!cleanCode || !cleanName) {
      throw new BadRequestException('الباركود / الرقم التعريفي واسم الطالب مطلوبان');
    }

    const existing = await this.prisma.student.findUnique({
      where: { studentCode: cleanCode },
    });

    if (existing) {
      throw new ConflictException(`الباركود (${cleanCode}) مسجل مسبقاً باسم (${existing.name})`);
    }

    const presentCount = Number(data.presentCount || 0);
    const absentCount = Number(data.absentCount || 0);
    const totalSessions = data.totalSessions != null && !isNaN(Number(data.totalSessions))
      ? Number(data.totalSessions)
      : (presentCount + absentCount);

    const student = await this.prisma.student.create({
      data: {
        orderIndex: data.orderIndex != null ? Number(data.orderIndex) : null,
        studentCode: cleanCode,
        name: cleanName,
        studyPeriod: data.studyPeriod || 'MORNING',
        section: data.section ? normalizeSection(data.section) : null,
        presentCount,
        absentCount,
        totalSessions,
      },
    });

    this.logger.log(`Created student: #${student.orderIndex} [${student.studentCode}] ${student.name} (${student.studyPeriod} - ${student.section || '-'})`);

    await this.ensureQrToken(student.id, actor?.id);
    if (actor) {
      await this.audit.log({
        actorUserId: actor.id,
        action: 'STUDENT_CREATE',
        entityType: 'Student',
        entityId: student.id,
        details: student.studentCode,
      });
    }

    return student;
  }

  /**
   * Bulk import students (from Excel)
   */
  async createBatch(students: {
    orderIndex?: number;
    studentCode: string;
    name: string;
    studyPeriod?: string;
    section?: string;
    presentCount?: number;
    absentCount?: number;
    totalSessions?: number;
    rate?: number;
  }[], actor?: AuthenticatedUser) {
    let created = 0;
    let updated = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (let i = 0; i < students.length; i++) {
      const item = students[i];
      const code = String(item.studentCode || '').trim();
      const name = String(item.name || '').trim();
      const studyPeriod = item.studyPeriod || 'MORNING';
      const section = item.section ? normalizeSection(item.section) : null;
      const orderIndex = item.orderIndex != null ? Number(item.orderIndex) : (i + 1);
      const presentCount = item.presentCount != null ? Math.max(0, Number(item.presentCount) || 0) : 0;
      const absentCount = item.absentCount != null ? Math.max(0, Number(item.absentCount) || 0) : 0;
      const totalSessions = item.totalSessions != null && !isNaN(Number(item.totalSessions))
        ? Number(item.totalSessions)
        : (presentCount + absentCount);

      if (!code || !name) continue;

      try {
        const existing = await this.prisma.student.findUnique({
          where: { studentCode: code },
        });

        if (existing) {
          const updatedStudent = await this.prisma.student.update({
            where: { id: existing.id },
            data: {
              orderIndex,
              name,
              studyPeriod,
              section,
              presentCount,
              absentCount,
              totalSessions,
            },
          });
          await this.ensureQrToken(updatedStudent.id, actor?.id);
          updated++;
        } else {
          const createdStudent = await this.prisma.student.create({
            data: {
              orderIndex,
              studentCode: code,
              name,
              studyPeriod,
              section,
              presentCount,
              absentCount,
              totalSessions,
            },
          });
          await this.ensureQrToken(createdStudent.id, actor?.id);
          created++;
        }
      } catch (err: any) {
        skipped++;
        errors.push(`فشل استيراد ${code}: ${err.message}`);
      }
    }

    return { success: true, count: created + updated, created, updated, skipped, errors };
  }

  /**
   * Update student details
   */
  async update(id: string, data: { studentCode?: string; name?: string; studyPeriod?: string; section?: string }, actor?: AuthenticatedUser) {
    const student = await this.prisma.student.findUnique({ where: { id } });
    if (!student) {
      throw new NotFoundException('الطالب غير موجود');
    }

    const updateData: any = {};
    if (data.name && data.name.trim()) updateData.name = data.name.trim();
    if (data.studyPeriod !== undefined) updateData.studyPeriod = data.studyPeriod || 'MORNING';
    if (data.section !== undefined) updateData.section = data.section ? data.section.trim() : null;
    if (data.studentCode && data.studentCode.trim()) {
      const cleanCode = data.studentCode.trim();
      if (cleanCode !== student.studentCode) {
        const existing = await this.prisma.student.findUnique({
          where: { studentCode: cleanCode },
        });
        if (existing) {
          throw new ConflictException(`الباركود (${cleanCode}) مستخدم لطالب آخر`);
        }
        updateData.studentCode = cleanCode;
      }
    }

    const updated = await this.prisma.student.update({
      where: { id },
      data: updateData,
    });

    if (actor) {
      await this.audit.log({
        actorUserId: actor.id,
        action: 'STUDENT_UPDATE',
        entityType: 'Student',
        entityId: id,
        details: student.studentCode,
      });
    }

    return updated;
  }

  /**
   * Delete a student
   */
  async delete(id: string, actor?: AuthenticatedUser) {
    const student = await this.prisma.student.findUnique({ where: { id } });
    if (!student) {
      throw new NotFoundException('الطالب غير موجود');
    }

    await this.prisma.student.delete({ where: { id } });
    this.logger.log(`Deleted student ${id} (${student.name})`);

    if (actor) {
      await this.audit.log({
        actorUserId: actor.id,
        action: 'STUDENT_DELETE',
        entityType: 'Student',
        entityId: id,
        details: `${student.studentCode} - ${student.name}`,
      });
    }

    return { success: true };
  }

  /**
   * Reset absences (تصفير الغيابات)
   * Can reset:
   * - All students
   * - A specific study period (MORNING / EVENING)
   * - A specific section
   * - A single student
   * resetType: 'ABSENCES_ONLY' | 'ALL_ATTENDANCE'
   */
  async resetAbsences(params: {
    studyPeriod?: string;
    section?: string;
    studentId?: string;
    resetType?: 'ABSENCES_ONLY' | 'ALL_ATTENDANCE';
  }, actor?: AuthenticatedUser) {
    const { studyPeriod, section, studentId, resetType = 'ABSENCES_ONLY' } = params;

    const whereClause: any = {};
    if (studentId) {
      whereClause.id = studentId;
    } else {
      if (studyPeriod && (studyPeriod === 'MORNING' || studyPeriod === 'EVENING')) {
        whereClause.studyPeriod = studyPeriod;
      }
      if (section && section !== 'ALL') {
        whereClause.section = normalizeSection(section);
      }
    }

    const students = await this.prisma.student.findMany({
      where: whereClause,
      select: { id: true, name: true },
    });

    if (students.length === 0) {
      return { success: true, count: 0, message: 'لم يتم العثور على طلاب مطابقين للتصفير' };
    }

    const studentIds = students.map(s => s.id);

    if (resetType === 'ALL_ATTENDANCE') {
      // 1. Delete all attendance records for these students
      await this.prisma.attendanceRecord.deleteMany({
        where: { studentId: { in: studentIds } },
      });

      // 2. Reset counts on student table
      await this.prisma.student.updateMany({
        where: { id: { in: studentIds } },
        data: {
          presentCount: 0,
          absentCount: 0,
          totalSessions: 0,
          rate: 100,
        },
      });

      this.logger.log(`Full reset (attendance + absences) completed for ${students.length} students`);

      if (actor) {
        await this.audit.log({
          actorUserId: actor.id,
          action: 'ATTENDANCE_RESET_ALL',
          entityType: 'Student',
          details: `scope=${studyPeriod || 'ALL'}/${section || 'ALL'}, count=${students.length}`,
        });
      }

      return {
        success: true,
        count: students.length,
        message: `تم تصفير سجل الحضور والغياب بالكامل لـ ${students.length} طالب بنجاح`,
      };
    } else {
      // ABSENCES_ONLY:
      // 1. Delete ABSENT records for these students
      await this.prisma.attendanceRecord.deleteMany({
        where: {
          studentId: { in: studentIds },
          status: 'ABSENT',
        },
      });

      // 2. Set absentCount = 0 and recalculate totalSessions
      for (const s of students) {
        const studentData = await this.prisma.student.findUnique({
          where: { id: s.id },
          include: { attendances: true },
        });

        if (studentData) {
          const presentCount = studentData.attendances.filter(a => a.status === 'PRESENT').length;
          await this.prisma.student.update({
            where: { id: s.id },
            data: {
              absentCount: 0,
              presentCount,
              totalSessions: presentCount,
              rate: 100,
            },
          });
        }
      }

      this.logger.log(`Absences reset completed for ${students.length} students`);

      if (actor) {
        await this.audit.log({
          actorUserId: actor.id,
          action: 'ATTENDANCE_RESET_ABSENCES',
          entityType: 'Student',
          details: `scope=${studyPeriod || 'ALL'}/${section || 'ALL'}, count=${students.length}`,
        });
      }

      return {
        success: true,
        count: students.length,
        message: `تم تصفير الغيابات لـ ${students.length} طالب بنجاح`,
      };
    }
  }
}

