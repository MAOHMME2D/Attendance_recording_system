'use client';

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { formatAttendanceDate, formatAttendanceTime } from '../../lib/formatTime';

export interface AttendancePdfRecord {
  id?: string;
  orderIndex?: number;
  name?: string;
  studentName?: string;
  studentCode?: string | null;
  studyPeriod?: string;
  section?: string | null;
  presentCount?: number;
  absentCount?: number;
  totalLectures?: number;
  status?: string; // 'PRESENT' | 'ABSENT'
  registeredAt?: string;
}

interface AttendancePdfReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  reportTitle: string;
  studyPeriodLabel?: string;
  sectionLabel?: string;
  lectureDate?: string;
  records: AttendancePdfRecord[];
}

export default function AttendancePdfReportModal({
  isOpen,
  onClose,
  reportTitle,
  studyPeriodLabel,
  sectionLabel,
  lectureDate,
  records,
}: AttendancePdfReportModalProps) {
  const [logoBase64, setLogoBase64] = useState<string | null>(null);

  useEffect(() => {
    // Convert logo to base64 so it embeds in print/PDF
    fetch('/college-logo.png')
      .then(res => res.blob())
      .then(blob => {
        const reader = new FileReader();
        reader.onloadend = () => setLogoBase64(reader.result as string);
        reader.readAsDataURL(blob);
      })
      .catch(() => {});
  }, []);

  if (!isOpen) return null;

  const handlePrint = () => {
    const originalTitle = document.title;
    const cleanTitle = `${reportTitle.replace(/[\s/:*?"<>|]+/g, '_')}_${new Date().toISOString().slice(0, 10)}`;
    document.title = cleanTitle;
    document.documentElement.classList.add('print-attendance-sheet');

    const cleanup = () => {
      document.title = originalTitle;
      document.documentElement.classList.remove('print-attendance-sheet');
      window.removeEventListener('afterprint', cleanup);
    };
    window.addEventListener('afterprint', cleanup);
    window.print();
  };

  const currentDateFormatted = formatAttendanceDate(
    lectureDate || new Date().toISOString(),
    true,
  );

  // Calculate totals
  const totalStudents = records.length;
  const isLectureSession = records.some(r => r.status !== undefined);
  const totalPresent = isLectureSession
    ? records.filter(r => r.status === 'PRESENT').length
    : records.reduce((acc, r) => acc + (r.presentCount || 0), 0);
  const totalAbsent = isLectureSession
    ? records.filter(r => r.status === 'ABSENT').length
    : records.reduce((acc, r) => acc + (r.absentCount || 0), 0);
  const sheetRecords = isLectureSession
    ? [...records].sort((a, b) =>
        String(a.studentCode || '').localeCompare(String(b.studentCode || ''), 'en', { numeric: true })
      )
    : records;

  // Colors
  const NAVY = '#1B2A4A';
  const GOLD = '#C5A028';
  const GOLD_LIGHT = '#F5ECD0';
  const GREEN_DARK = '#065F46';
  const RED_DARK = '#991B1B';

  const modal = (
    <div
      className="modal-backdrop attendance-pdf-modal-root animate-fade-in"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0,0,0,0.7)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: '16px',
      }}
    >
      <div
        className="glass-card attendance-pdf-modal-window animate-slide-up"
        onClick={e => e.stopPropagation()}
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '20px',
          width: '100%',
          maxWidth: '960px',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          overflow: 'hidden',
        }}
      >
        {/* Top Controls (Hidden in Print) */}
        <div
          className="no-print"
          style={{
            padding: '16px 24px',
            borderBottom: '1px solid #E5E7EB',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: '#F9FAFB',
            flexWrap: 'wrap',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '10px',
                background: GOLD_LIGHT,
                color: GOLD,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '18px',
                fontWeight: 'bold',
              }}
            >
              📄
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '17px', fontWeight: '800', color: '#111827' }}>
                معاينة وتصدير الكشف (PDF)
              </h3>
              <p style={{ margin: 0, fontSize: '12px', color: '#6B7280' }}>
                كشف رسمي جاهز للطباعة أو الحفظ كملف PDF
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              onClick={handlePrint}
              style={{
                padding: '9px 20px',
                borderRadius: '10px',
                border: 'none',
                background: NAVY,
                color: '#FFFFFF',
                fontWeight: '700',
                fontSize: '13px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: '0 4px 12px rgba(27, 42, 74, 0.3)',
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="6 9 6 2 18 2 18 9"></polyline>
                <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path>
                <rect x="6" y="14" width="12" height="8"></rect>
              </svg>
              تصدير / حفظ كـ PDF
            </button>
            <button
              onClick={onClose}
              style={{
                padding: '9px 16px',
                borderRadius: '10px',
                border: '1px solid #D1D5DB',
                background: '#FFFFFF',
                color: '#4B5563',
                fontWeight: '600',
                fontSize: '13px',
                cursor: 'pointer',
              }}
            >
              إغلاق
            </button>
          </div>
        </div>

        {/* Tip Banner (Hidden in Print) */}
        <div
          className="no-print"
          style={{
            background: GOLD_LIGHT,
            borderBottom: `1px solid ${GOLD}33`,
            padding: '10px 24px',
            fontSize: '12px',
            color: '#78650D',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <span>💡</span>
          <span>
            <strong>طريقة حفظ الملف بصيغة PDF:</strong> عند الضغط على <strong>&quot;تصدير / حفظ كـ PDF&quot;</strong>، اختر من خانة <strong>&quot;الوجهة&quot; (Destination)</strong> خيار <strong>&quot;حفظ بتنسيق PDF&quot; (Save as PDF)</strong> ثم اضغط حفظ.
          </span>
        </div>

        {/* Scrollable Preview Container on Screen */}
        <div className="attendance-pdf-preview" style={{ flex: 1, overflowY: 'auto', padding: '24px', background: '#F3F4F6' }}>
          {/* Printable Report Document (A4 Styling) */}
          <div
            id="printable-attendance-report"
            style={{
              background: '#FFFFFF',
              borderRadius: '12px',
              padding: '28px 32px',
              color: '#111827',
              fontFamily: "'Segoe UI', 'Tahoma', 'Arial', sans-serif",
              boxShadow: '0 4px 20px rgba(0,0,0,0.06)',
              margin: '0 auto',
              maxWidth: '850px',
            }}
          >
            {/* ===== OFFICIAL HEADER ===== */}
            <div
              style={{
                borderBottom: `3px double ${NAVY}`,
                paddingBottom: '16px',
                marginBottom: '20px',
              }}
            >
              {/* Top Row: Logo centered, text on sides */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  direction: 'rtl',
                }}
              >
                {/* Right Side - Arabic text */}
                <div style={{ textAlign: 'right', flex: 1 }}>
                  <div style={{ fontSize: '14px', fontWeight: '800', color: NAVY, lineHeight: '1.8' }}>
                    جمهورية العراق
                  </div>
                  <div style={{ fontSize: '12.5px', fontWeight: '700', color: '#374151', lineHeight: '1.7' }}>
                    وزارة التعليم العالي والبحث العلمي
                  </div>
                  <div style={{ fontSize: '13.5px', fontWeight: '800', color: NAVY, lineHeight: '1.7' }}>
                    جامعة الفرات الأوسط التقنية
                  </div>
                  <div style={{ fontSize: '13px', fontWeight: '800', color: GOLD, lineHeight: '1.7' }}>
                    الكلية التقنية / كربلاء
                  </div>
                </div>

                {/* Center - Logo */}
                <div style={{ textAlign: 'center', flex: '0 0 auto', margin: '0 20px' }}>
                  {logoBase64 ? (
                    <img
                      src={logoBase64}
                      alt="شعار الكلية"
                      style={{
                        width: '85px',
                        height: '85px',
                        objectFit: 'contain',
                      }}
                    />
                  ) : (
                    <img
                      src="/college-logo.png"
                      alt="شعار الكلية"
                      style={{
                        width: '85px',
                        height: '85px',
                        objectFit: 'contain',
                      }}
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = 'none';
                      }}
                    />
                  )}
                </div>

                {/* Left Side - English text */}
                <div style={{ textAlign: 'left', flex: 1, direction: 'ltr' }}>
                  <div style={{ fontSize: '11.5px', fontWeight: '700', color: NAVY, lineHeight: '1.8' }}>
                    Republic of Iraq
                  </div>
                  <div style={{ fontSize: '10.5px', fontWeight: '600', color: '#374151', lineHeight: '1.7' }}>
                    Ministry of Higher Education
                  </div>
                  <div style={{ fontSize: '11px', fontWeight: '700', color: NAVY, lineHeight: '1.7' }}>
                    Al-Furat Al-Awsat Technical Univ.
                  </div>
                  <div style={{ fontSize: '11px', fontWeight: '700', color: GOLD, lineHeight: '1.7' }}>
                    Technical College / Karbala
                  </div>
                </div>
              </div>

              {/* Department Name */}
              <div
                style={{
                  textAlign: 'center',
                  marginTop: '10px',
                  padding: '6px 0',
                  borderTop: `1.5px solid ${NAVY}22`,
                }}
              >
                <span
                  style={{
                    fontSize: '14px',
                    fontWeight: '900',
                    color: NAVY,
                    letterSpacing: '0.5px',
                  }}
                >
                  قسم تقنيات المختبرات الطبية
                </span>
                <span style={{ color: '#9CA3AF', margin: '0 10px' }}>|</span>
                <span
                  style={{
                    fontSize: '11.5px',
                    fontWeight: '600',
                    color: '#6B7280',
                  }}
                >
                  Dept. of Medical Laboratory Techniques
                </span>
              </div>
            </div>

            {/* ===== DOCUMENT TITLE ===== */}
            <div
              style={{
                textAlign: 'center',
                marginBottom: '18px',
                padding: '12px 16px',
                background: `linear-gradient(135deg, ${NAVY}08, ${GOLD}12)`,
                borderRadius: '10px',
                border: `1px solid ${GOLD}30`,
              }}
            >
              <h2
                style={{
                  fontSize: '20px',
                  fontWeight: '900',
                  color: NAVY,
                  margin: '0 0 8px 0',
                  letterSpacing: '-0.3px',
                }}
              >
                {reportTitle}
              </h2>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  gap: '20px',
                  fontSize: '12.5px',
                  color: '#4B5563',
                  fontWeight: '600',
                  flexWrap: 'wrap',
                }}
              >
                {studyPeriodLabel && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span style={{ color: GOLD, fontSize: '14px' }}>◆</span>
                    الدراسة: <strong style={{ color: NAVY }}>{studyPeriodLabel}</strong>
                  </span>
                )}
                {sectionLabel && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span style={{ color: GOLD, fontSize: '14px' }}>◆</span>
                    الشعبة: <strong style={{ color: NAVY }}>{sectionLabel}</strong>
                  </span>
                )}
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ color: GOLD, fontSize: '14px' }}>◆</span>
                  التاريخ: <strong style={{ color: NAVY }}>{currentDateFormatted}</strong>
                </span>
              </div>
            </div>

            {/* ===== STATISTICS BAR ===== */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '12px',
                marginBottom: '18px',
              }}
            >
              <div
                style={{
                  textAlign: 'center',
                  padding: '12px 10px',
                  background: '#F8FAFC',
                  borderRadius: '10px',
                  border: `1.5px solid ${NAVY}20`,
                  borderBottom: `3px solid ${NAVY}`,
                }}
              >
                <div style={{ fontSize: '10.5px', color: '#6B7280', fontWeight: '700', marginBottom: '4px', letterSpacing: '0.3px' }}>
                  إجمالي الطلبة
                </div>
                <div style={{ fontSize: '22px', fontWeight: '900', color: NAVY }}>{totalStudents}</div>
              </div>
              <div
                style={{
                  textAlign: 'center',
                  padding: '12px 10px',
                  background: '#F0FDF4',
                  borderRadius: '10px',
                  border: '1.5px solid #BBF7D020',
                  borderBottom: `3px solid ${GREEN_DARK}`,
                }}
              >
                <div style={{ fontSize: '10.5px', color: GREEN_DARK, fontWeight: '700', marginBottom: '4px', letterSpacing: '0.3px' }}>
                  مجموع الحضور
                </div>
                <div style={{ fontSize: '22px', fontWeight: '900', color: '#059669' }}>{totalPresent}</div>
              </div>
              <div
                style={{
                  textAlign: 'center',
                  padding: '12px 10px',
                  background: '#FEF2F2',
                  borderRadius: '10px',
                  border: '1.5px solid #FECACA20',
                  borderBottom: `3px solid ${RED_DARK}`,
                }}
              >
                <div style={{ fontSize: '10.5px', color: RED_DARK, fontWeight: '700', marginBottom: '4px', letterSpacing: '0.3px' }}>
                  مجموع الغيابات
                </div>
                <div style={{ fontSize: '22px', fontWeight: '900', color: '#DC2626' }}>{totalAbsent}</div>
              </div>
            </div>

            {/* ===== ATTENDANCE TABLE ===== */}
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                fontSize: '12px',
                marginBottom: '28px',
              }}
            >
              <thead>
                <tr
                  style={{
                    backgroundColor: NAVY,
                    color: '#FFFFFF',
                  }}
                >
                  <th style={{ border: `1.5px solid ${NAVY}`, padding: '9px 6px', width: '38px', textAlign: 'center', fontWeight: '700' }}>ت</th>
                  <th style={{ border: `1.5px solid ${NAVY}`, padding: '9px 10px', textAlign: 'right', fontWeight: '700' }}>اسم الطالب الثلاثي</th>
                  <th style={{ border: `1.5px solid ${NAVY}`, padding: '9px 8px', width: '100px', textAlign: 'center', fontWeight: '700' }}>الباركود / ID</th>
                  <th style={{ border: `1.5px solid ${NAVY}`, padding: '9px 8px', width: '70px', textAlign: 'center', fontWeight: '700' }}>الشعبة</th>
                  {isLectureSession ? (
                    <>
                      <th style={{ border: `1.5px solid ${NAVY}`, padding: '9px 8px', width: '85px', textAlign: 'center', fontWeight: '700' }}>الحالة</th>
                      <th style={{ border: `1.5px solid ${NAVY}`, padding: '9px 8px', width: '100px', textAlign: 'center', fontWeight: '700' }}>وقت التسجيل</th>
                    </>
                  ) : (
                    <>
                      <th style={{ border: `1.5px solid ${NAVY}`, padding: '9px 8px', width: '75px', textAlign: 'center', fontWeight: '700' }}>الحضور</th>
                      <th style={{ border: `1.5px solid ${NAVY}`, padding: '9px 8px', width: '75px', textAlign: 'center', fontWeight: '700' }}>الغياب</th>
                      <th style={{ border: `1.5px solid ${NAVY}`, padding: '9px 8px', width: '85px', textAlign: 'center', fontWeight: '700' }}>الموقف</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {sheetRecords.length === 0 ? (
                  <tr>
                    <td
                      colSpan={isLectureSession ? 6 : 7}
                      style={{ border: '1px solid #D1D5DB', textAlign: 'center', padding: '20px', color: '#6B7280' }}
                    >
                      لا توجد بيانات متاحة في هذا الكشف
                    </td>
                  </tr>
                ) : (
                  sheetRecords.map((r, idx) => {
                    const isAbsent = r.status === 'ABSENT' || (r.absentCount != null && r.absentCount > 0);
                    const rowBg = idx % 2 === 0 ? '#FFFFFF' : '#F8FAFC';
                    return (
                      <tr key={r.id || idx} style={{ backgroundColor: rowBg }}>
                        <td style={{ border: `1px solid ${NAVY}40`, textAlign: 'center', padding: '7px 4px', fontWeight: '700', color: NAVY }}>
                          {r.orderIndex != null ? r.orderIndex : idx + 1}
                        </td>
                        <td style={{ border: `1px solid ${NAVY}40`, padding: '7px 10px', fontWeight: '700', color: '#111827' }}>
                          {r.studentName || r.name || 'بدون اسم'}
                        </td>
                        <td style={{ border: `1px solid ${NAVY}40`, textAlign: 'center', padding: '7px 6px', fontFamily: 'monospace', color: '#374151', fontSize: '11px' }}>
                          {r.studentCode || '-'}
                        </td>
                        <td style={{ border: `1px solid ${NAVY}40`, textAlign: 'center', padding: '7px 6px', fontSize: '11px', color: '#4B5563' }}>
                          {r.section ? `${r.section}` : '-'}
                        </td>
                        {isLectureSession ? (
                          <>
                            <td
                              style={{
                                border: `1px solid ${NAVY}40`,
                                textAlign: 'center',
                                padding: '7px 6px',
                                fontWeight: '800',
                                fontSize: '11.5px',
                                color: r.status === 'PRESENT' ? '#047857' : '#B91C1C',
                                backgroundColor: r.status === 'PRESENT' ? '#ECFDF5' : '#FEF2F2',
                              }}
                            >
                              {r.status === 'PRESENT' ? '✓ حاضر' : '✗ غائب'}
                            </td>
                            <td style={{ border: `1px solid ${NAVY}40`, textAlign: 'center', padding: '7px 6px', fontSize: '11px', color: '#4B5563' }}>
                              <span dir="ltr" style={{ unicodeBidi: 'isolate', display: 'inline-block' }}>
                                {formatAttendanceTime(r.registeredAt)}
                              </span>
                            </td>
                          </>
                        ) : (
                          <>
                            <td style={{ border: `1px solid ${NAVY}40`, textAlign: 'center', padding: '7px 6px', fontWeight: '800', color: '#047857' }}>
                              {r.presentCount || 0}
                            </td>
                            <td style={{ border: `1px solid ${NAVY}40`, textAlign: 'center', padding: '7px 6px', fontWeight: '800', color: isAbsent ? '#B91C1C' : '#374151' }}>
                              {r.absentCount || 0}
                            </td>
                            <td
                              style={{
                                border: `1px solid ${NAVY}40`,
                                textAlign: 'center',
                                padding: '7px 6px',
                                fontSize: '11px',
                                fontWeight: '800',
                                color:
                                  (r.absentCount || 0) >= 4
                                    ? '#FFFFFF'
                                    : (r.absentCount || 0) >= 2
                                    ? '#92400E'
                                    : '#047857',
                                backgroundColor:
                                  (r.absentCount || 0) >= 4
                                    ? '#DC2626'
                                    : (r.absentCount || 0) >= 2
                                    ? '#FEF3C7'
                                    : '#ECFDF5',
                                borderRadius: '0',
                              }}
                            >
                              {(r.absentCount || 0) >= 4
                                ? '⚠ إنذار نهائي'
                                : (r.absentCount || 0) >= 2
                                ? '⚡ إنذار أول'
                                : '✓ مستمر'}
                            </td>
                          </>
                        )}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>

            {/* ===== DEPARTMENT SIGNATURES ===== */}
            <div
              style={{
                marginTop: '32px',
                paddingTop: '18px',
                borderTop: `2px solid ${NAVY}`,
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                textAlign: 'center',
                gap: '20px',
                pageBreakInside: 'avoid',
                breakInside: 'avoid',
              }}
            >
              <div>
                <div style={{ fontSize: '13px', fontWeight: '800', color: NAVY, marginBottom: '44px' }}>
                  أستاذ المادة
                </div>
                <div style={{ borderTop: `1.5px solid ${NAVY}40`, width: '70%', margin: '0 auto', paddingTop: '6px', fontSize: '11px', color: '#6B7280' }}>
                  التوقيع والتاريخ
                </div>
              </div>
              <div>
                <div style={{ fontSize: '13px', fontWeight: '800', color: NAVY, marginBottom: '44px' }}>
                  مقرر القسم
                </div>
                <div style={{ borderTop: `1.5px solid ${NAVY}40`, width: '70%', margin: '0 auto', paddingTop: '6px', fontSize: '11px', color: '#6B7280' }}>
                  التوقيع والتاريخ
                </div>
              </div>
              <div>
                <div style={{ fontSize: '13px', fontWeight: '800', color: NAVY, marginBottom: '44px' }}>
                  رئيس القسم
                </div>
                <div style={{ borderTop: `1.5px solid ${NAVY}40`, width: '70%', margin: '0 auto', paddingTop: '6px', fontSize: '11px', color: '#6B7280' }}>
                  التوقيع والتاريخ
                </div>
              </div>
            </div>

            {/* ===== FOOTER NOTE ===== */}
            <div
              style={{
                marginTop: '20px',
                paddingTop: '10px',
                borderTop: '1px dashed #D1D5DB',
                textAlign: 'center',
                fontSize: '10px',
                color: '#9CA3AF',
              }}
            >
              تم إعداد هذا الكشف بواسطة نظام تسجيل الحضور الذكي — Smart Attendance Recording System
            </div>
          </div>
        </div>

        {/* Footer (Hidden in Print) */}
        <div
          className="no-print"
          style={{
            padding: '12px 24px',
            borderTop: '1px solid #E5E7EB',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: '#F9FAFB',
          }}
        >
          <div style={{ fontSize: '12px', color: '#6B7280' }}>
            عدد السجلات في هذا الكشف: <strong>{records.length}</strong> طالب
          </div>
          <button
            onClick={onClose}
            style={{
              padding: '8px 18px',
              borderRadius: '8px',
              border: '1px solid #D1D5DB',
              background: '#FFFFFF',
              color: '#374151',
              fontWeight: '600',
              fontSize: '13px',
              cursor: 'pointer',
            }}
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );

  if (typeof document === 'undefined') return modal;
  return createPortal(modal, document.body);
}
