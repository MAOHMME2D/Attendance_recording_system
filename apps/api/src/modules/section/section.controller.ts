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
import { SectionService } from './section.service';
import { CreateSectionDto } from './dto/create-section.dto';
import { UpdateSectionDto } from './dto/update-section.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { PERMISSIONS } from '../../common/constants/roles';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';

@Controller('sections')
export class SectionController {
  constructor(private sectionService: SectionService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.SECTIONS_VIEW)
  async getAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query('studyPeriod') studyPeriod?: string,
    @Query('stage') stage?: string,
  ) {
    return this.sectionService.getAll(user, { studyPeriod, stage });
  }

  @Post()
  @RequirePermissions(PERMISSIONS.SECTIONS_MANAGE)
  async create(
    @Body() body: CreateSectionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.sectionService.create(body, user);
  }

  @Put(':id')
  @RequirePermissions(PERMISSIONS.SECTIONS_MANAGE)
  async update(
    @Param('id') id: string,
    @Body() body: UpdateSectionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.sectionService.update(id, body, user);
  }

  @Get(':id/dependencies')
  @RequirePermissions(PERMISSIONS.SECTIONS_VIEW)
  async dependencies(@Param('id') id: string) {
    return this.sectionService.dependencies(id);
  }

  @Delete(':id')
  @RequirePermissions(PERMISSIONS.SECTIONS_MANAGE)
  async delete(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.sectionService.delete(id, user);
  }
}
