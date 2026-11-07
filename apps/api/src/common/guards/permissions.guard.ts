import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import {
  REQUIRED_PERMISSIONS_KEY,
} from '../decorators/permissions.decorator';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { roleHasPermission, type Permission } from '../constants/roles';
import type { AuthenticatedUser } from '../types/authenticated-user';

/**
 * Global RBAC guard. Runs after AuthGuard. Routes without @RequirePermissions
 * only need a valid session; the role matrix decides every declared permission.
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const required = this.reflector.getAllAndOverride<Permission[]>(
      REQUIRED_PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!required || required.length === 0) return true;

    const request = context.switchToHttp().getRequest<Request>();
    const user = request.user as AuthenticatedUser | undefined;
    if (!user) {
      throw new UnauthorizedException('يجب تسجيل الدخول للمتابعة');
    }

    const allowed = required.every((permission) => roleHasPermission(user.role, permission));
    if (!allowed) {
      throw new ForbiddenException('ليست لديك صلاحية لتنفيذ هذا الإجراء');
    }

    return true;
  }
}
