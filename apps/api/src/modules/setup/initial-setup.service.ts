import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import {
  hashPassword,
  isValidStaffId,
  normalizeStaffId,
  validatePasswordStrength,
} from '../../common/utils/password';
import { SYSTEM_OWNER_ROLE } from '../../common/constants/roles';

/** Marker that makes the initial setup a one-time operation. */
export const INITIAL_SETUP_KEY = 'initial_setup_completed';

export interface InitialSetupAccountInput {
  staffId: string;
  fullName: string;
  password: string;
}

export interface InitialSetupInput {
  owner: InitialSetupAccountInput;
  head: InitialSetupAccountInput;
  registrar: InitialSetupAccountInput;
}

export interface InitialSetupAccountResult {
  id: string;
  staffId: string;
  fullName: string;
  role: string;
  /** True when the account was newly created by this run. */
  created: boolean;
  /** True when an existing sole Head of Department account was adopted. */
  adopted: boolean;
}

export interface InitialSetupResult {
  completedAt: string;
  accounts: InitialSetupAccountResult[];
}

function cleanFullName(value: string, label: string): string {
  const fullName = (value || '').trim();
  if (fullName.length < 2 || fullName.length > 120) {
    throw new BadRequestException(`اسم ${label} يجب أن يكون بين حرفين و120 حرفًا`);
  }
  return fullName;
}

function cleanStaffId(value: string, label: string): string {
  const staffId = normalizeStaffId(value || '');
  if (!isValidStaffId(staffId)) {
    throw new BadRequestException(
      `معرف ${label} غير صالح. استخدم أحرفًا لاتينية صغيرة وأرقامًا ونقاطًا أو شرطات (3-64 حرفًا)`,
    );
  }
  return staffId;
}

function assertStrongPassword(password: string, staffId: string, label: string): void {
  const error = validatePasswordStrength(password, staffId);
  if (error) {
    throw new BadRequestException(`كلمة مرور ${label}: ${error}`);
  }
}

/**
 * Creates the three first-run accounts exactly once:
 *   - isolated SYSTEM_OWNER test account
 *   - HEAD_OF_DEPARTMENT
 *   - REGISTRAR
 *
 * The command is intentionally CLI-only (no HTTP endpoint). A SystemSetting
 * marker is written inside the same transaction as the accounts, so a failed
 * run rolls back completely and a successful run can never be repeated.
 */
@Injectable()
export class InitialSetupService {
  private readonly logger = new Logger(InitialSetupService.name);

  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  async isCompleted(): Promise<boolean> {
    const marker = await this.prisma.systemSetting.findUnique({
      where: { key: INITIAL_SETUP_KEY },
    });
    return Boolean(marker);
  }

