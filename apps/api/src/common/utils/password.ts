import * as bcrypt from 'bcryptjs';
import { randomInt } from 'crypto';

/** Cost factor used everywhere a staff password is hashed. */
export const BCRYPT_ROUNDS = 12;

/**
 * Minimum length for every staff password, including first-run accounts.
 * Six characters keeps day-to-day use simple; there are no character-class
 * requirements, so a lecturer can use whatever combination they prefer.
 */
export const PASSWORD_MIN_LENGTH = 6;
export const PASSWORD_MAX_LENGTH = 200;

/**
 * Returns an Arabic error message when the password is too short, or null when
 * it is acceptable. Only the length is enforced: letters, digits and symbols
 * are all accepted without additional complexity rules.
 */
export function validatePasswordStrength(
  password: string,
  _staffId?: string,
): string | null {
  if (typeof password !== 'string' || password.length === 0) {
    return 'كلمة المرور مطلوبة';
  }
  if (password.length < PASSWORD_MIN_LENGTH) {
    return `كلمة المرور يجب أن تكون ${PASSWORD_MIN_LENGTH} أحرف على الأقل`;
  }
  if (password.length > PASSWORD_MAX_LENGTH) {
    return `كلمة المرور يجب ألا تتجاوز ${PASSWORD_MAX_LENGTH} حرفًا`;
  }
  return null;
}

/**
 * Generates a random password that satisfies the policy above. Used only by
 * local CLI helpers; the value is shown once and never persisted in plaintext.
 */
export function generateStrongPassword(length = 20): string {
  const alphabet =
    'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*';
  const safeLength = Math.max(PASSWORD_MIN_LENGTH + 4, length);
  for (let attempt = 0; attempt < 50; attempt++) {
    let candidate = '';
    for (let index = 0; index < safeLength; index++) {
      candidate += alphabet[randomInt(alphabet.length)];
    }
    if (validatePasswordStrength(candidate) === null) return candidate;
  }
  throw new Error('Unable to generate a password that satisfies the policy');
}

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

export function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/** Normalises a staff login id (lowercase, trimmed). */
export function normalizeStaffId(value: string): string {
  return value.trim().toLowerCase();
}

/** Shared validation for staff login ids. */
export function isValidStaffId(value: string): boolean {
  return /^[a-z0-9][a-z0-9._-]{2,63}$/.test(value);
}
