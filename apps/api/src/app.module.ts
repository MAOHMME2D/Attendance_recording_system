import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { PrismaModule } from './prisma/prisma.module';
import { AuditModule } from './modules/audit/audit.module';
import { AuthModule } from './modules/auth/auth.module';
import { LectureModule } from './modules/lecture/lecture.module';
import { AttendanceModule } from './modules/attendance/attendance.module';
import { StudentModule } from './modules/student/student.module';
import { SectionModule } from './modules/section/section.module';
import { StaffModule } from './modules/staff/staff.module';
import { SetupModule } from './modules/setup/setup.module';
import { CourseModule } from './modules/course/course.module';
import { AssignmentModule } from './modules/assignment/assignment.module';
import { FollowupModule } from './modules/followup/followup.module';
import { TimetableModule } from './modules/timetable/timetable.module';
import { ReportsModule } from './modules/reports/reports.module';
import { HealthController } from './health.controller';
import { AuthGuard } from './common/guards/auth.guard';
import { PermissionsGuard } from './common/guards/permissions.guard';

@Module({
  imports: [
    PrismaModule,
    AuditModule,
    AuthModule,
    LectureModule,
    AttendanceModule,
    StudentModule,
    SectionModule,
    StaffModule,
    SetupModule,
    CourseModule,
    AssignmentModule,
    FollowupModule,
    TimetableModule,
    ReportsModule,
  ],
  controllers: [HealthController],
  providers: [
    // Order matters: authenticate first, then check permissions.
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
  ],
})
export class AppModule {}
