import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { PERMISSIONS } from '../../common/constants/roles';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { StaffService } from './staff.service';
import { CreateStaffDto } from './dto/create-staff.dto';
import { UpdateStaffDto } from './dto/update-staff.dto';
import { UpdateStaffStatusDto } from './dto/update-staff-status.dto';
import { ResetStaffPasswordDto } from './dto/reset-staff-password.dto';

function clientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (Array.isArray(forwarded)) return forwarded[0] || '';
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0].trim();
  }
  return req.ip || req.socket.remoteAddress || '';
}

/**
 * Staff administration. Every route requires MANAGE_STAFF, and StaffService
 * applies the stricter Registrar role-target policy. There is deliberately no
 * public registration endpoint and no hard-delete route.
 */
@Controller('staff')
@RequirePermissions(PERMISSIONS.MANAGE_STAFF)
export class StaffController {
  constructor(private staffService: StaffService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.staffService.list(user);
  }

  @Post()
  create(
    @Body() dto: CreateStaffDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.staffService.create(dto, user, clientIp(req));
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateStaffDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.staffService.update(id, dto, user, clientIp(req));
  }

  @Patch(':id/status')
  setStatus(
    @Param('id') id: string,
    @Body() dto: UpdateStaffStatusDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.staffService.setActive(id, dto.isActive, user, clientIp(req));
  }

  @Patch(':id/password')
  resetPassword(
    @Param('id') id: string,
    @Body() dto: ResetStaffPasswordDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.staffService.resetPassword(id, dto.password, user, clientIp(req));
  }
}
