import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { TimetableService } from './timetable.service';
import { CreateTimetableEntryDto } from './dto/create-timetable-entry.dto';
import { UpdateTimetableEntryDto } from './dto/update-timetable-entry.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { PERMISSIONS } from '../../common/constants/roles';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';

@Controller('timetable')
export class TimetableController {
  constructor(private timetableService: TimetableService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.TIMETABLE_VIEW)
  async getAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query('courseId') courseId?: string,
    @Query('sectionId') sectionId?: string,
    @Query('dayOfWeek') dayOfWeek?: string,
    @Query('stage') stage?: string,
    @Query('studyPeriod') studyPeriod?: string,
  ) {
    return this.timetableService.getAll(user, {
      courseId: courseId || undefined,
      sectionId: sectionId || undefined,
      dayOfWeek:
        dayOfWeek !== undefined && dayOfWeek !== ''
          ? Number(dayOfWeek)
          : undefined,
      stage:
        stage !== undefined && stage !== '' ? Number(stage) : undefined,
      studyPeriod: studyPeriod || undefined,
    });
  }

  @Post()
  @RequirePermissions(PERMISSIONS.TIMETABLE_MANAGE)
  async create(
    @Body() body: CreateTimetableEntryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.timetableService.create(body, user);
  }

  @Put(':id')
  @RequirePermissions(PERMISSIONS.TIMETABLE_MANAGE)
  async update(
    @Param('id') id: string,
    @Body() body: UpdateTimetableEntryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.timetableService.update(id, body, user);
  }

  @Delete(':id')
  @RequirePermissions(PERMISSIONS.TIMETABLE_MANAGE)
  async delete(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.timetableService.delete(id, user);
  }
}
