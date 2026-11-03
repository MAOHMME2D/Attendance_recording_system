import { Controller, Get, Post, Delete, Body, Param, Query } from '@nestjs/common';
import { SectionService } from './section.service';

@Controller('sections')
export class SectionController {
  constructor(private sectionService: SectionService) {}

  @Get()
  async getAll(@Query('studyPeriod') studyPeriod?: string) {
    return this.sectionService.getAll(studyPeriod);
  }

  @Post()
  async create(@Body() body: { studyPeriod: string; name: string; label?: string }) {
    return this.sectionService.create(body);
  }

  @Delete(':id')
  async delete(@Param('id') id: string) {
    return this.sectionService.delete(id);
  }
}

