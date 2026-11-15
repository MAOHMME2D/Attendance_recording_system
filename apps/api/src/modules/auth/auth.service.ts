import {
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import type { StaffRole } from '../../common/constants/roles';
import { permissionsForRole } from '../../common/constants/roles';
import {
  hashPassword,
  verifyPassword,
} from '../../common/utils/password';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import type { LoginDto } from './dto/login.dto';

export interface PublicStaffUser {
  id: string;
  staffId: string;
  fullName: string;
  role: StaffRole;
  permissions: ReturnType<typeof permissionsForRole>;
  lastLoginAt: string | null;
}

export interface LoginResult {
  token: string;
  expiresAt: string;
  user: PublicStaffUser;
}

/** Defaults can be overridden per deployment without changing code. */
const DEFAULT_MAX_FAILED_ATTEMPTS = 5;
const DEFAULT_LOCK_MINUTES = 15;
const DEFAULT_LOGIN_WINDOW_MINUTES = 5;
/**
 * Per-IP failure ceiling is intentionally high: a whole campus can share one
 * NAT address, so a low number would lock everybody out. Per account+IP stays
 * strict, and the per-account lockout below is the real guessing barrier.
 */
const DEFAULT_MAX_FAILED_ATTEMPTS_PER_IP = 200;
const DEFAULT_MAX_FAILED_ATTEMPTS_PER_ACCOUNT_IP = 10;

/** Valid bcrypt hash used only to equalise timing for unknown staff ids. */
const DUMMY_HASH = '$2b$12$1kzq22NnRk9BhY4T3Ps8f.Oow0SnmqmyQnoL47dWCmklWNF6YcwFO';

function readPositiveInt(name: string, fallback: number, max: number): number {
  const raw = Number(process.env[name]);
  if (!Number.isFinite(raw) || raw <= 0) return fallback;
  return Math.min(Math.floor(raw), max);
}

interface AttemptBucket {
  count: number;
  resetAt: number;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly loginAttempts = new Map<string, AttemptBucket>();

  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  private sessionTtlMs(): number {
    const hours = Number(process.env.SESSION_TTL_HOURS || 12);
    const safeHours = Number.isFinite(hours) && hours > 0 && hours <= 168 ? hours : 12;
    return safeHours * 60 * 60 * 1000;
  }

  private hashToken(rawToken: string): string {
    return crypto.createHash('sha256').update(rawToken).digest('hex');
  }

  private newToken(): string {
    return crypto.randomBytes(32).toString('base64url');
  }

  private toPublicUser(user: {
    id: string;
    staffId: string;
    fullName: string;
    role: string;
    lastLoginAt: Date | null;
  }): PublicStaffUser {
    return {
      id: user.id,
      staffId: user.staffId,
      fullName: user.fullName,
      role: user.role as StaffRole,
      permissions: permissionsForRole(user.role),
      lastLoginAt: user.lastLoginAt ? user.lastLoginAt.toISOString() : null,
    };
  }

  private maxFailedAttempts(): number {
    return readPositiveInt('AUTH_MAX_FAILED_ATTEMPTS', DEFAULT_MAX_FAILED_ATTEMPTS, 100);
  }

  private lockMinutes(): number {
    return readPositiveInt('AUTH_LOCK_MINUTES', DEFAULT_LOCK_MINUTES, 24 * 60);
  }

  private loginWindowMs(): number {
    const minutes = readPositiveInt(
      'AUTH_LOGIN_WINDOW_MINUTES',
      DEFAULT_LOGIN_WINDOW_MINUTES,
      24 * 60,
    );
    return minutes * 60 * 1000;
  }

  private maxFailedAttemptsPerIp(): number {
    return readPositiveInt(
      'AUTH_IP_MAX_FAILED_ATTEMPTS',
      DEFAULT_MAX_FAILED_ATTEMPTS_PER_IP,
      100000,
    );
  }

  private maxFailedAttemptsPerAccountIp(): number {
    return readPositiveInt(
      'AUTH_ACCOUNT_IP_MAX_FAILED_ATTEMPTS',
      DEFAULT_MAX_FAILED_ATTEMPTS_PER_ACCOUNT_IP,
      10000,
    );
  }

  /**
   * Reads the current failure bucket without incrementing it. Successful
   * logins therefore never consume the failure budget.
   */
  private retryAfterSeconds(key: string, limit: number): number | null {
    const now = Date.now();
    const bucket = this.loginAttempts.get(key);
    if (!bucket) return null;
    if (bucket.resetAt <= now) {
      this.loginAttempts.delete(key);
      return null;
    }
    if (bucket.count < limit) return null;
    return Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
  }

  /** Counts one failed attempt for a key. Only failures call this. */
  private recordFailure(key: string): void {
    const now = Date.now();
    const bucket = this.loginAttempts.get(key);
    if (!bucket || bucket.resetAt <= now) {
      this.loginAttempts.set(key, {
        count: 1,
        resetAt: now + this.loginWindowMs(),
      });
      return;
    }
    bucket.count += 1;
  }

  private clearFailures(key: string): void {
    this.loginAttempts.delete(key);
  }

  /**
   * Rejects only requests that already exhausted their failure budget. It must
   * be called before credential verification and must not increment counters;
   * the counters are updated on failure in `recordLoginFailure`.
   */
  private assertLoginRateLimit(ipAddress: string, staffId: string): {
    ipKey: string;
    accountKey: string;
  } {
    const ipKey = `ip:${ipAddress || 'unknown'}`;
    const accountKey = `acct:${staffId}:${ipAddress || 'unknown'}`;

    const ipWait = this.retryAfterSeconds(ipKey, this.maxFailedAttemptsPerIp());
    if (ipWait !== null) {
      throw new HttpException(
        `محاولات دخول كثيرة. يرجى المحاولة بعد ${ipWait} ثانية`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const accountWait = this.retryAfterSeconds(
      accountKey,
      this.maxFailedAttemptsPerAccountIp(),
    );
    if (accountWait !== null) {
      throw new HttpException(
        `محاولات دخول كثيرة لهذا الحساب. يرجى المحاولة بعد ${accountWait} ثانية`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return { ipKey, accountKey };
  }

  private recordLoginFailure(ipKey: string, accountKey: string): void {
    this.recordFailure(ipKey);
    this.recordFailure(accountKey);
  }

  /**
   * Validates credentials server-side, applies per-account lockout, and creates
   * an opaque session token whose hash (never the token itself) is stored.
   */
  async login(
    dto: LoginDto,
    ipAddress: string,
    userAgent?: string,
  ): Promise<LoginResult> {
    const staffId = dto.staffId.trim().toLowerCase();
    // Check the failure budget before doing any work; do not increment it here.
    const { ipKey, accountKey } = this.assertLoginRateLimit(ipAddress, staffId);

    const user = await this.prisma.staffUser.findUnique({ where: { staffId } });

    // Always run a bcrypt comparison so unknown accounts take a similar time.
    const passwordMatches = await verifyPassword(
      dto.password,
      user?.passwordHash || DUMMY_HASH,
    );

    if (!user || !passwordMatches) {
      // Only failed attempts consume the rate-limit budget.
      this.recordLoginFailure(ipKey, accountKey);
      if (user) {
        const failedLoginCount = user.failedLoginCount + 1;
        const lockedUntil =
          failedLoginCount >= this.maxFailedAttempts()
            ? new Date(Date.now() + this.lockMinutes() * 60 * 1000)
            : user.lockedUntil;
        await this.prisma.staffUser.update({
          where: { id: user.id },
          data: { failedLoginCount, lockedUntil },
        });
        await this.audit.log({
          actorUserId: user.id,
          action: 'AUTH_LOGIN_FAILED',
          entityType: 'StaffUser',
          entityId: user.id,
          details:
            failedLoginCount >= this.maxFailedAttempts()
              ? 'account locked'
              : 'invalid password',
          ipAddress,
        });
      } else {
        await this.audit.log({
          action: 'AUTH_LOGIN_FAILED',
          entityType: 'StaffUser',
          details: 'unknown staff id',
          ipAddress,
        });
      }
      throw new UnauthorizedException('معرف الموظف أو كلمة المرور غير صحيحة');
    }

    if (!user.isActive) {
      await this.audit.log({
        actorUserId: user.id,
        action: 'AUTH_LOGIN_DENIED',
        entityType: 'StaffUser',
        entityId: user.id,
        details: 'inactive account',
        ipAddress,
      });
      throw new UnauthorizedException('هذا الحساب غير مفعّل. راجع رئيس القسم.');
    }

    if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
      const minutes = Math.max(
        1,
        Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000),
      );
      throw new HttpException(
        `الحساب مقفل مؤقتاً بسبب محاولات دخول خاطئة. يرجى المحاولة بعد ${minutes} دقيقة`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // Credentials are valid: reset the per-account/IP failure budget. The IP
    // budget is intentionally not reset so a known-good login cannot be used
    // to clear an attacker's failures.
    this.clearFailures(accountKey);

    const rawToken = this.newToken();
    const expiresAt = new Date(Date.now() + this.sessionTtlMs());

    const session = await this.prisma.staffSession.create({
      data: {
        userId: user.id,
        tokenHash: this.hashToken(rawToken),
        expiresAt,
        ipAddress: ipAddress || null,
        userAgent: userAgent ? userAgent.slice(0, 500) : null,
      },
    });

    const updatedUser = await this.prisma.staffUser.update({
      where: { id: user.id },
      data: {
        failedLoginCount: 0,
        lockedUntil: null,
        lastLoginAt: new Date(),
      },
    });

    await this.audit.log({
      actorUserId: user.id,
      action: 'AUTH_LOGIN_SUCCESS',
      entityType: 'StaffSession',
      entityId: session.id,
      ipAddress,
    });

    this.logger.log(`Staff login: ${user.staffId} (${user.role})`);

    return {
      token: rawToken,
      expiresAt: expiresAt.toISOString(),
      user: this.toPublicUser(updatedUser),
    };
  }

  /**
   * Resolves a raw session token to a staff identity.
   * Returns null for unknown, expired, revoked, or deactivated sessions.
   */
  async resolveSession(rawToken: string): Promise<AuthenticatedUser | null> {
    if (!rawToken || rawToken.length < 20 || rawToken.length > 512) return null;

    const session = await this.prisma.staffSession.findUnique({
      where: { tokenHash: this.hashToken(rawToken) },
      include: { user: true },
    });

    if (!session) return null;
    if (session.revokedAt) return null;
    if (session.expiresAt.getTime() <= Date.now()) return null;
    if (!session.user.isActive) return null;

    return {
      id: session.user.id,
      staffId: session.user.staffId,
      fullName: session.user.fullName,
      role: session.user.role as StaffRole,
      sessionId: session.id,
    };
  }

  async logout(user: AuthenticatedUser, ipAddress: string): Promise<{ success: true }> {
    await this.prisma.staffSession.updateMany({
      where: { id: user.sessionId, userId: user.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    await this.audit.log({
      actorUserId: user.id,
      action: 'AUTH_LOGOUT',
      entityType: 'StaffSession',
      entityId: user.sessionId,
      ipAddress,
    });

    return { success: true };
  }

  async me(userId: string): Promise<PublicStaffUser> {
    const user = await this.prisma.staffUser.findUnique({ where: { id: userId } });
    if (!user || !user.isActive) {
      throw new UnauthorizedException('الحساب غير متاح');
    }
    return this.toPublicUser(user);
  }

  /** Revokes every active session for a user (used when disabling staff). */
  async revokeAllSessions(userId: string): Promise<void> {
    await this.prisma.staffSession.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  /** Small helper used by the create-staff CLI and tests. */
  async hashPassword(password: string): Promise<string> {
    return hashPassword(password);
  }
}
