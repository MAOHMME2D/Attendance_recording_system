'use client';

import React from 'react';

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
  if (!isOpen) return null;

  const handlePrint = () => {
    const originalTitle = document.title;
    const cleanTitle = reportTitle.replace(/[\s\/:*?"<>|]+/g, '_');
    const dateStr = new Date().toISOString().slice(0, 10);
    document.title = `${cleanTitle}_${dateStr}`;
    window.print();
    setTimeout(() => {
      document.title = originalTitle;
    }, 1000);
  };

  const currentDateFormatted = lectureDate || new Date().toLocaleDateString('ar-IQ', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  // Calculate totals
  const totalStudents = records.length;
  const isLectureSession = records.some(r => r.status !== undefined);
  const totalPresent = isLectureSession
    ? records.filter(r => r.status === 'PRESENT').length
    : records.reduce((acc, r) => acc + (r.presentCount || 0), 0);
  const totalAbsent = isLectureSession
    ? records.filter(r => r.status === 'ABSENT').length
    : records.reduce((acc, r) => acc + (r.absentCount || 0), 0);

  return (
    <div
      className="modal-backdrop animate-fade-in"
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
                background: '#FEE2E2',
                color: '#DC2626',
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
                background: '#DC2626',
                color: '#FFFFFF',
                fontWeight: '700',
                fontSize: '13px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: '0 4px 12px rgba(220, 38, 38, 0.25)',
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
            background: '#EFF6FF',
            borderBottom: '1px solid #DBEAFE',
            padding: '10px 24px',
            fontSize: '12px',
            color: '#1E40AF',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <span>💡</span>
          <span>
            <strong>طريقة حفظ الملف بصيغة PDF:</strong> عند الضغط على <strong>"تصدير / حفظ كـ PDF"</strong>، اختر من خانة <strong>"الوجهة" (Destination)</strong> خيار <strong>"حفظ بتنسيق PDF" (Save as PDF)</strong> ثم اضغط حفظ.
          </span>
        </div>

        {/* Scrollable Preview Container on Screen */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px', background: '#F3F4F6' }}>
          {/* Printable Report Document (A4 Styling) */}
          <div
            id="printable-attendance-report"
            style={{
              background: '#FFFFFF',
              borderRadius: '12px',
              padding: '24px 30px',
              color: '#111827',
              fontFamily: 'system-ui, -apple-system, sans-serif',
              boxShadow: '0 4px 20px rgba(0,0,0,0.06)',
              margin: '0 auto',
              maxWidth: '850px',
            }}
          >
            {/* Header: Republic of Iraq & College Info */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                borderBottom: '2.5px solid #1F2937',
                paddingBottom: '14px',
                marginBottom: '18px',
              }}
            >
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '13px', fontWeight: '800', color: '#111827' }}>
                  جمهورية العراق
                </div>
                <div style={{ fontSize: '12px', fontWeight: '700', color: '#374151' }}>
                  وزارة التعليم العالي والبحث العلمي
                </div>
                <div style={{ fontSize: '14px', fontWeight: '800', color: '#1E40AF', marginTop: '2px' }}>
                  كلية البوليتكنك - كربلاء
                </div>
                <div style={{ fontSize: '12px', fontWeight: '700', color: '#4B5563' }}>
                  قسم تقنيات المختبرات الطبية
                </div>
              </div>

              {/* College Logo */}
              <div style={{ textAlign: 'center' }}>
                <img
                  src="/college-logo.png"
                  alt="College Logo"
                  style={{
                    width: '64px',
                    height: '64px',
                    objectFit: 'contain',
                  }}
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />
              </div>

              <div style={{ textAlign: 'left', direction: 'ltr' }}>
                <div style={{ fontSize: '12px', color: '#6B7280' }}>
                  Date: {new Date().toISOString().slice(0, 10)}
                </div>
                <div style={{ fontSize: '11px', color: '#9CA3AF' }}>
                  Smart Attendance System
                </div>
                <div style={{ fontSize: '11px', fontWeight: '700', color: '#1F2937', marginTop: '4px' }}>
                  {studyPeriodLabel || ''}
                </div>
              </div>
            </div>

            {/* Document Title Banner */}
            <div style={{ textAlign: 'center', marginBottom: '18px' }}>
              <h2
                style={{
                  fontSize: '20px',
                  fontWeight: '900',
                  color: '#111827',
                  margin: '0 0 6px 0',
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
                  gap: '16px',
                  fontSize: '12.5px',
                  color: '#4B5563',
                  fontWeight: '600',
                  flexWrap: 'wrap',
                }}
              >
                {studyPeriodLabel && <span>الدراسة: <strong>{studyPeriodLabel}</strong></span>}
                {sectionLabel && <span>الشعبة: <strong>{sectionLabel}</strong></span>}
                <span>التاريخ: <strong>{currentDateFormatted}</strong></span>
              </div>
            </div>

            {/* Statistics Mini-Bar */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: isLectureSession ? 'repeat(3, 1fr)' : 'repeat(3, 1fr)',
                gap: '10px',
                marginBottom: '16px',
                padding: '10px 14px',
                background: '#F9FAFB',
                borderRadius: '8px',
                border: '1px solid #E5E7EB',
                textAlign: 'center',
              }}
            >
              <div>
                <div style={{ fontSize: '11px', color: '#6B7280', fontWeight: '600' }}>إجمالي الطلبة</div>
                <div style={{ fontSize: '16px', fontWeight: '800', color: '#111827' }}>{totalStudents}</div>
              </div>
              <div>
                <div style={{ fontSize: '11px', color: '#065F46', fontWeight: '600' }}>مجموع الحضور</div>
                <div style={{ fontSize: '16px', fontWeight: '800', color: '#059669' }}>{totalPresent}</div>
              </div>
              <div>
                <div style={{ fontSize: '11px', color: '#991B1B', fontWeight: '600' }}>مجموع الغيابات</div>
                <div style={{ fontSize: '16px', fontWeight: '800', color: '#DC2626' }}>{totalAbsent}</div>
              </div>
            </div>

            {/* Attendance Table */}
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                fontSize: '12px',
                marginBottom: '24px',
              }}
            >
              <thead>
                <tr style={{ backgroundColor: '#F3F4F6' }}>
                  <th style={{ border: '1.5px solid #374151', padding: '8px 6px', width: '38px', textAlign: 'center' }}>ت</th>
                  <th style={{ border: '1.5px solid #374151', padding: '8px 10px', textAlign: 'right' }}>اسم الطالب الثلاثي</th>
                  <th style={{ border: '1.5px solid #374151', padding: '8px 8px', width: '100px', textAlign: 'center' }}>الباركود / ID</th>
                  <th style={{ border: '1.5px solid #374151', padding: '8px 8px', width: '70px', textAlign: 'center' }}>الشعبة</th>
                  {isLectureSession ? (
                    <>
                      <th style={{ border: '1.5px solid #374151', padding: '8px 8px', width: '85px', textAlign: 'center' }}>الحالة</th>
                      <th style={{ border: '1.5px solid #374151', padding: '8px 8px', width: '100px', textAlign: 'center' }}>وقت التسجيل</th>
                    </>
                  ) : (
                    <>
                      <th style={{ border: '1.5px solid #374151', padding: '8px 8px', width: '75px', textAlign: 'center' }}>الحضور</th>
                      <th style={{ border: '1.5px solid #374151', padding: '8px 8px', width: '75px', textAlign: 'center' }}>الغياب</th>
                      <th style={{ border: '1.5px solid #374151', padding: '8px 8px', width: '85px', textAlign: 'center' }}>الموقف</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {records.length === 0 ? (
                  <tr>
                    <td
                      colSpan={isLectureSession ? 6 : 7}
                      style={{ border: '1px solid #D1D5DB', textAlign: 'center', padding: '20px', color: '#6B7280' }}
                    >
                      لا توجد بيانات متاحة في هذا الكشف
                    </td>
                  </tr>
                ) : (
                  records.map((r, idx) => {
                    const isAbsent = r.status === 'ABSENT' || (r.absentCount != null && r.absentCount > 0);
                    return (
                      <tr
                        key={r.id || idx}
                        style={{
                          backgroundColor: idx % 2 === 0 ? '#FFFFFF' : '#F9FAFB',
                        }}
                      >
                        <td style={{ border: '1px solid #4B5563', textAlign: 'center', padding: '6px 4px', fontWeight: '700' }}>
                          {r.orderIndex != null ? r.orderIndex : idx + 1}
                        </td>
                        <td style={{ border: '1px solid #4B5563', padding: '6px 10px', fontWeight: '700', color: '#111827' }}>
                          {r.studentName || r.name || 'بدون اسم'}
                        </td>
                        <td style={{ border: '1px solid #4B5563', textAlign: 'center', padding: '6px 6px', fontFamily: 'monospace', color: '#374151' }}>
                          {r.studentCode || '-'}
                        </td>
                        <td style={{ border: '1px solid #4B5563', textAlign: 'center', padding: '6px 6px' }}>
                          {r.section ? `شعبة ${r.section}` : '-'}
                        </td>
                        {isLectureSession ? (
                          <>
                            <td
                              style={{
                                border: '1px solid #4B5563',
                                textAlign: 'center',
                                padding: '6px 6px',
                                fontWeight: '800',
                                color: r.status === 'PRESENT' ? '#047857' : '#B91C1C',
                              }}
                            >
                              {r.status === 'PRESENT' ? 'حاضر' : 'غائب'}
                            </td>
                            <td style={{ border: '1px solid #4B5563', textAlign: 'center', padding: '6px 6px', fontSize: '11px', color: '#4B5563' }}>
                              {r.registeredAt
                                ? new Date(r.registeredAt).toLocaleTimeString('ar-IQ', { hour: '2-digit', minute: '2-digit' })
                                : '-'}
                            </td>
                          </>
                        ) : (
                          <>
                            <td style={{ border: '1px solid #4B5563', textAlign: 'center', padding: '6px 6px', fontWeight: '700', color: '#047857' }}>
                              {r.presentCount || 0}
                            </td>
                            <td style={{ border: '1px solid #4B5563', textAlign: 'center', padding: '6px 6px', fontWeight: '800', color: isAbsent ? '#B91C1C' : '#374151' }}>
                              {r.absentCount || 0}
                            </td>
                            <td
                              style={{
                                border: '1px solid #4B5563',
                                textAlign: 'center',
                                padding: '6px 6px',
                                fontSize: '11px',
                                fontWeight: '700',
                                color:
                                  (r.absentCount || 0) >= 4
                                    ? '#B91C1C'
                                    : (r.absentCount || 0) >= 2
                                    ? '#D97706'
                                    : '#047857',
                              }}
                            >
                              {(r.absentCount || 0) >= 4
                                ? 'إنذار نهائي'
                                : (r.absentCount || 0) >= 2
                                ? 'إنذار أول'
                                : 'مستمر'}
                            </td>
                          </>
                        )}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>

            {/* Department Signatures Section */}
            <div
              style={{
                marginTop: '36px',
                paddingTop: '16px',
                borderTop: '1.5px dashed #9CA3AF',
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                textAlign: 'center',
                gap: '20px',
                pageBreakInside: 'avoid',
                breakInside: 'avoid',
              }}
            >
              <div>
                <div style={{ fontSize: '12px', fontWeight: '700', color: '#374151', marginBottom: '40px' }}>
                  أستاذ المادة
                </div>
                <div style={{ fontSize: '11px', color: '#6B7280' }}>التوقيع: ..........................</div>
              </div>
              <div>
                <div style={{ fontSize: '12px', fontWeight: '700', color: '#374151', marginBottom: '40px' }}>
                  مقرر القسم
                </div>
                <div style={{ fontSize: '11px', color: '#6B7280' }}>التوقيع: ..........................</div>
              </div>
              <div>
                <div style={{ fontSize: '12px', fontWeight: '700', color: '#374151', marginBottom: '40px' }}>
                  رئيس القسم
                </div>
                <div style={{ fontSize: '11px', color: '#6B7280' }}>التوقيع: ..........................</div>
              </div>
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
}

