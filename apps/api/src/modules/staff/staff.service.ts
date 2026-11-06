import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import {
  CREATABLE_STAFF_ROLES,
  REGISTRAR_MANAGED_ROLES,
  isStaffRole,
  isSystemOwnerRole,
} from '../../common/constants/roles';
import {
  hashPassword,
  isValidStaffId,
  normalizeStaffId,
  validatePasswordStrength,
} from '../../common/utils/password';
import type { CreateStaffDto } from './dto/create-staff.dto';
import type { UpdateStaffDto } from './dto/update-staff.dto';

/**
 * PostgreSQL transaction-level advisory lock key used to serialize every
 * mutation that could remove the last active Head of Department.
 *
 * The key is arbitrary but must stay stable: all API instances must use the
 * same value so the count-then-update sequence cannot interleave.
 */
const STAFF_ROLE_MUTATION_LOCK_KEY = 728194001;

export interface PublicStaffMember {
  id: string;
  staffId: string;
  fullName: string;
  role: string;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

function toPublicStaff(user: {
  id: string;
  staffId: string;
  fullName: string;
  role: string;
  isActive: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
}): PublicStaffMember {
  return {
    id: user.id,
    staffId: user.staffId,
    fullName: user.fullName,
    role: user.role,
    isActive: user.isActive,
    lastLoginAt: user.lastLoginAt ? user.lastLoginAt.toISOString() : null,
    createdAt: user.createdAt.toISOString(),
  };
}

function cleanFullName(value: string): string {
  const fullName = value.trim();
  if (fullName.length < 2 || fullName.length > 120) {
    throw new BadRequestException('اسم الموظف يجب أن يكون بين حرفين و120 حرفًا');
  }
  return fullName;
}

/**
 * Server-side staff administration policy.
 *
 * The permission guard already requires MANAGE_STAFF. This service adds the
 * stricter role-target rules so a Registrar can never touch a Head of
 * Department, another Registrar, or the isolated SYSTEM_OWNER account.
 */
@Injectable()
export class StaffService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  private isRegistrar(actor: AuthenticatedUser): boolean {
    return actor.role === 'REGISTRAR';
  }

  private isHeadOrOwner(actor: AuthenticatedUser): boolean {
    return actor.role === 'HEAD_OF_DEPARTMENT' || isSystemOwnerRole(actor.role);
  }

  private assertRoleAllowed(actor: AuthenticatedUser, role: string): void {
    if (!isStaffRole(role) || !(CREATABLE_STAFF_ROLES as readonly string[]).includes(role)) {
      throw new BadRequestException('صلاحية الموظف غير مسموحة');
    }
    if (this.isHeadOrOwner(actor)) return;
    if (
      this.isRegistrar(actor) &&
      (REGISTRAR_MANAGED_ROLES as readonly string[]).includes(role)
    ) {
      return;
    }
    throw new ForbiddenException('ليست لديك صلاحية لتعيين هذه الصلاحية');
  }

  private assertTargetManageable(
    actor: AuthenticatedUser,
    target: { id: string; role: string },
  ): void {
    // The owner test account is intentionally immutable through the API. It can
    // only be disabled/reactivated with the dedicated CLI command.
    if (isSystemOwnerRole(target.role)) {
      throw new ForbiddenException(
        'حساب مالك النظام التجريبي لا يمكن إدارته عبر واجهة الموظفين',
      );
    }
    if (this.isHeadOrOwner(actor)) return;
    if (
      this.isRegistrar(actor) &&
      (REGISTRAR_MANAGED_ROLES as readonly string[]).includes(target.role)
    ) {
      return;
    }
    throw new ForbiddenException('ليست لديك صلاحية لإدارة هذا الحساب');
  }

  /**
   * Serializes staff role/status changes across every API process. The lock is
   * transaction-scoped, so PostgreSQL releases it automatically on commit or
   * rollback. The head count must only be read after this call succeeds and
   * inside the same transaction.
   */
  private async acquireStaffRoleLock(
    tx: Prisma.TransactionClient,
  ): Promise<void> {
    await tx.$executeRawUnsafe(
      `SELECT pg_advisory_xact_lock(${STAFF_ROLE_MUTATION_LOCK_KEY})`,
    );
  }

