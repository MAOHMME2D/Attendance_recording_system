export const SESSION_COOKIE_NAME = 'attendance_session';

/** Parses a Cookie header without adding a runtime dependency. */
export function readCookie(cookieHeader: string | undefined, name: string): string | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(';')) {
    const index = part.indexOf('=');
    if (index === -1) continue;
    const key = part.slice(0, index).trim();
    if (key !== name) continue;
    const rawValue = part.slice(index + 1).trim();
    try {
      return decodeURIComponent(rawValue);
    } catch {
      return rawValue;
    }
  }
  return null;
}

/** Extracts a bearer token from the Authorization header. */
export function readBearerToken(authorization: string | undefined): string | null {
  if (!authorization) return null;
  const [scheme, value] = authorization.split(' ');
  if (!value || scheme.toLowerCase() !== 'bearer') return null;
  return value.trim() || null;
}
