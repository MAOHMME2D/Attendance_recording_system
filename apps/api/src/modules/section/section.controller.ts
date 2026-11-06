import { Controller, Get, Post, Delete, Body, Param, Query } from '@nestjs/common';
import { SectionService } from './section.service';
import { CreateSectionDto } from './dto/create-section.dto';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { PERMISSIONS } from '../../common/constants/roles';

@Controller('sections')
export class SectionController {
  constructor(private sectionService: SectionService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.SECTIONS_VIEW)
  async getAll(@Query('studyPeriod') studyPeriod?: string) {
    return this.sectionService.getAll(studyPeriod);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.SECTIONS_MANAGE)
  async create(@Body() body: CreateSectionDto) {
    return this.sectionService.create(body);
  }

  @Delete(':id')
  @RequirePermissions(PERMISSIONS.SECTIONS_MANAGE)
  async delete(@Param('id') id: string) {
    return this.sectionService.delete(id);
  }
}
