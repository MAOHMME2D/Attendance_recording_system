'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
  ApiError,
  authApi,
  type StaffRole,
  type StaffUser,
} from './api';

/** Mirrors the server permission matrix (apps/api/src/common/constants/roles.ts). */
export const PERMISSIONS = {
  LECTURE_CREATE: 'LECTURE_CREATE',
  LECTURE_CONDUCT: 'LECTURE_CONDUCT',
  LECTURE_VIEW_ALL: 'LECTURE_VIEW_ALL',
  LECTURE_DELETE: 'LECTURE_DELETE',
  REPORTS_VIEW: 'REPORTS_VIEW',
  ATTENDANCE_MANUAL: 'ATTENDANCE_MANUAL',
  STUDENTS_VIEW: 'STUDENTS_VIEW',
  STUDENT_OPTIONS: 'STUDENT_OPTIONS',
  STUDENTS_MANAGE: 'STUDENTS_MANAGE',
  SECTIONS_VIEW: 'SECTIONS_VIEW',
  SECTIONS_MANAGE: 'SECTIONS_MANAGE',
  TIMETABLE_VIEW: 'TIMETABLE_VIEW',
  TIMETABLE_MANAGE: 'TIMETABLE_MANAGE',
  COURSES_VIEW: 'COURSES_VIEW',
  COURSES_MANAGE: 'COURSES_MANAGE',
  ASSIGNMENTS_VIEW: 'ASSIGNMENTS_VIEW',
  ASSIGNMENTS_MANAGE: 'ASSIGNMENTS_MANAGE',
  STUDENT_FOLLOWUP_VIEW: 'STUDENT_FOLLOWUP_VIEW',
  QR_ISSUE: 'QR_ISSUE',
  ABSENCES_RESET: 'ABSENCES_RESET',
  AUDIT_VIEW: 'AUDIT_VIEW',
  MANAGE_STAFF: 'MANAGE_STAFF',
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const ROLE_LABELS: Record<StaffRole, string> = {
  HEAD_OF_DEPARTMENT: 'رئيس القسم',
  REGISTRAR: 'مقرر',
  LECTURER: 'تدريسي',
  TECHNICAL_LECTURER: 'تدريسي خارجي',
  SYSTEM_OWNER: 'مالك النظام',
};

interface AuthContextValue {
  user: StaffUser | null;
  loading: boolean;
  login: (staffId: string, password: string) => Promise<StaffUser>;
  logout: () => Promise<void>;
  can: (permission: Permission) => boolean;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

interface AuthProviderProps {
  children: React.ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<StaffUser | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();
  const requestRef = useRef(0);

  const refresh = useCallback(async () => {
    const requestId = ++requestRef.current;
    try {
      const me = await authApi.me();
      if (requestRef.current === requestId) setUser(me);
    } catch (error) {
      if (requestRef.current === requestId) setUser(null);
    } finally {
      if (requestRef.current === requestId) setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    const handleUnauthorized = () => {
      setUser(null);
      setLoading(false);
    };
    window.addEventListener('attendance:unauthorized', handleUnauthorized);
    return () => {
      window.removeEventListener('attendance:unauthorized', handleUnauthorized);
    };
  }, []);

  const login = useCallback(async (staffId: string, password: string) => {
    const result = await authApi.login(staffId, password);
    setUser(result.user);
    setLoading(false);
    return result.user;
  }, []);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch (error) {
      // The local state must be cleared even if the server session already expired.
      if (!(error instanceof ApiError) || error.status !== 401) {
        // Swallowed intentionally: logging out locally is always safe.
      }
    }
    setUser(null);
    if (pathname !== '/login') {
      router.replace('/login');
    }
  }, [pathname, router]);

  const can = useCallback(
    (permission: Permission) => Boolean(user?.permissions?.includes(permission)),
    [user],
  );

  const value = useMemo<AuthContextValue>(
    () => ({ user, loading, login, logout, can, refresh }),
    [user, loading, login, logout, can, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return context;
}
