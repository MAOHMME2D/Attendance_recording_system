import { Controller, Get, Param, Query } from '@nestjs/common';
import { FollowupService } from './followup.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { PERMISSIONS } from '../../common/constants/roles';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';

/**
 * Read-only student follow-up for lecturers and technical lecturers.
 * Every route is GET; there is intentionally no write endpoint here.
 */
@Controller('followup')
export class FollowupController {
  constructor(private followupService: FollowupService) {}

  @Get('overview')
  @RequirePermissions(PERMISSIONS.STUDENT_FOLLOWUP_VIEW)
  async overview(
    @CurrentUser() user: AuthenticatedUser,
    @Query('courseId') courseId?: string,
    @Query('sectionId') sectionId?: string,
    @Query('stage') stage?: string,
    @Query('search') search?: string,
  ) {
    return this.followupService.overview(user, {
      courseId,
      sectionId,
      stage,
      search,
    });
  }

  @Get('students')
  @RequirePermissions(PERMISSIONS.STUDENT_FOLLOWUP_VIEW)
  async students(
    @CurrentUser() user: AuthenticatedUser,
    @Query('courseId') courseId?: string,
    @Query('sectionId') sectionId?: string,
    @Query('stage') stage?: string,
    @Query('search') search?: string,
    @Query('sort') sort?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.followupService.students(user, {
      courseId,
      sectionId,
      stage,
      search,
      sort,
      page,
      pageSize,
    });
  }

  @Get('students/:studentId')
  @RequirePermissions(PERMISSIONS.STUDENT_FOLLOWUP_VIEW)
  async studentDetail(
    @CurrentUser() user: AuthenticatedUser,
    @Param('studentId') studentId: string,
    @Query('courseId') courseId?: string,
    @Query('sectionId') sectionId?: string,
    @Query('stage') stage?: string,
  ) {
    return this.followupService.studentDetail(user, studentId, {
      courseId,
      sectionId,
      stage,
    });
  }
}
