import { SetMetadata } from '@nestjs/common';
import type { Permission } from '../constants/roles';

export const REQUIRED_PERMISSIONS_KEY = 'requiredPermissions';

/**
 * Requires the authenticated staff member to hold every listed permission.
 * Omit this decorator on authenticated routes to only require a valid session.
 */
export const RequirePermissions = (...permissions: Permission[]) =>
  SetMetadata(REQUIRED_PERMISSIONS_KEY, permissions);
