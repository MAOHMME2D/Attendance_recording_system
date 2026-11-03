import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { LectureModule } from './modules/lecture/lecture.module';
import { AttendanceModule } from './modules/attendance/attendance.module';
import { StudentModule } from './modules/student/student.module';
import { SectionModule } from './modules/section/section.module';

@Module({
  imports: [
    PrismaModule,
    LectureModule,
    AttendanceModule,
    StudentModule,
    SectionModule,
  ],
})
export class AppModule {}
