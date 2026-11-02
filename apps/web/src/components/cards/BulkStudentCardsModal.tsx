'use client';

import React from 'react';
import { QRCodeSVG } from 'qrcode.react';

interface StudentData {
  id: string;
  name: string;
  studentCode: string;
  studyPeriod?: string | null;
  orderIndex?: number | null;
  section?: string | null;
}

interface BulkStudentCardsModalProps {
  students: StudentData[];
  onClose: () => void;
}

export default function BulkStudentCardsModal({ students, onClose }: BulkStudentCardsModalProps) {
  const handlePrint = () => {
    const originalTitle = document.title;
    document.title = 'بطاقات_حضور_الطلاب_قسم_تقنيات_المختبرات_الطبية';
    window.print();
    setTimeout(() => {
      document.title = originalTitle;
    }, 1000);
  };

  // Chunk students into groups of 9 (3x3 grid per A4 page)
  const CARDS_PER_PAGE = 9;
  const pages: StudentData[][] = [];
  for (let i = 0; i < students.length; i += CARDS_PER_PAGE) {
    pages.push(students.slice(i, i + CARDS_PER_PAGE));
  }

  return (
    <div
      className="modal-backdrop animate-fade-in"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.8)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        zIndex: 1100,
      }}
    >
      <div
        className="glass-card bulk-cards-modal-window animate-slide-up"
        onClick={e => e.stopPropagation()}
        style={{
          maxWidth: '1000px',
          width: '100%',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          padding: '24px',
          background: '#FFFFFF',
          borderRadius: '24px',
          border: '1px solid #E5E7EB',
          boxShadow: '0 20px 60px rgba(0,0,0,0.35)',
        }}
      >
        {/* Top Controls (Hidden in Print) */}
        <div
          className="no-print"
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '12px',
            borderBottom: '1px solid #E5E7EB',
            paddingBottom: '12px',
            flexWrap: 'wrap',
            gap: '10px',
          }}
        >
          <div>
            <h2 style={{ fontSize: '19px', fontWeight: '800', color: '#111827', margin: 0 }}>
              طباعة وتنزيل بطاقات الحضور ({students.length} طالب • {pages.length} صفحة A4)
            </h2>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
              ⚡ نظام فوري عالي الدقة: 9 بطاقات في كل ورقة A4 بدون تشويه وبخط عربي أصلي
            </p>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button
              className="btn btn-primary btn-sm"
              onClick={handlePrint}
              style={{
                fontSize: '13.5px',
                fontWeight: '700',
                background: '#059669',
                borderColor: '#059669',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '7px 16px',
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              تنزيل بصيغة PDF / طباعة فورية
            </button>
            <button className="btn btn-ghost btn-sm" onClick={onClose} style={{ fontSize: '13px' }}>
              إغلاق
            </button>
          </div>
        </div>

        {/* Helpful Tip Banner (Hidden in Print) */}
        <div
          className="no-print"
          style={{
            background: '#EFF6FF',
            border: '1px solid #BFDBFE',
            borderRadius: '12px',
            padding: '10px 14px',
            marginBottom: '14px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
          }}
        >
          <span style={{ fontSize: '20px' }}>💡</span>
          <div style={{ fontSize: '12.5px', color: '#1E40AF', lineHeight: '1.5' }}>
            <strong>طريقة حفظ الملف كـ PDF:</strong> بعد الضغط على زر <strong>"تنزيل بصيغة PDF / طباعة"</strong>، ستفتح نافذة الطباعة فوراً. من خيار <strong>"الوجهة" (Destination)</strong> اختر <strong>"حفظ بتنسيق PDF" (Save as PDF)</strong> للحصول على ملف سريع وعالي الدقة بدون أي تشويه بالحروف العربية.
          </div>
        </div>

        {/* Printable Cards Grid (Grouped by Pages) */}
        <div
          id="bulk-print-cards-container"
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '12px',
            background: '#F9FAFB',
            borderRadius: '16px',
            border: '1px solid #E5E7EB',
          }}
        >
          {pages.map((pageStudents, pageIdx) => (
            <div
              key={pageIdx}
              className="bulk-cards-page"
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
                gap: '14px',
                marginBottom: pageIdx < pages.length - 1 ? '24px' : '0',
                paddingBottom: pageIdx < pages.length - 1 ? '18px' : '0',
                borderBottom: pageIdx < pages.length - 1 ? '1px dashed #D1D5DB' : 'none',
              }}
            >
              {pageStudents.map((student, idx) => (
                <div
                  key={student.id || idx}
                  className="student-print-badge"
                  style={{
                    background: '#FFFFFF',
                    border: '1.5px solid #111827',
                    borderRadius: '12px',
                    padding: '10px 8px',
                    textAlign: 'center',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.04)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <div style={{ width: '100%', borderBottom: '1px solid #F3F4F6', paddingBottom: '4px', marginBottom: '4px' }}>
                    <div style={{ fontSize: '11px', fontWeight: '800', color: '#111827', lineHeight: 1.2 }}>
                      كلية البوليتكنك | قسم تقنيات المختبرات الطبية
                    </div>
                    <div style={{ fontSize: '9.5px', color: '#6B7280', marginTop: '2px' }}>
                      {(student.studyPeriod || 'MORNING') === 'EVENING' ? 'الدراسة المسائية' : 'الدراسة الصباحية'} • بطاقة الحضور
                    </div>
                  </div>

                  {/* QR Code Box - BIGGER SIZE */}
                  <div style={{ padding: '4px', background: '#FFFFFF', borderRadius: '8px', border: '1.5px solid #D1D5DB', display: 'inline-block', margin: '3px 0' }}>
                    <QRCodeSVG
                      value={student.studentCode}
                      size={130}
                      level="M"
                      marginSize={1}
                      bgColor="#FFFFFF"
                      fgColor="#000000"
                    />
                  </div>

                  <div style={{ width: '100%', marginTop: '3px' }}>
                    <div style={{ fontWeight: '700', fontSize: '12.5px', color: '#111827', marginBottom: '3px', lineHeight: 1.25, whiteSpace: 'normal' }}>
                      {student.name}
                      {student.section && (
                        <span style={{ fontSize: '10.5px', color: '#4B5563', marginRight: '4px', fontWeight: 'normal' }}>
                          (شعبة {student.section})
                        </span>
                      )}
                    </div>

                    <div style={{ display: 'inline-block', background: '#F3F4F6', border: '1px solid #D1D5DB', borderRadius: '6px', padding: '1px 8px', fontSize: '11.5px', fontWeight: '800', color: '#111827', fontFamily: 'monospace' }}>
                      ID: {student.studentCode}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
