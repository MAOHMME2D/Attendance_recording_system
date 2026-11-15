'use client';

import Link from 'next/link';

export default function StudentSelfAttendancePage() {
  return (
    <div
      dir="rtl"
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px 16px',
        background: '#F9FAFB',
      }}
    >
      <div
        style={{
          maxWidth: '520px',
          width: '100%',
          background: '#FFFFFF',
          borderRadius: '20px',
          padding: '32px 26px',
          border: '1px solid #E5E7EB',
          boxShadow: '0 12px 36px rgba(0,0,0,0.06)',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            width: '60px',
            height: '60px',
            borderRadius: '50%',
            background: '#FEF2F2',
            color: '#DC2626',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 16px auto',
            fontSize: '28px',
            fontWeight: '800',
          }}
        >
          !
        </div>

        <h1 style={{ fontSize: '21px', fontWeight: '800', color: '#111827', marginBottom: '10px' }}>
          تسجيل الحضور الذاتي غير متاح
        </h1>

        <p style={{ fontSize: '14px', color: '#4B5563', lineHeight: 1.8, marginBottom: '24px' }}>
          لا يملك الطلاب حسابات في النظام ولا يمكنهم تسجيل الحضور بأنفسهم.
          يتم تسجيل الحضور بواسطة المحاضر المختص عبر مسح بطاقة الـ QR الخاصة بالطالب.
        </p>

        <Link
          href="/login"
          style={{
            display: 'inline-block',
            padding: '10px 24px',
            borderRadius: '10px',
            background: '#111827',
            color: '#FFFFFF',
            fontWeight: '700',
            fontSize: '14px',
            textDecoration: 'none',
          }}
        >
          دخول الكادر التدريسي
        </Link>
      </div>
    </div>
  );
}
