import { Controller, Post, Body, Get, Patch, Param, Req } from '@nestjs/common';
import { AttendanceService } from './attendance.service';
import { Request } from 'express';

@Controller('attendance')
export class AttendanceController {
  constructor(private attendanceService: AttendanceService) {}

  /**
   * Public endpoint - students register attendance via QR token + name + deviceId
   */
  @Post('register')
  async register(
    @Body() body: { token: string; studentName: string; deviceId?: string },
    @Req() req: Request,
  ) {
    const rawIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '';
    const ip = Array.isArray(rawIp) ? rawIp[0] : String(rawIp).split(',')[0].trim();
    return this.attendanceService.register(body.token, body.studentName, body.deviceId, ip);
  }

  /**
   * Get attendance list for a lecture
   */
  @Get(':lectureId')
  async getByLecture(@Param('lectureId') lectureId: string) {
    return this.attendanceService.getByLecture(lectureId);
  }

  /**
   * Toggle a student's status (PRESENT ↔ ABSENT)
   */
  @Patch(':id/toggle')
  async toggleStatus(@Param('id') id: string) {
    return this.attendanceService.toggleStatus(id);
  }

  /**
   * Scan student QR via laptop camera
   */
  @Post(':lectureId/scan-student')
  async scanStudent(
    @Param('lectureId') lectureId: string,
    @Body() body: { studentCode: string },
  ) {
    return this.attendanceService.scanStudent(lectureId, body.studentCode);
  }

  /**
   * Manually add a student to a lecture's attendance list
   */
  @Post(':lectureId/manual')
  async addManual(
    @Param('lectureId') lectureId: string,
    @Body() body: { studentName: string; status?: string },
  ) {
    return this.attendanceService.addManual(lectureId, body.studentName, body.status);
  }
}
