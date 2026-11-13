import { BadRequestException } from '@nestjs/common';

/**
 * Phase 2 academic model constants.
 *
 * The college has four fixed study stages. A section, a student and a course
 * each belong to exactly one stage; the study period (MORNING/EVENING) is an
 * independent dimension.
 */
export const ACADEMIC_STAGES = [1, 2, 3, 4] as const;

export type AcademicStage = (typeof ACADEMIC_STAGES)[number];

export const DEFAULT_STAGE: AcademicStage = 2;

export const STAGE_LABELS: Record<AcademicStage, string> = {
  1: 'المرحلة الأولى',
  2: 'المرحلة الثانية',
  3: 'المرحلة الثالثة',
  4: 'المرحلة الرابعة',
};

export function isAcademicStage(value: unknown): value is AcademicStage {
  const num = Number(value);
  return (ACADEMIC_STAGES as readonly number[]).includes(num);
}

export function normalizeStage(value: unknown, fallback: AcademicStage = DEFAULT_STAGE): AcademicStage {
  const num = Number(value);
  return isAcademicStage(num) ? num : fallback;
}

/**
 * Strict variant for explicit client input. Invalid or missing values are
 * rejected instead of silently falling back to stage 2.
 */
export function requireAcademicStage(
  value: unknown,
  message = 'المرحلة غير صالحة. اختر مرحلة بين 1 و4',
): AcademicStage {
  const num = Number(value);
  if (!isAcademicStage(num)) {
    throw new BadRequestException(message);
  }
  return num;
}

/** Student code prefix for a stage, e.g. stage 2 -> "S2-". */
export function stageCodePrefix(stage: number): string {
  return `S${normalizeStage(stage)}-`;
}

/**
 * Normalises a student code to the stage-prefixed format. Purely numeric codes
 * (the legacy 1001..1297 range) get the stage prefix; any other code is kept
 * exactly as entered so existing/custom identifiers are never rewritten.
 */
export function normalizeStudentCode(code: string, stage: number): string {
  const clean = String(code || '').trim();
  if (!clean) return clean;
  if (/^\d+$/.test(clean)) {
    return `${stageCodePrefix(stage)}${clean}`;
  }
  return clean;
}
