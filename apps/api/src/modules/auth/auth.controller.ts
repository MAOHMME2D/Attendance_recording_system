import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { SESSION_COOKIE_NAME } from '../../common/utils/cookies';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';

function clientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (Array.isArray(forwarded)) return forwarded[0] || '';
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0].trim();
  }
  return req.ip || req.socket.remoteAddress || '';
}

function cookieOptions() {
  const secure =
    process.env.COOKIE_SECURE === 'true' || process.env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    secure,
    sameSite: 'lax' as const,
    path: '/',
  };
}

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Public()
  @Post('login')
  @HttpCode(200)
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.login(
      dto,
      clientIp(req),
      req.headers['user-agent'],
    );

    res.cookie(SESSION_COOKIE_NAME, result.token, {
      ...cookieOptions(),
      maxAge: Math.max(0, new Date(result.expiresAt).getTime() - Date.now()),
    });

    // The raw session token is delivered ONLY through the HttpOnly cookie.
    // It must never appear in the JSON body where script or logs could read it.
    return {
      expiresAt: result.expiresAt,
      user: result.user,
    };
  }

  @Post('logout')
  @HttpCode(200)
  async logout(
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.logout(user, clientIp(req));
    res.clearCookie(SESSION_COOKIE_NAME, cookieOptions());
    return result;
  }

  @Get('me')
  async me(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.me(user.id);
  }
}
