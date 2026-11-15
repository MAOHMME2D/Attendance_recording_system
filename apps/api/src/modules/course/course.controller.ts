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
import { CourseService } from './course.service';
import { CreateCourseDto } from './dto/create-course.dto';
import { UpdateCourseDto } from './dto/update-course.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { PERMISSIONS } from '../../common/constants/roles';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';

@Controller('courses')
export class CourseController {
  constructor(private courseService: CourseService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.COURSES_VIEW)
  async list(
    @CurrentUser() user: AuthenticatedUser,
    @Query('stage') stage?: string,
  ) {
    return this.courseService.list(user, stage);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.COURSES_MANAGE)
  async create(
    @Body() body: CreateCourseDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.courseService.create(body, user);
  }

  @Put(':id')
  @RequirePermissions(PERMISSIONS.COURSES_MANAGE)
  async update(
    @Param('id') id: string,
    @Body() body: UpdateCourseDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.courseService.update(id, body, user);
  }

  @Get(':id/dependencies')
  @RequirePermissions(PERMISSIONS.COURSES_VIEW)
  async dependencies(@Param('id') id: string) {
    return this.courseService.dependencies(id);
  }

  @Delete(':id')
  @RequirePermissions(PERMISSIONS.COURSES_MANAGE)
  async delete(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.courseService.delete(id, user);
  }
}
