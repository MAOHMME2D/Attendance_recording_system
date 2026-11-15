'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { systemApi, type AcademicYearSummary } from '../../lib/api';

/** Must match ACADEMIC_YEAR_RESET_PHRASE in the API. */
const CONFIRM_PHRASE = 'بدء سنة دراسية جديدة';

const COUNT_CARDS: Array<{ key: keyof AcademicYearSummary; label: string; icon: string }> = [
  { key: 'students', label: 'الطلاب', icon: '👨‍🎓' },
  { key: 'sections', label: 'الشعب', icon: '🏫' },
  { key: 'courses', label: 'المواد', icon: '📘' },
  { key: 'lectures', label: 'المحاضرات', icon: '🗓️' },
  { key: 'attendanceRecords', label: 'سجلات الحضور', icon: '✅' },
  { key: 'timetableEntries', label: 'حصص الجدول', icon: '⏰' },
  { key: 'teachingAssignments', label: 'إسنادات التدريسيين', icon: '🧑‍🏫' },
  { key: 'enrollments', label: 'تخصيصات المواد', icon: '📋' },
];

export default function AcademicYearResetSection() {
  const [summary, setSummary] = useState<AcademicYearSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const loadSummary = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      setSummary(await systemApi.academicYearSummary());
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'تعذر تحميل ملخص البيانات');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  const openModal = () => {
    setConfirmText('');
    setSubmitError(null);
    setSuccess(null);
    setOpen(true);
  };

  const closeModal = () => {
    if (submitting) return;
    setOpen(false);
    setConfirmText('');
    setSubmitError(null);
  };

  const handleReset = async () => {
    if (confirmText.trim() !== CONFIRM_PHRASE) {
      setSubmitError(`اكتب العبارة التالية بالضبط: ${CONFIRM_PHRASE}`);
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      const result = await systemApi.resetAcademicYear(confirmText.trim());
      setSuccess(result.message);
      setOpen(false);
      setConfirmText('');
      await loadSummary();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'تعذر تصفير السنة الدراسية');
    } finally {
      setSubmitting(false);
    }
  };

  const canConfirm = confirmText.trim() === CONFIRM_PHRASE && !submitting;

  return (
    <div>
      <div style={{ marginBottom: '14px' }}>
        <h2 style={{ fontSize: '16px', fontWeight: '800', color: '#111827' }}>
          بدء سنة دراسية جديدة
        </h2>
        <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', marginTop: '3px', lineHeight: 1.7 }}>
          تصفير كامل للبيانات الأكاديمية استعداداً لسنة جديدة. تُحذف المواد والشعب
          والمحاضرات وسجلات الحضور والطلاب، وتبقى حسابات الموظفين وإعدادات النظام
          وسجل التدقيق كما هي.
        </p>
      </div>

      {success && (
        <div
          role="status"
          style={{
            padding: '12px 16px',
            borderRadius: '12px',
            background: '#ECFDF5',
            border: '1px solid #A7F3D0',
            color: '#065F46',
            fontSize: '13px',
            fontWeight: '700',
            marginBottom: '14px',
          }}
        >
          ✅ {success}
        </div>
      )}

      {loadError && (
        <div
          role="alert"
          style={{
            padding: '12px 16px',
            borderRadius: '12px',
            background: '#FEF2F2',
            border: '1px solid #FCA5A5',
            color: '#991B1B',
            fontSize: '13px',
            marginBottom: '14px',
          }}
        >
          ⚠️ {loadError}
        </div>
      )}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
          gap: '10px',
          marginBottom: '16px',
        }}
      >
        {COUNT_CARDS.map((card) => (
          <div
            key={card.key}
            style={{
              padding: '12px 14px',
              borderRadius: '12px',
              background: '#FFFFFF',
              border: '1px solid #E5E7EB',
              boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
            }}
          >
            <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', fontWeight: '700', marginBottom: '4px' }}>
              <span aria-hidden="true">{card.icon}</span> {card.label}
            </div>
            <div style={{ fontSize: '20px', fontWeight: '900', color: '#111827' }}>
              {loading ? '—' : (summary?.[card.key] ?? 0)}
            </div>
          </div>
        ))}
      </div>

      <div
        style={{
          padding: '14px 16px',
          borderRadius: '12px',
          background: '#FEF2F2',
          border: '1px solid #FCA5A5',
          marginBottom: '16px',
          fontSize: '12.5px',
          color: '#991B1B',
          lineHeight: 1.8,
        }}
      >
        ⚠️ <strong>منطقة خطرة:</strong> هذه العملية نهائية ولا يمكن التراجع عنها.
        تأكد من أخذ نسخة احتياطية قبل المتابعة. إن أردت فقط بداية فصل دراسي جديد
        دون حذف المواد والشعب، استخدم «تصفير الفصل الدراسي» في قسم الطلاب.
      </div>

      <button
        type="button"
        className="btn btn-danger"
        onClick={openModal}
        disabled={loading || !summary}
        style={{ fontSize: '13px', fontWeight: '800' }}
      >
        🗓️ بدء سنة دراسية جديدة
      </button>

      {open && (
        <div
          className="modal-backdrop animate-fade-in"
          onClick={closeModal}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
            zIndex: 1200,
          }}
        >
          <div
            className="glass-card animate-slide-up"
            onClick={(event) => event.stopPropagation()}
            style={{
              maxWidth: '520px',
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
              background: '#FFFFFF',
              borderRadius: '18px',
              border: '1px solid #E5E7EB',
              padding: '24px',
            }}
          >
            <h3 style={{ fontSize: '18px', fontWeight: '900', color: '#991B1B', marginBottom: '6px' }}>
              تأكيد بدء سنة دراسية جديدة
            </h3>
            <p style={{ fontSize: '13px', color: '#4B5563', lineHeight: 1.8, marginBottom: '14px' }}>
              سيتم حذف <strong>{summary?.students ?? 0}</strong> طالب،{' '}
              <strong>{summary?.sections ?? 0}</strong> شعبة،{' '}
              <strong>{summary?.courses ?? 0}</strong> مادة،{' '}
              <strong>{summary?.lectures ?? 0}</strong> محاضرة و{' '}
              <strong>{summary?.attendanceRecords ?? 0}</strong> سجل حضور نهائياً.
            </p>

            <div
              style={{
                padding: '10px 12px',
                borderRadius: '10px',
                background: '#FFFBEB',
                border: '1px solid #FDE68A',
                color: '#92400E',
                fontSize: '12px',
                lineHeight: 1.7,
                marginBottom: '16px',
              }}
            >
              لا يمكن التراجع عن هذه العملية. الموظفون وإعدادات النظام وسجل التدقيق لن يُحذفوا.
            </div>

            <label
              style={{
                display: 'block',
                fontSize: '13px',
                fontWeight: '700',
                color: '#374151',
                marginBottom: '6px',
              }}
            >
              للتأكيد، اكتب العبارة:{' '}
              <span style={{ color: '#DC2626', fontWeight: '900' }}>{CONFIRM_PHRASE}</span>
            </label>
            <input
              type="text"
              className="input"
              value={confirmText}
              onChange={(event) => setConfirmText(event.target.value)}
              placeholder={CONFIRM_PHRASE}
              autoFocus
              style={{
                width: '100%',
                fontSize: '14px',
                border:
                  confirmText.trim() === CONFIRM_PHRASE
                    ? '2px solid #059669'
                    : '1px solid #D1D5DB',
                marginBottom: '14px',
              }}
            />

            {submitError && (
              <div
                role="alert"
                style={{
                  padding: '10px 12px',
                  borderRadius: '10px',
                  background: '#FEF2F2',
                  border: '1px solid #FCA5A5',
                  color: '#991B1B',
                  fontSize: '12.5px',
                  marginBottom: '14px',
                }}
              >
                ⚠️ {submitError}
              </div>
            )}

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={closeModal}
                disabled={submitting}
                style={{ fontSize: '13px' }}
              >
                إلغاء
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={handleReset}
                disabled={!canConfirm}
                style={{ fontSize: '13px', fontWeight: '800' }}
              >
                {submitting ? 'جارٍ الحذف...' : 'تأكيد بدء السنة الدراسية'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
