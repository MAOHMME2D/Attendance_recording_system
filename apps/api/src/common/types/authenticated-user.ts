import type { StaffRole } from '../constants/roles';

/** The identity attached to an authenticated HTTP request or WebSocket. */
export interface AuthenticatedUser {
  id: string;
  staffId: string;
  fullName: string;
  role: StaffRole;
  sessionId: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}
