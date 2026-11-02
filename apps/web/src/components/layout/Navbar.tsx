'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function Navbar() {
  const pathname = usePathname();

  return (
    <nav className="nav-bar no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
      <Link href="/" className="nav-logo" style={{ display: 'flex', alignItems: 'center', gap: '12px', textDecoration: 'none' }}>
        <img
          src="/college-logo.png"
          alt="كلية البوليتكنك | قسم تقنيات المختبرات الطبية"
          style={{
            height: '40px',
            objectFit: 'contain',
            background: '#FFFFFF',
            padding: '2px 8px',
            borderRadius: '8px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
          }}
        />
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: '15px', fontWeight: '800', lineHeight: 1.2, color: '#FFFFFF' }}>
            نظام تسجيل الحضور الذكي
          </span>
          <span style={{ fontSize: '11px', color: '#E5E7EB', fontWeight: '600' }}>
            كلية البوليتكنك | قسم تقنيات المختبرات الطبية
          </span>
        </div>
      </Link>

      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
        <div className="nav-links">
          <Link href="/" className={`nav-link ${pathname === '/' ? 'active' : ''}`}>
            الحضور
          </Link>
          <Link href="/reports" className={`nav-link ${pathname === '/reports' ? 'active' : ''}`}>
            التقارير
          </Link>
          <Link href="/students" className={`nav-link ${pathname === '/students' ? 'active' : ''}`}>
            الطلاب
          </Link>
        </div>

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
