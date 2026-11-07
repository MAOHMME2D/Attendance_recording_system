import { ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  isAdministrativeRole,
  permissionsForRole,
  roleHasPermission,
  type Permission,
  type StaffRole,
} from '../../common/constants/roles';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';

@Injectable()
export class AuthorizationService {
  private readonly logger = new Logger(AuthorizationService.name);

  constructor(private prisma: PrismaService) {}

  hasPermission(user: Pick<AuthenticatedUser, 'role'>, permission: Permission): boolean {
    return roleHasPermission(user.role, permission);
  }

  permissions(user: Pick<AuthenticatedUser, 'role'>): Permission[] {
    return permissionsForRole(user.role);
  }

  /**
   * Lecture visibility/ownership rule.
   *  - HEAD_OF_DEPARTMENT / REGISTRAR / SYSTEM_OWNER: every lecture
   *  - LECTURER: lectures they created or conducted
   *  - TECHNICAL_LECTURER: only lectures where they are the recorded conductor
   */
  canAccessLecture(
    user: Pick<AuthenticatedUser, 'id' | 'role'>,
    lecture: { createdByUserId: string | null; conductedByUserId: string | null },
  ): boolean {
    if (isAdministrativeRole(user.role)) return true;
    if (user.role === 'LECTURER') {
      return (
        lecture.createdByUserId === user.id || lecture.conductedByUserId === user.id
      );
    }
    if (user.role === 'TECHNICAL_LECTURER') {
      return lecture.conductedByUserId === user.id;
    }
    return false;
  }

  lectureScope(user: Pick<AuthenticatedUser, 'id' | 'role'>): Record<string, unknown> {
    if (isAdministrativeRole(user.role)) return {};
    if (user.role === 'TECHNICAL_LECTURER') {
      return { conductedByUserId: user.id };
    }
    return {
      OR: [{ createdByUserId: user.id }, { conductedByUserId: user.id }],
    };
  }

  /**
   * Phase 2 course scope.
   *  - administrative roles: every course
   *  - LECTURER / TECHNICAL_LECTURER: only courses assigned to them
   */
  courseScope(user: Pick<AuthenticatedUser, 'id' | 'role'>): Record<string, unknown> {
    if (isAdministrativeRole(user.role)) return {};
    return { assignments: { some: { staffUserId: user.id } } };
  }

  async assignedCourseIds(user: Pick<AuthenticatedUser, 'id' | 'role'>): Promise<string[]> {
    if (isAdministrativeRole(user.role)) {
      const courses = await this.prisma.course.findMany({ select: { id: true } });
      return courses.map((course) => course.id);
    }
    const assignments = await this.prisma.teachingAssignment.findMany({
      where: { staffUserId: user.id },
      select: { courseId: true },
    });
    return assignments.map((assignment) => assignment.courseId);
  }

  /** Stages covered by the courses a user may access. */
  async assignedStages(user: Pick<AuthenticatedUser, 'id' | 'role'>): Promise<number[]> {
    if (isAdministrativeRole(user.role)) return [1, 2, 3, 4];
    const assignments = await this.prisma.teachingAssignment.findMany({
      where: { staffUserId: user.id },
      select: { course: { select: { stage: true } } },
    });
    return Array.from(new Set(assignments.map((assignment) => assignment.course.stage)));
  }

  async canAccessCourse(
    user: Pick<AuthenticatedUser, 'id' | 'role'>,
    courseId: string,
  ): Promise<boolean> {
    if (isAdministrativeRole(user.role)) return true;
    const assignment = await this.prisma.teachingAssignment.findUnique({
      where: {
        staffUserId_courseId: { staffUserId: user.id, courseId },
      },
      select: { id: true },
    });
    return Boolean(assignment);
  }

  async assertCanAccessCourse(
    user: Pick<AuthenticatedUser, 'id' | 'role'>,
    courseId: string,
  ): Promise<void> {
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
      select: { id: true },
    });
    if (!course) throw new NotFoundException('المادة غير موجودة');
    if (!(await this.canAccessCourse(user, courseId))) {
      throw new ForbiddenException('هذه المادة غير مسندة إليك');
    }
  }

  async assertActiveUser(userId: string): Promise<{ id: string; role: StaffRole } | null> {
    const user = await this.prisma.staffUser.findUnique({
      where: { id: userId },
      select: { id: true, role: true, isActive: true },
    });
    if (!user || !user.isActive) return null;
    return { id: user.id, role: user.role as StaffRole };
  }
}
