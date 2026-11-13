/**
 * CORS is opt-in. Wildcards are never used.
 *
 * Defaults only cover the local development UI. Any LAN or production
 * deployment must set CORS_ORIGINS explicitly, e.g.
 *   CORS_ORIGINS=http://192.168.1.20:3000,https://attendance.example.edu
 */
export function getAllowedOrigins(): string[] {
  const configured = (process.env.CORS_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (configured.length > 0) {
    return configured;
  }

  return ['http://localhost:3000', 'http://127.0.0.1:3000'];
}

export function isAllowedOrigin(origin: string | undefined): boolean {
  if (!origin) return true; // same-origin/non-browser clients do not send Origin
  return getAllowedOrigins().includes(origin);
}
