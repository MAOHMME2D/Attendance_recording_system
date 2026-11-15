import {
  Controller,
  Post,
  Body,
  Get,
  Patch,
  Param,
  GoneException,
} from '@nestjs/common';
import { AttendanceService } from './attendance.service';
import { ScanStudentDto } from './dto/scan-student.dto';
import { AddManualAttendanceDto } from './dto/add-manual-attendance.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { PERMISSIONS } from '../../common/constants/roles';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';

@Controller('attendance')
export class AttendanceController {
  constructor(private attendanceService: AttendanceService) {}

  /**
   * Student self check-in has been disabled in Phase 1: students have no
   * accounts and no direct website access. Attendance is recorded only by an
   * authenticated lecturer scanning the student's card.
   */
  @Public()
  @Post('register')
  async register() {
    throw new GoneException(
      'تسجيل الحضور الذاتي للطلاب معطّل. يتم تسجيل الحضور بواسطة المحاضر عبر مسح البطاقة.',
    );
  }

  /** Get attendance list for a lecture (actor must own/conduct it). */
  @Get(':lectureId')
  @RequirePermissions(PERMISSIONS.LECTURE_CONDUCT)
  async getByLecture(
    @Param('lectureId') lectureId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.attendanceService.getByLecture(lectureId, user);
  }

  /** Toggle a student's status (PRESENT ↔ ABSENT). */
  @Patch(':id/toggle')
  @RequirePermissions(PERMISSIONS.ATTENDANCE_MANUAL)
  async toggleStatus(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.attendanceService.toggleStatus(id, user);
  }

  /** Scan a student card. Only active opaque QR tokens are accepted. */
  @Post(':lectureId/scan-student')
  @RequirePermissions(PERMISSIONS.LECTURE_CONDUCT)
  async scanStudent(
    @Param('lectureId') lectureId: string,
    @Body() body: ScanStudentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.attendanceService.scanStudent(lectureId, body.studentCode, user);
  }

  /** Manually add a student to a lecture's attendance list. */
  @Post(':lectureId/manual')
  @RequirePermissions(PERMISSIONS.ATTENDANCE_MANUAL)
  async addManual(
    @Param('lectureId') lectureId: string,
    @Body() body: AddManualAttendanceDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.attendanceService.addManual(
      lectureId,
      body.studentName,
      body.status || 'ABSENT',
      user,
    );
  }
}
