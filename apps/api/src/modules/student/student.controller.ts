import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
} from '@nestjs/common';
import { StudentService } from './student.service';
import { CreateStudentDto } from './dto/create-student.dto';
import { UpdateStudentDto } from './dto/update-student.dto';
import { BatchStudentsDto } from './dto/batch-students.dto';
import { ImportStudentsDto } from './dto/import-students.dto';
import { ResetAbsencesDto } from './dto/reset-absences.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { PERMISSIONS } from '../../common/constants/roles';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';

@Controller('students')
export class StudentController {
  constructor(private studentService: StudentService) {}

  /** Full student list with statistics and history (never includes QR secrets). */
  @Get()
  @RequirePermissions(PERMISSIONS.STUDENTS_VIEW)
  async getAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query('studyPeriod') studyPeriod?: string,
    @Query('section') section?: string,
    @Query('stage') stage?: string,
    @Query('sectionId') sectionId?: string,
  ) {
    return this.studentService.getAllWithStats(user, {
      studyPeriod,
      section,
      stage,
      sectionId,
    });
  }

  /** Minimal list for lecturers adding students to their own lecture. */
  @Get('options')
  @RequirePermissions(PERMISSIONS.STUDENT_OPTIONS)
  async getOptions(
    @CurrentUser() user: AuthenticatedUser,
    @Query('studyPeriod') studyPeriod?: string,
    @Query('section') section?: string,
    @Query('sectionId') sectionId?: string,
    @Query('stage') stage?: string,
    @Query('courseId') courseId?: string,
  ) {
    return this.studentService.getOptions(user, {
      studyPeriod,
      section,
      sectionId,
      stage,
      courseId,
    });
  }

  @Get('lookup/:code')
  @RequirePermissions(PERMISSIONS.STUDENT_OPTIONS)
  async lookup(
    @Param('code') code: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.studentService.findByCode(code, user);
  }

  @Get(':id/qr')
  @RequirePermissions(PERMISSIONS.QR_ISSUE)
  async getQr(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const token = await this.studentService.ensureQrToken(id, user.id);
    return { studentId: id, token: token.token };
  }

  @Post(':id/qr/rotate')
  @RequirePermissions(PERMISSIONS.QR_ISSUE)
  async rotateQr(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const token = await this.studentService.rotateQrToken(id, user);
    return { studentId: id, token: token.token, rotatedAt: token.createdAt };
  }

  /** Validate an Excel import without writing anything. */
  @Post('import/preview')
  @RequirePermissions(PERMISSIONS.STUDENTS_MANAGE)
  async previewImport(@Body() body: ImportStudentsDto) {
    return this.studentService.previewImport(body);
  }

  /** Confirm an Excel import. Duplicate/invalid rows are rejected. */
  @Post('import/confirm')
  @RequirePermissions(PERMISSIONS.STUDENTS_MANAGE)
  async confirmImport(
    @Body() body: ImportStudentsDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.studentService.importStudents(body, user);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.STUDENTS_MANAGE)
  async create(
    @Body() body: CreateStudentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.studentService.create(body, user);
  }

  @Post('batch')
  @RequirePermissions(PERMISSIONS.STUDENTS_MANAGE)
  async createBatch(
    @Body() body: BatchStudentsDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.studentService.createBatch(body.students, user);
  }

  @Post('reset-absences')
  @RequirePermissions(PERMISSIONS.ABSENCES_RESET)
  async resetAbsences(
    @Body() body: ResetAbsencesDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.studentService.resetAbsences(body, user);
  }

  @Put(':id')
  @RequirePermissions(PERMISSIONS.STUDENTS_MANAGE)
  async update(
    @Param('id') id: string,
    @Body() body: UpdateStudentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.studentService.update(id, body, user);
  }

  @Delete(':id')
  @RequirePermissions(PERMISSIONS.STUDENTS_MANAGE)
  async delete(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.studentService.delete(id, user);
  }
}
