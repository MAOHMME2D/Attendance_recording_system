'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function Navbar() {
  const pathname = usePathname();

  return (
    <nav className="nav-bar no-print">
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
        <Link href="/my-qr" className={`nav-link ${pathname === '/my-qr' ? 'active' : ''}`} target="_blank">
          بطاقة الطالب
        </Link>
      </div>
    </nav>
  );
}

