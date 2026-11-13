import RequireAuth from '../../components/auth/RequireAuth';

/**
 * Access is granted to any role holding at least one of the academic
 * permissions (sections / courses / assignments). Each tab is additionally
 * hidden and guarded by its own permission inside the page; the API enforces
 * the authoritative checks.
 */
export default function AcademicsLayout({ children }: { children: React.ReactNode }) {
  return <RequireAuth>{children}</RequireAuth>;
}