  private async activeHeadCount(
    tx: Prisma.TransactionClient,
  ): Promise<number> {
    return tx.staffUser.count({
      where: { role: 'HEAD_OF_DEPARTMENT', isActive: true },
    });
  }

  private async findTarget(id: string) {
    const target = await this.prisma.staffUser.findUnique({ where: { id } });
    if (!target) throw new NotFoundException('حساب الموظف غير موجود');
    return target;
  }

  async list(actor: AuthenticatedUser): Promise<PublicStaffMember[]> {
    const where = this.isRegistrar(actor)
      ? { role: { in: [...REGISTRAR_MANAGED_ROLES] } }
      : {};
    const users = await this.prisma.staffUser.findMany({
      where,
      orderBy: [{ role: 'asc' }, { staffId: 'asc' }],
    });
    return users.map(toPublicStaff);
  }

  async create(
    dto: CreateStaffDto,
    actor: AuthenticatedUser,
    ipAddress: string,
  ): Promise<PublicStaffMember> {
    const staffId = normalizeStaffId(dto.staffId);
    if (!isValidStaffId(staffId)) {
      throw new BadRequestException('معرف الموظف غير صالح');
    }

    this.assertRoleAllowed(actor, dto.role);
    const fullName = cleanFullName(dto.fullName);
    const passwordError = validatePasswordStrength(dto.password, staffId);
    if (passwordError) throw new BadRequestException(passwordError);

    const existing = await this.prisma.staffUser.findUnique({ where: { staffId } });
    if (existing) {
      throw new ConflictException(`المعرف "${staffId}" مستخدم بالفعل`);
    }

    let created;
    try {
      created = await this.prisma.staffUser.create({
        data: {
          staffId,
          fullName,
          role: dto.role,
          passwordHash: await hashPassword(dto.password),
          isActive: true,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(`المعرف "${staffId}" مستخدم بالفعل`);
      }
      throw error;
    }

    await this.audit.log({
      actorUserId: actor.id,
      action: 'STAFF_CREATED',
      entityType: 'StaffUser',
      entityId: created.id,
      details: `staffId=${created.staffId}; role=${created.role}`,
      ipAddress,
    });

    return toPublicStaff(created);
  }

  async update(
    id: string,
    dto: UpdateStaffDto,
    actor: AuthenticatedUser,
    ipAddress: string,
  ): Promise<PublicStaffMember> {
    // Format validation happens before the transaction. Every decision that
    // depends on the current row (role, active head count) is re-evaluated
    // inside the transaction while holding the advisory lock.
    let nextFullName: string | undefined;
    if (dto.fullName !== undefined) {
      nextFullName = cleanFullName(dto.fullName);
    }

    let nextStaffId: string | undefined;
    if (dto.staffId !== undefined) {
      nextStaffId = normalizeStaffId(dto.staffId);
      if (!isValidStaffId(nextStaffId)) {
        throw new BadRequestException('معرف الموظف غير صالح');
      }
    }

    if (dto.role !== undefined) {
      // A Registrar may switch between the two roles it is allowed to manage,
      // but can never promote anyone (including itself) to Head/Registrar/Owner.
      this.assertRoleAllowed(actor, dto.role);
    }

    const changes: string[] = [];

    const updated = await this.prisma.$transaction(async (tx) => {
      await this.acquireStaffRoleLock(tx);

      const current = await tx.staffUser.findUnique({ where: { id } });
      if (!current) throw new NotFoundException('حساب الموظف غير موجود');
      this.assertTargetManageable(actor, current);

      const data: {
        staffId?: string;
        fullName?: string;
        role?: string;
      } = {};

      if (nextFullName !== undefined && nextFullName !== current.fullName) {
        data.fullName = nextFullName;
        changes.push('fullName');
      }

      if (nextStaffId !== undefined && nextStaffId !== current.staffId) {
        const duplicate = await tx.staffUser.findUnique({
          where: { staffId: nextStaffId },
        });
        if (duplicate) {
          throw new ConflictException(
            `المعرف "${nextStaffId}" مستخدم بالفعل`,
          );
        }
        data.staffId = nextStaffId;
        changes.push(`staffId:${current.staffId}->${nextStaffId}`);
      }

      if (dto.role !== undefined && dto.role !== current.role) {
        if (
          current.role === 'HEAD_OF_DEPARTMENT' &&
          current.isActive &&
          (await this.activeHeadCount(tx)) <= 1
        ) {
          throw new ConflictException(
            'لا يمكن إزالة صلاحية آخر حساب رئيس قسم فعال',
          );
        }

        data.role = dto.role;
        changes.push(`role:${current.role}->${dto.role}`);
      }

      if (Object.keys(data).length === 0) {
        return current;
      }

      try {
        return await tx.staffUser.update({ where: { id }, data });
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002'
        ) {
          throw new ConflictException('معرف الموظف مستخدم بالفعل');
        }
        throw error;
      }
    });

    if (changes.length > 0) {
      await this.audit.log({
        actorUserId: actor.id,
        action: 'STAFF_UPDATED',
        entityType: 'StaffUser',
        entityId: updated.id,
        details: `changed=${changes.join(',')}`,
        ipAddress,
      });
    }

    return toPublicStaff(updated);
  }

  async setActive(
    id: string,
    isActive: boolean,
    actor: AuthenticatedUser,
    ipAddress: string,
  ): Promise<PublicStaffMember> {
    const target = await this.findTarget(id);
    this.assertTargetManageable(actor, target);

    if (!isActive && target.id === actor.id) {
      throw new BadRequestException('لا يمكنك تعطيل حسابك الحالي');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      await this.acquireStaffRoleLock(tx);

      const current = await tx.staffUser.findUnique({ where: { id } });
      if (!current) throw new NotFoundException('حساب الموظف غير موجود');
      this.assertTargetManageable(actor, current);

      if (!isActive && current.id === actor.id) {
        throw new BadRequestException('لا يمكنك تعطيل حسابك الحالي');
      }

      if (
        !isActive &&
        current.role === 'HEAD_OF_DEPARTMENT' &&
        current.isActive &&
        (await this.activeHeadCount(tx)) <= 1
      ) {
        throw new ConflictException(
          'لا يمكن تعطيل آخر حساب رئيس قسم فعال',
        );
      }

      const result = await tx.staffUser.update({
        where: { id },
        data: {
          isActive,
          ...(isActive
            ? { failedLoginCount: 0, lockedUntil: null }
            : {}),
        },
      });

      if (!isActive) {
        await tx.staffSession.updateMany({
          where: { userId: id, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      }

      return result;
    });

    await this.audit.log({
      actorUserId: actor.id,
      action: isActive ? 'STAFF_REACTIVATED' : 'STAFF_DEACTIVATED',
      entityType: 'StaffUser',
      entityId: updated.id,
      details: `staffId=${updated.staffId}; role=${updated.role}`,
      ipAddress,
    });

    return toPublicStaff(updated);
  }

  async resetPassword(
    id: string,
    password: string,
    actor: AuthenticatedUser,
    ipAddress: string,
  ): Promise<{ success: true }> {
    const target = await this.findTarget(id);
    this.assertTargetManageable(actor, target);

    const passwordError = validatePasswordStrength(password, target.staffId);
    if (passwordError) throw new BadRequestException(passwordError);

    await this.prisma.staffUser.update({
      where: { id },
      data: {
        passwordHash: await hashPassword(password),
        failedLoginCount: 0,
        lockedUntil: null,
      },
    });

    // A reset must invalidate every existing session for that account.
    await this.prisma.staffSession.updateMany({
      where: { userId: id, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    await this.audit.log({
      actorUserId: actor.id,
      action: 'STAFF_PASSWORD_RESET',
      entityType: 'StaffUser',
      entityId: target.id,
      details: `staffId=${target.staffId}; sessions revoked`,
      ipAddress,
    });

    return { success: true };
  }
}
