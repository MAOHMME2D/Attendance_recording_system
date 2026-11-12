import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthorizationService } from '../auth/authorization.service';
import { requireAcademicStage } from '../../common/constants/academics';
import { normalizeSection } from '../../common/utils/section.util';
import { COVER_NOTE_PREFIX } from '../../common/constants/coverage';
import { notCoveredWhere } from '../../common/utils/coverage.util';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';

interface FollowupFilters {
  courseId?: string;
  sectionId?: string;
  stage?: string;
  search?: string;
  sort?: string;
  page?: string;
  pageSize?: string;
}

interface FollowupScope {
  courseIds: string[];
  stages: number[];
  courses: Array<{ id: string; code: string; name: string; stage: number }>;
}

export interface SectionFilter {
  id: string;
  name: string;
  stage: number;
  studyPeriod: string;
}

@Injectable()
export class FollowupService {
  constructor(
    private prisma: PrismaService,
    private authorization: AuthorizationService,
  ) {}

  /**
   * The scope is always derived from the database assignments, never from a
   * client-supplied studentId/sectionId.
   *
   * When a staff member teaches more than one course, `courseId` is mandatory:
   * silently merging several courses would mix unrelated statistics.
   */
  private async resolveScope(
    user: AuthenticatedUser,
    courseId?: string,
  ): Promise<FollowupScope> {
    const accessible = await this.authorization.assignedCourseIds(user);
    const requested = String(courseId || '').trim();

    if (requested) {
      if (!accessible.includes(requested)) {
        throw new ForbiddenException('هذه المادة غير مسندة إليك');
      }
      const course = await this.prisma.course.findUnique({
        where: { id: requested },
        select: { id: true, code: true, name: true, stage: true },
      });
      if (!course) throw new NotFoundException('المادة غير موجودة');
      return {
        courses: [course],
        courseIds: [course.id],
        stages: [course.stage],
      };
    }

    if (accessible.length === 0) {
      return { courses: [], courseIds: [], stages: [] };
    }

    if (accessible.length > 1) {
      throw new BadRequestException(
        'لديك أكثر من مادة. اختر المادة قبل عرض المتابعة.',
      );
    }

    const course = await this.prisma.course.findUnique({
      where: { id: accessible[0] },
      select: { id: true, code: true, name: true, stage: true },
    });
    if (!course) {
      return { courses: [], courseIds: [], stages: [] };
    }

    return {
      courses: [course],
      courseIds: [course.id],
      stages: [course.stage],
    };
  }

  /** Validates a section filter against the stage/course scope. */
  private async resolveSectionFilter(
    scope: FollowupScope,
    sectionId?: string,
  ): Promise<SectionFilter | null> {
    const requested = String(sectionId || '').trim();
    if (!requested) return null;

    const section = await this.prisma.section.findUnique({
      where: { id: requested },
      select: { id: true, name: true, stage: true, studyPeriod: true },
    });
    if (!section) {
      throw new BadRequestException('الشعبة المحددة غير موجودة');
    }
    if (!scope.stages.includes(section.stage)) {
      throw new ForbiddenException('هذه الشعبة خارج نطاق موادك');
    }
    return section;
  }

  /** Students explicitly required to take one of the given courses. */
  private async carryOverStudentIds(courseIds: string[]): Promise<string[]> {
    if (courseIds.length === 0) return [];
    const settings = await this.prisma.systemSetting.findMany({
      where: { key: { startsWith: 'STUDENT_COURSES_' } },
    });
    const ids: string[] = [];
    for (const setting of settings) {
      try {
        const parsed = JSON.parse(setting.value);
        if (
          parsed &&
          parsed.academicStatus !== 'REGULAR' &&
          Array.isArray(parsed.courseIds) &&
          parsed.courseIds.some((courseId: string) => courseIds.includes(courseId))
        ) {
          ids.push(setting.key.replace('STUDENT_COURSES_', ''));
        }
      } catch {}
    }
    return ids;
  }

  private studentWhere(
    scope: FollowupScope,
    filters: FollowupFilters,
    section: SectionFilter | null,
    carryOverIds: string[],
  ) {
    const where: any = { deletedAt: null };
    const and: any[] = [];

    const stageCondition: any = filters.stage
      ? (() => {
          const stage = requireAcademicStage(filters.stage);
          if (!scope.stages.includes(stage)) {
            throw new ForbiddenException('هذه المرحلة خارج نطاق موادك');
          }
          return { stage };
        })()
      : { stage: { in: scope.stages } };

    // A carry-over student keeps his own stage but is required to take one of
    // this course's lectures, so he must appear in the course's follow-up.
    and.push(
      carryOverIds.length > 0
        ? { OR: [stageCondition, { id: { in: carryOverIds } }] }
        : stageCondition,
    );

    if (section) {
      const matches: any[] = [
        { sectionId: section.id },
        { sectionId: null, section: section.name },
      ];
      // Cross-stage sections share the same number but not the same row, so a
      // carry-over student is matched by his section number.
      if (carryOverIds.length > 0) {
        matches.push({ id: { in: carryOverIds }, section: section.name });
      }
      and.push({ OR: matches });
    }

    if (filters.search && filters.search.trim()) {
      const term = filters.search.trim();
      and.push({
        OR: [
          { name: { contains: term, mode: 'insensitive' } },
          { studentCode: { contains: term, mode: 'insensitive' } },
        ],
      });
    }

    if (and.length > 0) where.AND = and;

    return where;
  }

