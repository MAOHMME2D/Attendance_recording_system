import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthorizationService } from '../auth/authorization.service';
import { isAdministrativeRole } from '../../common/constants/roles';
import { ACADEMIC_STAGES, requireAcademicStage, STAGE_LABELS } from '../../common/constants/academics';
import { normalizeSection } from '../../common/utils/section.util';
import { notCoveredWhere } from '../../common/utils/coverage.util';
import { COVER_NOTE_PREFIX } from '../../common/constants/coverage';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import type { ReportFilters, ReportScope, LectureScopeRow } from './report-types';

const DEFAULT_ABSENCE_THRESHOLD = 3;

@Injectable()
export class ReportsService {
  constructor(
    private prisma: PrismaService,
    private authorization: AuthorizationService,
  ) {}

  // ------------------------------------------------------------------ scope
  /**
   * Resolve the caller's visibility. Non-admin users only ever see the
   * courses they are assigned to, and the stages those courses cover.
   */
  async resolveScope(user: AuthenticatedUser): Promise<ReportScope> {
    const isAdmin = isAdministrativeRole(user.role);
    const courseIds = await this.authorization.assignedCourseIds(user);
    const stages = isAdmin ? [...ACADEMIC_STAGES] : await this.authorization.assignedStages(user);
    return { isAdmin, courseIds, stages };
  }

  /**
   * Returns the course filter to apply:
   *   - null  → no restriction (admin, no explicit filter)
   *   - [ids] → explicit request validated against the caller's assignments
   *   - []    → non-admin with nothing assigned (matches nothing)
   */
  private async scopedCourseIds(user: AuthenticatedUser, requestedCourseId?: string): Promise<string[] | null> {
    const scope = await this.resolveScope(user);
    const requested = String(requestedCourseId || '').trim();
    if (requested) {
      if (!scope.isAdmin && !scope.courseIds.includes(requested)) {
        throw new ForbiddenException('هذه المادة غير مسندة إليك');
      }
      const course = await this.prisma.course.findUnique({
        where: { id: requested },
        select: { id: true },
      });
      if (!course) throw new NotFoundException('المادة غير موجودة');
      return [requested];
    }
    return scope.isAdmin ? null : scope.courseIds;
  }

  private async scopedStage(user: AuthenticatedUser, requestedStage?: string): Promise<number | null> {
    if (requestedStage === undefined || requestedStage === '' || requestedStage === 'ALL') {
      return null;
    }
    const stage = requireAcademicStage(requestedStage);
    const scope = await this.resolveScope(user);
    if (!scope.isAdmin && !scope.stages.includes(stage)) {
      throw new ForbiddenException('هذه المرحلة خارج نطاق موادك');
    }
    return stage;
  }

  private async scopedSection(user: AuthenticatedUser, requestedSectionId?: string) {
    const requested = String(requestedSectionId || '').trim();
    if (!requested) return null;
    const section = await this.prisma.section.findUnique({
      where: { id: requested },
      select: { id: true, name: true, stage: true, studyPeriod: true, label: true },
    });
    if (!section) throw new BadRequestException('الشعبة المحددة غير موجودة');
    const scope = await this.resolveScope(user);
    if (!scope.isAdmin && !scope.stages.includes(section.stage)) {
      throw new ForbiddenException('هذه الشعبة خارج نطاق موادك');
    }
    return section;
  }

  private async scopedLecturerId(user: AuthenticatedUser, requestedLecturerId?: string): Promise<string | null> {
    const requested = String(requestedLecturerId || '').trim();
    if (!requested) return null;
    if (!isAdministrativeRole(user.role) && requested !== user.id) {
      throw new ForbiddenException('لا يمكن عرض تقارير تدريسي آخر');
    }
    return requested;
  }

  private dateRange(filters: ReportFilters): { gte?: Date; lte?: Date } | undefined {
    const range: { gte?: Date; lte?: Date } = {};
    const from = String(filters.from || '').trim();
    const to = String(filters.to || '').trim();
    if (from) {
      const date = new Date(from);
      if (Number.isNaN(date.getTime())) throw new BadRequestException('تاريخ البداية غير صالح');
      range.gte = date;
    }
    if (to) {
      const date = new Date(to);
      if (Number.isNaN(date.getTime())) throw new BadRequestException('تاريخ النهاية غير صالح');
      // End-of-day so the range is inclusive.
      date.setHours(23, 59, 59, 999);
      range.lte = date;
    }
    return Object.keys(range).length > 0 ? range : undefined;
  }

  private statusFilter(filters: ReportFilters): string | null {
    const status = String(filters.status || '').trim().toUpperCase();
    if (!status || status === 'ALL') return null;
    if (status !== 'ACTIVE' && status !== 'CLOSED') {
      throw new BadRequestException('حالة المحاضرة غير صالحة');
    }
    return status;
  }

