import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { CreateAssignmentDto } from './dto/create-assignment.dto';

const ASSIGNABLE_ROLES = ['LECTURER', 'TECHNICAL_LECTURER'];

@Injectable()
export class AssignmentService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  async list(filters: { staffUserId?: string; courseId?: string }) {
    return this.prisma.teachingAssignment.findMany({
      where: {
        ...(filters.staffUserId ? { staffUserId: filters.staffUserId } : {}),
        ...(filters.courseId ? { courseId: filters.courseId } : {}),
      },
      include: {
        staffUser: {
          select: {
            id: true,
            staffId: true,
            fullName: true,
            role: true,
            isActive: true,
          },
        },
        course: {
          select: { id: true, code: true, name: true, stage: true },
        },
      },
      orderBy: [{ createdAt: 'desc' }],
    });
  }

  async create(dto: CreateAssignmentDto, actor: AuthenticatedUser) {
    const staff = await this.prisma.staffUser.findUnique({
      where: { id: dto.staffUserId },
      select: { id: true, fullName: true, role: true, isActive: true },
    });
    if (!staff) throw new NotFoundException('المحاضر غير موجود');
    if (!staff.isActive) throw new BadRequestException('لا يمكن تعيين حساب موقوف');
    if (!ASSIGNABLE_ROLES.includes(staff.role)) {
      throw new BadRequestException(
        'يمكن تعيين المحاضرين أو المحاضرين التقنيين فقط',
      );
    }

    const course = await this.prisma.course.findUnique({
      where: { id: dto.courseId },
      select: { id: true, code: true, name: true, stage: true },
    });
    if (!course) throw new NotFoundException('المادة غير موجودة');

    const existing = await this.prisma.teachingAssignment.findUnique({
      where: {
        staffUserId_courseId: {
          staffUserId: staff.id,
          courseId: course.id,
        },
      },
    });
    if (existing) {
      throw new ConflictException('هذا المحاضر معيّن مسبقاً على المادة نفسها');
    }

    const assignment = await this.prisma.teachingAssignment.create({
      data: { staffUserId: staff.id, courseId: course.id },
      include: {
        staffUser: {
          select: {
            id: true,
            staffId: true,
            fullName: true,
            role: true,
            isActive: true,
          },
        },
        course: {
          select: { id: true, code: true, name: true, stage: true },
        },
      },
    });

    await this.audit.log({
      actorUserId: actor.id,
      action: 'ASSIGNMENT_CREATE',
      entityType: 'TeachingAssignment',
      entityId: assignment.id,
      details: `${staff.fullName} -> ${course.code} (${course.name}, stage ${course.stage})`,
    });

    return assignment;
  }

  async delete(id: string, actor: AuthenticatedUser) {
    const assignment = await this.prisma.teachingAssignment.findUnique({
      where: { id },
      include: {
        staffUser: { select: { fullName: true } },
        course: { select: { code: true, name: true } },
      },
    });
    if (!assignment) throw new NotFoundException('التعيين غير موجود');

    await this.prisma.teachingAssignment.delete({ where: { id } });

    await this.audit.log({
      actorUserId: actor.id,
      action: 'ASSIGNMENT_DELETE',
      entityType: 'TeachingAssignment',
      entityId: id,
      details: `${assignment.staffUser.fullName} -/-> ${assignment.course.code} (${assignment.course.name})`,
    });

    return { success: true };
  }
}
