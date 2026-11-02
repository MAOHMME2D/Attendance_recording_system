'use client';

import React, { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { studentApi } from '../../lib/api';
import Link from 'next/link';
import Navbar from '../../components/layout/Navbar';

export default function MyQrPage() {
  const [studentCode, setStudentCode] = useState('');
  const [student, setStudent] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Check saved student in localStorage on phone
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedCode = localStorage.getItem('my_student_code');
      if (savedCode) {
        setStudentCode(savedCode);
        fetchStudent(savedCode);
      }
    }
  }, []);

  const fetchStudent = async (codeToFetch: string) => {
    const trimmed = codeToFetch.trim();
    if (!trimmed) return;

    setLoading(true);
    setError('');

    try {
      const found = await studentApi.lookup(trimmed);
      if (found) {
        setStudent(found);
        if (typeof window !== 'undefined') {
          localStorage.setItem('my_student_code', trimmed);
        }
      } else {
        setError('الرقم التعريفي (ID) غير مسجل في قاعدة بيانات الكلية');
        setStudent(null);
      }
    } catch (err: any) {
      setError(err.message || 'حدث خطأ في البحث عن بيانات الطالب');
      setStudent(null);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchStudent(studentCode);
  };

  const handleReset = () => {
    setStudent(null);
    setStudentCode('');
    if (typeof window !== 'undefined') {
      localStorage.removeItem('my_student_code');
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: '#F8F9FA' }}>
      {/* Unified Header / Navbar Component */}
      <Navbar />

      <div style={{ maxWidth: '440px', margin: '30px auto', padding: '0 20px' }}>
        {!student ? (
          /* Form to enter student ID */
          <div className="glass-card animate-slide-up" style={{ padding: '32px 24px', textAlign: 'center' }}>
            <div
              style={{
                width: '68px',
                height: '68px',
                borderRadius: '50%',
                background: '#111827',
                border: '2px solid var(--gold)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px auto',
                color: '#D4AF37',
              }}
            >
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="5" width="20" height="14" rx="2" />
                <line x1="2" y1="10" x2="22" y2="10" />
              </svg>
            </div>
            <h1 style={{ fontSize: '24px', fontWeight: '800', marginBottom: '6px', color: '#111827' }}>
              عرض بطاقة الحضور الخاصة بك
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '24px' }}>
              أدخل رقمك التعريفي (ID) لعرض رمز الـ QR الخاص بك وتوجيهه نحو كاميرا الأستاذ
            </p>

            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: '16px' }}>
                <input
                  type="text"
                  className="input"
                  placeholder="أدخل رقمك التعريفي (مثال: 1001)..."
                  value={studentCode}
                  onChange={e => setStudentCode(e.target.value)}
                  autoFocus
                  required
                  style={{ fontSize: '18px', padding: '14px', textAlign: 'center', letterSpacing: '1px', fontWeight: '700', direction: 'ltr' }}
                />
              </div>

              {error && (
                <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '10px', padding: '10px 14px', color: '#991B1B', fontSize: '13px', marginBottom: '16px' }}>
                  {error}
                </div>
              )}

              <button
                type="submit"
                className="btn btn-primary btn-lg"
                disabled={loading || !studentCode.trim()}
                style={{ width: '100%', fontSize: '16px' }}
              >
                {loading ? 'جاري البحث...' : 'عرض بطاقة الحضور'}
              </button>
            </form>
          </div>
        ) : (
          /* Digital Student Card */
          <div className="animate-slide-up" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div
              style={{
                background: 'linear-gradient(145deg, #0A0A0A 0%, #161B26 100%)',
                borderRadius: '24px',
                padding: '28px 24px',
                color: '#FFFFFF',
                border: '2px solid var(--gold)',
                boxShadow: '0 16px 40px rgba(0,0,0,0.25)',
                textAlign: 'center',
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              {/* Gold Top Stripe */}
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  height: '6px',
                  background: 'linear-gradient(90deg, #A88126, #E5CA72, #C9A84C)',
                }}
              />

              {/* College Logo */}
              <img
                src="/college-logo.png"
                alt="كلية البوليتكنك - كربلاء"
                style={{
                  height: '42px',
                  objectFit: 'contain',
                  background: '#FFFFFF',
                  padding: '3px 12px',
                  borderRadius: '10px',
                  margin: '0 auto 12px auto',
                  display: 'block',
                }}
              />
              <div style={{ fontSize: '13px', fontWeight: '700', color: '#D4AF37' }}>
                كلية البوليتكنك | قسم تقنيات المختبرات الطبية
              </div>
              <div style={{ fontSize: '11px', color: '#9CA3AF', marginBottom: '20px' }}>
                بطاقة تسجيل الحضور الذكية
              </div>

              {/* QR Code Container */}
              <div
                style={{
                  background: '#FFFFFF',
                  borderRadius: '18px',
                  padding: '18px',
                  display: 'inline-block',
                  margin: '0 auto 20px auto',
                  boxShadow: '0 8px 30px rgba(0,0,0,0.3)',
                }}
              >
                <QRCodeSVG
                  value={student.studentCode}
                  size={220}
                  level="M"
                  marginSize={2}
                  bgColor="#FFFFFF"
                  fgColor="#0A0A0A"
                />
              </div>

              {/* Student Name & ID */}
              <h2 style={{ fontSize: '22px', fontWeight: '800', color: '#FFFFFF', marginBottom: '8px' }}>
                {student.name}
              </h2>

              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: 'rgba(201, 168, 76, 0.15)', border: '1px solid rgba(201, 168, 76, 0.4)', borderRadius: '20px', padding: '6px 18px', marginBottom: '16px' }}>
                <span style={{ fontSize: '12px', color: '#E5CA72', fontWeight: '600' }}>الرقم التعريفي (ID):</span>
                <span style={{ fontSize: '16px', fontWeight: '800', color: '#FFFFFF', fontFamily: 'monospace', letterSpacing: '1px' }}>
                  {student.studentCode}
                </span>
              </div>

              <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: '12px', padding: '12px', fontSize: '12px', color: '#D1D5DB' }}>
                وجّه هذه الشاشة نحو كاميرا لابتوب الأستاذ لتسجيل حضورك
              </div>
            </div>

            <button
              className="btn btn-ghost"
              onClick={handleReset}
              style={{ width: '100%', fontSize: '14px' }}
            >
              تغيير الطالب / إدخال رقم آخر
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
