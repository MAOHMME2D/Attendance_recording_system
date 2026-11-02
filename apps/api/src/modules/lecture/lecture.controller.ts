import { Controller, Post, Body, Get, Patch, Param, Delete } from '@nestjs/common';
import { LectureService } from './lecture.service';

@Controller('lectures')
export class LectureController {
  constructor(private lectureService: LectureService) {}

  /**
   * Create a new lecture - No auth required
   */
  @Post()
  async createLecture(@Body() body: { name: string; studyPeriod?: string; section?: string }) {
    return this.lectureService.createLecture(body.name, body.studyPeriod, body.section);
  }

  /**
   * Get currently active lecture (if any)
   */
  @Get('active/current')
  async getActiveLecture() {
    return this.lectureService.getActiveLecture();
  }

  /**
   * Get a specific lecture by ID
   */
  @Get(':id')
  async getLecture(@Param('id') id: string) {
    return this.lectureService.getLecture(id);
  }

  /**
   * Close a lecture
   */
  @Patch(':id/close')
  async closeLecture(@Param('id') id: string) {
    return this.lectureService.closeLecture(id);
  }

  /**
   * Get all lectures (for reports)
   */
  @Get()
  async getAllLectures() {
    return this.lectureService.getAllLectures();
  }

  /**
   * Delete a lecture
   */
  @Delete(':id')
  async deleteLecture(@Param('id') id: string) {
    return this.lectureService.deleteLecture(id);
  }

  /**
   * Validate a QR token (used by student check-in page)
   */
  @Post('validate-qr')
  async validateQr(@Body() body: { token: string }) {
    return this.lectureService.validateQrToken(body.token);
  }
}