  async run(input: InitialSetupInput): Promise<InitialSetupResult> {
    const ownerStaffId = cleanStaffId(input.owner.staffId, 'المالك');
    const headStaffId = cleanStaffId(input.head.staffId, 'رئيس القسم');
    const registrarStaffId = cleanStaffId(input.registrar.staffId, 'المسجل');

    const uniqueIds = new Set([ownerStaffId, headStaffId, registrarStaffId]);
    if (uniqueIds.size !== 3) {
      throw new BadRequestException('معرفات الحسابات الثلاثة يجب أن تكون مختلفة');
    }

    if (
      input.owner.password === input.head.password ||
      input.owner.password === input.registrar.password ||
      input.head.password === input.registrar.password
    ) {
      throw new BadRequestException(
        'يجب استخدام كلمة مرور مستقلة لكل حساب من الحسابات الثلاثة',
      );
    }

    assertStrongPassword(input.owner.password, ownerStaffId, 'المالك');
    assertStrongPassword(input.head.password, headStaffId, 'رئيس القسم');
    assertStrongPassword(input.registrar.password, registrarStaffId, 'المسجل');

    let result: InitialSetupResult;

    try {
      result = await this.prisma.$transaction(
        async (tx) => {
        const existingMarker = await tx.systemSetting.findUnique({
          where: { key: INITIAL_SETUP_KEY },
        });
        if (existingMarker) {
          throw new ConflictException('تم تنفيذ الإعداد الأولي مسبقًا ولا يمكن تكراره');
        }

        const existingOwner = await tx.staffUser.findFirst({
          where: { role: SYSTEM_OWNER_ROLE },
        });
        if (existingOwner) {
          throw new ConflictException(
            'يوجد حساب مالك نظام مسبقًا؛ لا يمكن تشغيل الإعداد الأولي مرة أخرى',
          );
        }

        const conflictingOwner = await tx.staffUser.findUnique({
          where: { staffId: ownerStaffId },
        });
        if (conflictingOwner) {
          throw new ConflictException(`المعرف "${ownerStaffId}" مستخدم بالفعل`);
        }

        const conflictingRegistrar = await tx.staffUser.findUnique({
          where: { staffId: registrarStaffId },
        });
        if (conflictingRegistrar) {
          throw new ConflictException(`المعرف "${registrarStaffId}" مستخدم بالفعل`);
        }

        // Adopt an existing sole Head of Department (the live installation may
        // already have one) instead of deleting or duplicating it.
        const existingHeads = await tx.staffUser.findMany({
          where: { role: 'HEAD_OF_DEPARTMENT' },
        });
        if (existingHeads.length > 1) {
          throw new ConflictException(
            'يوجد أكثر من حساب رئيس قسم؛ عالج التكرار قبل تشغيل الإعداد الأولي',
          );
        }

        const now = new Date();
        const completedAt = now.toISOString();

        const ownerHash = await hashPassword(input.owner.password);
        const registrarHash = await hashPassword(input.registrar.password);

        const owner = await tx.staffUser.create({
          data: {
            staffId: ownerStaffId,
            fullName: cleanFullName(input.owner.fullName, 'المالك'),
            role: SYSTEM_OWNER_ROLE,
            passwordHash: ownerHash,
            isActive: true,
          },
        });

        const registrar = await tx.staffUser.create({
          data: {
            staffId: registrarStaffId,
            fullName: cleanFullName(input.registrar.fullName, 'المسجل'),
            role: 'REGISTRAR',
            passwordHash: registrarHash,
            isActive: true,
          },
        });

        let head;
        let adopted = false;

        if (existingHeads.length === 1) {
          const existingHead = existingHeads[0];
          if (existingHead.staffId !== headStaffId) {
            throw new ConflictException(
              `يوجد رئيس قسم فعال بالمعرف "${existingHead.staffId}". استخدم هذا المعرف أو أوقفه قبل الإعداد`,
            );
          }
          adopted = true;
          head = await tx.staffUser.update({
            where: { id: existingHead.id },
            data: {
              fullName: cleanFullName(input.head.fullName, 'رئيس القسم'),
              role: 'HEAD_OF_DEPARTMENT',
              passwordHash: await hashPassword(input.head.password),
              isActive: true,
              failedLoginCount: 0,
              lockedUntil: null,
            },
          });
          await tx.staffSession.updateMany({
            where: { userId: existingHead.id, revokedAt: null },
            data: { revokedAt: now },
          });
        } else {
          const conflictingHead = await tx.staffUser.findUnique({
            where: { staffId: headStaffId },
          });
          if (conflictingHead) {
            throw new ConflictException(`المعرف "${headStaffId}" مستخدم بالفعل`);
          }
          head = await tx.staffUser.create({
            data: {
              staffId: headStaffId,
              fullName: cleanFullName(input.head.fullName, 'رئيس القسم'),
              role: 'HEAD_OF_DEPARTMENT',
              passwordHash: await hashPassword(input.head.password),
              isActive: true,
            },
          });
        }

        await tx.systemSetting.create({
          data: { key: INITIAL_SETUP_KEY, value: completedAt },
        });

        return {
          completedAt,
          accounts: [
            {
              id: owner.id,
              staffId: owner.staffId,
              fullName: owner.fullName,
              role: owner.role,
              created: true,
              adopted: false,
            },
            {
              id: head.id,
              staffId: head.staffId,
              fullName: head.fullName,
              role: head.role,
              created: !adopted,
              adopted,
            },
            {
              id: registrar.id,
              staffId: registrar.staffId,
              fullName: registrar.fullName,
              role: registrar.role,
              created: true,
              adopted: false,
            },
          ],
        };
        },
        { maxWait: 10000, timeout: 30000 },
      );
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          throw new ConflictException(
            'تعذر إنشاء الحسابات الأولية بسبب تعارض في المعرفات أو وجود إعداد سابق',
          );
        }
      }
      throw error;
    }

    // Audit the setup without ever including passwords. Logging failures are
    // already swallowed by AuditService and must not roll back the setup.
    await this.audit.log({
      actorUserId: result.accounts[0]?.id ?? null,
      action: 'SYSTEM_INITIAL_SETUP',
      entityType: 'SystemSetting',
      entityId: INITIAL_SETUP_KEY,
      details: JSON.stringify({
        accounts: result.accounts.map((account) => ({
          staffId: account.staffId,
          role: account.role,
          adopted: account.adopted,
        })),
      }),
    });

    this.logger.log(
      `Initial setup completed with accounts: ${result.accounts
        .map((account) => `${account.staffId} (${account.role})`)
        .join(', ')}`,
    );

    return result;
  }
}
