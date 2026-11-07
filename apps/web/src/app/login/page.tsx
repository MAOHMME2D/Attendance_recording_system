'use client';

import React, { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '../../lib/auth';
import { ApiError } from '../../lib/api';

function safeNextPath(value: string | null): string {
  if (!value) return '/';
  // Only allow internal absolute paths, never protocol-relative URLs.
  if (!value.startsWith('/') || value.startsWith('//')) return '/';
  if (value.startsWith('/login')) return '/';
  return value;
}

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading, login } = useAuth();

  const nextPath = safeNextPath(searchParams.get('next'));

  const [staffId, setStaffId] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Already signed in: go straight to the requested page.
  useEffect(() => {
    if (!loading && user) {
      router.replace(nextPath);
    }
  }, [loading, user, router, nextPath]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    const cleanStaffId = staffId.trim();
    if (!cleanStaffId) {
      setError('يرجى إدخال معرف الموظف.');
      return;
    }
    if (password.length < 8) {
      setError('كلمة المرور يجب أن تكون 8 أحرف على الأقل.');
      return;
    }

    setSubmitting(true);
    try {
      await login(cleanStaffId, password);
      router.replace(nextPath);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('تعذر الاتصال بالخادم. تحقق من الشبكة وحاول مرة أخرى.');
      }
      setPassword('');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      dir="rtl"
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px 16px',
        background:
          'radial-gradient(circle at 20% 0%, #1F2937 0%, #0B0F19 45%, #05070C 100%)',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '430px',
          background: '#FFFFFF',
          borderRadius: '22px',
          padding: '30px 26px',
          boxShadow: '0 24px 60px rgba(0,0,0,0.35)',
          border: '1px solid rgba(212,175,55,0.35)',
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: '22px' }}>
          <img
            src="/college-logo.png"
            alt="شعار الكلية"
            style={{
              width: '58px',
              height: '58px',
              objectFit: 'contain',
              margin: '0 auto 10px auto',
              display: 'block',
            }}
          />
          <h1 style={{ fontSize: '21px', fontWeight: '800', color: '#111827', margin: 0 }}>
            تسجيل دخول الكادر التدريسي
          </h1>
          <p style={{ fontSize: '13px', color: '#6B7280', marginTop: '6px', lineHeight: 1.6 }}>
            نظام تسجيل الحضور الذكي • قسم تقنيات المختبرات الطبية
          </p>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '28px 0', color: '#6B7280', fontSize: '13px' }}>
            جارٍ التحقق من الجلسة...
          </div>
        ) : (
          <form onSubmit={handleSubmit} noValidate>
            <div style={{ marginBottom: '14px' }}>
              <label
                htmlFor="staff-id"
                style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#374151', marginBottom: '6px' }}
              >
                معرف الموظف
              </label>
              <input
                id="staff-id"
                name="staffId"
                type="text"
                className="input"
                autoComplete="username"
                inputMode="text"
                placeholder="مثال: registrar1"
                value={staffId}
                onChange={(event) => setStaffId(event.target.value)}
                disabled={submitting}
                autoFocus
                style={{ width: '100%', fontSize: '15px', padding: '11px 14px', textAlign: 'left', direction: 'ltr' }}
              />
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label
                htmlFor="password"
                style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#374151', marginBottom: '6px' }}
              >
                كلمة المرور
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  className="input"
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  disabled={submitting}
                  style={{ width: '100%', fontSize: '15px', padding: '11px 14px', paddingLeft: '52px', textAlign: 'left', direction: 'ltr' }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  disabled={submitting}
                  aria-label={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
                  style={{
                    position: 'absolute',
                    left: '8px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    border: 'none',
                    background: 'transparent',
                    color: '#6B7280',
                    fontSize: '12px',
                    fontWeight: '700',
                    cursor: 'pointer',
                    padding: '4px 6px',
                  }}
                >
                  {showPassword ? 'إخفاء' : 'إظهار'}
                </button>
              </div>
            </div>

            {error && (
              <div
                role="alert"
                style={{
                  background: '#FEF2F2',
                  border: '1px solid #FECACA',
                  color: '#991B1B',
                  borderRadius: '10px',
                  padding: '10px 12px',
                  fontSize: '12.5px',
                  lineHeight: 1.6,
                  marginBottom: '14px',
                }}
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              className="btn btn-primary"
              disabled={submitting}
              style={{
                width: '100%',
                fontSize: '15px',
                fontWeight: '800',
                padding: '12px 20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
              }}
            >
              {submitting ? (
                <>
                  <span
                    style={{
                      width: '16px',
                      height: '16px',
                      borderRadius: '50%',
                      border: '2px solid rgba(255,255,255,0.4)',
                      borderTopColor: '#FFFFFF',
                      display: 'inline-block',
                      animation: 'login-spin 0.8s linear infinite',
                    }}
                  />
                  جارٍ تسجيل الدخول...
                </>
              ) : (
                'تسجيل الدخول'
              )}
            </button>
          </form>
        )}

        <div
          style={{
            marginTop: '20px',
            paddingTop: '14px',
            borderTop: '1px solid #F3F4F6',
            fontSize: '11.5px',
            color: '#6B7280',
            textAlign: 'center',
            lineHeight: 1.7,
          }}
        >
          الدخول مخصص للكادر التدريسي والإداري فقط.
          <br />
          الطلاب لا يملكون حسابات؛ يتم تسجيل حضورهم بمسح بطاقة QR.
        </div>

        <style jsx>{`
          @keyframes login-spin {
            to {
              transform: rotate(360deg);
            }
          }
        `}</style>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div
          dir="rtl"
          style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#0B0F19',
            color: '#E5E7EB',
            fontSize: '14px',
          }}
        >
          جارٍ التحميل...
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  );
}
