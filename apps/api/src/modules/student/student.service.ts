import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { AuthorizationService } from '../auth/authorization.service';
import { normalizeSection } from '../../common/utils/section.util';
import {
  normalizeStage,
  normalizeStudentCode,
  requireAcademicStage,
  stageCodePrefix,
  type AcademicStage,
} from '../../common/constants/academics';
import { isAdministrativeRole } from '../../common/constants/roles';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { recomputeStudentStats } from '../../common/utils/student-stats.util';
import { Prisma } from '@prisma/client';
import * as crypto from 'crypto';
import { ImportStudentsDto, ImportStudentRowDto } from './dto/import-students.dto';
import { UpdateStudentCoursesDto } from './dto/update-student-courses.dto';

interface StudentContext {
  stage: AcademicStage;
  studyPeriod: string;
  section: string | null;
  sectionId: string | null;
}

export interface ImportRowResult {
  row: number;
  studentCode: string;
  name: string;
  stage: number;
  studyPeriod: string;
  section: string | null;
  sectionId: string | null;
  status: 'VALID' | 'ERROR';
  errors: string[];
}

@Injectable()
export class StudentService {
  private readonly logger = new Logger(StudentService.name);

  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
    private authorization: AuthorizationService,
  ) {}

  // ============================================================
  // Shared helpers
  // ============================================================

  private async assertStageAllowed(
    actor: AuthenticatedUser | undefined,
    stage: number,
  ): Promise<void> {
    if (!actor || isAdministrativeRole(actor.role)) return;
    const stages = await this.authorization.assignedStages(actor);
    if (!stages.includes(stage)) {
      throw new BadRequestException('هذه المرحلة غير مسندة إليك');
    }
  }

  /**
   * Resolves the academic context of a row: stage, study period and the
   * section relation. A section always wins over the free-text fields so the
   * legacy `Student.section` mirror cannot drift from `sectionId`.
   */
  private async resolveContext(
    input: {
      stage?: number;
      studyPeriod?: string;
      section?: string;
      sectionId?: string;
    },
    defaultStage: AcademicStage = 2,
    options: { strict?: boolean } = {},
  ): Promise<{ context: StudentContext; errors: string[] }> {
    const errors: string[] = [];
    let stage = normalizeStage(input.stage ?? defaultStage);
    let section: { id: string; name: string; stage: number; studyPeriod: string } | null = null;

    if (input.sectionId) {
      section = await this.prisma.section.findUnique({
        where: { id: input.sectionId },
        select: { id: true, name: true, stage: true, studyPeriod: true },
      });
      if (!section) {
        errors.push('الشعبة المحددة غير موجودة');
      }
    } else if (input.section && input.section.trim()) {
      const name = normalizeSection(input.section);
      const where: Prisma.SectionWhereInput = { stage, name };
      if (input.studyPeriod) where.studyPeriod = input.studyPeriod;
      const matches = await this.prisma.section.findMany({
        where,
        select: { id: true, name: true, stage: true, studyPeriod: true },
        take: 2,
      });
      if (matches.length === 1) {
        section = matches[0];
      } else if (matches.length > 1) {
        const periodMatch = matches.find((m) => m.studyPeriod === input.studyPeriod);
        if (periodMatch) {
          section = periodMatch;
        } else {
          errors.push('الشعبة موجودة في أكثر من دراسة؛ حدد نوع الدراسة');
        }
      } else {
        errors.push(`الشعبة (${input.section}) غير موجودة في هذه المرحلة`);
      }
    }

    const studyPeriod = section
      ? section.studyPeriod
      : input.studyPeriod === 'EVENING'
        ? 'EVENING'
        : 'MORNING';

    if (section) stage = normalizeStage(section.stage);

    const context: StudentContext = {
      stage,
      studyPeriod,
      section: section ? section.name : null,
      sectionId: section ? section.id : null,
    };

    if (options.strict && errors.length > 0) {
      throw new BadRequestException(errors.join(' — '));
    }

    return { context, errors };
  }

  /** Highest numeric suffix currently used by a stage. */
  private async codeState(stages: number[]): Promise<Map<number, number>> {
    const state = new Map<number, number>();
    for (const stage of Array.from(new Set(stages))) {
      const prefix = stageCodePrefix(stage);
      const rows = await this.prisma.student.findMany({
        where: { studentCode: { startsWith: prefix } },
        select: { studentCode: true },
      });
      let max = 1000;
      for (const row of rows) {
        const match = row.studentCode.match(new RegExp(`^${prefix}(\\d+)$`));
        if (match) max = Math.max(max, Number(match[1]));
      }
      state.set(stage, max + 1);
    }
    return state;
  }

  private takeNextCode(state: Map<number, number>, stage: number): string {
    const prefix = stageCodePrefix(stage);
    let next = state.get(stage) ?? 1001;
    if (next < 1001) next = 1001;
    let code = `${prefix}${next}`;
    // The map only tracks generated codes; a manual code may already occupy
    // the slot. The unique constraint is the final guard, but skipping ahead
    // here keeps confirm imports clean.
    state.set(stage, next + 1);
    return code;
  }

  private async assertCodeFree(code: string, exceptId?: string) {
    const existing = await this.prisma.student.findUnique({
      where: { studentCode: code },
      select: { id: true, name: true, deletedAt: true },
    });
    if (existing && existing.id !== exceptId) {
      throw new ConflictException(
        `الباركود (${code}) مسجل مسبقاً باسم (${existing.name})`,
      );
    }
  }

  // ============================================================
  // Read APIs
  // ============================================================

  /**
   * Full student list with attendance statistics. Soft-deleted students are
   * never returned, and QR credentials are never included.
   */
  async getAllWithStats(
    actor: AuthenticatedUser | undefined,
    filters: { studyPeriod?: string; section?: string; stage?: string; sectionId?: string } = {},
  ) {
    const whereClause: any = { deletedAt: null };

    if (filters.studyPeriod) whereClause.studyPeriod = filters.studyPeriod;
    if (filters.sectionId) whereClause.sectionId = filters.sectionId;
    if (filters.section && filters.section !== 'ALL') {
      whereClause.section = normalizeSection(filters.section);
    }

    if (filters.stage) {
      const stage = requireAcademicStage(filters.stage);
      await this.assertStageAllowed(actor, stage);
      whereClause.stage = stage;
    } else if (actor && !isAdministrativeRole(actor.role)) {
      const stages = await this.authorization.assignedStages(actor);
      whereClause.stage = { in: stages };
    }

    const students = await this.prisma.student.findMany({
      where: whereClause,
      include: {
        sectionRef: { select: { id: true, name: true, label: true, stage: true } },
        attendances: {
          // Unified statistics: only closed, non-archived lectures count.
          where: { lecture: { status: 'CLOSED', deletedAt: null } },
          include: {
            lecture: {
              select: {
                id: true,
                name: true,
                status: true,
                startedAt: true,
                courseId: true,
                // The stage of the lecture's course lets the students page show
                // per-stage counters for a carry-over student.
                course: { select: { stage: true } },
              },
            },
          },
          orderBy: { registeredAt: 'desc' },
        },
      },
      orderBy: [{ orderIndex: 'asc' }, { studentCode: 'asc' }],
    });

    const customSettings = await this.prisma.systemSetting.findMany({
      where: { key: { startsWith: 'STUDENT_COURSES_' } },
    });
    const enrollmentMap = new Map<
      string,
      { academicStatus: string; courseIds: string[]; notes?: string }
    >();
    for (const s of customSettings) {
      try {
        const studentId = s.key.replace('STUDENT_COURSES_', '');
        const parsed = JSON.parse(s.value);
        if (parsed && Array.isArray(parsed.courseIds)) {
          enrollmentMap.set(studentId, parsed);
        }
      } catch {}
    }

    // Stages of the courses a student is explicitly required to take, so the
    // stage filter can show a carry-over student with the lower stage too.
    const requiredCourseIds = new Set<string>();
    for (const enrollment of enrollmentMap.values()) {
      for (const courseId of enrollment.courseIds) requiredCourseIds.add(courseId);
    }
    const requiredCourses =
      requiredCourseIds.size > 0
        ? await this.prisma.course.findMany({
            where: { id: { in: [...requiredCourseIds] } },
            select: { id: true, stage: true },
          })
        : [];
    const courseStageById = new Map(requiredCourses.map((course) => [course.id, course.stage]));

    return students.map((student, idx) => {
      // Attendance records are the only source of truth: active lectures are
      // excluded above, and stale stored counters are never used as a fallback.
      const totalPresent = student.attendances.filter((a) => a.status === 'PRESENT').length;
      const totalAbsent = student.attendances.filter((a) => a.status === 'ABSENT').length;
      const totalSessions = totalPresent + totalAbsent;
      const custom = enrollmentMap.get(student.id);
      const customCourseStages = Array.from(
        new Set(
          (custom?.courseIds || [])
            .map((courseId) => courseStageById.get(courseId))
            .filter((stage): stage is number => typeof stage === 'number'),
        ),
      );

      return {
        id: student.id,
        orderIndex: student.orderIndex != null ? student.orderIndex : idx + 1,
        studentCode: student.studentCode,
        name: student.name,
        stage: student.stage,
        studyPeriod: student.studyPeriod || 'MORNING',
        section: student.section || '',
        sectionId: student.sectionId,
        sectionLabel: student.sectionRef?.label || null,
        presentCount: totalPresent,
        absentCount: totalAbsent,
        totalLectures: totalSessions,
        academicStatus: custom?.academicStatus || 'REGULAR',
        customCourseCount: custom?.courseIds?.length ?? null,
        customCourseStages,
        isCustomEnrollment: Boolean(custom && custom.academicStatus !== 'REGULAR'),
        enrollmentNotes: custom?.notes || null,
        createdAt: student.createdAt,
        history: student.attendances.map((a) => ({
          attendanceId: a.id,
          lectureId: a.lecture.id,
          lectureName: a.lecture.name,
          courseId: a.lecture.courseId,
          courseStage: a.lecture.course?.stage ?? null,
          lectureDate: a.lecture.startedAt,
          status: a.status,
          registeredAt: a.registeredAt,
        })),
      };
    });
  }

  async findByCode(code: string, actor?: AuthenticatedUser) {
    const trimmed = code.trim();
    if (!trimmed) return null;

    let student = await this.prisma.student.findFirst({
      where: { studentCode: trimmed, deletedAt: null },
    });

    if (!student) {
      const nameMatches = await this.prisma.student.findMany({
        where: { name: trimmed, deletedAt: null },
        take: 2,
      });
      if (nameMatches.length > 1) {
        throw new BadRequestException(
          'يوجد أكثر من طالب بهذا الاسم. استخدم رقم الطالب (الباركود) للبحث.',
        );
      }
      student = nameMatches[0] || null;
    }

    if (!student) return null;
    if (actor && !isAdministrativeRole(actor.role)) {
      const stages = await this.authorization.assignedStages(actor);
      if (!stages.includes(student.stage)) return null;
    }
    return student;
  }

  /**
   * Minimal student list for lecturers. Scoped to the stages they teach and,
   * optionally, a specific course/section/lecture.
   */
  async getOptions(
    actor: AuthenticatedUser | undefined,
    filters: {
      studyPeriod?: string;
      section?: string;
      sectionId?: string;
      stage?: string;
      courseId?: string;
    } = {},
  ) {
    const where: any = { deletedAt: null };
    if (filters.studyPeriod) where.studyPeriod = filters.studyPeriod;
    if (filters.sectionId) where.sectionId = filters.sectionId;
    if (filters.section && filters.section !== 'ALL') {
      where.section = normalizeSection(filters.section);
    }

    if (filters.courseId) {
      if (actor) await this.authorization.assertCanAccessCourse(actor, filters.courseId);
      const course = await this.prisma.course.findUnique({
        where: { id: filters.courseId },
        select: { id: true, stage: true },
      });
      if (!course) throw new NotFoundException('المادة غير موجودة');

      const customSettings = await this.prisma.systemSetting.findMany({
        where: { key: { startsWith: 'STUDENT_COURSES_' } },
      });
      const carryOverStudentIds: string[] = [];
      const excludedRepeatingStudentIds = new Set<string>();

      for (const s of customSettings) {
        try {
          const studentId = s.key.replace('STUDENT_COURSES_', '');
          const parsed = JSON.parse(s.value);
          if (parsed && Array.isArray(parsed.courseIds)) {
            if (parsed.academicStatus !== 'REGULAR') {
              if (parsed.courseIds.includes(filters.courseId)) {
                carryOverStudentIds.push(studentId);
              } else {
                excludedRepeatingStudentIds.add(studentId);
              }
            }
          }
        } catch {}
      }

      const baseWhere: any = {
        deletedAt: null,
        stage: course.stage,
        ...(excludedRepeatingStudentIds.size > 0
          ? { id: { notIn: Array.from(excludedRepeatingStudentIds) } }
          : {}),
      };
      if (filters.studyPeriod) baseWhere.studyPeriod = filters.studyPeriod;
      if (filters.sectionId) baseWhere.sectionId = filters.sectionId;
      if (filters.section && filters.section !== 'ALL') {
        baseWhere.section = normalizeSection(filters.section);
      }

      let queryWhere: any = baseWhere;
      if (carryOverStudentIds.length > 0) {
        const carryOverWhere: any = {
          deletedAt: null,
          id: { in: carryOverStudentIds },
          stage: { not: course.stage },
        };
        if (filters.studyPeriod) carryOverWhere.studyPeriod = filters.studyPeriod;
        if (filters.sectionId) carryOverWhere.sectionId = filters.sectionId;
        if (filters.section && filters.section !== 'ALL') {
          carryOverWhere.section = normalizeSection(filters.section);
        }
        queryWhere = { OR: [baseWhere, carryOverWhere] };
      }

      return this.prisma.student.findMany({
        where: queryWhere,
        select: {
          id: true,
          name: true,
          studentCode: true,
          stage: true,
          studyPeriod: true,
          section: true,
          sectionId: true,
          orderIndex: true,
        },
        orderBy: [{ orderIndex: 'asc' }, { studentCode: 'asc' }],
      });
    } else if (filters.stage) {
      const stage = requireAcademicStage(filters.stage);
      await this.assertStageAllowed(actor, stage);
      where.stage = stage;
    } else if (actor && !isAdministrativeRole(actor.role)) {
      const stages = await this.authorization.assignedStages(actor);
      where.stage = { in: stages };
    }

    return this.prisma.student.findMany({
      where,
      select: {
        id: true,
        name: true,
        studentCode: true,
        stage: true,
        studyPeriod: true,
        section: true,
        sectionId: true,
        orderIndex: true,
      },
      orderBy: [{ orderIndex: 'asc' }, { studentCode: 'asc' }],
    });
  }

  // ============================================================
  // Opaque, revocable student QR credentials
  // ============================================================

  private generateQrToken(): string {
    return `qr_${crypto.randomBytes(24).toString('base64url')}`;
  }

  private async acquireStudentQrLock(
    tx: Prisma.TransactionClient,
    studentId: string,
  ): Promise<void> {
    await tx.$executeRawUnsafe(
      'SELECT pg_advisory_xact_lock(hashtext($1))',
      studentId,
    );
  }

  async ensureQrToken(studentId: string, actorId?: string) {
    return this.prisma.$transaction(async (tx) => {
      await this.acquireStudentQrLock(tx, studentId);

      const existing = await tx.studentQrToken.findFirst({
        where: { studentId, revokedAt: null },
        orderBy: { createdAt: 'desc' },
      });
      if (existing) return existing;

      return this.issueQrToken(studentId, actorId, tx);
    });
  }

  private async issueQrToken(
    studentId: string,
    actorId: string | undefined,
    tx: Prisma.TransactionClient,
  ) {
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        return await tx.studentQrToken.create({
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

  async rotateQrToken(studentId: string, actor: AuthenticatedUser) {
    let studentCode = '';

    const token = await this.prisma.$transaction(async (tx) => {
      await this.acquireStudentQrLock(tx, studentId);

      const student = await tx.student.findUnique({ where: { id: studentId } });
      if (!student || student.deletedAt) {
        throw new NotFoundException('الطالب غير موجود');
      }
      studentCode = student.studentCode;

      await tx.studentQrToken.updateMany({
        where: { studentId, revokedAt: null },
        data: { revokedAt: new Date() },
      });

      return this.issueQrToken(studentId, actor.id, tx);
    });

    await this.audit.log({
      actorUserId: actor.id,
      action: 'STUDENT_QR_ROTATE',
      entityType: 'Student',
      entityId: studentId,
      details: studentCode,
    });

    return token;
  }

  async backfillQrTokens(): Promise<number> {
    const students = await this.prisma.student.findMany({
      where: { deletedAt: null, qrTokens: { none: { revokedAt: null } } },
      select: { id: true },
    });
    for (const student of students) {
      await this.ensureQrToken(student.id);
    }
    return students.length;
  }

  // ============================================================
  // Write APIs
  // ============================================================

  async create(
    data: {
      studentCode?: string;
      name: string;
      stage?: number;
      studyPeriod?: string;
      section?: string;
      sectionId?: string;
      orderIndex?: number;
      presentCount?: number;
      absentCount?: number;
      totalSessions?: number;
      rate?: number;
    },
    actor?: AuthenticatedUser,
  ) {
    const cleanName = String(data.name || '').trim();
    if (!cleanName) {
      throw new BadRequestException('اسم الطالب مطلوب');
    }

    const { context } = await this.resolveContext(data, normalizeStage(data.stage), {
      strict: true,
    });
    await this.assertStageAllowed(actor, context.stage);

    const rawCode = String(data.studentCode || '').trim();
    let cleanCode = rawCode ? normalizeStudentCode(rawCode, context.stage) : '';
    if (!cleanCode) {
      const state = await this.codeState([context.stage]);
      cleanCode = this.takeNextCode(state, context.stage);
    }

    await this.assertCodeFree(cleanCode);

    const presentCount = Number(data.presentCount || 0);
    const absentCount = Number(data.absentCount || 0);
    const totalSessions =
      data.totalSessions != null && !isNaN(Number(data.totalSessions))
        ? Number(data.totalSessions)
        : presentCount + absentCount;

    let student;
    try {
      student = await this.prisma.student.create({
        data: {
          orderIndex: data.orderIndex != null ? Number(data.orderIndex) : null,
          studentCode: cleanCode,
          name: cleanName,
          stage: context.stage,
          studyPeriod: context.studyPeriod,
          section: context.section,
          sectionId: context.sectionId,
          presentCount,
          absentCount,
          totalSessions,
        },
      });
    } catch (error: any) {
      if (error?.code === 'P2002') {
        throw new ConflictException(`الباركود (${cleanCode}) مسجل مسبقاً`);
      }
      throw error;
    }

    this.logger.log(
      `Created student: [${student.studentCode}] ${student.name} (stage ${student.stage} - ${student.studyPeriod} - ${student.section || '-'})`,
    );

    await this.ensureQrToken(student.id, actor?.id);
    if (actor) {
      await this.audit.log({
        actorUserId: actor.id,
        action: 'STUDENT_CREATE',
        entityType: 'Student',
        entityId: student.id,
        details: `${student.studentCode} - ${student.name} (stage ${student.stage}, ${student.section || 'no section'})`,
      });
    }

    return student;
  }

  async update(
    id: string,
    data: {
      studentCode?: string;
      name?: string;
      stage?: number;
      studyPeriod?: string;
      section?: string;
      sectionId?: string | null;
      orderIndex?: number;
    },
    actor?: AuthenticatedUser,
  ) {
    const student = await this.prisma.student.findUnique({ where: { id } });
    if (!student || student.deletedAt) {
      throw new NotFoundException('الطالب غير موجود');
    }

    let nextStage = normalizeStage(student.stage);
    let nextPeriod = student.studyPeriod || 'MORNING';
    let nextSection: string | null = student.section;
    let nextSectionId: string | null = student.sectionId;

    if (data.sectionId !== undefined) {
      if (data.sectionId === null) {
        nextSectionId = null;
        nextSection = null;
      } else {
        const section = await this.prisma.section.findUnique({
          where: { id: data.sectionId },
          select: { id: true, name: true, stage: true, studyPeriod: true },
        });
        if (!section) throw new BadRequestException('الشعبة المحددة غير موجودة');
        nextSectionId = section.id;
        nextSection = section.name;
        nextStage = normalizeStage(section.stage);
        nextPeriod = section.studyPeriod;
      }
    } else if (data.section !== undefined) {
      if (!data.section.trim()) {
        nextSection = null;
        nextSectionId = null;
      } else {
        const section = await this.prisma.section.findFirst({
          where: {
            stage: nextStage,
            studyPeriod: nextPeriod,
            name: normalizeSection(data.section),
          },
          select: { id: true, name: true },
        });
        if (!section) throw new BadRequestException('الشعبة غير موجودة في هذه المرحلة');
        nextSection = section.name;
        nextSectionId = section.id;
      }
    } else {
      // Stage/period changes without a section move must not desync the section.
      if (data.stage !== undefined) {
        const requested = normalizeStage(data.stage);
        if (nextSectionId) {
          const current = await this.prisma.section.findUnique({
            where: { id: nextSectionId },
            select: { stage: true },
          });
          if (current && current.stage !== requested) {
            throw new BadRequestException(
              'انقل الطالب إلى شعبة في المرحلة الجديدة بدلاً من تغيير المرحلة فقط',
            );
          }
        }
        nextStage = requested;
      }
      if (data.studyPeriod !== undefined) {
        if (nextSectionId) {
          const current = await this.prisma.section.findUnique({
            where: { id: nextSectionId },
            select: { studyPeriod: true },
          });
          if (current && current.studyPeriod !== data.studyPeriod) {
            throw new BadRequestException(
              'انقل الطالب إلى شعبة في الدراسة الجديدة بدلاً من تغيير الدراسة فقط',
            );
          }
        }
        nextPeriod = data.studyPeriod || 'MORNING';
      }
    }

    await this.assertStageAllowed(actor, nextStage);

    // Unchecked input exposes the scalar sectionId directly. The relation is
    // still updated through its foreign key, which is what we want here.
    const updateData: Prisma.StudentUncheckedUpdateInput = {};
    if (data.name !== undefined) {
      const name = data.name.trim();
      if (!name) throw new BadRequestException('اسم الطالب مطلوب');
      updateData.name = name;
    }
    if (data.orderIndex !== undefined) updateData.orderIndex = data.orderIndex;
    updateData.stage = nextStage;
    updateData.studyPeriod = nextPeriod;
    updateData.section = nextSection;
    updateData.sectionId = nextSectionId;

    let codeChanged = false;
    let nextCode = student.studentCode;
    if (data.studentCode !== undefined) {
      const raw = data.studentCode.trim();
      if (!raw) throw new BadRequestException('رقم الطالب مطلوب');
      nextCode = normalizeStudentCode(raw, nextStage);
      if (nextCode !== student.studentCode) {
        await this.assertCodeFree(nextCode, id);
        updateData.studentCode = nextCode;
        codeChanged = true;
      }
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.student.update({ where: { id }, data: updateData });
      if (codeChanged) {
        // The attendance table keeps a denormalised code for historical rows.
        await tx.attendanceRecord.updateMany({
          where: { studentId: id },
          data: { studentCode: nextCode },
        });
      }
      return result;
    });

    if (actor) {
      await this.audit.log({
        actorUserId: actor.id,
        action: 'STUDENT_UPDATE',
        entityType: 'Student',
        entityId: id,
        details:
          `${student.studentCode} -> ${updated.studentCode}; ` +
          `stage ${student.stage}->${updated.stage}; ` +
          `section ${student.section || '-'}->${updated.section || '-'}`,
      });
    }

    return updated;
  }

  /**
   * Safe delete: students with attendance history are soft-deleted so the
   * records stay intact; only students without any history are removed.
   */
  async delete(id: string, actor?: AuthenticatedUser) {
    const student = await this.prisma.student.findUnique({ where: { id } });
    if (!student) {
      throw new NotFoundException('الطالب غير موجود');
    }

    if (student.deletedAt) {
      return { success: true, mode: 'SOFT', alreadyDeleted: true };
    }

    const attendanceCount = await this.prisma.attendanceRecord.count({
      where: { studentId: id },
    });

    if (attendanceCount > 0) {
      await this.prisma.student.update({
        where: { id },
        data: { deletedAt: new Date() },
      });

      if (actor) {
        await this.audit.log({
          actorUserId: actor.id,
          action: 'STUDENT_SOFT_DELETE',
          entityType: 'Student',
          entityId: id,
          details: `${student.studentCode} - ${student.name} (attendance records preserved: ${attendanceCount})`,
        });
      }

      return { success: true, mode: 'SOFT', attendanceRecords: attendanceCount };
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

    return { success: true, mode: 'HARD' };
  }

  // ============================================================
  // Excel import: preview, then confirm (duplicates are rejected)
  // ============================================================

  private async validateImportRows(dto: ImportStudentsDto) {
    const stagesInRows = new Set<number>();
    const defaultStage = normalizeStage(dto.stage);
    stagesInRows.add(defaultStage);
    for (const row of dto.students) {
      stagesInRows.add(normalizeStage(row.stage ?? defaultStage));
    }

    const state = await this.codeState(Array.from(stagesInRows));
    const seenCodes = new Set<string>();
    const results: ImportRowResult[] = [];

    for (let index = 0; index < dto.students.length; index++) {
      const row = dto.students[index];
      const name = String(row.name || '').trim();
      const errors: string[] = [];

      if (!name) errors.push('اسم الطالب مطلوب');

      // A row-level section always wins over the request-level default. This
      // matters when a spreadsheet has a different section per row; otherwise
      // the default sectionId would silently override it.
      let effectiveSectionId = row.sectionId;
      let effectiveSection = row.section;
      if (!effectiveSectionId && !effectiveSection) {
        effectiveSectionId = dto.sectionId;
        effectiveSection = dto.section;
      }

      const { context, errors: contextErrors } = await this.resolveContext(
        {
          stage: row.stage ?? dto.stage,
          studyPeriod: row.studyPeriod ?? dto.studyPeriod,
          section: effectiveSection,
          sectionId: effectiveSectionId,
        },
        defaultStage,
      );
      errors.push(...contextErrors);

      let code = String(row.studentCode || '').trim()
        ? normalizeStudentCode(String(row.studentCode).trim(), context.stage)
        : '';

      if (!code) {
        code = this.takeNextCode(state, context.stage);
      } else {
        const existing = await this.prisma.student.findUnique({
          where: { studentCode: code },
          select: { name: true },
        });
        if (existing) {
          errors.push(`رقم الطالب (${code}) موجود مسبقاً باسم (${existing.name})`);
        }
        // Keep generated sequence ahead of a manually supplied numeric code.
        const match = code.match(new RegExp(`^${stageCodePrefix(context.stage)}(\\d+)$`));
        if (match) {
          const next = state.get(context.stage) ?? 1001;
          state.set(context.stage, Math.max(next, Number(match[1]) + 1));
        }
      }

      const codeKey = code.toLowerCase();
      if (seenCodes.has(codeKey)) {
        errors.push(`رقم الطالب (${code}) مكرر داخل الملف`);
      } else {
        seenCodes.add(codeKey);
      }

      results.push({
        row: index + 1,
        studentCode: code,
        name,
        stage: context.stage,
        studyPeriod: context.studyPeriod,
        section: context.section,
        sectionId: context.sectionId,
        status: errors.length === 0 ? 'VALID' : 'ERROR',
        errors,
      });
    }

    return results;
  }

  async previewImport(dto: ImportStudentsDto) {
    const rows = await this.validateImportRows(dto);
    const valid = rows.filter((row) => row.status === 'VALID').length;
    return {
      success: true,
      summary: {
        total: rows.length,
        valid,
        invalid: rows.length - valid,
      },
      rows,
    };
  }

  async importStudents(dto: ImportStudentsDto, actor?: AuthenticatedUser) {
    const rows = await this.validateImportRows(dto);
    let created = 0;
    let rejected = 0;
    const errors: string[] = [];
    let orderCursor = 0;

    for (const row of rows) {
      if (row.status !== 'VALID') {
        rejected++;
        errors.push(`صف ${row.row} (${row.studentCode || row.name}): ${row.errors.join(' — ')}`);
        continue;
      }

      try {
        orderCursor++;
        const student = await this.prisma.student.create({
          data: {
            orderIndex: orderCursor,
            studentCode: row.studentCode,
            name: row.name,
            stage: row.stage,
            studyPeriod: row.studyPeriod,
            section: row.section,
            sectionId: row.sectionId,
            presentCount: 0,
            absentCount: 0,
            totalSessions: 0,
          },
        });
        await this.ensureQrToken(student.id, actor?.id);
        created++;
      } catch (error: any) {
        rejected++;
        const message =
          error?.code === 'P2002'
            ? 'رقم الطالب مكرر في قاعدة البيانات'
            : error?.message || 'خطأ غير معروف';
        errors.push(`صف ${row.row} (${row.studentCode}): ${message}`);
      }
    }

    if (actor) {
      await this.audit.log({
        actorUserId: actor.id,
        action: 'STUDENTS_IMPORT',
        entityType: 'Student',
        details: `created=${created}, rejected=${rejected}, total=${rows.length}`,
      });
    }

    return {
      success: true,
      created,
      rejected,
      skipped: rejected,
      updated: 0,
      count: created,
      errors,
    };
  }

  /** Backwards-compatible bulk endpoint (strict: never updates existing rows). */
  async createBatch(students: ImportStudentRowDto[], actor?: AuthenticatedUser) {
    return this.importStudents({ students }, actor);
  }

  // ============================================================
  // Absences reset (unchanged semantics, soft-deleted students excluded)
  // ============================================================

  /**
   * Resets attendance/absence data for an explicit academic scope.
   *
   * The scope must never be implicit: either one student, or a stage plus an
   * optional study period/section. A request without a stage is rejected so a
   * reset can never wipe every stage by accident.
   */
  async resetAbsences(
    params: {
      stage?: number | string;
      studyPeriod?: string;
      section?: string;
      sectionId?: string;
      studentId?: string;
      resetType?: 'ABSENCES_ONLY' | 'ALL_ATTENDANCE';
    },
    actor?: AuthenticatedUser,
  ) {
    const {
      stage,
      studyPeriod,
      section,
      sectionId,
      studentId,
      resetType = 'ABSENCES_ONLY',
    } = params;

    const whereClause: any = { deletedAt: null };
    let scopeLabel = '';

    if (studentId) {
      const student = await this.prisma.student.findUnique({
        where: { id: studentId },
        select: { id: true, stage: true, studentCode: true },
      });
      if (!student || !student.stage) {
        throw new NotFoundException('الطالب غير موجود');
      }
      await this.assertStageAllowed(actor, normalizeStage(student.stage));
      whereClause.id = student.id;
      scopeLabel = `student=${student.studentCode}, stage=${student.stage}`;
    } else {
      if (stage === undefined || stage === null || String(stage).trim() === '') {
        throw new BadRequestException(
          'حدد المرحلة قبل تصفير الغيابات. لا يمكن التصفير عبر جميع المراحل.',
        );
      }
      const requestedStage = requireAcademicStage(stage);
      await this.assertStageAllowed(actor, requestedStage);
      whereClause.stage = requestedStage;

      if (studyPeriod) {
        if (studyPeriod !== 'MORNING' && studyPeriod !== 'EVENING') {
          throw new BadRequestException('نوع الدراسة غير صالح');
        }
        whereClause.studyPeriod = studyPeriod;
      }

      if (sectionId) {
        const target = await this.prisma.section.findUnique({
          where: { id: sectionId },
          select: { id: true, name: true, stage: true, studyPeriod: true },
        });
        if (!target) {
          throw new BadRequestException('الشعبة المحددة غير موجودة');
        }
        if (target.stage !== requestedStage) {
          throw new BadRequestException('الشعبة المحددة لا تنتمي إلى المرحلة المختارة');
        }
        if (studyPeriod && target.studyPeriod !== studyPeriod) {
          throw new BadRequestException('الشعبة المحددة لا تنتمي إلى الدراسة المختارة');
        }
        whereClause.studyPeriod = target.studyPeriod;
        whereClause.OR = [
          { sectionId: target.id },
          { sectionId: null, section: target.name },
        ];
        scopeLabel = `stage=${requestedStage}, period=${target.studyPeriod}, section=${target.name}`;
      } else if (section && section !== 'ALL') {
        const name = normalizeSection(section);
        if (!name) {
          throw new BadRequestException('الشعبة غير صالحة');
        }
        const matches = await this.prisma.section.findMany({
          where: {
            stage: requestedStage,
            name,
            ...(studyPeriod ? { studyPeriod } : {}),
          },
          select: { id: true, name: true, studyPeriod: true },
          take: 2,
        });
        if (matches.length === 0) {
          throw new BadRequestException('الشعبة غير موجودة في المرحلة المختارة');
        }
        if (matches.length > 1) {
          throw new BadRequestException('الشعبة موجودة في أكثر من دراسة؛ حدد نوع الدراسة');
        }
        whereClause.studyPeriod = matches[0].studyPeriod;
        whereClause.OR = [
          { sectionId: matches[0].id },
          { sectionId: null, section: matches[0].name },
        ];
        scopeLabel = `stage=${requestedStage}, period=${matches[0].studyPeriod}, section=${matches[0].name}`;
      } else {
        scopeLabel =
          `stage=${requestedStage}, period=${studyPeriod || 'ALL'}, section=ALL`;
      }
    }

    const students = await this.prisma.student.findMany({
      where: whereClause,
      select: { id: true, name: true },
    });

    if (students.length === 0) {
      return {
        success: true,
        count: 0,
        message: 'لم يتم العثور على طلاب مطابقين للتصفير',
      };
    }

    const studentIds = students.map((s) => s.id);

    await this.prisma.$transaction(async (tx) => {
      // ISS-02 Fix: Only delete attendance records belonging to CLOSED, non-deleted lectures
      // Active (OPEN) lectures must never have their attendance records wiped during a reset.
      const closedLectureCondition = {
        status: 'CLOSED' as const,
        deletedAt: null,
      };

      if (resetType === 'ALL_ATTENDANCE') {
        await tx.attendanceRecord.deleteMany({
          where: {
            studentId: { in: studentIds },
            lecture: closedLectureCondition,
          },
        });
      } else {
        await tx.attendanceRecord.deleteMany({
          where: {
            studentId: { in: studentIds },
            status: 'ABSENT',
            lecture: closedLectureCondition,
          },
        });
      }
      await recomputeStudentStats(tx, studentIds);
    });

    const action =
      resetType === 'ALL_ATTENDANCE'
        ? 'ATTENDANCE_RESET_ALL'
        : 'ATTENDANCE_RESET_ABSENCES';

    if (actor) {
      await this.audit.log({
        actorUserId: actor.id,
        action,
        entityType: 'Student',
        details: `scope=${scopeLabel}, type=${resetType}, count=${students.length}`,
      });
    }

    this.logger.log(
      `${resetType} completed for ${students.length} students (${scopeLabel})`,
    );

    return {
      success: true,
      count: students.length,
      message:
        resetType === 'ALL_ATTENDANCE'
          ? `تم تصفير سجل الحضور والغياب بالكامل لـ ${students.length} طالب بنجاح`
          : `تم تصفير الغيابات لـ ${students.length} طالب بنجاح`,
    };
  }

  // ============================================================
  // Academic Course Enrollment (Repeating & Carry-over Students)
  // ============================================================

  async getStudentEnrollment(studentId: string, actor: AuthenticatedUser) {
    const student = await this.prisma.student.findUnique({
      where: { id: studentId, deletedAt: null },
      select: {
        id: true,
        name: true,
        studentCode: true,
        stage: true,
        studyPeriod: true,
        section: true,
        sectionId: true,
        sectionRef: { select: { name: true, label: true } },
      },
    });
    if (!student) {
      throw new NotFoundException('الطالب غير موجود');
    }
    if (actor && !isAdministrativeRole(actor.role)) {
      await this.assertStageAllowed(actor, student.stage);
    }

    const allCourses = await this.prisma.course.findMany({
      orderBy: [{ stage: 'asc' }, { code: 'asc' }],
      select: { id: true, code: true, name: true, stage: true, description: true },
    });

    const setting = await this.prisma.systemSetting.findUnique({
      where: { key: `STUDENT_COURSES_${studentId}` },
    });

    if (setting?.value) {
      try {
        const parsed = JSON.parse(setting.value);
        if (parsed && Array.isArray(parsed.courseIds)) {
          const enrolledCourses = allCourses.filter((c) => parsed.courseIds.includes(c.id));
          return {
            studentId: student.id,
            studentName: student.name,
            studentCode: student.studentCode,
            stage: student.stage,
            studyPeriod: student.studyPeriod,
            section: student.section,
            sectionLabel: student.sectionRef?.label || student.sectionRef?.name || null,
            isCustom: true,
            academicStatus: parsed.academicStatus || 'REPEAT',
            courseIds: parsed.courseIds,
            courses: enrolledCourses,
            notes: parsed.notes || null,
            updatedAt: parsed.updatedAt || null,
            allCourses,
          };
        }
      } catch {}
    }

    const defaultCourses = allCourses.filter((c) => c.stage === student.stage);
    return {
      studentId: student.id,
      studentName: student.name,
      studentCode: student.studentCode,
      stage: student.stage,
      studyPeriod: student.studyPeriod,
      section: student.section,
      sectionLabel: student.sectionRef?.label || student.sectionRef?.name || null,
      isCustom: false,
      academicStatus: 'REGULAR',
      courseIds: defaultCourses.map((c) => c.id),
      courses: defaultCourses,
      notes: null,
      updatedAt: null,
      allCourses,
    };
  }

  async updateStudentEnrollment(
    studentId: string,
    dto: UpdateStudentCoursesDto,
    actor: AuthenticatedUser,
  ) {
    const student = await this.prisma.student.findUnique({
      where: { id: studentId, deletedAt: null },
      select: { id: true, name: true, stage: true },
    });
    if (!student) {
      throw new NotFoundException('الطالب غير موجود');
    }
    if (actor && !isAdministrativeRole(actor.role)) {
      throw new ForbiddenException('فقط المسؤول ومسجل الكلية يمكنهما تعديل مواد الطالب');
    }

    const key = `STUDENT_COURSES_${studentId}`;

    if (dto.academicStatus === 'REGULAR') {
      await this.prisma.systemSetting.deleteMany({ where: { key } });
    } else {
      const validCourses = await this.prisma.course.findMany({
        where: { id: { in: dto.courseIds } },
        select: { id: true },
      });
      const validIds = validCourses.map((c) => c.id);

      const payload = {
        studentId,
        academicStatus: dto.academicStatus,
        courseIds: validIds,
        notes: dto.notes ? dto.notes.trim() : '',
        updatedAt: new Date().toISOString(),
      };

      await this.prisma.systemSetting.upsert({
        where: { key },
        create: { key, value: JSON.stringify(payload) },
        update: { value: JSON.stringify(payload) },
      });
    }

    await this.prisma.auditLog.create({
      data: {
        actorUserId: actor.id,
        action: 'UPDATE_STUDENT_COURSES',
        entityType: 'Student',
        entityId: student.id,
        details: JSON.stringify({
          academicStatus: dto.academicStatus,
          courseCount: dto.courseIds.length,
          notes: dto.notes || null,
        }),
      },
    });

    return this.getStudentEnrollment(studentId, actor);
  }
}
