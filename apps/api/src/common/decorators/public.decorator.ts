import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Marks a route as reachable without a staff session.
 * Use sparingly: login and health checks only.
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
