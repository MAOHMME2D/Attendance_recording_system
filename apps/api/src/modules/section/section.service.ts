import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { AuthorizationService } from '../auth/authorization.service';
import { isAdministrativeRole } from '../../common/constants/roles';
import {
  DEFAULT_STAGE,
  requireAcademicStage,
} from '../../common/constants/academics';
import { normalizeSection } from '../../common/utils/section.util';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { CreateSectionDto } from './dto/create-section.dto';
import { UpdateSectionDto } from './dto/update-section.dto';

@Injectable()
export class SectionService {
  private readonly logger = new Logger(SectionService.name);

  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
    private authorization: AuthorizationService,
  ) {}

  /**
   * Get all sections with their active student count.
   *
   * Lecturers only see sections of the stages they teach (their course
   * assignments); administrative roles see every section.
   */
  async getAll(
    actor: AuthenticatedUser,
    filters: { studyPeriod?: string; stage?: string } = {},
  ) {
    const where: Record<string, unknown> = {};

    if (filters.studyPeriod && (filters.studyPeriod === 'MORNING' || filters.studyPeriod === 'EVENING')) {
      where.studyPeriod = filters.studyPeriod;
    }

    if (filters.stage) {
      // Explicit invalid input must not silently fall back to stage 2.
      const stage = requireAcademicStage(filters.stage);
      if (!isAdministrativeRole(actor.role)) {
        const stages = await this.authorization.assignedStages(actor);
        if (!stages.includes(stage)) return [];
      }
      where.stage = stage;
    } else if (!isAdministrativeRole(actor.role)) {
      const stages = await this.authorization.assignedStages(actor);
      if (stages.length === 0) return [];
      where.stage = { in: stages };
    }

    const sections = await this.prisma.section.findMany({
      where,
      include: {
        _count: {
          select: { students: { where: { deletedAt: null } } },
        },
      },
      orderBy: [{ stage: 'asc' }, { studyPeriod: 'asc' }, { name: 'asc' }],
    });

    return sections.map((section) => ({
      id: section.id,
      stage: section.stage,
      studyPeriod: section.studyPeriod,
      name: section.name,
      label: section.label,
      createdAt: section.createdAt,
      updatedAt: section.updatedAt,
      studentCount: section._count.students,
    }));
  }

  async create(data: CreateSectionDto, actor: AuthenticatedUser) {
    // A missing stage keeps the historical default (stage 2), but an explicit
    // invalid value is rejected instead of being silently rewritten.
    const stage =
      data.stage !== undefined && data.stage !== null
        ? requireAcademicStage(data.stage)
        : DEFAULT_STAGE;
    const period = data.studyPeriod?.trim().toUpperCase() === 'EVENING' ? 'EVENING' : 'MORNING';
    const cleanName = String(data.name || '').trim();

    if (!cleanName) {
      throw new ConflictException('يرجى تحديد اسم أو رقم الشعبة');
    }

    const existing = await this.prisma.section.findUnique({
      where: {
        stage_studyPeriod_name: {
          stage,
          studyPeriod: period,
          name: cleanName,
        },
      },
    });

    if (existing) {
      throw new ConflictException(
        `الشعبة (${cleanName}) موجودة مسبقاً في هذه المرحلة وهذه الدراسة`,
      );
    }

    const label = data.label?.trim() || `الشعبة ${cleanName}`;

    const section = await this.prisma.section.create({
      data: { stage, studyPeriod: period, name: cleanName, label },
    });

    await this.audit.log({
      actorUserId: actor.id,
      action: 'SECTION_CREATE',
      entityType: 'Section',
      entityId: section.id,
      details: `stage=${stage}, ${period}, ${cleanName}`,
    });

    this.logger.log(`Created section: stage ${stage} - ${period} - ${cleanName}`);
    return { ...section, studentCount: 0 };
  }

  async update(id: string, data: UpdateSectionDto, actor: AuthenticatedUser) {
    const section = await this.prisma.section.findUnique({
      where: { id },
      include: {
        _count: {
          select: { students: { where: { deletedAt: null } } },
        },
      },
    });
    if (!section) throw new NotFoundException('الشعبة غير موجودة');

    const nextStage =
      data.stage !== undefined && data.stage !== null
        ? requireAcademicStage(data.stage)
        : section.stage;
    const nextPeriod = data.studyPeriod ?? section.studyPeriod;
    const nextName = data.name !== undefined ? String(data.name).trim() : section.name;
    const nextLabel = data.label !== undefined ? (data.label.trim() || null) : section.label;

    if (!nextName) throw new ConflictException('اسم الشعبة مطلوب');

    const stageChanged = nextStage !== section.stage;
    const periodChanged = nextPeriod !== section.studyPeriod;
    const nameChanged = nextName !== section.name;

    // Lectures reference the section by its text mirror. Find them before any
    // write so renaming keeps the link and moving to another stage/period is
    // rejected when history exists.
    const sectionKey = normalizeSection(section.name);
    const linkedLectures =
      stageChanged || periodChanged || nameChanged
        ? (
            await this.prisma.lecture.findMany({
              where: {
                studyPeriod: section.studyPeriod,
                OR: [{ course: { stage: section.stage } }, { courseId: null }],
              },
              select: { id: true, section: true },
            })
          ).filter((lecture) =>
            String(lecture.section || '')
              .split(',')
              .map((part) => normalizeSection(part))
              .filter(Boolean)
              .includes(sectionKey),
          )
        : [];

    // Moving a section between stages/periods while students belong to it would
    // silently change their academic scope. Require an explicit, empty section.
    if ((stageChanged || periodChanged) && section._count.students > 0) {
      throw new ConflictException(
        'لا يمكن تغيير المرحلة أو الدراسة لشعبة تحتوي طلاباً. انقل الطلاب أولاً.',
      );
    }

    if ((stageChanged || periodChanged) && linkedLectures.length > 0) {
      throw new ConflictException(
        'لا يمكن تغيير المرحلة أو الدراسة لشعبة مرتبطة بمحاضرات وسجلات حضور سابقة.',
      );
    }

    const duplicate = await this.prisma.section.findUnique({
      where: {
        stage_studyPeriod_name: {
          stage: nextStage,
          studyPeriod: nextPeriod,
          name: nextName,
        },
      },
    });
    if (duplicate && duplicate.id !== id) {
      throw new ConflictException('توجد شعبة أخرى بالاسم نفسه في هذه المرحلة والدراسة');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.section.update({
        where: { id },
        data: {
          stage: nextStage,
          studyPeriod: nextPeriod,
          name: nextName,
          label: nextLabel,
        },
      });

      // Student.section is a legacy text mirror. Keep it in sync for students
      // that are linked through the new sectionId relation.
      if (nameChanged || periodChanged || stageChanged) {
        await tx.student.updateMany({
          where: { sectionId: id },
          data: {
            stage: nextStage,
            studyPeriod: nextPeriod,
            section: nextName,
          },
        });
      }

      // Lecture.section is also a text mirror (there is no Lecture.sectionId in
      // Phase 2). Rename it in place so previous lectures stay attached to this
      // section and closing them keeps matching the same students.
      if (nameChanged) {
        for (const lecture of linkedLectures) {
          const parts = String(lecture.section || '')
            .split(',')
            .map((part) => part.trim())
            .filter(Boolean)
            .map((part) =>
              normalizeSection(part) === sectionKey ? nextName : part,
            );
          const nextSection = Array.from(new Set(parts)).join(',');
          await tx.lecture.update({
            where: { id: lecture.id },
            data: { section: nextSection || null },
          });
        }
      }

      return result;
    });

    await this.audit.log({
      actorUserId: actor.id,
      action: 'SECTION_UPDATE',
      entityType: 'Section',
      entityId: id,
      details: `${section.name} -> ${nextName} (stage ${section.stage}->${nextStage}, ${section.studyPeriod}->${nextPeriod})`,
    });

    return { ...updated, studentCount: section._count.students };
  }

  /**
   * Delete a section only when nothing references it. Attendance history is
   * never detached implicitly.
   */
  async delete(id: string, actor: AuthenticatedUser) {
    const deps = await this.dependencies(id);

    if (!deps.canDelete) {
      // Return the same structured blockers as the preflight endpoint so any
      // caller can tell the user exactly what has to be removed first.
      throw new ConflictException({
        message: 'لا يمكن حذف الشعبة قبل إزالة الارتباطات التالية',
        blockers: deps.blockers,
      });
    }

    await this.prisma.section.delete({ where: { id } });

    await this.audit.log({
      actorUserId: actor.id,
      action: 'SECTION_DELETE',
      entityType: 'Section',
      entityId: id,
      details: `stage=${deps.stage}, ${deps.studyPeriod}, ${deps.name}`,
    });

    this.logger.log(
      `Deleted section: stage ${deps.stage} - ${deps.studyPeriod} - ${deps.name}`,
    );
    return { success: true, message: `تم حذف الشعبة (${deps.name}) بنجاح` };
  }

  /**
   * What still references this section, with the action needed to remove each
   * blocker. The web app shows this list in a modal before any deletion.
   */
  async dependencies(id: string) {
    const section = await this.prisma.section.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            students: true,
            lectureSections: { where: { lecture: { deletedAt: null } } },
            timetableEntries: true,
          },
        },
      },
    });
    if (!section) {
      throw new NotFoundException('الشعبة غير موجودة');
    }

    // Lectures reference the section by its text mirror. Match the same stage
    // and study period so a section that already holds attendance history (or
    // an archived lecture) is reported as linked. Archived lectures are kept as
    // a note only: they no longer block deleting the section.
    const lectures = await this.prisma.lecture.findMany({
      where: {
        studyPeriod: section.studyPeriod,
        deletedAt: null,
        OR: [{ course: { stage: section.stage } }, { courseId: null }],
      },
      select: { id: true, section: true },
    });
    const sectionKey = normalizeSection(section.name);
    const lectureIds = new Set(
      lectures
        .filter((lecture) =>
          String(lecture.section || '')
            .split(',')
            .map((part) => normalizeSection(part))
            .filter(Boolean)
            .includes(sectionKey),
        )
        .map((lecture) => lecture.id),
    );

    // Lectures created through the timetable are linked by id as well.
    if (section._count.lectureSections > 0) {
      const links = await this.prisma.lectureSection.findMany({
        where: { sectionId: id, lecture: { deletedAt: null } },
        select: { lectureId: true },
      });
      for (const link of links) lectureIds.add(link.lectureId);
    }

    const blockers: Array<{
      key: string;
      count: number;
      label: string;
      action: string;
    }> = [];

    if (section._count.students > 0) {
      blockers.push({
        key: 'students',
        count: section._count.students,
        label: 'طلاب مرتبطون بهذه الشعبة',
        action: 'انقل الطلاب إلى شعبة أخرى أو احذفهم، ثم أعد المحاولة',
      });
    }

    if (lectureIds.size > 0) {
      blockers.push({
        key: 'lectures',
        count: lectureIds.size,
        label: 'محاضرات مرتبطة بالشعبة (وسجلات حضورها)',
        action: 'احذف هذه المحاضرات من صفحة الحضور أولاً',
      });
    }

    const notes: string[] = [];
    if (section._count.timetableEntries > 0) {
      notes.push(
        `يوجد ${section._count.timetableEntries} موعد في الجدول الدراسي لهذه الشعبة وسيُحذف تلقائياً معها.`,
      );
    }
    const archivedLectures = await this.prisma.lecture.count({
      where: {
        deletedAt: { not: null },
        studyPeriod: section.studyPeriod,
        OR: [{ course: { stage: section.stage } }, { courseId: null }],
      },
    });
    if (archivedLectures > 0) {
      notes.push(
        `توجد ${archivedLectures} محاضرة محذوفة (مؤرشفة) لهذه الشعبة؛ سجلات حضورها محفوظة في التقارير.`,
      );
    }

    return {
      entity: 'SECTION' as const,
      id: section.id,
      name: section.name,
      label: section.label,
      stage: section.stage,
      studyPeriod: section.studyPeriod,
      canDelete: blockers.length === 0,
      blockers,
      notes,
    };
  }
}
