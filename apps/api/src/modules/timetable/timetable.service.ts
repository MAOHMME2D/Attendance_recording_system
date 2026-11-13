import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';

export const DAY_LABELS = [
  'الأحد',
  'الإثنين',
  'الثلاثاء',
  'الأربعاء',
  'الخميس',
  'الجمعة',
  'السبت',
] as const;

function timeToMinutes(value: string): number {
  const [h, m] = value.split(':').map((part) => Number(part));
  return h * 60 + m;
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { code?: string }).code === 'P2002'
  );
}

@Injectable()
export class TimetableService {
  private readonly logger = new Logger(TimetableService.name);

  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  /**
   * List timetable entries. Any authenticated staff member may read them
   * (they need it to understand parallel sessions); writes are restricted to
   * TIMETABLE_MANAGE holders in the controller.
   */
  async getAll(
    actor: AuthenticatedUser,
    filters: {
      courseId?: string;
      sectionId?: string;
      dayOfWeek?: number;
      stage?: number;
      studyPeriod?: string;
    } = {},
  ) {
    const where: Record<string, unknown> = {};
    if (filters.courseId) where.courseId = filters.courseId;
    if (filters.sectionId) where.sectionId = filters.sectionId;
    if (filters.dayOfWeek !== undefined && !Number.isNaN(filters.dayOfWeek)) {
      where.dayOfWeek = filters.dayOfWeek;
    }
    if (filters.stage !== undefined || filters.studyPeriod) {
      where.section = {
        ...(filters.stage !== undefined ? { stage: filters.stage } : {}),
        ...(filters.studyPeriod ? { studyPeriod: filters.studyPeriod } : {}),
      };
    }

    const entries = await this.prisma.timetableEntry.findMany({
      where,
      include: {
        course: { select: { id: true, code: true, name: true, stage: true } },
        section: { select: { id: true, name: true, stage: true, studyPeriod: true, label: true } },
      },
      orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
    });

    // Entries are academic information; audit readers exist but reading the
    // table is not itself a security event. Skip audit logging for reads.
    void actor;
    return entries.map((entry) => ({
      ...entry,
      dayLabel: DAY_LABELS[entry.dayOfWeek] ?? String(entry.dayOfWeek),
    }));
  }

