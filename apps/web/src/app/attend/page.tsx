'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { attendanceApi, lectureApi, studentApi } from '../../lib/api';

function getDeviceId(): string {
  if (typeof window === 'undefined') return '';
  const KEY = 'attendance_device_uuid';
  let deviceId = '';
  try {
    deviceId = localStorage.getItem(KEY) || '';
  } catch (e) {}

  if (!deviceId) {
    const match = document.cookie.match(new RegExp('(^| )' + KEY + '=([^;]+)'));
    if (match) {
      deviceId = match[2];
    } else {
      deviceId = 'dev_' + Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
    }
    try {
      localStorage.setItem(KEY, deviceId);
    } catch (e) {}
  }

  try {
    document.cookie = `${KEY}=${deviceId}; path=/; max-age=31536000; SameSite=Lax`;
  } catch (e) {}

  return deviceId;
}

function AttendContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token') || '';

  const [studentCode, setStudentCode] = useState('');
  const [matchedStudent, setMatchedStudent] = useState<any>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isValidating, setIsValidating] = useState(true);
  const [lectureId, setLectureId] = useState('');
  const [lectureName, setLectureName] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState<any>(null);
  const [isAlreadyRegistered, setIsAlreadyRegistered] = useState(false);

  // Validate QR token on mount
  useEffect(() => {
    if (!token) {
      setError('رمز غير صالح');
      setIsValidating(false);
      return;
    }

    const validate = async () => {
      try {
        const result = await lectureApi.validateQr(token);
        if (result.valid) {
          const lecId = result.lectureId || '';
          setLectureId(lecId);
          setLectureName(result.lectureName || '');

          // Check if this device already registered for this lecture
          if (lecId && typeof window !== 'undefined') {
            const saved = localStorage.getItem(`registered_lecture_${lecId}`);
            if (saved) {
              try {
                const parsed = JSON.parse(saved);
                setSuccess(parsed);
                setIsAlreadyRegistered(true);
                setIsValidating(false);
                return;
              } catch (e) {}
            }
          }
        } else {
          setError(result.reason || 'رمز غير صالح أو منتهي الصلاحية');
        }
      } catch (err: any) {
        setError(err.message || 'فشل في التحقق من الرمز');
      } finally {
        setIsValidating(false);
      }
    };

    validate();
  }, [token]);

  // Live lookup of student when typing ID
  useEffect(() => {
    const trimmed = studentCode.trim();
    if (!trimmed || trimmed.length < 2) {
      setMatchedStudent(null);
      return;
    }

    const timeout = setTimeout(async () => {
      try {
        const found = await studentApi.lookup(trimmed);
        if (found) {
          setMatchedStudent(found);
        } else {
          setMatchedStudent(null);
        }
      } catch (e) {
        setMatchedStudent(null);
      }
    }, 250);

    return () => clearTimeout(timeout);
  }, [studentCode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentCode.trim() || !token) return;

    setIsSubmitting(true);
    setError('');

    try {
      const devId = getDeviceId();
      const result = await attendanceApi.register(token, studentCode.trim(), devId);

      // Save record to device storage to lock device
      const lecId = lectureId || result.lectureId;
      if (lecId && typeof window !== 'undefined') {
        localStorage.setItem(`registered_lecture_${lecId}`, JSON.stringify(result));
      }

      setSuccess(result);
    } catch (err: any) {
      setError(err.message || 'فشل في تسجيل الحضور');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Loading state
  if (isValidating) {
    return (
      <div className="checkin-page">
        <div className="checkin-card" style={{ textAlign: 'center' }}>
          <div style={{ width: '48px', height: '48px', margin: '0 auto 16px auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#D4AF37" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ animation: 'spin 1s linear infinite' }}>
              <line x1="12" y1="2" x2="12" y2="6"/>
              <line x1="12" y1="18" x2="12" y2="22"/>
              <line x1="4.93" y1="4.93" x2="7.76" y2="7.76"/>
              <line x1="16.24" y1="16.24" x2="19.07" y2="19.07"/>
              <line x1="2" y1="12" x2="6" y2="12"/>
              <line x1="18" y1="12" x2="22" y2="12"/>
              <line x1="4.93" y1="19.07" x2="7.76" y2="16.24"/>
              <line x1="16.24" y1="7.76" x2="19.07" y2="4.93"/>
            </svg>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '16px' }}>جاري التحقق من الرمز...</p>
        </div>
      </div>
    );
  }

  // Success state
  if (success) {
    return (
      <div className="checkin-page">
        <div className="checkin-card animate-slide-up">
          <div className="checkin-success">
            <img
              src="/college-logo.png"
              alt="جامعة الفرات الأوسط التقنية"
              style={{
                height: '56px',
                width: '56px',
                margin: '0 auto 8px auto',
                objectFit: 'contain',
                background: '#FFFFFF',
                padding: '3px',
                borderRadius: '50%',
                display: 'inline-block',
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
              }}
            />
            <div className="success-icon" style={{ background: '#ECFDF5', color: '#059669', border: '2px solid #10B981', width: '64px', height: '64px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            </div>
            <h1 style={{ fontSize: '24px', fontWeight: '800', color: '#111827' }}>
              {isAlreadyRegistered ? 'لقد قمت بتسجيل الحضور مسبقاً!' : 'تم تسجيل حضورك بنجاح!'}
            </h1>
            <div style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: '14px', padding: '20px', width: '100%' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                <span style={{ color: 'var(--text-muted)' }}>اسم الطالب</span>
                <span style={{ fontWeight: '700', fontSize: '16px', color: '#111827' }}>{success.studentName}</span>
              </div>
              {success.studentCode && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                  <span style={{ color: 'var(--text-muted)' }}>الرقم التعريفي (ID)</span>
                  <span style={{ fontWeight: '700', color: 'var(--gold-dark)', direction: 'ltr' }}>{success.studentCode}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                <span style={{ color: 'var(--text-muted)' }}>المحاضرة</span>
                <span style={{ fontWeight: '600', color: '#111827' }}>{success.lectureName}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>الوقت</span>
                <span style={{ fontWeight: '600', direction: 'ltr', color: '#111827' }}>
                  {new Date(success.registeredAt).toLocaleTimeString('ar-IQ', {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                  })}
                </span>
              </div>
            </div>
            <div style={{ background: '#FFFBEB', border: '1px solid #FCD34D', borderRadius: '10px', padding: '10px 14px', width: '100%', fontSize: '13px', color: '#92400E', fontWeight: '600' }}>
              تم قفل التسجيل: لا يمكن استخدام هذا الجهاز لتسجيل طالب آخر لهذه المحاضرة.
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
              يمكنك إغلاق هذه الصفحة الآن
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Error state (invalid token)
  if (error && !lectureName) {
    return (
      <div className="checkin-page">
        <div className="checkin-card animate-slide-up" style={{ textAlign: 'center' }}>
          <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: '#FEF2F2', color: '#DC2626', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px auto' }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12" y2="12"/>
              <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
          </div>
          <h1 style={{ fontSize: '22px', fontWeight: '700', marginBottom: '12px', color: '#DC2626' }}>
            خطأ
          </h1>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '20px' }}>{error}</p>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
            الرجاء توجيه رمز الطالب نحو كاميرا المحاضر
          </p>
        </div>
      </div>
    );
  }

  // Check-in form
  return (
    <div className="checkin-page">
      <div className="checkin-card animate-slide-up">
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <img
            src="/college-logo.png"
            alt="جامعة الفرات الأوسط التقنية"
            style={{
              height: '64px',
              width: '64px',
              margin: '0 auto 14px auto',
              objectFit: 'contain',
              background: '#FFFFFF',
              padding: '4px',
              borderRadius: '50%',
              display: 'inline-block',
              boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
            }}
          />
          <h1 style={{ fontSize: '24px', fontWeight: '800', marginBottom: '6px', color: '#111827' }}>
            تسجيل الحضور
          </h1>
          {lectureName && (
            <p style={{ color: 'var(--gold-dark)', fontWeight: '600', fontSize: '16px' }}>
              {lectureName}
            </p>
          )}
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', fontSize: '15px', color: 'var(--text-secondary)' }}>
              الرقم التعريفي (ID) الخاص بك
            </label>
            <input
              type="text"
              className="input"
              placeholder="أدخل رقمك التعريفي (مثال: 1001)..."
              value={studentCode}
              onChange={e => setStudentCode(e.target.value)}
              autoFocus
              required
              id="student-code-input"
              style={{ fontSize: '18px', padding: '16px', direction: 'ltr', textAlign: 'center', letterSpacing: '1px', fontWeight: '700' }}
            />

            {/* Live student lookup preview */}
            {matchedStudent && (
              <div style={{ marginTop: '10px', background: '#ECFDF5', border: '1px solid #A7F3D0', borderRadius: '10px', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div>
                  <span style={{ color: '#065F46', fontSize: '12px', fontWeight: '500' }}>اسم الطالب: </span>
                  <span style={{ color: '#047857', fontWeight: '700' }}>{matchedStudent.name}</span>
                </div>
              </div>
            )}
          </div>

          {error && (
            <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '12px', padding: '12px 16px', marginBottom: '16px', color: '#991B1B', fontSize: '14px', textAlign: 'center', fontWeight: '600' }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            className="btn btn-primary btn-lg"
            disabled={isSubmitting || !studentCode.trim()}
            style={{ width: '100%', fontSize: '18px' }}
            id="submit-attendance-btn"
          >
            {isSubmitting ? 'جاري التحقق والتسجيل...' : 'تأكيد تسجيل الحضور'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function AttendPage() {
  return (
    <Suspense fallback={
      <div className="checkin-page">
        <div className="checkin-card" style={{ textAlign: 'center' }}>
          <p style={{ color: 'var(--text-secondary)' }}>جاري التحميل...</p>
        </div>
      </div>
    }>
      <AttendContent />
    </Suspense>
  );
}
