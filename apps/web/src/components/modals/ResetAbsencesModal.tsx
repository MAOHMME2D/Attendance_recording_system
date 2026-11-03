'use client';

import React, { useState, useEffect } from 'react';
import { studentApi, sectionApi, SectionItem } from '../../lib/api';

interface ResetAbsencesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (message: string) => void;
  currentStudyPeriod?: string;
  currentSection?: string;
}

export default function ResetAbsencesModal({
  isOpen,
  onClose,
  onSuccess,
  currentStudyPeriod,
  currentSection,
}: ResetAbsencesModalProps) {
  const [scope, setScope] = useState<'ALL' | 'PERIOD' | 'SECTION'>('PERIOD');
  const [studyPeriod, setStudyPeriod] = useState<string>(currentStudyPeriod || 'MORNING');
  const [section, setSection] = useState<string>(currentSection || '');
  const [resetType, setResetType] = useState<'ABSENCES_ONLY' | 'ALL_ATTENDANCE'>('ABSENCES_ONLY');
  const [sections, setSections] = useState<SectionItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmText, setConfirmText] = useState('');

  useEffect(() => {
    if (isOpen) {
      if (currentStudyPeriod) setStudyPeriod(currentStudyPeriod);
      if (currentSection && currentSection !== 'ALL') {
        setScope('SECTION');
        setSection(currentSection);
      }
      setConfirmText('');
      setError(null);

      // Load sections for dropdown
      sectionApi
        .getAll()
        .then((data) => setSections(data))
        .catch(() => {});
    }
  }, [isOpen, currentStudyPeriod, currentSection]);

  if (!isOpen) return null;

  const filteredSections = sections.filter((s) => s.studyPeriod === studyPeriod);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();

    if (confirmText.trim() !== 'تأكيد') {
      setError('يرجى كتابة كلمة "تأكيد" في الحقل لتأكيد العملية');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const payload: any = {
        resetType,
      };

      if (scope === 'PERIOD') {
        payload.studyPeriod = studyPeriod;
      } else if (scope === 'SECTION') {
        payload.studyPeriod = studyPeriod;
        payload.section = section;
      }

      const res = await studentApi.resetAbsences(payload);
      onSuccess(res.message || 'تم تصفير الغيابات بنجاح');
      onClose();
    } catch (err: any) {
      setError(err.message || 'حدث خطأ أثناء تصفير الغيابات');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0,0,0,0.5)',
        backdropFilter: 'blur(3px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: '16px',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !loading) onClose();
      }}
    >
      <div
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '16px',
          width: '100%',
          maxWidth: '520px',
          boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '90vh',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '20px',
            borderBottom: '1px solid #FEE2E2',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'linear-gradient(135deg, #FEF2F2 0%, #FFFFFF 100%)',
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
              🔄
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 'bold', color: '#991B1B' }}>
                تصفير الغيابات
              </h3>
              <p style={{ margin: 0, fontSize: '12px', color: '#6B7280' }}>
                إعادة ضبط عداد وسجلات غيابات الطلاب
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={loading}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '20px',
              cursor: 'pointer',
              color: '#9CA3AF',
              padding: '4px 8px',
            }}
          >
            ✕
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleReset} style={{ padding: '20px', overflowY: 'auto', flex: 1 }}>
          {error && (
            <div
              style={{
                padding: '10px 14px',
                borderRadius: '8px',
                background: '#FEF2F2',
                color: '#DC2626',
                fontSize: '13px',
                marginBottom: '16px',
                border: '1px solid #FCA5A5',
              }}
            >
              ⚠️ {error}
            </div>
          )}

          {/* Scope Selection */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>
              نطاق التصفير:
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
              <button
                type="button"
                onClick={() => setScope('PERIOD')}
                style={{
                  padding: '8px',
                  borderRadius: '8px',
                  border: scope === 'PERIOD' ? '2px solid #DC2626' : '1px solid #D1D5DB',
                  background: scope === 'PERIOD' ? '#FEF2F2' : '#FFFFFF',
                  color: scope === 'PERIOD' ? '#991B1B' : '#4B5563',
                  fontSize: '12px',
                  fontWeight: '600',
                  cursor: 'pointer',
                }}
              >
                دراسة محددة
              </button>
              <button
                type="button"
                onClick={() => setScope('SECTION')}
                style={{
                  padding: '8px',
                  borderRadius: '8px',
                  border: scope === 'SECTION' ? '2px solid #DC2626' : '1px solid #D1D5DB',
                  background: scope === 'SECTION' ? '#FEF2F2' : '#FFFFFF',
                  color: scope === 'SECTION' ? '#991B1B' : '#4B5563',
                  fontSize: '12px',
                  fontWeight: '600',
                  cursor: 'pointer',
                }}
              >
                شعبة محددة
              </button>
              <button
                type="button"
                onClick={() => setScope('ALL')}
                style={{
                  padding: '8px',
                  borderRadius: '8px',
                  border: scope === 'ALL' ? '2px solid #DC2626' : '1px solid #D1D5DB',
                  background: scope === 'ALL' ? '#FEF2F2' : '#FFFFFF',
                  color: scope === 'ALL' ? '#991B1B' : '#4B5563',
                  fontSize: '12px',
                  fontWeight: '600',
                  cursor: 'pointer',
                }}
              >
                الكل (عام)
              </button>
            </div>
          </div>

          {/* Period Selection (if scope is not ALL) */}
          {scope !== 'ALL' && (
            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: '#4B5563', marginBottom: '6px' }}>
                الدراسة:
              </label>
              <select
                value={studyPeriod}
                onChange={(e) => {
                  setStudyPeriod(e.target.value);
                  setSection('');
                }}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: '8px',
                  border: '1px solid #D1D5DB',
                  fontSize: '14px',
                  outline: 'none',
                }}
              >
                <option value="MORNING">الدراسة الصباحية</option>
                <option value="EVENING">الدراسة المسائية</option>
              </select>
            </div>
          )}

          {/* Section Selection (if scope is SECTION) */}
          {scope === 'SECTION' && (
            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: '#4B5563', marginBottom: '6px' }}>
                الشعبة:
              </label>
              <select
                value={section}
                onChange={(e) => setSection(e.target.value)}
                required
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: '8px',
                  border: '1px solid #D1D5DB',
                  fontSize: '14px',
                  outline: 'none',
                }}
              >
                <option value="">-- اختر الشعبة --</option>
                {filteredSections.map((s) => (
                  <option key={s.id} value={s.name}>
                    {s.label || `الشعبة ${s.name}`}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Reset Type */}
          <div style={{ marginBottom: '18px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>
              نوع التصفير:
            </label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '10px',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  border: resetType === 'ABSENCES_ONLY' ? '1px solid #DC2626' : '1px solid #E5E7EB',
                  background: resetType === 'ABSENCES_ONLY' ? '#FEF2F2' : '#F9FAFB',
                  cursor: 'pointer',
                }}
              >
                <input
                  type="radio"
                  name="resetType"
                  value="ABSENCES_ONLY"
                  checked={resetType === 'ABSENCES_ONLY'}
                  onChange={() => setResetType('ABSENCES_ONLY')}
                  style={{ marginTop: '3px' }}
                />
                <div>
                  <strong style={{ fontSize: '13px', color: '#111827', display: 'block' }}>
                    تصفير الغيابات فقط (موصى به)
                  </strong>
                  <span style={{ fontSize: '12px', color: '#6B7280' }}>
                    تصفير عداد الغياب وحذف سجلات الغياب السابقة مع الحفاظ على سجلات حضور الطلاب.
                  </span>
                </div>
              </label>

              <label
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '10px',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  border: resetType === 'ALL_ATTENDANCE' ? '1px solid #DC2626' : '1px solid #E5E7EB',
                  background: resetType === 'ALL_ATTENDANCE' ? '#FEF2F2' : '#F9FAFB',
                  cursor: 'pointer',
                }}
              >
                <input
                  type="radio"
                  name="resetType"
                  value="ALL_ATTENDANCE"
                  checked={resetType === 'ALL_ATTENDANCE'}
                  onChange={() => setResetType('ALL_ATTENDANCE')}
                  style={{ marginTop: '3px' }}
                />
                <div>
                  <strong style={{ fontSize: '13px', color: '#DC2626', display: 'block' }}>
                    تصفير شامل (الحضور والغياب والبدء من الصفر)
                  </strong>
                  <span style={{ fontSize: '12px', color: '#6B7280' }}>
                    مسح جميع سجلات الحضور والغياب للبدء بفصل دراسي جديد كلياً.
                  </span>
                </div>
              </label>
            </div>
          </div>

          {/* Warning Banner */}
          <div
            style={{
              padding: '12px',
              borderRadius: '8px',
              backgroundColor: '#FFFBEB',
              border: '1px solid #FDE68A',
              marginBottom: '16px',
              fontSize: '12px',
              color: '#92400E',
              lineHeight: '1.6',
            }}
          >
            ⚠️ <strong>تنبيه مهم:</strong> عملية التصفير نهائية ولا يمكن التراجع عنها. سيتم تحديث إحصائيات الطلاب
            المحددين فوراً في قاعدة البيانات.
          </div>

          {/* Confirmation Input */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>
              للتأكيد، اكتب كلمة <span style={{ color: '#DC2626', fontWeight: 'bold' }}>"تأكيد"</span> أدناه:
            </label>
            <input
              type="text"
              placeholder='اكتب: تأكيد'
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: '8px',
                border: confirmText.trim() === 'تأكيد' ? '2px solid #059669' : '1px solid #D1D5DB',
                fontSize: '14px',
                outline: 'none',
              }}
            />
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '10px' }}>
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              style={{
                padding: '9px 18px',
                borderRadius: '8px',
                border: '1px solid #D1D5DB',
                background: '#FFFFFF',
                color: '#4B5563',
                fontSize: '13px',
                fontWeight: '500',
                cursor: 'pointer',
              }}
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={loading || confirmText.trim() !== 'تأكيد'}
              style={{
                padding: '9px 20px',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: confirmText.trim() === 'تأكيد' ? '#DC2626' : '#9CA3AF',
                color: '#FFFFFF',
                fontSize: '13px',
                fontWeight: '600',
                cursor: confirmText.trim() === 'تأكيد' && !loading ? 'pointer' : 'not-allowed',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              {loading ? 'جاري التصفير...' : 'تأكيد تصفير الغيابات'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

