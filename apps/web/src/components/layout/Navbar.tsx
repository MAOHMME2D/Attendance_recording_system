'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth, PERMISSIONS, ROLE_LABELS } from '../../lib/auth';

export default function Navbar() {
  const pathname = usePathname();
  const { user, logout, can } = useAuth();

  const showReports = can(PERMISSIONS.REPORTS_VIEW);
  const showStudents = can(PERMISSIONS.STUDENTS_VIEW);
  const showStaff = can(PERMISSIONS.MANAGE_STAFF);

  return (
    <nav className="nav-bar no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
      <Link href="/" className="nav-logo">
        <img
          src="/navbar-logo.png"
          alt="كلية البوليتكنك - كربلاء | Polytechnic College - Karbala"
          className="nav-brand-mark"
        />
        <span className="nav-brand-rule" aria-hidden="true" />
        <div className="nav-brand-copy">
          <span className="nav-brand-title">نظام تسجيل الحضور الذكي</span>
          <span className="nav-brand-sub">قسم تقنيات المختبرات الطبية</span>
        </div>
      </Link>

      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
        <div className="nav-links">
          <Link href="/" className={`nav-link ${pathname === '/' ? 'active' : ''}`}>
            الحضور
          </Link>
          {showReports && (
            <Link href="/reports" className={`nav-link ${pathname === '/reports' ? 'active' : ''}`}>
              التقارير
            </Link>
          )}
          {showStudents && (
            <Link href="/students" className={`nav-link ${pathname === '/students' ? 'active' : ''}`}>
              الطلاب
            </Link>
          )}
          {showStaff && (
            <Link href="/staff" className={`nav-link ${pathname === '/staff' ? 'active' : ''}`}>
              الموظفون
            </Link>
          )}
        </div>

        {user && (
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              background: 'rgba(255, 255, 255, 0.12)',
              padding: '5px 12px',
              borderRadius: '20px',
              fontSize: '11.5px',
              color: '#F3F4F6',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
            }}
            title={`${user.fullName} (${user.staffId})`}
          >
            <span style={{ fontSize: '12px' }}>👤</span>
            <span style={{ maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {user.fullName}
            </span>
            <span style={{ color: '#D4AF37', fontWeight: '700' }}>
              {ROLE_LABELS[user.role] || user.role}
            </span>
          </div>
        )}

        {user && (
          <button
            type="button"
            onClick={() => logout()}
            style={{
              background: 'rgba(255, 255, 255, 0.08)',
              border: '1px solid rgba(255, 255, 255, 0.25)',
              color: '#F3F4F6',
              borderRadius: '20px',
              padding: '5px 14px',
              fontSize: '11.5px',
              fontWeight: '700',
              cursor: 'pointer',
            }}
            title="إنهاء الجلسة الحالية"
          >
            تسجيل الخروج
          </button>
        )}

        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            background: 'rgba(255, 255, 255, 0.12)',
            padding: '5px 12px',
            borderRadius: '20px',
            fontSize: '11.5px',
            color: '#F3F4F6',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
          }}
          title="مطور ومبرمج النظام: Mohammed Redha"
        >
          <span style={{ fontSize: '12px' }}>⚡</span>
          <span>تطوير:</span>
          <strong style={{ color: '#FFFFFF', letterSpacing: '0.3px' }}>Mohammed Redha</strong>
        </div>
      </div>
    </nav>
  );
}
