import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { AuthorizationService } from '../auth/authorization.service';
import { normalizeStage } from '../../common/constants/academics';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { CreateCourseDto } from './dto/create-course.dto';
import { UpdateCourseDto } from './dto/update-course.dto';

@Injectable()
export class CourseService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
    private authorization: AuthorizationService,
  ) {}

  /** Lecturers only receive the courses assigned to them. */
  async list(user: AuthenticatedUser, stage?: string) {
    const where: Record<string, unknown> = {
      ...this.authorization.courseScope(user),
    };
    if (stage) where.stage = normalizeStage(stage);

    return this.prisma.course.findMany({
      where,
      include: {
        _count: {
          select: { lectures: { where: { deletedAt: null } }, assignments: true },
        },
      },
      orderBy: [{ stage: 'asc' }, { code: 'asc' }],
    });
  }

  async create(dto: CreateCourseDto, actor: AuthenticatedUser) {
    const code = dto.code.trim();
    const name = dto.name.trim();
    const stage = normalizeStage(dto.stage);

    if (!code || !name) {
      throw new ConflictException('رمز المادة واسمها مطلوبان');
    }

    const existing = await this.prisma.course.findUnique({
      where: { stage_code: { stage, code } },
    });
    if (existing) {
      throw new ConflictException(
        `المادة (${code}) موجودة مسبقاً في المرحلة ${stage}`,
      );
    }

    const course = await this.prisma.course.create({
      data: {
        code,
        name,
        stage,
        description: dto.description?.trim() || null,
        type: dto.type?.trim() || 'THEORETICAL',
      },
    });

    await this.audit.log({
      actorUserId: actor.id,
      action: 'COURSE_CREATE',
      entityType: 'Course',
      entityId: course.id,
      details: `${course.code} - ${course.name} (stage ${course.stage})`,
    });

    return course;
  }

  async update(id: string, dto: UpdateCourseDto, actor: AuthenticatedUser) {
    const course = await this.prisma.course.findUnique({ where: { id } });
    if (!course) throw new NotFoundException('المادة غير موجودة');

    const data: Record<string, unknown> = {};
    if (dto.code !== undefined) {
      const code = dto.code.trim();
      if (!code) throw new ConflictException('رمز المادة مطلوب');
      data.code = code;
    }
    if (dto.name !== undefined) {
      const name = dto.name.trim();
      if (!name) throw new ConflictException('اسم المادة مطلوب');
      data.name = name;
    }
    if (dto.stage !== undefined) data.stage = normalizeStage(dto.stage);
    if (dto.description !== undefined) {
      data.description = dto.description?.trim() || null;
    }
    if (dto.type !== undefined) {
      data.type = dto.type?.trim() || 'THEORETICAL';
    }

    const nextCode = (data.code as string | undefined) ?? course.code;
    const nextStage = (data.stage as number | undefined) ?? course.stage;
    if (nextCode !== course.code || nextStage !== course.stage) {
      const existing = await this.prisma.course.findUnique({
        where: { stage_code: { stage: nextStage, code: nextCode } },
      });
      if (existing && existing.id !== id) {
        throw new ConflictException(
          `المادة (${nextCode}) موجودة مسبقاً في المرحلة ${nextStage}`,
        );
      }
    }

    const updated = await this.prisma.course.update({ where: { id }, data });

    await this.audit.log({
      actorUserId: actor.id,
      action: 'COURSE_UPDATE',
      entityType: 'Course',
      entityId: id,
      details: `${updated.code} - ${updated.name} (stage ${updated.stage})`,
    });

    return updated;
  }

  async delete(id: string, actor: AuthenticatedUser) {
    const deps = await this.dependencies(id);

    if (!deps.canDelete) {
      throw new ConflictException({
        message: 'لا يمكن حذف المادة قبل إزالة الارتباطات التالية',
        blockers: deps.blockers,
      });
    }

    await this.prisma.course.delete({ where: { id } });

    await this.audit.log({
      actorUserId: actor.id,
      action: 'COURSE_DELETE',
      entityType: 'Course',
      entityId: id,
      details: `${deps.code} - ${deps.name} (stage ${deps.stage})`,
    });

    return { success: true };
  }

  /**
   * What still references this course, with the action needed to remove each
   * blocker. The web app shows this list in a modal before any deletion.
   */
  async dependencies(id: string) {
    const course = await this.prisma.course.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            // Archived lectures no longer block deleting the course.
            lectures: { where: { deletedAt: null } },
            assignments: true,
            timetableEntries: true,
          },
        },
      },
    });
    if (!course) throw new NotFoundException('المادة غير موجودة');

    // A carry-over/repeat student may be explicitly required to take this
    // course; deleting it would leave a dangling id in his enrollment.
    const settings = await this.prisma.systemSetting.findMany({
      where: { key: { startsWith: 'STUDENT_COURSES_' } },
    });
    let requiredByStudents = 0;
    for (const setting of settings) {
      try {
        const parsed = JSON.parse(setting.value);
        if (
          parsed &&
          parsed.academicStatus !== 'REGULAR' &&
          Array.isArray(parsed.courseIds) &&
          parsed.courseIds.includes(id)
        ) {
          requiredByStudents += 1;
        }
      } catch {}
    }

    const blockers: Array<{
      key: string;
      count: number;
      label: string;
      action: string;
    }> = [];

    if (course._count.lectures > 0) {
      blockers.push({
        key: 'lectures',
        count: course._count.lectures,
        label: 'محاضرات مرتبطة بهذه المادة (وسجلات حضورها)',
        action: 'احذف هذه المحاضرات من صفحة الحضور أولاً',
      });
    }

    if (requiredByStudents > 0) {
      blockers.push({
        key: 'students',
        count: requiredByStudents,
        label: 'طلاب مطالبون بهذه المادة (عبور أو إعادة)',
        action: 'احذف المادة من مواد هؤلاء الطلاب من زر «المواد» في صفحة الطلاب أولاً',
      });
    }

    const notes: string[] = [];
    if (course._count.assignments > 0) {
      notes.push(
        `سيتم إلغاء إسناد المادة لـ ${course._count.assignments} محاضر تلقائياً عند الحذف.`,
      );
    }
    if (course._count.timetableEntries > 0) {
      notes.push(
        `يوجد ${course._count.timetableEntries} موعد في الجدول الدراسي لهذه المادة وسيُحذف تلقائياً معها.`,
      );
    }
    const archivedLectures = await this.prisma.lecture.count({
      where: { courseId: id, deletedAt: { not: null } },
    });
    if (archivedLectures > 0) {
      notes.push(
        `توجد ${archivedLectures} محاضرة محذوفة (مؤرشفة) لهذه المادة؛ سجلات حضورها محفوظة في التقارير.`,
      );
    }

    return {
      entity: 'COURSE' as const,
      id: course.id,
      code: course.code,
      name: course.name,
      stage: course.stage,
      canDelete: blockers.length === 0,
      blockers,
      notes,
    };
  }
}
