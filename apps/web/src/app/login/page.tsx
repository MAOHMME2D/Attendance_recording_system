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

const BRAND_FEATURES = [
  { icon: '⚡', text: 'تسجيل حضور فوري بمسح بطاقة QR' },
  { icon: '📊', text: 'إحصاءات دقيقة لكل مادة وشعبة' },
  { icon: '👥', text: 'متابعة الطلاب ونسب الحضور والغياب' },
];

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
    if (password.length < 6) {
      setError('كلمة المرور يجب أن تكون 6 أحرف على الأقل.');
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
    <div className="login-shell" dir="rtl">
      <span className="login-orb login-orb-a" aria-hidden="true" />
      <span className="login-orb login-orb-b" aria-hidden="true" />

      <div className="login-frame">
        {/* ============ Branding panel ============ */}
        <aside className="login-brand">
          <div className="brand-top">
            <img
              className="brand-logo"
              src="/navbar-logo.png"
              alt="كلية البوليتكنك - كربلاء | Polytechnic College - Karbala"
            />
          </div>

          <div className="brand-body">
            <span className="brand-eyebrow">
              <span className="brand-eyebrow-dot" aria-hidden="true" />
              قسم تقنيات المختبرات الطبية
            </span>
            <h2>
              نظام تسجيل الحضور
              <br />
              الذكي
            </h2>
            <p>
              منصة متكاملة لتسجيل حضور المحاضرات ومسح بطاقات الطلاب وإصدار التقارير
              والإحصاءات بدقة وسرعة.
            </p>

            <ul className="brand-features">
              {BRAND_FEATURES.map((feature) => (
                <li key={feature.text}>
                  <span className="feat-icon" aria-hidden="true">
                    {feature.icon}
                  </span>
                  <span>{feature.text}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="brand-footer">
            <span className="brand-footer-line" aria-hidden="true" />
            كلية البوليتكنك — جامعة الفرات الأوسط التقنية
          </div>
        </aside>

        {/* ============ Login panel ============ */}
        <main className="login-panel">
          <div className="login-card">
            <div className="card-head">
              <div className="card-icon" aria-hidden="true">
                🔐
              </div>
              <div>
                <h1>تسجيل الدخول</h1>
                <p>أدخل معرف الموظف وكلمة المرور للمتابعة</p>
              </div>
            </div>

            {loading ? (
              <div className="login-loading" role="status">
                <span className="spinner spinner-dark" aria-hidden="true" />
                جارٍ التحقق من الجلسة...
              </div>
            ) : (
              <form onSubmit={handleSubmit} noValidate>
                <div className="field">
                  <label htmlFor="staff-id">معرف الموظف</label>
                  <div className="input-wrap">
                    <span className="input-icon" aria-hidden="true">
                      👤
                    </span>
                    <input
                      id="staff-id"
                      name="staffId"
                      type="text"
                      className="login-input"
                      autoComplete="username"
                      inputMode="text"
                      placeholder="مثال: registrar1"
                      value={staffId}
                      onChange={(event) => setStaffId(event.target.value)}
                      disabled={submitting}
                      autoFocus
                    />
                  </div>
                </div>

                <div className="field">
                  <label htmlFor="password">كلمة المرور</label>
                  <div className="input-wrap">
                    <span className="input-icon" aria-hidden="true">
                      🔒
                    </span>
                    <input
                      id="password"
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      className="login-input login-input-password"
                      autoComplete="current-password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      disabled={submitting}
                    />
                    <button
                      type="button"
                      className="pw-toggle"
                      onClick={() => setShowPassword((value) => !value)}
                      disabled={submitting}
                      aria-label={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
                    >
                      {showPassword ? 'إخفاء' : 'إظهار'}
                    </button>
                  </div>
                </div>

                {error && (
                  <div className="login-error" role="alert">
                    <span aria-hidden="true">⚠️</span>
                    <span>{error}</span>
                  </div>
                )}

                <button type="submit" className="login-submit" disabled={submitting}>
                  {submitting ? (
                    <>
                      <span className="spinner" aria-hidden="true" />
                      جارٍ تسجيل الدخول...
                    </>
                  ) : (
                    <>
                      <span>تسجيل الدخول</span>
                      <span className="submit-arrow" aria-hidden="true">
                        ←
                      </span>
                    </>
                  )}
                </button>
              </form>
            )}

            <div className="card-note">
              <span className="note-icon" aria-hidden="true">
                ℹ️
              </span>
              <span>
                الدخول مخصص للكادر التدريسي والإداري فقط. الطلاب لا يملكون حسابات؛
                يتم تسجيل حضورهم بمسح بطاقة QR.
              </span>
            </div>
          </div>

          <div className="login-copyright">
            © 2026 كلية البوليتكنك — قسم تقنيات المختبرات الطبية
          </div>
        </main>
      </div>

      <style jsx>{`
        .login-shell {
          position: relative;
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 30px 20px;
          overflow: hidden;
          background:
            radial-gradient(1000px 620px at 88% -12%, rgba(201, 168, 76, 0.16), transparent 60%),
            radial-gradient(900px 600px at -5% 105%, rgba(37, 99, 235, 0.12), transparent 55%),
            linear-gradient(135deg, #070b14 0%, #0d1424 45%, #0a0f1c 100%);
        }

        .login-orb {
          position: absolute;
          border-radius: 50%;
          filter: blur(80px);
          pointer-events: none;
          opacity: 0.55;
        }

        .login-orb-a {
          width: 360px;
          height: 360px;
          top: -100px;
          right: -70px;
          background: rgba(201, 168, 76, 0.3);
          animation: login-float 9s ease-in-out infinite;
        }

        .login-orb-b {
          width: 320px;
          height: 320px;
          bottom: -120px;
          left: -80px;
          background: rgba(37, 99, 235, 0.24);
          animation: login-float 11s ease-in-out infinite reverse;
        }

        .login-frame {
          position: relative;
          z-index: 1;
          width: 100%;
          max-width: 1060px;
          display: grid;
          grid-template-columns: 1.02fr 1fr;
          background: #ffffff;
          border-radius: 26px;
          overflow: hidden;
          box-shadow:
            0 40px 90px rgba(0, 0, 0, 0.45),
            0 0 0 1px rgba(201, 168, 76, 0.22);
          min-height: 590px;
        }

        /* ---------------- Brand panel ---------------- */
        .login-brand {
          position: relative;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          gap: 22px;
          padding: 34px 34px 28px;
          overflow: hidden;
          color: #ffffff;
          background:
            radial-gradient(620px 400px at 18% 0%, rgba(201, 168, 76, 0.22), transparent 60%),
            linear-gradient(160deg, #0b1220 0%, #111a2e 55%, #0a0f1a 100%);
        }

        .login-brand::before {
          content: '';
          position: absolute;
          inset: 0;
          background-image:
            linear-gradient(rgba(255, 255, 255, 0.045) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255, 255, 255, 0.045) 1px, transparent 1px);
          background-size: 44px 44px;
          -webkit-mask-image: radial-gradient(circle at 32% 18%, #000 0%, transparent 76%);
          mask-image: radial-gradient(circle at 32% 18%, #000 0%, transparent 76%);
          pointer-events: none;
        }

        .brand-top,
        .brand-body,
        .brand-footer {
          position: relative;
          z-index: 1;
        }

        .brand-logo {
          display: block;
          width: 250px;
          max-width: 100%;
          height: auto;
          filter: drop-shadow(0 8px 20px rgba(0, 0, 0, 0.35));
        }

        .brand-eyebrow {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          padding: 5px 12px;
          border-radius: 999px;
          background: rgba(201, 168, 76, 0.12);
          border: 1px solid rgba(201, 168, 76, 0.38);
          color: #f3d98b;
          font-size: 11.5px;
          font-weight: 800;
          letter-spacing: 0.2px;
        }

        .brand-eyebrow-dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: #d4af37;
          box-shadow: 0 0 0 4px rgba(212, 175, 55, 0.16);
        }

        .brand-body h2 {
          margin: 15px 0 10px;
          font-size: 27px;
          font-weight: 900;
          line-height: 1.5;
          color: #ffffff;
        }

        .brand-body p {
          margin: 0;
          max-width: 390px;
          font-size: 13px;
          line-height: 1.95;
          color: rgba(255, 255, 255, 0.72);
        }

        .brand-features {
          list-style: none;
          margin: 22px 0 0;
          padding: 0;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .brand-features li {
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 12.5px;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.86);
        }

        .feat-icon {
          flex-shrink: 0;
          width: 32px;
          height: 32px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 14px;
          background: rgba(201, 168, 76, 0.12);
          border: 1px solid rgba(201, 168, 76, 0.28);
        }

        .brand-footer {
          display: flex;
          align-items: center;
          gap: 9px;
          font-size: 11.5px;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.5);
        }

        .brand-footer-line {
          width: 26px;
          height: 2px;
          border-radius: 2px;
          background: linear-gradient(90deg, #d4af37, transparent);
        }

        /* ---------------- Login panel ---------------- */
        .login-panel {
          display: flex;
          flex-direction: column;
          justify-content: center;
          padding: 36px 38px 26px;
          background: linear-gradient(180deg, #ffffff 0%, #fbfcfe 100%);
        }

        .login-card {
          width: 100%;
          max-width: 380px;
          margin: 0 auto;
        }

        .card-head {
          display: flex;
          align-items: center;
          gap: 13px;
          margin-bottom: 24px;
        }

        .card-icon {
          flex-shrink: 0;
          width: 48px;
          height: 48px;
          border-radius: 15px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 21px;
          color: #f3d98b;
          background: linear-gradient(150deg, #111a2e, #0b1220);
          border: 1px solid rgba(201, 168, 76, 0.35);
          box-shadow: 0 10px 22px rgba(15, 23, 42, 0.28);
        }

        .card-head h1 {
          margin: 0;
          font-size: 22px;
          font-weight: 900;
          color: #0f172a;
          line-height: 1.3;
        }

        .card-head p {
          margin: 3px 0 0;
          font-size: 12.5px;
          color: #6b7280;
        }

        .field {
          margin-bottom: 15px;
        }

        .field label {
          display: block;
          margin-bottom: 7px;
          font-size: 12.5px;
          font-weight: 800;
          color: #374151;
        }

        .input-wrap {
          position: relative;
          display: flex;
          align-items: center;
        }

        .input-icon {
          position: absolute;
          right: 13px;
          font-size: 14px;
          opacity: 0.75;
          pointer-events: none;
        }

        .login-input {
          width: 100%;
          font-family: inherit;
          font-size: 14.5px;
          padding: 12px 40px 12px 14px;
          border-radius: 12px;
          border: 1.5px solid #e5e7eb;
          background: #f9fafb;
          color: #0f172a;
          text-align: left;
          direction: ltr;
          transition:
            border-color 0.15s ease,
            box-shadow 0.15s ease,
            background 0.15s ease;
        }

        .login-input::placeholder {
          color: #9ca3af;
        }

        .login-input:focus {
          outline: none;
          border-color: #c9a84c;
          background: #ffffff;
          box-shadow: 0 0 0 4px rgba(201, 168, 76, 0.16);
        }

        .login-input:disabled {
          opacity: 0.65;
          cursor: not-allowed;
        }

        .login-input-password {
          padding-left: 66px;
        }

        .pw-toggle {
          position: absolute;
          left: 8px;
          top: 50%;
          transform: translateY(-50%);
          border: none;
          background: transparent;
          color: #6b7280;
          font-family: inherit;
          font-size: 11.5px;
          font-weight: 800;
          cursor: pointer;
          padding: 5px 8px;
          border-radius: 7px;
          transition: background 0.15s ease, color 0.15s ease;
        }

        .pw-toggle:hover:not(:disabled) {
          background: #f3f4f6;
          color: #111827;
        }

        .pw-toggle:disabled {
          cursor: not-allowed;
          opacity: 0.6;
        }

        .login-error {
          display: flex;
          align-items: flex-start;
          gap: 8px;
          margin-bottom: 14px;
          padding: 10px 12px;
          border-radius: 12px;
          background: #fef2f2;
          border: 1px solid #fecaca;
          color: #991b1b;
          font-size: 12.5px;
          line-height: 1.7;
        }

        .login-submit {
          position: relative;
          overflow: hidden;
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 9px;
          padding: 13px 20px;
          border: 1px solid rgba(201, 168, 76, 0.35);
          border-radius: 12px;
          font-family: inherit;
          font-size: 15px;
          font-weight: 800;
          color: #ffffff;
          cursor: pointer;
          background: linear-gradient(135deg, #111827 0%, #1f2937 60%, #0b1220 100%);
          box-shadow:
            0 12px 26px rgba(15, 23, 42, 0.3),
            inset 0 1px 0 rgba(255, 255, 255, 0.12);
          transition: transform 0.12s ease, box-shadow 0.15s ease, opacity 0.15s ease;
        }

        .login-submit::after {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(
            110deg,
            transparent 30%,
            rgba(201, 168, 76, 0.35) 50%,
            transparent 70%
          );
          transform: translateX(-130%);
          transition: transform 0.65s ease;
        }

        .login-submit:hover:not(:disabled)::after {
          transform: translateX(130%);
        }

        .login-submit:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 16px 32px rgba(15, 23, 42, 0.38);
        }

        .login-submit:active:not(:disabled) {
          transform: translateY(0);
        }

        .login-submit:disabled {
          opacity: 0.72;
          cursor: not-allowed;
        }

        .submit-arrow {
          font-size: 16px;
          line-height: 1;
        }

        .login-loading {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          padding: 30px 0;
          color: #6b7280;
          font-size: 13px;
        }

        .card-note {
          display: flex;
          align-items: flex-start;
          gap: 8px;
          margin-top: 20px;
          padding: 12px 14px;
          border-radius: 12px;
          background: #f8fafc;
          border: 1px dashed #d1d5db;
          color: #4b5563;
          font-size: 11.5px;
          line-height: 1.8;
        }

        .note-icon {
          flex-shrink: 0;
          font-size: 13px;
          line-height: 1.5;
        }

        .login-copyright {
          margin-top: 16px;
          text-align: center;
          font-size: 11px;
          color: #9ca3af;
        }

        .spinner {
          display: inline-block;
          width: 16px;
          height: 16px;
          border-radius: 50%;
          border: 2px solid rgba(255, 255, 255, 0.35);
          border-top-color: #ffffff;
          animation: login-spin 0.8s linear infinite;
        }

        .spinner-dark {
          border-color: rgba(15, 23, 42, 0.15);
          border-top-color: #0f172a;
        }

        @keyframes login-spin {
          to {
            transform: rotate(360deg);
          }
        }

        @keyframes login-float {
          0%,
          100% {
            transform: translate3d(0, 0, 0);
          }
          50% {
            transform: translate3d(0, -18px, 0);
          }
        }

        @media (max-width: 880px) {
          .login-frame {
            grid-template-columns: 1fr;
            max-width: 460px;
            min-height: 0;
          }

          .login-brand {
            gap: 14px;
            padding: 24px 24px 22px;
          }

          .brand-logo {
            width: 210px;
          }

          .brand-body h2 {
            margin: 12px 0 6px;
            font-size: 21px;
          }

          .brand-body p {
            font-size: 12.5px;
            line-height: 1.8;
          }

          .brand-features,
          .brand-footer {
            display: none;
          }

          .login-panel {
            padding: 26px 24px 22px;
          }
        }

        @media (max-width: 420px) {
          .login-shell {
            padding: 16px 12px;
          }

          .login-brand {
            padding: 20px 18px 18px;
          }

          .brand-logo {
            width: 180px;
          }

          .login-panel {
            padding: 22px 18px 18px;
          }

          .card-head h1 {
            font-size: 20px;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .login-orb-a,
          .login-orb-b,
          .spinner {
            animation: none;
          }

          .login-submit::after {
            display: none;
          }
        }
      `}</style>
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
