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

@Controller('students')
export class StudentController {
  constructor(private studentService: StudentService) {}

  @Get()
  async getAll(
    @Query('studyPeriod') studyPeriod?: string,
    @Query('section') section?: string,
  ) {
    return this.studentService.getAllWithStats(studyPeriod, section);
  }

  @Get('lookup/:code')
  async lookup(@Param('code') code: string) {
    return this.studentService.findByCode(code);
  }

  @Post()
  async create(
    @Body()
    body: {
      studentCode: string;
      name: string;
      studyPeriod?: string;
      section?: string;
      orderIndex?: number;
      presentCount?: number;
      absentCount?: number;
      totalSessions?: number;
      rate?: number;
    },
  ) {
    return this.studentService.create(body);
  }

  @Post('batch')
  async createBatch(
    @Body()
    body: {
      students: {
        orderIndex?: number;
        studentCode: string;
        name: string;
        studyPeriod?: string;
        section?: string;
        presentCount?: number;
        absentCount?: number;
        totalSessions?: number;
        rate?: number;
      }[];
    },
  ) {
    return this.studentService.createBatch(body.students);
  }

  @Post('reset-absences')
  async resetAbsences(
    @Body()
    body: {
      studyPeriod?: string;
      section?: string;
      studentId?: string;
      resetType?: 'ABSENCES_ONLY' | 'ALL_ATTENDANCE';
    },
  ) {
    return this.studentService.resetAbsences(body);
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() body: { studentCode?: string; name?: string; studyPeriod?: string; section?: string },
  ) {
    return this.studentService.update(id, body);
  }

  @Delete(':id')
  async delete(@Param('id') id: string) {
    return this.studentService.delete(id);
  }
}
