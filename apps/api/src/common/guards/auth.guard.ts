import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { AuthService } from '../../modules/auth/auth.service';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import {
  SESSION_COOKIE_NAME,
  readBearerToken,
  readCookie,
} from '../utils/cookies';

/**
 * Global authentication guard. Every route is protected unless the handler or
 * controller is explicitly decorated with @Public().
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly authService: AuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<Request>();
    const token =
      readBearerToken(request.headers.authorization) ||
      readCookie(request.headers.cookie, SESSION_COOKIE_NAME);

    if (!token) {
      throw new UnauthorizedException('يجب تسجيل الدخول للمتابعة');
    }

    const user = await this.authService.resolveSession(token);
    if (!user) {
      throw new UnauthorizedException('انتهت صلاحية الجلسة. يرجى تسجيل الدخول مجدداً');
    }

    request.user = user;
    return true;
  }
}
