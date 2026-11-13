import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { AssignmentService } from './assignment.service';
import {
  CreateAssignmentDto,
  ListAssignmentsQueryDto,
} from './dto/create-assignment.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { PERMISSIONS } from '../../common/constants/roles';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';

@Controller('assignments')
export class AssignmentController {
  constructor(private assignmentService: AssignmentService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.ASSIGNMENTS_VIEW)
  async list(@Query() query: ListAssignmentsQueryDto) {
    return this.assignmentService.list(query);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.ASSIGNMENTS_MANAGE)
  async create(
    @Body() body: CreateAssignmentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.assignmentService.create(body, user);
  }

  @Delete(':id')
  @RequirePermissions(PERMISSIONS.ASSIGNMENTS_MANAGE)
  async delete(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.assignmentService.delete(id, user);
  }
}
