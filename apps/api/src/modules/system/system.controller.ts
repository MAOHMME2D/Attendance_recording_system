import { Body, Controller, Get, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { SystemService } from './system.service';
import { ResetAcademicYearDto } from './dto/reset-academic-year.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { PERMISSIONS } from '../../common/constants/roles';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';

function clientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (Array.isArray(forwarded)) return forwarded[0] || '';
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0].trim();
  }
  return req.ip || req.socket.remoteAddress || '';
}

@Controller('system')
export class SystemController {
  constructor(private systemService: SystemService) {}

  /** Preview counts for the "new academic year" confirmation dialog. */
  @Get('academic-year-summary')
  @RequirePermissions(PERMISSIONS.ACADEMIC_YEAR_RESET)
  async academicYearSummary() {
    return this.systemService.academicYearSummary();
  }

  @Post('reset-academic-year')
  @RequirePermissions(PERMISSIONS.ACADEMIC_YEAR_RESET)
  async resetAcademicYear(
    @Body() body: ResetAcademicYearDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.systemService.resetAcademicYear(body.confirm, user, clientIp(req));
  }
}
