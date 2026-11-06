import RequireAuth from '../../components/auth/RequireAuth';
import type { Permission } from '../../lib/auth';

/**
 * Layouts are Server Components. Import only the *type* from the client auth
 * module: reading a runtime export (PERMISSIONS) from a "use client" file inside
 * a server layout breaks the React Client Manifest during `next build`.
 */
export default function ReportsLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireAuth permission={'REPORTS_VIEW' as Permission}>{children}</RequireAuth>
  );
}