  async overview(user: AuthenticatedUser, filters: FollowupFilters) {
    const scope = await this.resolveScope(user, filters.courseId);
    const section = await this.resolveSectionFilter(scope, filters.sectionId);
    const carryOverIds = await this.carryOverStudentIds(scope.courseIds);
    const where = this.studentWhere(scope, filters, section, carryOverIds);

    const students = await this.prisma.student.findMany({
      where,
      select: { id: true },
    });
    const studentIds = students.map((student) => student.id);

    // Archived lectures are hidden from every listing and statistic.
    const allLectures = await this.prisma.lecture.count({
      where: { courseId: { in: scope.courseIds }, deletedAt: null },
    });

    const closedLectures = await this.prisma.lecture.findMany({
      where: {
        courseId: { in: scope.courseIds },
        status: 'CLOSED',
        deletedAt: null,
      },
      select: { id: true },
    });
    const closedIds = closedLectures.map((lecture) => lecture.id);

    let present = 0;
    let absent = 0;
    if (closedIds.length > 0 && studentIds.length > 0) {
      const [presentCount, absentCount] = await Promise.all([
        this.prisma.attendanceRecord.count({
          where: {
            lectureId: { in: closedIds },
            studentId: { in: studentIds },
            status: 'PRESENT',
            ...notCoveredWhere(),
          },
        }),
        this.prisma.attendanceRecord.count({
          where: {
            lectureId: { in: closedIds },
            studentId: { in: studentIds },
            status: 'ABSENT',
            ...notCoveredWhere(),
          },
        }),
      ]);
      present = presentCount;
      absent = absentCount;
    }

    const totalCases = present + absent;
    const attendanceRate = totalCases > 0 ? Math.round((present / totalCases) * 100) : 0;
    const absenceRate = totalCases > 0 ? Math.round((absent / totalCases) * 100) : 0;

    return {
      courses: scope.courses,
      scope: {
        courseIds: scope.courseIds,
        stages: scope.stages,
        section,
      },
      totals: {
        students: studentIds.length,
        lectures: allLectures,
        closedLectures: closedIds.length,
        activeLectures: allLectures - closedIds.length,
        present,
        absent,
        attendanceCases: totalCases,
        attendanceRate,
        absenceRate,
      },
    };
  }

  async students(user: AuthenticatedUser, filters: FollowupFilters) {
    const scope = await this.resolveScope(user, filters.courseId);
    const section = await this.resolveSectionFilter(scope, filters.sectionId);
    const carryOverIds = await this.carryOverStudentIds(scope.courseIds);
    const where = this.studentWhere(scope, filters, section, carryOverIds);

    const rows = await this.prisma.student.findMany({
      where,
      select: {
        id: true,
        studentCode: true,
        name: true,
        stage: true,
        studyPeriod: true,
        section: true,
        sectionId: true,
        sectionRef: { select: { label: true } },
      },
      orderBy: [{ orderIndex: 'asc' }, { studentCode: 'asc' }],
    });

    const studentIds = rows.map((row) => row.id);

    // Only CLOSED, non-archived lectures count. Active lectures are deliberately
    // excluded from absences and rates.
    const closedIds = (
      await this.prisma.lecture.findMany({
        where: {
          courseId: { in: scope.courseIds },
          status: 'CLOSED',
          deletedAt: null,
        },
        select: { id: true },
      })
    ).map((lecture) => lecture.id);

    const records =
      closedIds.length > 0 && studentIds.length > 0
        ? await this.prisma.attendanceRecord.findMany({
            where: {
              lectureId: { in: closedIds },
              studentId: { in: studentIds },
              // Covered rows are display credits, not attendance.
              ...notCoveredWhere(),
            },
            select: { studentId: true, status: true },
          })
        : [];

    const stats = new Map<string, { present: number; absent: number }>();
    for (const record of records) {
      if (!record.studentId) continue;
      const entry = stats.get(record.studentId) || { present: 0, absent: 0 };
      if (record.status === 'PRESENT') entry.present++;
      else if (record.status === 'ABSENT') entry.absent++;
      stats.set(record.studentId, entry);
    }

    const items = rows.map((row) => {
      const entry = stats.get(row.id) || { present: 0, absent: 0 };
      const total = entry.present + entry.absent;
      return {
        id: row.id,
        studentCode: row.studentCode,
        name: row.name,
        stage: row.stage,
        studyPeriod: row.studyPeriod,
        section: row.section,
        sectionId: row.sectionId,
        sectionLabel: row.sectionRef?.label || null,
        presentCount: entry.present,
        absentCount: entry.absent,
        totalLectures: total,
        attendanceRate: total > 0 ? Math.round((entry.present / total) * 100) : 0,
        absenceRate: total > 0 ? Math.round((entry.absent / total) * 100) : 0,
      };
    });

    const sort = filters.sort || 'name';
    items.sort((a, b) => {
      switch (sort) {
        case 'attendanceRate_asc':
          return a.attendanceRate - b.attendanceRate;
        case 'attendanceRate_desc':
          return b.attendanceRate - a.attendanceRate;
        case 'absenceRate_asc':
          return a.absenceRate - b.absenceRate;
        case 'absenceRate_desc':
          return b.absenceRate - a.absenceRate;
        case 'studentCode':
          return a.studentCode.localeCompare(b.studentCode, 'ar');
        case 'name':
        default:
          return a.name.localeCompare(b.name, 'ar');
      }
    });

    const pageSize = Math.min(Math.max(Number(filters.pageSize) || 25, 1), 100);
    const total = items.length;
    const totalPages = Math.max(Math.ceil(total / pageSize), 1);
    const page = Math.min(Math.max(Number(filters.page) || 1, 1), totalPages);
    const start = (page - 1) * pageSize;

    return {
      courses: scope.courses,
      scope: {
        courseIds: scope.courseIds,
        stages: scope.stages,
        section,
      },
      items: items.slice(start, start + pageSize),
      pagination: { page, pageSize, total, totalPages },
    };
  }