  /**
   * Closed lectures only. Open sessions are deliberately excluded from every
   * absence statistic — an absence record is written by the close transition,
   * never by opening a lecture.
   */
  private async scopedClosedLectures(user: AuthenticatedUser, filters: ReportFilters): Promise<LectureScopeRow[]> {
    const courseIds = await this.scopedCourseIds(user, filters.courseId);
    const stage = await this.scopedStage(user, filters.stage);
    const section = await this.scopedSection(user, filters.sectionId);
    const lecturerId = await this.scopedLecturerId(user, filters.lecturerId);
    const range = this.dateRange(filters);
    const status = this.statusFilter(filters);
    const scopeStages = stage != null ? [stage] : (await this.resolveScope(user)).stages;

    const where: any = { deletedAt: null };
    if (status) where.status = status;
    if (range) where.startedAt = range;
    if (courseIds) where.courseId = { in: courseIds };
    if (lecturerId) where.conductedByUserId = lecturerId;
    if (stage != null) where.course = { stage };
    else if (!isAdministrativeRole(user.role)) where.course = { stage: { in: scopeStages } };
    if (section) {
      where.OR = [
        { sectionId: section.id },
        { lectureSections: { some: { sectionId: section.id } } },
      ];
    }

    const rows = await this.prisma.lecture.findMany({
      where,
      select: {
        id: true,
        name: true,
        status: true,
        studyPeriod: true,
        startedAt: true,
        closedAt: true,
        course: { select: { id: true, code: true, name: true, stage: true } },
        lectureSections: {
          select: { section: { select: { id: true, name: true, stage: true, studyPeriod: true } } },
        },
        conductedBy: { select: { id: true, fullName: true, staffId: true } },
        createdBy: { select: { id: true, fullName: true, staffId: true } },
      },
      orderBy: { startedAt: 'desc' },
    });

    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      status: row.status,
      studyPeriod: row.studyPeriod,
      startedAt: row.startedAt,
      closedAt: row.closedAt,
      course: row.course,
      sections: row.lectureSections.map((ls) => ls.section),
      conductedBy: row.conductedBy,
      createdBy: row.createdBy,
    }));
  }

  /**
   * Count PRESENT/ABSENT per lecture for the given lectures, excluding
   * coverage rows. When `studentIds` is provided the counts are restricted to
   * those students.
   */
  private async recordCountsByLecture(
    lectureIds: string[],
    studentIds?: string[],
  ): Promise<Map<string, { present: number; absent: number }>> {
    const result = new Map<string, { present: number; absent: number }>();
    if (lectureIds.length === 0) return result;

    const rows = await this.prisma.attendanceRecord.groupBy({
      by: ['lectureId', 'status'],
      where: {
        lectureId: { in: lectureIds },
        ...(studentIds ? { studentId: { in: studentIds } } : { studentId: { not: null } }),
        ...notCoveredWhere(),
      },
      _count: { _all: true },
    });

    for (const row of rows) {
      if (!row.lectureId) continue;
      const count = (row._count as any)?._all ?? 0;
      const entry = result.get(row.lectureId) || { present: 0, absent: 0 };
      if (row.status === 'PRESENT') entry.present += count;
      else if (row.status === 'ABSENT') entry.absent += count;
      result.set(row.lectureId, entry);
    }
    return result;
  }

  private async studentStatsById(
    lectureIds: string[],
    studentIds?: string[],
  ): Promise<Map<string, { present: number; absent: number }>> {
    const result = new Map<string, { present: number; absent: number }>();
    if (lectureIds.length === 0) return result;

    const rows = await this.prisma.attendanceRecord.groupBy({
      by: ['studentId', 'status'],
      where: {
        lectureId: { in: lectureIds },
        ...(studentIds ? { studentId: { in: studentIds } } : { studentId: { not: null } }),
        ...notCoveredWhere(),
      },
      _count: { _all: true },
    });

    for (const row of rows) {
      if (!row.studentId) continue;
      const count = (row._count as any)?._all ?? 0;
      const entry = result.get(row.studentId) || { present: 0, absent: 0 };
      if (row.status === 'PRESENT') entry.present += count;
      else if (row.status === 'ABSENT') entry.absent += count;
      result.set(row.studentId, entry);
    }
    return result;
  }

  /** Summary counters shared by every aggregated view. */
  private summarize(present: number, absent: number) {
    const total = present + absent;
    return {
      present,
      absent,
      totalCases: total,
      attendanceRate: total > 0 ? Math.round((present / total) * 100) : null,
      absenceRate: total > 0 ? Math.round((absent / total) * 100) : null,
    };
  }

  private isoWeekKey(date: Date): string {
    const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
    return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
  }

  private monthKey(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  }

  private dayKey(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }

  private buildTrend(
    lectures: LectureScopeRow[],
    counts: Map<string, { present: number; absent: number }>,
    granularity: 'day' | 'week' | 'month',
  ) {
    const keyOf = granularity === 'day' ? this.dayKey.bind(this) : granularity === 'week' ? this.isoWeekKey.bind(this) : this.monthKey.bind(this);
    const buckets = new Map<string, { present: number; absent: number; lectures: number }>();
    for (const lecture of lectures) {
      if (lecture.status !== 'CLOSED') continue;
      const bucket = keyOf(lecture.startedAt);
      const entry = buckets.get(bucket) || { present: 0, absent: 0, lectures: 0 };
      const count = counts.get(lecture.id) || { present: 0, absent: 0 };
      entry.present += count.present;
      entry.absent += count.absent;
      entry.lectures += 1;
      buckets.set(bucket, entry);
    }
    return Array.from(buckets.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([key, value]) => ({ key, ...value }));
  }

  // ---------------------------------------------------------------- options
  /** Filter dropdowns, scoped to what the caller may see. */
  async options(user: AuthenticatedUser) {
    const scope = await this.resolveScope(user);
    const [sections, courses, lecturers] = await Promise.all([
      this.prisma.section.findMany({
        where: scope.isAdmin ? {} : { stage: { in: scope.stages } },
        select: { id: true, name: true, stage: true, studyPeriod: true, label: true },
        orderBy: [{ stage: 'asc' }, { studyPeriod: 'asc' }, { name: 'asc' }],
      }),
      this.prisma.course.findMany({
        where: scope.courseIds.length > 0 ? { id: { in: scope.courseIds } } : { id: { in: [] } },
        select: { id: true, code: true, name: true, stage: true },
        orderBy: [{ stage: 'asc' }, { code: 'asc' }],
      }),
      scope.isAdmin
        ? this.prisma.staffUser.findMany({
            where: { role: { in: ['LECTURER', 'TECHNICAL_LECTURER'] }, isActive: true },
            select: { id: true, fullName: true, staffId: true, role: true },
            orderBy: { fullName: 'asc' },
          })
        : this.prisma.staffUser.findMany({
            where: { id: user.id },
            select: { id: true, fullName: true, staffId: true, role: true },
          }),
    ]);

    return {
      stages: scope.stages.map((stage) => ({ value: stage, label: STAGE_LABELS[stage as 1 | 2 | 3 | 4] })),
      sections,
      courses,
      lecturers,
    };
  }

  // -------------------------------------------------------------- dashboard
  async dashboard(user: AuthenticatedUser, filters: ReportFilters) {
    const scope = await this.resolveScope(user);
    const adminStages = [...ACADEMIC_STAGES];
    const effectiveStages = scope.stages;
    const [studentsCount, staffCount, lectures, recordsAll, coursesCount, sectionsCount] = await Promise.all([
      this.prisma.student.count({
        where: { deletedAt: null, ...(scope.isAdmin ? {} : { stage: { in: effectiveStages } }) },
      }),
      this.prisma.staffUser.count({
        where: {
          isActive: true,
          role: { in: ['LECTURER', 'TECHNICAL_LECTURER'] },
          ...(scope.isAdmin
            ? {}
            : { assignments: { some: { courseId: { in: scope.courseIds.length ? scope.courseIds : ['__none__'] } } } }),
        },
      }),
      this.scopedClosedLectures(user, filters),
      this.prisma.attendanceRecord.count({
        where: {
          ...(scope.isAdmin ? {} : { lecture: { course: { stage: { in: effectiveStages } } } }),
          ...notCoveredWhere(),
        },
      }),
      Promise.resolve(scope.courseIds.length),
      this.prisma.section.count({
        where: scope.isAdmin ? {} : { stage: { in: effectiveStages } },
      }),
    ]);

    const closed = lectures.filter((lecture) => lecture.status === 'CLOSED');
    const open = lectures.filter((lecture) => lecture.status === 'ACTIVE');
    const counts = await this.recordCountsByLecture(lectures.map((lecture) => lecture.id));

    let present = 0;
    let absent = 0;
    for (const lecture of closed) {
      const entry = counts.get(lecture.id);
      if (entry) {
        present += entry.present;
        absent += entry.absent;
      }
    }
    // Present rows of still-open sessions are informative but not absence statistics.
    let activePresent = 0;
    for (const lecture of open) {
      const entry = counts.get(lecture.id);
      if (entry) activePresent += entry.present;
    }

    const absence = this.summarize(present, absent);

    const byCourse = new Map<string, { course: LectureScopeRow['course']; present: number; absent: number; lectures: number }>();
    const bySection = new Map<string, { section: LectureScopeRow['sections'][number]; present: number; absent: number; lectures: number }>();
    for (const lecture of closed) {
      const entry = counts.get(lecture.id) || { present: 0, absent: 0 };
      if (lecture.course) {
        const key = lecture.course.id;
        const bucket = byCourse.get(key) || { course: lecture.course, present: 0, absent: 0, lectures: 0 };
        bucket.present += entry.present;
        bucket.absent += entry.absent;
        bucket.lectures += 1;
        byCourse.set(key, bucket);
      }
      for (const section of lecture.sections) {
        const key = section.id;
        const bucket = bySection.get(key) || { section, present: 0, absent: 0, lectures: 0 };
        bucket.present += entry.present;
        bucket.absent += entry.absent;
        bucket.lectures += 1;
        bySection.set(key, bucket);
      }
    }

    const courseComparison = Array.from(byCourse.values())
      .map((item) => ({ ...item, ...this.summarize(item.present, item.absent) }))
      .sort((a, b) => (b.attendanceRate ?? 0) - (a.attendanceRate ?? 0));
    const sectionComparison = Array.from(bySection.values())
      .map((item) => ({ ...item, ...this.summarize(item.present, item.absent) }))
      .sort((a, b) => a.section.name.localeCompare(b.section.name, 'ar'));

    return {
      scope: {
        isAdmin: scope.isAdmin,
        stages: effectiveStages,
        courseIds: scope.courseIds,
        appliedFilters: { ...filters, stage: filters.stage ?? null },
      },
      totals: {
        students: studentsCount,
        teachers: staffCount,
        sections: sectionsCount,
        courses: coursesCount,
        lectures: lectures.length,
        closedLectures: closed.length,
        openLectures: open.length,
        attendanceRecords: recordsAll,
        activePresent,
        ...absence,
      },
      trendDaily: this.buildTrend(lectures, counts, 'day'),
      trendWeekly: this.buildTrend(lectures, counts, 'week'),
      trendMonthly: this.buildTrend(lectures, counts, 'month'),
      courseComparison,
      sectionComparison,
      stages: this.stageComparison(closed, counts),
    };
  }

  private stageComparison(
    lectures: LectureScopeRow[],
    counts: Map<string, { present: number; absent: number }>,
  ) {
    const byStage = new Map<number, { stage: number; present: number; absent: number; lectures: number }>();
    for (const lecture of lectures) {
      const entry = counts.get(lecture.id) || { present: 0, absent: 0 };
      const stage = lecture.course?.stage;
      if (!stage) continue;
      const bucket = byStage.get(stage) || { stage, present: 0, absent: 0, lectures: 0 };
      bucket.present += entry.present;
      bucket.absent += entry.absent;
      bucket.lectures += 1;
      byStage.set(stage, bucket);
    }
    return Array.from(byStage.values())
      .map((item) => ({ ...item, label: STAGE_LABELS[item.stage as 1 | 2 | 3 | 4], ...this.summarize(item.present, item.absent) }))
      .sort((a, b) => a.stage - b.stage);
  }

  // --------------------------------------------------------------- students
  private studentSearchWhere(search?: string) {
    const term = String(search || '').trim();
    if (!term) return {};
    return {
      OR: [
        { name: { contains: term, mode: 'insensitive' as const } },
        { studentCode: { contains: term, mode: 'insensitive' as const } },
      ],
    };
  }

  /** Students required to take a course of the selected stage (or scope). */
  private async carryOverStudentIdsForStage(
    stage: number | null,
    scope: ReportScope,
  ): Promise<string[]> {
    // An admin with no stage filter already sees every student.
    if (stage == null && scope.isAdmin) return [];
    const courses = await this.prisma.course.findMany({
      where: stage != null ? { stage } : { id: { in: scope.courseIds } },
      select: { id: true },
    });
    if (courses.length === 0) return [];
    const courseIds = new Set(courses.map((course) => course.id));

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
          parsed.courseIds.some((courseId: string) => courseIds.has(courseId))
        ) {
          ids.push(setting.key.replace('STUDENT_COURSES_', ''));
        }
      } catch {}
    }
    return ids;
  }

  private async studentScopeWhere(user: AuthenticatedUser, filters: ReportFilters) {
    const scope = await this.resolveScope(user);
    const stage = await this.scopedStage(user, filters.stage);
    const section = await this.scopedSection(user, filters.sectionId);
    const carryOverIds = await this.carryOverStudentIdsForStage(stage, scope);

    const where: any = { deletedAt: null };
    const and: any[] = [];

    const stageCondition: any =
      stage != null
        ? { stage }
        : !scope.isAdmin
          ? { stage: { in: scope.stages } }
          : null;
    if (stageCondition) {
      and.push(
        carryOverIds.length > 0
          ? { OR: [stageCondition, { id: { in: carryOverIds } }] }
          : stageCondition,
      );
    }

    if (section) {
      const matches: any[] = [
        { sectionId: section.id },
        { sectionId: null, section: section.name },
      ];
      // Cross-stage sections share a number but not a row.
      if (carryOverIds.length > 0) {
        matches.push({ id: { in: carryOverIds }, section: section.name });
      }
      and.push({ OR: matches });
    }

    const search = this.studentSearchWhere(filters.search);
    if ('OR' in search) and.push(search);

    if (and.length > 0) where.AND = and;
    return where;
  }

  async students(user: AuthenticatedUser, filters: ReportFilters) {
    const lectures = await this.scopedClosedLectures(user, filters);
    const closedIds = lectures.filter((l) => l.status === 'CLOSED').map((l) => l.id);

    const where = await this.studentScopeWhere(user, filters);

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
        orderIndex: true,
        sectionRef: { select: { label: true, name: true } },
      },
      orderBy: [{ orderIndex: 'asc' }, { studentCode: 'asc' }],
    });

    const studentIds = rows.map((row) => row.id);
    const stats = await this.studentStatsById(closedIds, studentIds);

    const items = rows.map((row) => {
      const entry = stats.get(row.id) || { present: 0, absent: 0 };
      const summary = this.summarize(entry.present, entry.absent);
      return {
        id: row.id,
        studentCode: row.studentCode,
        name: row.name,
        stage: row.stage,
        stageLabel: STAGE_LABELS[row.stage as 1 | 2 | 3 | 4] || `المرحلة ${row.stage}`,
        studyPeriod: row.studyPeriod,
        section: row.section,
        sectionId: row.sectionId,
        sectionLabel: row.sectionRef?.label || row.sectionRef?.name || row.section || null,
        orderIndex: row.orderIndex,
        ...summary,
      };
    });

    const sort = String(filters.sort || 'name');
    items.sort((a, b) => {
      switch (sort) {
        case 'attendanceRate_asc':
          return (a.attendanceRate ?? -1) - (b.attendanceRate ?? -1);
        case 'attendanceRate_desc':
          return (b.attendanceRate ?? -1) - (a.attendanceRate ?? -1);
        case 'absenceRate_asc':
          return (a.absenceRate ?? -1) - (b.absenceRate ?? -1);
        case 'absenceRate_desc':
          return (b.absenceRate ?? -1) - (a.absenceRate ?? -1);
        case 'absentCount_desc':
          return b.absent - a.absent;
        case 'studentCode':
          return (a.studentCode || '').localeCompare(b.studentCode || '', 'ar');
        case 'name':
        default:
          return (a.name || '').localeCompare(b.name || '', 'ar');
      }
    });

    const pageSize = Math.min(Math.max(Number(filters.pageSize) || 25, 1), 100);
    const total = items.length;
    const totalPages = Math.max(Math.ceil(total / pageSize), 1);
    const page = Math.min(Math.max(Number(filters.page) || 1, 1), totalPages);

    const totals = items.reduce(
      (acc, item) => {
        acc.present += item.present;
        acc.absent += item.absent;
        return acc;
      },
      { present: 0, absent: 0 },
    );

    return {
      items: items.slice((page - 1) * pageSize, page * pageSize),
      pagination: { page, pageSize, total, totalPages },
      totals: { ...totals, ...this.summarize(totals.present, totals.absent), students: total },
      lecturesInScope: closedIds.length,
    };
  }

  async studentDetail(user: AuthenticatedUser, studentId: string, filters: ReportFilters) {
    const lectures = await this.scopedClosedLectures(user, filters);
    const closedIds = lectures.filter((l) => l.status === 'CLOSED').map((l) => l.id);
    const closedIdSet = new Set(closedIds);
    const scope = await this.resolveScope(user);

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
        orderIndex: true,
        sectionRef: { select: { label: true, name: true } },
      },
    });

    if (!student) throw new NotFoundException('الطالب غير موجود');
    if (!scope.isAdmin && !scope.stages.includes(student.stage)) {
      throw new NotFoundException('الطالب غير موجود ضمن نطاق موادك');
    }
    const section = await this.scopedSection(user, filters.sectionId);
    if (section) {
      const matches =
        student.sectionId === section.id ||
        (student.sectionId === null &&
          normalizeSection(student.section) === normalizeSection(section.name));
      if (!matches) {
        throw new NotFoundException('الطالب غير موجود ضمن نطاق موادك');
      }
    }

    const records = closedIds.length
      ? await this.prisma.attendanceRecord.findMany({
          where: {
            studentId: student.id,
            lectureId: { in: closedIds },
          },
          select: {
            id: true,
            lectureId: true,
            status: true,
            note: true,
            registeredAt: true,
          },
        })
      : [];

    const recordsByLecture = new Map(records.map((record) => [record.lectureId, record]));
    const detail = lectures
      .filter((lecture) => closedIdSet.has(lecture.id))
      .map((lecture) => {
        const record = recordsByLecture.get(lecture.id) || null;
        return {
          lectureId: lecture.id,
          lectureName: lecture.name,
          lectureDate: lecture.startedAt,
          closedAt: lecture.closedAt,
          courseId: lecture.course?.id || null,
          courseCode: lecture.course?.code || null,
          courseName: lecture.course?.name || null,
          stage: lecture.course?.stage ?? null,
          sections: lecture.sections.map((s) => s.name),
          conductedBy: lecture.conductedBy?.fullName || null,
          createdBy: lecture.createdBy?.fullName || null,
          studyPeriod: lecture.studyPeriod,
          status: record?.status || null,
          note: record?.note || null,
          registeredAt: record?.registeredAt || null,
        };
      });

    const statsRecords = records.filter(
      (record) => !record.note || !record.note.startsWith(COVER_NOTE_PREFIX),
    );
    const present = statsRecords.filter((record) => record.status === 'PRESENT').length;
    const absent = statsRecords.filter((record) => record.status === 'ABSENT').length;

    return {
      student: {
        id: student.id,
        studentCode: student.studentCode,
        name: student.name,
        stage: student.stage,
        stageLabel: STAGE_LABELS[student.stage as 1 | 2 | 3 | 4] || `المرحلة ${student.stage}`,
        studyPeriod: student.studyPeriod,
        section: student.section,
        sectionLabel: student.sectionRef?.label || student.sectionRef?.name || student.section || null,
      },
      stats: this.summarize(present, absent),
      lectures: detail,
      totalLectures: detail.length,
    };
  }

  // ---------------------------------------------------------------- courses
  async courses(user: AuthenticatedUser, filters: ReportFilters) {
    const lectures = await this.scopedClosedLectures(user, filters);
    const closed = lectures.filter((lecture) => lecture.status === 'CLOSED');
    const counts = await this.recordCountsByLecture(closed.map((lecture) => lecture.id));

    const courseIds = await this.scopedCourseIds(user, filters.courseId);
    const courses = await this.prisma.course.findMany({
      where: courseIds ? { id: { in: courseIds } } : {},
      select: { id: true, code: true, name: true, stage: true },
      orderBy: [{ stage: 'asc' }, { code: 'asc' }],
    });

    const byCourse = new Map<string, { course: (typeof courses)[number]; present: number; absent: number; lectures: number }>();
    for (const lecture of closed) {
      if (!lecture.course) continue;
      const entry = counts.get(lecture.id) || { present: 0, absent: 0 };
      const bucket = byCourse.get(lecture.course.id) || { course: lecture.course, present: 0, absent: 0, lectures: 0 };
      bucket.present += entry.present;
      bucket.absent += entry.absent;
      bucket.lectures += 1;
      byCourse.set(lecture.course.id, bucket);
    }

    const items = courses.map((course) => {
      const bucket = byCourse.get(course.id) || { present: 0, absent: 0, lectures: 0 };
      return {
        ...course,
        closedLectures: bucket.lectures,
        ...this.summarize(bucket.present, bucket.absent),
      };
    });

    const totals = {
      courses: items.length,
      closedLectures: items.reduce((sum, item) => sum + item.closedLectures, 0),
      ...this.summarize(
        items.reduce((sum, item) => sum + item.present, 0),
        items.reduce((sum, item) => sum + item.absent, 0),
      ),
    };

    return { items, totals };
  }

  /** Per-course student-level statistics (used by the drill-down view). */
  async courseStudents(user: AuthenticatedUser, courseId: string, filters: ReportFilters) {
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
      select: { id: true, code: true, name: true, stage: true },
    });
    if (!course) throw new NotFoundException('المادة غير موجودة');
    // Null means "unrestricted" (admin); an array was already validated above.
    await this.scopedCourseIds(user, courseId);

    const merged = { ...filters, courseId, stage: String(course.stage) };
    const lectures = (await this.scopedClosedLectures(user, merged)).filter(
      (lecture) => lecture.status === 'CLOSED',
    );
    const closedIds = lectures.map((lecture) => lecture.id);

    const stage = course.stage;
    const where = await this.studentScopeWhere(user, { ...merged, sectionId: filters.sectionId });
    where.stage = stage;

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
            if (parsed.courseIds.includes(courseId)) {
              carryOverStudentIds.push(studentId);
            } else {
              excludedRepeatingStudentIds.add(studentId);
            }
          }
        }
      } catch {}
    }

    if (excludedRepeatingStudentIds.size > 0) {
      where.id = { notIn: Array.from(excludedRepeatingStudentIds) };
    }

    let initialRows = await this.prisma.student.findMany({
      where,
      select: {
        id: true,
        studentCode: true,
        name: true,
        stage: true,
        studyPeriod: true,
        section: true,
        orderIndex: true,
        sectionRef: { select: { label: true, name: true } },
      },
      orderBy: [{ orderIndex: 'asc' }, { studentCode: 'asc' }],
    });

    if (carryOverStudentIds.length > 0) {
      const existingIds = new Set(initialRows.map((r) => r.id));
      const neededCarryOverIds = carryOverStudentIds.filter((cid) => !existingIds.has(cid));
      if (neededCarryOverIds.length > 0) {
        const carryOverWhere: any = {
          id: { in: neededCarryOverIds },
          deletedAt: null,
        };
        if (filters.sectionId) carryOverWhere.sectionId = filters.sectionId;

        const carryOverRows = await this.prisma.student.findMany({
          where: carryOverWhere,
          select: {
            id: true,
            studentCode: true,
            name: true,
            stage: true,
            studyPeriod: true,
            section: true,
            orderIndex: true,
            sectionRef: { select: { label: true, name: true } },
          },
          orderBy: [{ orderIndex: 'asc' }, { studentCode: 'asc' }],
        });
        initialRows = initialRows.concat(carryOverRows);
      }
    }

    const rows = initialRows;

    const stats = await this.studentStatsById(closedIds, rows.map((row) => row.id));

    const items = rows.map((row) => {
      const entry = stats.get(row.id) || { present: 0, absent: 0 };
      return {
        id: row.id,
        studentCode: row.studentCode,
        name: row.name,
        stage: row.stage,
        studyPeriod: row.studyPeriod,
        section: row.section,
        sectionLabel: row.sectionRef?.label || row.sectionRef?.name || row.section || null,
        ...this.summarize(entry.present, entry.absent),
      };
    });

    const totals = items.reduce(
      (acc, item) => ({ present: acc.present + item.present, absent: acc.absent + item.absent }),
      { present: 0, absent: 0 },
    );

    return {
      course: {
        ...course,
        stageLabel: STAGE_LABELS[course.stage as 1 | 2 | 3 | 4] || `المرحلة ${course.stage}`,
      },
      lecturesInScope: closedIds.length,
      items,
      totals: { students: items.length, ...totals, ...this.summarize(totals.present, totals.absent) },
    };
  }

  // -------------------------------------------------------------- lecturers
  async lecturers(user: AuthenticatedUser, filters: ReportFilters) {
    const scopedId = await this.scopedLecturerId(user, filters.lecturerId);
    const scope = await this.resolveScope(user);
    const isAdmin = scope.isAdmin;

    const staff = await this.prisma.staffUser.findMany({
      where: {
        isActive: true,
        role: { in: ['LECTURER', 'TECHNICAL_LECTURER'] },
        ...(scopedId ? { id: scopedId } : isAdmin ? {} : { id: user.id }),
      },
      select: { id: true, fullName: true, staffId: true, role: true },
      orderBy: { fullName: 'asc' },
    });

    const lectures = await this.scopedClosedLectures(user, filters);
    const conducted = lectures.filter(
      (lecture) => lecture.status === 'CLOSED' && lecture.conductedBy != null,
    );
    const counts = await this.recordCountsByLecture(conducted.map((lecture) => lecture.id));

    const assignments = scope.isAdmin
      ? await this.prisma.teachingAssignment.findMany({
          select: { staffUserId: true, course: { select: { id: true, code: true, name: true, stage: true } } },
        })
      : await this.prisma.teachingAssignment.findMany({
          where: { staffUserId: user.id, courseId: { in: scope.courseIds.length ? scope.courseIds : ['__none__'] } },
          select: { staffUserId: true, course: { select: { id: true, code: true, name: true, stage: true } } },
        });
    const assignedByStaff = new Map<string, Array<{ id: string; code: string; name: string; stage: number }>>();
    for (const assignment of assignments) {
      const list = assignedByStaff.get(assignment.staffUserId) || [];
      list.push(assignment.course);
      assignedByStaff.set(assignment.staffUserId, list);
    }

    const items = staff.map((member) => {
      const mine = conducted.filter((lecture) => lecture.conductedBy?.id === member.id);
      const totals = mine.reduce(
        (acc, lecture) => {
          const entry = counts.get(lecture.id) || { present: 0, absent: 0 };
          acc.present += entry.present;
          acc.absent += entry.absent;
          return acc;
        },
        { present: 0, absent: 0 },
      );
      return {
        id: member.id,
        fullName: member.fullName,
        staffId: member.staffId,
        role: member.role,
        assignments: assignedByStaff.get(member.id) || [],
        conductedLectures: mine.length,
        ...totals,
        ...this.summarize(totals.present, totals.absent),
      };
    });

    const totals = items.reduce(
      (acc, item) => ({
        conductedLectures: acc.conductedLectures + item.conductedLectures,
        present: acc.present + item.present,
        absent: acc.absent + item.absent,
      }),
      { conductedLectures: 0, present: 0, absent: 0 },
    );

    return {
      items,
      totals: { lecturers: items.length, ...totals, ...this.summarize(totals.present, totals.absent) },
    };
  }

  async lecturerDetail(user: AuthenticatedUser, lecturerId: string, filters: ReportFilters) {
    const scopedId = await this.scopedLecturerId(user, lecturerId); // enforces self-or-admin
    const lecturer = await this.prisma.staffUser.findUnique({
      where: { id: scopedId! },
      select: { id: true, fullName: true, staffId: true, role: true, isActive: true },
    });
    if (!lecturer) throw new NotFoundException('المدرس غير موجود');

    const scope = await this.resolveScope(user);
    const merged = { ...filters, lecturerId: lecturer.id };
    const lectures = (await this.scopedClosedLectures(user, merged)).filter(
      (lecture) => lecture.status === 'CLOSED',
    );
    const counts = await this.recordCountsByLecture(lectures.map((lecture) => lecture.id));

    const assignments = await this.prisma.teachingAssignment.findMany({
      where: {
        staffUserId: lecturer.id,
        ...(scope.isAdmin ? {} : { courseId: { in: scope.courseIds } }),
      },
      select: { course: { select: { id: true, code: true, name: true, stage: true } } },
    });

    const detail = lectures.map((lecture) => {
      const entry = counts.get(lecture.id) || { present: 0, absent: 0 };
      return {
        id: lecture.id,
        name: lecture.name,
        lectureDate: lecture.startedAt,
        courseCode: lecture.course?.code || null,
        courseName: lecture.course?.name || null,
        stage: lecture.course?.stage ?? null,
        sections: lecture.sections.map((s) => s.name),
        studyPeriod: lecture.studyPeriod,
        ...this.summarize(entry.present, entry.absent),
      };
    });

    const totals = detail.reduce(
      (acc, row) => ({ present: acc.present + row.present, absent: acc.absent + row.absent }),
      { present: 0, absent: 0 },
    );

    return {
      lecturer,
      assignments: assignments.map((a) => a.course),
      lectures: detail,
      totals: {
        conductedLectures: detail.length,
        studentsPresent: totals.present,
        studentsAbsent: totals.absent,
        ...this.summarize(totals.present, totals.absent),
      },
    };
  }

  // ------------------------------------------------------------- sections
  async sections(user: AuthenticatedUser, filters: ReportFilters) {
    const scope = await this.resolveScope(user);
    const stage = await this.scopedStage(user, filters.stage);
    const lectures = await this.scopedClosedLectures(user, filters);
    const closed = lectures.filter((lecture) => lecture.status === 'CLOSED');
    const counts = await this.recordCountsByLecture(closed.map((lecture) => lecture.id));

    const sections = await this.prisma.section.findMany({
      where: {
        ...(stage != null ? { stage } : scope.isAdmin ? {} : { stage: { in: scope.stages } }),
      },
      select: { id: true, name: true, stage: true, studyPeriod: true, label: true },
      orderBy: [{ stage: 'asc' }, { studyPeriod: 'asc' }, { name: 'asc' }],
    });

    const countsAll = await Promise.all(
      sections.map((section) =>
        this.prisma.student.count({
          where: {
            deletedAt: null,
            stage: section.stage,
            OR: [{ sectionId: section.id }, { sectionId: null, section: section.name }],
          },
        }),
      ),
    );

    const items = sections.map((section, index) => {
      const sectionClosed = closed.filter((lecture) =>
        lecture.sections.some((s) => s.id === section.id),
      );
      const totals = sectionClosed.reduce(
        (acc, lecture) => {
          const entry = counts.get(lecture.id) || { present: 0, absent: 0 };
          acc.present += entry.present;
          acc.absent += entry.absent;
          return acc;
        },
        { present: 0, absent: 0 },
      );
      return {
        id: section.id,
        name: section.name,
        label: section.label,
        stage: section.stage,
        stageLabel: STAGE_LABELS[section.stage as 1 | 2 | 3 | 4] || `المرحلة ${section.stage}`,
        studyPeriod: section.studyPeriod,
        students: countsAll[index],
        closedLectures: sectionClosed.length,
        ...totals,
        ...this.summarize(totals.present, totals.absent),
      };
    });

    const totals = items.reduce(
      (acc, item) => ({
        students: acc.students + item.students,
        closedLectures: acc.closedLectures + item.closedLectures,
        present: acc.present + item.present,
        absent: acc.absent + item.absent,
      }),
      { students: 0, closedLectures: 0, present: 0, absent: 0 },
    );

    return {
      items,
      totals: {
        sections: items.length,
        ...totals,
        ...this.summarize(totals.present, totals.absent),
      },
    };
  }

  // ---------------------------------------------------------------- stages
  async stages(user: AuthenticatedUser, filters: ReportFilters) {
    const scope = await this.resolveScope(user);
    const lectures = await this.scopedClosedLectures(user, filters);
    const closed = lectures.filter((lecture) => lecture.status === 'CLOSED');
    const counts = await this.recordCountsByLecture(closed.map((lecture) => lecture.id));

    const stageNumbers = scope.stages;
    const studentsByStage = await Promise.all(
      stageNumbers.map((stage) =>
        this.prisma.student.count({ where: { deletedAt: null, stage } }),
      ),
    );
    const sectionsByStage = await Promise.all(
      stageNumbers.map((stage) => this.prisma.section.count({ where: { stage } })),
    );
    const coursesByStage = await Promise.all(
      stageNumbers.map((stage) =>
        this.prisma.course.count({
          where: scope.isAdmin ? { stage } : { stage, id: { in: scope.courseIds } },
        }),
      ),
    );

    const items = stageNumbers.map((stage, index) => {
      const stageClosed = closed.filter((lecture) => lecture.course?.stage === stage);
      const totals = stageClosed.reduce(
        (acc, lecture) => {
          const entry = counts.get(lecture.id) || { present: 0, absent: 0 };
          acc.present += entry.present;
          acc.absent += entry.absent;
          return acc;
        },
        { present: 0, absent: 0 },
      );
      return {
        stage,
        label: STAGE_LABELS[stage as 1 | 2 | 3 | 4] || `المرحلة ${stage}`,
        students: studentsByStage[index],
        sections: sectionsByStage[index],
        courses: coursesByStage[index],
        closedLectures: stageClosed.length,
        ...totals,
        ...this.summarize(totals.present, totals.absent),
      };
    });

    return { items };
  }

  // ------------------------------------------------------------- absentees
  private async absenceThreshold(user: AuthenticatedUser, requested?: string) {
    const raw = String(requested || '').trim();
    if (raw) {
      const parsed = Number(raw);
      if (!Number.isFinite(parsed) || parsed < 1 || parsed > 50) {
        throw new BadRequestException('حد الغياب غير صالح (1–50)');
      }
      return { threshold: Math.floor(parsed), source: 'param' as const };
    }
    const setting = await this.prisma.systemSetting.findUnique({
      where: { key: 'ABSENCE_ALERT_THRESHOLD' },
    });
    const parsed = setting ? Number(setting.value) : NaN;
    if (Number.isFinite(parsed) && parsed >= 1 && parsed <= 50) {
      return { threshold: Math.floor(parsed), source: 'setting' as const };
    }
    return { threshold: DEFAULT_ABSENCE_THRESHOLD, source: 'default' as const };
  }

  /** Students who exceeded the absence alert threshold (and those one away). */
  async absentees(user: AuthenticatedUser, filters: ReportFilters) {
    const { threshold, source } = await this.absenceThreshold(user, filters.threshold);
    const lectures = await this.scopedClosedLectures(user, filters);
    const closedIds = lectures.filter((lecture) => lecture.status === 'CLOSED').map((lecture) => lecture.id);

    const where = await this.studentScopeWhere(user, filters);
    const students = await this.prisma.student.findMany({
      where,
      select: {
        id: true,
        studentCode: true,
        name: true,
        stage: true,
        studyPeriod: true,
        section: true,
        orderIndex: true,
        sectionRef: { select: { label: true, name: true } },
      },
    });
    const studentIds = students.map((s) => s.id);
    const stats = await this.studentStatsById(closedIds, studentIds);

    const items = students
      .map((row) => {
        const entry = stats.get(row.id) || { present: 0, absent: 0 };
        const summary = this.summarize(entry.present, entry.absent);
        const status =
          entry.absent >= threshold
            ? ('EXCEEDED' as const)
            : entry.absent === threshold - 1
              ? ('WARNING' as const)
              : null;
        return {
          id: row.id,
          studentCode: row.studentCode,
          name: row.name,
          stage: row.stage,
          stageLabel: STAGE_LABELS[row.stage as 1 | 2 | 3 | 4] || `المرحلة ${row.stage}`,
          studyPeriod: row.studyPeriod,
          section: row.section,
          sectionLabel: row.sectionRef?.label || row.sectionRef?.name || row.section || null,
          absentCount: entry.absent,
          presentCount: entry.present,
          status,
          ...summary,
        };
      })
      .filter((item) => item.status !== null)
      .sort((a, b) => b.absentCount - a.absentCount || a.name.localeCompare(b.name, 'ar'));

    const pageSize = Math.min(Math.max(Number(filters.pageSize) || 25, 1), 100);
    const total = items.length;
    const totalPages = Math.max(Math.ceil(total / pageSize), 1);
    const page = Math.min(Math.max(Number(filters.page) || 1, 1), totalPages);

    return {
      threshold,
      thresholdSource: source,
      exceeded: items.filter((item) => item.status === 'EXCEEDED').length,
      warning: items.filter((item) => item.status === 'WARNING').length,
      items: items.slice((page - 1) * pageSize, page * pageSize),
      pagination: { page, pageSize, total, totalPages },
    };
  }
}

