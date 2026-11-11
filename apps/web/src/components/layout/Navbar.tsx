'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth, PERMISSIONS, ROLE_LABELS } from '../../lib/auth';

interface NavLinkItem {
  href: string;
  label: string;
}

export default function Navbar() {
  const pathname = usePathname();
  const { user, logout, can } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Close the mobile menu whenever the route changes.
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const links: NavLinkItem[] = [{ href: '/', label: 'الحضور' }];

  if (can(PERMISSIONS.STUDENT_FOLLOWUP_VIEW)) {
    links.push({ href: '/followup', label: 'متابعة الطلاب' });
  }
  if (can(PERMISSIONS.REPORTS_VIEW)) {
    links.push({ href: '/reports', label: 'التقارير' });
  }
  if (can(PERMISSIONS.STUDENTS_VIEW)) {
    links.push({ href: '/students', label: 'الطلاب' });
  }
  // صفحة "المراحل والمواد" تظهر فقط للمسؤولين (رئيس القسم والمسجل)
  // ويُحجب هذا الرابط عن التدريسيين لأن كل ما يحتاجه التدريسي موجود في "التقارير" وجدول المحاضرات
  if (
    user?.role === 'HEAD_OF_DEPARTMENT' ||
    user?.role === 'REGISTRAR' ||
    user?.role === 'SYSTEM_OWNER'
  ) {
    if (
      can(PERMISSIONS.SECTIONS_VIEW) ||
      can(PERMISSIONS.COURSES_VIEW) ||
      can(PERMISSIONS.ASSIGNMENTS_VIEW)
    ) {
      links.push({ href: '/academics', label: 'المراحل والمواد' });
    }
  }
  if (can(PERMISSIONS.MANAGE_STAFF)) {
    links.push({ href: '/staff', label: 'الموظفون' });
  }

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`);

  const roleLabel = user ? ROLE_LABELS[user.role] || user.role : '';

  return (
    <nav className="nav-bar no-print">
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

      {/* Desktop navigation */}
      <div className="nav-right">
        <div className="nav-links nav-desktop-links">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`nav-link ${isActive(link.href) ? 'active' : ''}`}
            >
              {link.label}
            </Link>
          ))}
        </div>

        {user && (
          <div className="nav-user-chip" title={`${user.fullName} (${user.staffId})`}>
            <span style={{ fontSize: '12px' }}>👤</span>
            <span className="nav-user-name">{user.fullName}</span>
            <span style={{ color: '#D4AF37', fontWeight: '700' }}>{roleLabel}</span>
          </div>
        )}

        {user && (
          <button type="button" className="nav-logout" onClick={() => logout()}>
            تسجيل الخروج
          </button>
        )}

        <div className="nav-dev-badge" title="مطور ومبرمج النظام: Mohammed Redha">
          <span style={{ fontSize: '12px' }}>⚡</span>
          <span>تطوير:</span>
          <strong style={{ color: '#FFFFFF', letterSpacing: '0.3px' }}>Mohammed Redha</strong>
        </div>

        <button
          type="button"
          className="nav-menu-toggle"
          aria-expanded={mobileOpen}
          aria-label="القائمة"
          onClick={() => setMobileOpen((open) => !open)}
        >
          <span className="nav-menu-icon" aria-hidden="true">
            {mobileOpen ? '✕' : '☰'}
          </span>
          <span>القائمة</span>
        </button>
      </div>

      {/* Mobile navigation */}
      {mobileOpen && (
        <div className="nav-mobile-panel">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`nav-mobile-link ${isActive(link.href) ? 'active' : ''}`}
            >
              {link.label}
            </Link>
          ))}

          {user && (
            <div className="nav-mobile-user">
              <span>👤 {user.fullName}</span>
              <span style={{ color: '#D4AF37', fontWeight: '700' }}>{roleLabel}</span>
              <span style={{ color: 'rgba(255,255,255,0.55)' }}>{user.staffId}</span>
            </div>
          )}

          {user && (
            <button
              type="button"
              className="nav-mobile-logout"
              onClick={() => logout()}
            >
              تسجيل الخروج
            </button>
          )}
        </div>
      )}
    </nav>
  );
}
