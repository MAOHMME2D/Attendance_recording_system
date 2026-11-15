import RequireAuth from '../../components/auth/RequireAuth';
import type { Permission } from '../../lib/auth';

/**
 * Layouts are Server Components. Import only the *type* from the client auth
 * module to avoid breaking the React Client Manifest during `next build`.
 */
export default function StaffLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireAuth permission={'MANAGE_STAFF' as Permission}>{children}</RequireAuth>
  );
}
