import { Injectable, Logger } from '@nestjs/common';
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

  async assertActiveUser(userId: string): Promise<{ id: string; role: StaffRole } | null> {
    const user = await this.prisma.staffUser.findUnique({
      where: { id: userId },
      select: { id: true, role: true, isActive: true },
    });
    if (!user || !user.isActive) return null;
    return { id: user.id, role: user.role as StaffRole };
  }
}
