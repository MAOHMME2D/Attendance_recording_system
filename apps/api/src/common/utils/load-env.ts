import { config } from 'dotenv';
import { join } from 'path';

let loaded = false;

/**
 * Loads .env from the repository root and from apps/api. Existing environment
 * variables always win, so tests/deployments can override files.
 */
export function loadEnvironment(): void {
  if (loaded) return;
  loaded = true;

  const candidates = [
    join(__dirname, '..', '..', '..', '..', '..', '.env'), // repository root
    join(__dirname, '..', '..', '..', '.env'), // apps/api
    join(process.cwd(), '.env'),
  ];

  for (const path of candidates) {
    config({ path });
  }
}