  async studentDetail(
    user: AuthenticatedUser,
    studentId: string,
    filters: FollowupFilters,
  ) {
    const scope = await this.resolveScope(user, filters.courseId);
    const section = await this.resolveSectionFilter(scope, filters.sectionId);
    const carryOverIds = await this.carryOverStudentIds(scope.courseIds);

    const student = await this.prisma.student.findFirst({
      where: { id: studentId, deletedAt: null },
      select: {
        id: true,
        studentCode: true,
        name: true,
        stage: true,
        studyPeriod: true,
        section: true,
        sectionId: true,
        sectionRef: { select: { label: true } },
      },
    });

    const isCarryOver = Boolean(student && carryOverIds.includes(student.id));

    // Do not reveal whether an out-of-scope student exists. A changed
    // studentId can never leak a student from another stage or section.
    if (!student || (!scope.stages.includes(student.stage) && !isCarryOver)) {
      throw new NotFoundException('الطالب غير موجود ضمن نطاق موادك');
    }

    if (section) {
      const matches =
        student.sectionId === section.id ||
        (student.sectionId === null &&
          normalizeSection(student.section) === normalizeSection(section.name)) ||
        (isCarryOver &&
          normalizeSection(student.section) === normalizeSection(section.name));
      if (!matches) {
        throw new NotFoundException('الطالب غير موجود ضمن نطاق موادك');
      }
    }

    if (filters.stage) {
      const stage = requireAcademicStage(filters.stage);
      if (student.stage !== stage && !isCarryOver) {
        throw new NotFoundException('الطالب غير موجود ضمن نطاق موادك');
      }
    }

    const records = await this.prisma.attendanceRecord.findMany({
      where: {
        studentId,
        lecture: {
          status: 'CLOSED',
          deletedAt: null,
          courseId: { in: scope.courseIds },
        },
      },
      include: {
        lecture: {
          select: {
            id: true,
            name: true,
            startedAt: true,
            closedAt: true,
            courseId: true,
            course: { select: { id: true, code: true, name: true, stage: true } },
          },
        },
      },
      orderBy: { lecture: { startedAt: 'desc' } },
    });

    // The listing below keeps every row (including "حاضر عبر…" coverage
    // credits, rendered distinctly); the statistics skip them.
    const statsRecords = records.filter(
      (record) => !record.note || !record.note.startsWith(COVER_NOTE_PREFIX),
    );
    const present = statsRecords.filter((record) => record.status === 'PRESENT').length;
    const absent = statsRecords.filter((record) => record.status === 'ABSENT').length;
    const total = present + absent;

    const activeLectures = await this.prisma.lecture.count({
      where: {
        courseId: { in: scope.courseIds },
        status: 'ACTIVE',
        deletedAt: null,
      },
    });

    return {
      student: {
        id: student.id,
        studentCode: student.studentCode,
        name: student.name,
        stage: student.stage,
        studyPeriod: student.studyPeriod,
        section: student.section,
        sectionId: student.sectionId,
        sectionLabel: student.sectionRef?.label || null,
      },
      stats: {
        present,
        absent,
        totalLectures: total,
        attendanceRate: total > 0 ? Math.round((present / total) * 100) : 0,
        absenceRate: total > 0 ? Math.round((absent / total) * 100) : 0,
        excludedActiveLectures: activeLectures,
      },
      lectures: records.map((record) => ({
        attendanceId: record.id,
        lectureId: record.lecture.id,
        lectureName: record.lecture.name,
        lectureDate: record.lecture.startedAt,
        closedAt: record.lecture.closedAt,
        courseId: record.lecture.courseId,
        courseCode: record.lecture.course?.code || null,
        courseName: record.lecture.course?.name || null,
        status: record.status,
        note: record.note,
      })),
    };
  }
}
