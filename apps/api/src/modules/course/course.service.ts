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
        _count: { select: { lectures: true, assignments: true } },
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
    const course = await this.prisma.course.findUnique({
      where: { id },
      include: { _count: { select: { lectures: true, assignments: true } } },
    });
    if (!course) throw new NotFoundException('المادة غير موجودة');

    if (course._count.lectures > 0) {
      throw new ConflictException(
        'لا يمكن حذف المادة لأنها مرتبطة بمحاضرات. احذف المحاضرات أولاً أو أبقِ المادة.',
      );
    }

    await this.prisma.course.delete({ where: { id } });

    await this.audit.log({
      actorUserId: actor.id,
      action: 'COURSE_DELETE',
      entityType: 'Course',
      entityId: id,
      details: `${course.code} - ${course.name}`,
    });

    return { success: true };
  }
}
