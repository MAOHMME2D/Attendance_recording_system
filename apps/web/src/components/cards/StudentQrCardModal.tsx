'use client';

import React, { useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { studentApi, ApiError } from '../../lib/api';

interface StudentData {
  id: string;
  name: string;
  studentCode: string;
  studyPeriod?: string | null;
  orderIndex?: number | null;
  section?: string | null;
}

interface StudentQrCardModalProps {
  student: StudentData | null;
  onClose: () => void;
}

export default function StudentQrCardModal({ student, onClose }: StudentQrCardModalProps) {
  const [activeToken, setActiveToken] = useState<string | null>(null);
  const [loadingToken, setLoadingToken] = useState(false);
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [rotating, setRotating] = useState(false);
  const [rotateError, setRotateError] = useState<string | null>(null);

  const studentId = student?.id;

  useEffect(() => {
    if (!studentId) return;
    let cancelled = false;

    setActiveToken(null);
    setTokenError(null);
    setRotateError(null);
    setRotating(false);
    setLoadingToken(true);

    studentApi
      .getQr(studentId)
      .then((result) => {
        if (!cancelled) setActiveToken(result.token);
      })
      .catch((error) => {
        if (cancelled) return;
        setTokenError(
          error instanceof ApiError
            ? error.message
            : 'تعذر تحميل رمز QR لهذا الطالب.',
        );
      })
      .finally(() => {
        if (!cancelled) setLoadingToken(false);
      });

    return () => {
      cancelled = true;
    };
  }, [studentId]);

  if (!student) return null;

  const handlePrint = () => {
    if (!activeToken) return;
    const originalTitle = document.title;
    const safeName = student.name.replace(/\s+/g, '_');
    document.title = `بطاقة_حضور_${safeName}_${student.studentCode}`;
    window.print();
    setTimeout(() => {
      document.title = originalTitle;
    }, 1000);
  };

  const handleRotate = async () => {
    const confirmed = window.confirm(
      'إعادة إصدار رمز QR ستُبطل البطاقة المطبوعة حالياً. هل تريد المتابعة؟',
    );
    if (!confirmed) return;

    setRotating(true);
    setRotateError(null);
    try {
      const result = await studentApi.rotateQr(student.id);
      setActiveToken(result.token);
    } catch (error) {
      if (error instanceof ApiError) {
        setRotateError(error.message);
      } else {
        setRotateError('تعذر إعادة إصدار رمز QR. حاول مرة أخرى.');
      }
    } finally {
      setRotating(false);
    }
  };

  return (
    <div
      className="modal-backdrop animate-fade-in"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.75)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        zIndex: 1100,
      }}
    >
      <div
        className="glass-card single-card-modal-window animate-slide-up"
        onClick={e => e.stopPropagation()}
        style={{
          maxWidth: '460px',
          width: '100%',
          padding: '24px',
          background: '#FFFFFF',
          borderRadius: '24px',
          border: '1px solid #E5E7EB',
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
        }}
      >
        {/* Modal Top Bar (Hidden in Print) */}
        <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                background: '#111827',
                border: '1px solid var(--gold)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#D4AF37',
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="5" width="20" height="14" rx="2" />
                <line x1="2" y1="10" x2="22" y2="10" />
              </svg>
            </div>
            <h3 style={{ fontSize: '17px', fontWeight: '800', color: '#111827', margin: 0 }}>
              بطاقة الحضور الذكية (QR)
            </h3>
          </div>
          <button
            className="btn btn-ghost btn-sm"
            onClick={onClose}
            style={{ borderRadius: '50%', width: '32px', height: '32px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            ✕
          </button>
        </div>

        {/* Printable Card Area */}
        <div
          id="printable-student-card"
          style={{
            background: 'linear-gradient(145deg, #0A0A0A 0%, #161B26 100%)',
            borderRadius: '20px',
            padding: '22px',
            color: '#FFFFFF',
            border: '2px solid var(--gold)',
            boxShadow: '0 12px 30px rgba(0,0,0,0.25)',
            textAlign: 'center',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {/* Card Gold Trim Accent */}
          <div
            className="no-print"
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: '5px',
              background: 'linear-gradient(90deg, #A88126, #E5CA72, #C9A84C)',
            }}
          />

          {/* College Header */}
          <div style={{ marginBottom: '14px' }}>
            <img
              src="/college-logo.png"
              alt="جامعة الفرات الأوسط التقنية"
              style={{
                height: '48px',
                width: '48px',
                objectFit: 'contain',
                background: '#FFFFFF',
                padding: '2px',
                borderRadius: '50%',
                margin: '0 auto 8px auto',
                display: 'block',
              }}
            />
            <div style={{ fontSize: '13.5px', fontWeight: '700', color: '#D4AF37' }}>
              جامعة الفرات الأوسط التقنية | قسم تقنيات المختبرات الطبية
            </div>
            <div style={{ fontSize: '11px', color: '#9CA3AF' }}>
              {(student.studyPeriod || 'MORNING') === 'EVENING' ? 'الدراسة المسائية' : 'الدراسة الصباحية'} • بطاقة الحضور
            </div>
          </div>

          {/* Student QR Code Box - BIGGER SIZE */}
          <div
            style={{
              background: '#FFFFFF',
              borderRadius: '16px',
              padding: '16px',
              display: 'inline-block',
              margin: '0 auto 14px auto',
              boxShadow: '0 4px 20px rgba(0,0,0,0.25)',
              minWidth: '262px',
              minHeight: '262px',
              verticalAlign: 'middle',
            }}
          >
            {activeToken ? (
              <QRCodeSVG
                value={activeToken}
                size={230}
                level="M"
                marginSize={2}
                bgColor="#FFFFFF"
                fgColor="#0A0A0A"
              />
            ) : (
              <div style={{ color: '#111827', fontSize: '13px', fontWeight: '700', padding: '100px 10px' }}>
                {loadingToken ? 'جارٍ تحميل رمز QR...' : 'رمز QR غير متاح'}
              </div>
            )}
          </div>

          {/* Student Info */}
          <div style={{ marginBottom: '8px' }}>
            <h2 style={{ fontSize: '19px', fontWeight: '800', color: '#FFFFFF', marginBottom: '4px' }}>
              {student.name}
              {student.section && (
                <span style={{ fontSize: '13px', color: '#D4AF37', marginRight: '6px', fontWeight: 'normal' }}>
                  (شعبة {student.section})
                </span>
              )}
            </h2>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'rgba(201, 168, 76, 0.15)', border: '1px solid rgba(201, 168, 76, 0.4)', borderRadius: '20px', padding: '4px 14px' }}>
              <span style={{ fontSize: '12px', color: '#E5CA72', fontWeight: '600' }}>الرقم التعريفي (ID):</span>
              <span style={{ fontSize: '16px', fontWeight: '800', color: '#FFFFFF', fontFamily: 'monospace', letterSpacing: '1px' }}>
                {student.studentCode}
              </span>
            </div>
          </div>

          <p style={{ fontSize: '11px', color: '#9CA3AF', marginTop: '10px' }}>
            وجّه هذا الرمز نحو كاميرا الحاسبة لتسجيل الحضور تلقائياً
          </p>
        </div>

        {tokenError && (
          <div
            className="no-print"
            style={{
              marginTop: '12px',
              background: '#FEF2F2',
              border: '1px solid #FECACA',
              color: '#991B1B',
              borderRadius: '10px',
              padding: '8px 12px',
              fontSize: '12px',
            }}
          >
            {tokenError}
          </div>
        )}

        {rotateError && (
          <div
            className="no-print"
            style={{
              marginTop: '12px',
              background: '#FEF2F2',
              border: '1px solid #FECACA',
              color: '#991B1B',
              borderRadius: '10px',
              padding: '8px 12px',
              fontSize: '12px',
            }}
          >
            {rotateError}
          </div>
        )}

        {/* Action Buttons (Hidden in Print) */}
        <div className="no-print" style={{ display: 'flex', gap: '10px', marginTop: '18px', flexWrap: 'wrap' }}>
          <button
            className="btn btn-primary"
            onClick={handlePrint}
            disabled={!activeToken}
            style={{ flex: 1, fontSize: '13.5px', background: '#059669', borderColor: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', opacity: activeToken ? 1 : 0.6 }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            تنزيل بصيغة PDF / طباعة فورية
          </button>
          <button
            className="btn btn-ghost"
            onClick={onClose}
            style={{ fontSize: '13.5px' }}
          >
            إغلاق
          </button>
        </div>

        <button
          type="button"
          className="no-print"
          onClick={handleRotate}
          disabled={rotating || !activeToken}
          style={{
            marginTop: '10px',
            width: '100%',
            padding: '8px 12px',
            borderRadius: '10px',
            border: '1px solid #FCA5A5',
            background: '#FEF2F2',
            color: '#991B1B',
            fontSize: '12.5px',
            fontWeight: '700',
            cursor: rotating || !activeToken ? 'not-allowed' : 'pointer',
            opacity: rotating || !activeToken ? 0.7 : 1,
          }}
        >
          {rotating ? 'جارٍ إعادة الإصدار...' : 'إعادة إصدار رمز QR (إبطال البطاقة الحالية)'}
        </button>

        {/* Small Tip */}
        <div className="no-print" style={{ marginTop: '10px', textAlign: 'center', fontSize: '11.5px', color: '#6B7280' }}>
          💡 اختر <strong>&quot;حفظ بتنسيق PDF&quot; (Save as PDF)</strong> من نافذة المتصفح لتنزيل البطاقة كملف PDF
        </div>
      </div>
    </div>
  );
}
