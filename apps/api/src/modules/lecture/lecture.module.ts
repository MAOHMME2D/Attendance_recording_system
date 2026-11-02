import { Module } from '@nestjs/common';
import { LectureController } from './lecture.controller';
import { LectureService } from './lecture.service';
import { AttendanceGateway } from './attendance.gateway';

@Module({
  controllers: [LectureController],
  providers: [LectureService, AttendanceGateway],
  exports: [LectureService, AttendanceGateway],
})
export class LectureModule {}
