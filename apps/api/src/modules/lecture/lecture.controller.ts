import {
  Controller,
  Post,
  Body,
  Get,
  Patch,
  Param,
  Delete,
  Query,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { LectureService } from './lecture.service';
import { CreateLectureDto } from './dto/create-lecture.dto';
import { ValidateQrDto } from './dto/validate-qr.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { PERMISSIONS } from '../../common/constants/roles';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';

function clientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (Array.isArray(forwarded)) return forwarded[0] || '';
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0].trim();
  }
  return req.ip || req.socket.remoteAddress || '';
}

@Controller('lectures')
export class LectureController {
  constructor(private lectureService: LectureService) {}

  /** Create a lecture; the creator is recorded as the conducting lecturer. */
  @Post()
  @RequirePermissions(PERMISSIONS.LECTURE_CREATE)
  async createLecture(
    @Body() body: CreateLectureDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.lectureService.createLecture(
      body.name,
      body.studyPeriod,
      body.section,
      body.courseId,
      user,
      body.sectionId,
      body.sectionIds,
    );
  }

  /** Get the active lecture visible to the signed-in staff member. */
  @Get('active/current')
  @RequirePermissions(PERMISSIONS.LECTURE_CONDUCT)
  async getActiveLecture(@CurrentUser() user: AuthenticatedUser) {
    return this.lectureService.getActiveLecture(user);
  }

  /** Get all lectures visible to the actor (scoped for lecturers/technicians). */
  @Get()
  @RequirePermissions(PERMISSIONS.LECTURE_CONDUCT)
  async getAllLectures(@CurrentUser() user: AuthenticatedUser) {
    return this.lectureService.getAllLectures(user);
  }

  /** Validate a QR token; access to the owning lecture is enforced. */
  @Post('validate-qr')
  @RequirePermissions(PERMISSIONS.LECTURE_CONDUCT)
  async validateQr(
    @Body() body: ValidateQrDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.lectureService.validateQrToken(body.token, user);
  }

  /** Get a specific lecture. */
  @Get(':id')
  @RequirePermissions(PERMISSIONS.LECTURE_CONDUCT)
  async getLecture(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.lectureService.getLecture(id, user);
  }

  /** Close a lecture owned/conducted by the actor. */
  @Patch(':id/close')
  @RequirePermissions(PERMISSIONS.LECTURE_CONDUCT)
  async closeLecture(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.lectureService.closeLecture(id, user, clientIp(req));
  }

  /**
   * Delete a lecture (administrative only).
   * By default the lecture is archived (attendance history preserved). Pass
   * ?permanent=true to permanently delete the lecture and its attendance
   * records; this cannot be undone.
   */
  @Delete(':id')
  @RequirePermissions(PERMISSIONS.LECTURE_DELETE)
  async deleteLecture(
    @Param('id') id: string,
    @Query('permanent') permanent: string | undefined,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.lectureService.deleteLecture(id, user, clientIp(req), permanent === 'true');
  }
}
