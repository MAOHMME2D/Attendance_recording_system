import { Controller, Get, Param, Query } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { PERMISSIONS } from '../../common/constants/roles';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';

/**
 * Advanced reporting & statistics. Every route is read-only and behind the
 * REPORTS_VIEW permission; data is additionally scoped to the caller's
 * assigned courses/stages inside the service (Phase 2 scope rules).
 */
@Controller('reports')
export class ReportsController {
  constructor(private reportsService: ReportsService) {}

  private filters(query: Record<string, string | undefined>) {
    return {
      from: query.from,
      to: query.to,
      stage: query.stage,
      sectionId: query.sectionId,
      courseId: query.courseId,
      lecturerId: query.lecturerId,
      status: query.status,
      search: query.search,
      sort: query.sort,
      page: query.page,
      pageSize: query.pageSize,
      threshold: query.threshold,
    };
  }

  @Get('options')
  @RequirePermissions(PERMISSIONS.REPORTS_VIEW)
  options(@CurrentUser() user: AuthenticatedUser) {
    return this.reportsService.options(user);
  }

  @Get('dashboard')
  @RequirePermissions(PERMISSIONS.REPORTS_VIEW)
  dashboard(@CurrentUser() user: AuthenticatedUser, @Query() query: Record<string, string>) {
    return this.reportsService.dashboard(user, this.filters(query));
  }

  @Get('students')
  @RequirePermissions(PERMISSIONS.REPORTS_VIEW)
  students(@CurrentUser() user: AuthenticatedUser, @Query() query: Record<string, string>) {
    return this.reportsService.students(user, this.filters(query));
  }

  @Get('students/:id')
  @RequirePermissions(PERMISSIONS.REPORTS_VIEW)
  studentDetail(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') studentId: string,
    @Query() query: Record<string, string>,
  ) {
    return this.reportsService.studentDetail(user, studentId, this.filters(query));
  }

  @Get('courses')
  @RequirePermissions(PERMISSIONS.REPORTS_VIEW)
  courses(@CurrentUser() user: AuthenticatedUser, @Query() query: Record<string, string>) {
    return this.reportsService.courses(user, this.filters(query));
  }

  @Get('courses/:id/students')
  @RequirePermissions(PERMISSIONS.REPORTS_VIEW)
  courseStudents(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') courseId: string,
    @Query() query: Record<string, string>,
  ) {
    return this.reportsService.courseStudents(user, courseId, this.filters(query));
  }

  @Get('lecturers')
  @RequirePermissions(PERMISSIONS.REPORTS_VIEW)
  lecturers(@CurrentUser() user: AuthenticatedUser, @Query() query: Record<string, string>) {
    return this.reportsService.lecturers(user, this.filters(query));
  }

  @Get('lecturers/:id')
  @RequirePermissions(PERMISSIONS.REPORTS_VIEW)
  lecturerDetail(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') lecturerId: string,
    @Query() query: Record<string, string>,
  ) {
    return this.reportsService.lecturerDetail(user, lecturerId, this.filters(query));
  }

  @Get('sections')
  @RequirePermissions(PERMISSIONS.REPORTS_VIEW)
  sections(@CurrentUser() user: AuthenticatedUser, @Query() query: Record<string, string>) {
    return this.reportsService.sections(user, this.filters(query));
  }

  @Get('stages')
  @RequirePermissions(PERMISSIONS.REPORTS_VIEW)
  stages(@CurrentUser() user: AuthenticatedUser, @Query() query: Record<string, string>) {
    return this.reportsService.stages(user, this.filters(query));
  }

  @Get('absentees')
  @RequirePermissions(PERMISSIONS.REPORTS_VIEW)
  absentees(@CurrentUser() user: AuthenticatedUser, @Query() query: Record<string, string>) {
    return this.reportsService.absentees(user, this.filters(query));
  }
}