  private async assertCourseAndSection(
    courseId: string,
    sectionId: string,
  ): Promise<{
    course: { id: string; code: string; name: string; stage: number };
    section: { id: string; name: string; stage: number };
  }> {
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
      select: { id: true, code: true, name: true, stage: true },
    });
    if (!course) throw new NotFoundException('المادة غير موجودة');

    const section = await this.prisma.section.findUnique({
      where: { id: sectionId },
      select: { id: true, name: true, stage: true },
    });
    if (!section) throw new NotFoundException('الشعبة غير موجودة');

    if (course.stage !== section.stage) {
      throw new BadRequestException(
        `الشعبة (${section.name}) لا تنتمي إلى المرحلة ${course.stage} التي تخص المادة`,
      );
    }

    return { course, section };
  }

  private assertTimeOrder(startTime: string, endTime: string): void {
    if (timeToMinutes(startTime) >= timeToMinutes(endTime)) {
      throw new BadRequestException('وقت النهاية يجب أن يكون بعد وقت البداية');
    }
  }

  /**
   * Reject overlapping slots for the same section on the same day. Overlaps
   * would make "the parallel session" ambiguous for cross-section attendance.
   */
  private async assertNoOverlap(
    sectionId: string,
    dayOfWeek: number,
    startTime: string,
    endTime: string,
    excludeEntryId?: string,
  ): Promise<void> {
    const sameDay = await this.prisma.timetableEntry.findMany({
      where: {
        sectionId,
        dayOfWeek,
        ...(excludeEntryId ? { id: { not: excludeEntryId } } : {}),
      },
      select: { id: true, startTime: true, endTime: true, course: { select: { code: true } } },
    });
    const from = timeToMinutes(startTime);
    const to = timeToMinutes(endTime);
    for (const row of sameDay) {
      const otherFrom = timeToMinutes(row.startTime);
      const otherTo = timeToMinutes(row.endTime);
      if (from < otherTo && otherFrom < to) {
        throw new ConflictException(
          `هذا الموعد يتعارض مع محاضرة ${row.course?.code ?? ''} (${row.startTime} - ${row.endTime}) لنفس الشعبة في نفس اليوم`,
        );
      }
    }
  }

  async create(
    dto: {
      courseId: string;
      sectionId: string;
      dayOfWeek: number;
      startTime: string;
      endTime: string;
      type?: string;
      hall?: string;
    },
    actor: AuthenticatedUser,
  ) {
    const { course, section } = await this.assertCourseAndSection(
      dto.courseId,
      dto.sectionId,
    );
    this.assertTimeOrder(dto.startTime, dto.endTime);
    await this.assertNoOverlap(
      section.id,
      dto.dayOfWeek,
      dto.startTime,
      dto.endTime,
    );

    try {
      const entry = await this.prisma.timetableEntry.create({
        data: {
          courseId: course.id,
          sectionId: section.id,
          dayOfWeek: dto.dayOfWeek,
          startTime: dto.startTime,
          endTime: dto.endTime,
          type: dto.type || 'THEORETICAL',
          hall: dto.hall?.trim() || null,
        },
        include: {
          course: { select: { id: true, code: true, name: true, stage: true } },
          section: { select: { id: true, name: true, stage: true, studyPeriod: true, label: true } },
        },
      });

      await this.audit.log({
        actorUserId: actor.id,
        action: 'TIMETABLE_CREATE',
        entityType: 'TimetableEntry',
        entityId: entry.id,
        details: `${course.code} / ${course.name} - شعبة ${section.name} - ${DAY_LABELS[dto.dayOfWeek]} ${dto.startTime}-${dto.endTime}`,
      });

      return { ...entry, dayLabel: DAY_LABELS[dto.dayOfWeek] };
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException(
          'هذا الموعد موجود مسبقاً لنفس المادة والشعبة واليوم',
        );
      }
      throw error;
    }
  }

  async update(
    id: string,
    dto: {
      courseId?: string;
      sectionId?: string;
      dayOfWeek?: number;
      startTime?: string;
      endTime?: string;
      type?: string;
      hall?: string;
    },
    actor: AuthenticatedUser,
  ) {
    const existing = await this.prisma.timetableEntry.findUnique({
      where: { id },
      include: {
        course: { select: { id: true, code: true, name: true, stage: true } },
        section: { select: { id: true, name: true, stage: true } },
      },
    });
    if (!existing) {
      throw new NotFoundException('موعد الجدول غير موجود');
    }

    const courseId = dto.courseId ?? existing.courseId;
    const sectionId = dto.sectionId ?? existing.sectionId;
    const dayOfWeek = dto.dayOfWeek ?? existing.dayOfWeek;
    const startTime = dto.startTime ?? existing.startTime;
    const endTime = dto.endTime ?? existing.endTime;

    const { course, section } = await this.assertCourseAndSection(
      courseId,
      sectionId,
    );
    this.assertTimeOrder(startTime, endTime);
    await this.assertNoOverlap(section.id, dayOfWeek, startTime, endTime, id);

    try {
      const entry = await this.prisma.timetableEntry.update({
        where: { id },
        data: {
          courseId: course.id,
          sectionId: section.id,
          dayOfWeek,
          startTime,
          endTime,
          ...(dto.type !== undefined ? { type: dto.type || 'THEORETICAL' } : {}),
          ...(dto.hall !== undefined ? { hall: dto.hall?.trim() || null } : {}),
        },
        include: {
          course: { select: { id: true, code: true, name: true, stage: true } },
          section: { select: { id: true, name: true, stage: true, studyPeriod: true, label: true } },
        },
      });

      await this.audit.log({
        actorUserId: actor.id,
        action: 'TIMETABLE_UPDATE',
        entityType: 'TimetableEntry',
        entityId: id,
        details: `${course.code} / شعبة ${section.name} - ${DAY_LABELS[dayOfWeek]} ${startTime}-${endTime}`,
      });

      return { ...entry, dayLabel: DAY_LABELS[dayOfWeek] };
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException(
          'هذا الموعد موجود مسبقاً لنفس المادة والشعبة واليوم',
        );
      }
      throw error;
    }
  }

  async delete(id: string, actor: AuthenticatedUser) {
    const existing = await this.prisma.timetableEntry.findUnique({
      where: { id },
      include: {
        course: { select: { code: true, name: true } },
        section: { select: { name: true } },
      },
    });
    if (!existing) {
      throw new NotFoundException('موعد الجدول غير موجود');
    }

    await this.prisma.timetableEntry.delete({ where: { id } });

    await this.audit.log({
      actorUserId: actor.id,
      action: 'TIMETABLE_DELETE',
      entityType: 'TimetableEntry',
      entityId: id,
      details: `${existing.course.code} / شعبة ${existing.section.name} - ${DAY_LABELS[existing.dayOfWeek]} ${existing.startTime}-${existing.endTime}`,
    });

    return { success: true };
  }
}
