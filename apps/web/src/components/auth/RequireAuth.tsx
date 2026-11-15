'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth, ROLE_LABELS, type Permission } from '../../lib/auth';

interface RequireAuthProps {
  children: React.ReactNode;
  permission?: Permission;
}

export function AuthLoading() {
  return (
    <div
      style={{
        minHeight: '60vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '14px',
        color: '#4B5563',
        fontSize: '14px',
      }}
    >
      <div
        style={{
          width: '34px',
          height: '34px',
          borderRadius: '50%',
          border: '3px solid #E5E7EB',
          borderTopColor: '#111827',
          animation: 'spin 0.8s linear infinite',
        }}
      />
      <span>جارٍ التحقق من الجلسة...</span>
      <style jsx>{`
        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  );
}

export default function RequireAuth({ children, permission }: RequireAuthProps) {
  const { user, loading, can } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !user) {
      const next = pathname && pathname !== '/login' ? `?next=${encodeURIComponent(pathname)}` : '';
      router.replace(`/login${next}`);
    }
  }, [loading, user, router, pathname]);

  if (loading || !user) {
    return <AuthLoading />;
  }

  if (permission && !can(permission)) {
    return (
      <div
        style={{
          maxWidth: '560px',
          margin: '60px auto',
          padding: '32px',
          background: '#FFFFFF',
          border: '1px solid #E5E7EB',
          borderRadius: '18px',
          textAlign: 'center',
          boxShadow: '0 10px 30px rgba(0,0,0,0.05)',
        }}
      >
        <div
          style={{
            width: '56px',
            height: '56px',
            borderRadius: '50%',
            background: '#FEF2F2',
            color: '#DC2626',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 16px auto',
            fontSize: '24px',
            fontWeight: '800',
          }}
        >
          !
        </div>
        <h2 style={{ fontSize: '20px', fontWeight: '800', color: '#111827', marginBottom: '8px' }}>
          لا تملك صلاحية الوصول
        </h2>
        <p style={{ color: '#4B5563', fontSize: '14px', lineHeight: '1.7', marginBottom: '20px' }}>
          حسابك مسجّل بصفة <strong>{ROLE_LABELS[user.role] || user.role}</strong> ولا يمنحه النظام
          الوصول إلى هذه الصفحة. راجع رئيس القسم إذا كنت تعتقد أن هذا خطأ.
        </p>
        <Link
          href="/"
          style={{
            display: 'inline-block',
            padding: '10px 22px',
            borderRadius: '10px',
            background: '#111827',
            color: '#FFFFFF',
            fontSize: '14px',
            fontWeight: '700',
            textDecoration: 'none',
          }}
        >
          العودة إلى صفحة الحضور
        </Link>
      </div>
    );
  }

  return <>{children}</>;
}
