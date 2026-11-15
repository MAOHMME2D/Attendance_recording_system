import RequireAuth from '../../components/auth/RequireAuth';
import type { Permission } from '../../lib/auth';

export default function FollowupLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireAuth permission={'STUDENT_FOLLOWUP_VIEW' as Permission}>{children}</RequireAuth>
  );
}
