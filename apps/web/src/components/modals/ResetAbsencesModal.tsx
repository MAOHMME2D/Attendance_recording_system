'use client';

import React, { useState, useEffect } from 'react';
import {
  ACADEMIC_STAGES,
  STAGE_LABELS,
  studentApi,
  sectionApi,
  SectionItem,
} from '../../lib/api';

interface ResetAbsencesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (message: string) => void;
  currentStudyPeriod?: string;
  currentSection?: string;
  currentSectionId?: string;
  currentStage?: number;
}

type ResetScope = 'STAGE' | 'PERIOD' | 'SECTION';
type StudyPeriod = 'MORNING' | 'EVENING';

export default function ResetAbsencesModal({
  isOpen,
  onClose,
  onSuccess,
  currentStudyPeriod,
  currentSection,
  currentSectionId,
  currentStage,
}: ResetAbsencesModalProps) {
  // A stage is always required: the backend rejects an unscoped reset so a
  // cleanup for one stage can never silently zero another stage.
  const [scope, setScope] = useState<ResetScope>('PERIOD');
  const [stage, setStage] = useState<number>(
    currentStage && ACADEMIC_STAGES.includes(currentStage as any) ? currentStage : 2,
  );
  const [studyPeriod, setStudyPeriod] = useState<StudyPeriod>(
    currentStudyPeriod === 'EVENING' ? 'EVENING' : 'MORNING',
  );
  const [sectionId, setSectionId] = useState<string>(currentSectionId || '');
  const [resetType, setResetType] = useState<'ABSENCES_ONLY' | 'ALL_ATTENDANCE'>('ABSENCES_ONLY');
  const [sections, setSections] = useState<SectionItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmText, setConfirmText] = useState('');

  useEffect(() => {
    if (isOpen) {
      if (currentStudyPeriod === 'EVENING' || currentStudyPeriod === 'MORNING') {
        setStudyPeriod(currentStudyPeriod);
      }
      if (currentStage && ACADEMIC_STAGES.includes(currentStage as any)) {
        setStage(currentStage);
      }
      if (currentSectionId) {
        setScope('SECTION');
        setSectionId(currentSectionId);
      } else {
        setSectionId('');
      }
      setConfirmText('');
      setError(null);

      // Load sections for dropdown
      sectionApi
        .getAll()
        .then((data) => setSections(data))
        .catch(() => {});
    }
  }, [isOpen, currentStudyPeriod, currentSection, currentSectionId, currentStage]);

  if (!isOpen) return null;

  const filteredSections = sections.filter(
    (section) => section.stage === stage && section.studyPeriod === studyPeriod,
  );

  const selectedSection = sections.find((section) => section.id === sectionId) || null;
  const legacySectionMatch =
    !selectedSection && currentSection
      ? sections.find(
          (section) =>
            section.stage === stage &&
            section.studyPeriod === studyPeriod &&
            section.name === currentSection,
        ) || null
      : null;
  const effectiveSection = selectedSection || legacySectionMatch;

  const scopeSummary =
    scope === 'SECTION'
      ? `${STAGE_LABELS[stage as keyof typeof STAGE_LABELS]} — ${
          studyPeriod === 'EVENING' ? 'مسائي' : 'صباحي'
        } — ${effectiveSection?.label || effectiveSection?.name || 'اختر شعبة'}`
      : scope === 'PERIOD'
        ? `${STAGE_LABELS[stage as keyof typeof STAGE_LABELS]} — ${
            studyPeriod === 'EVENING' ? 'مسائي' : 'صباحي'
          }`
        : `${STAGE_LABELS[stage as keyof typeof STAGE_LABELS]} — كل الشعب`;

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();

    if (confirmText.trim() !== 'تأكيد') {
      setError('يرجى كتابة كلمة "تأكيد" في الحقل لتأكيد العملية');
      return;
    }

    if (scope === 'SECTION' && !sectionId) {
      setError('يرجى اختيار الشعبة أولاً');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const payload: {
        stage: number;
        studyPeriod?: StudyPeriod;
        sectionId?: string;
        resetType: 'ABSENCES_ONLY' | 'ALL_ATTENDANCE';
      } = {
        stage,
        resetType,
      };

      if (scope === 'PERIOD' || scope === 'SECTION') {
        payload.studyPeriod = studyPeriod;
      }
      if (scope === 'SECTION') {
        payload.sectionId = sectionId;
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
                onClick={() => setScope('STAGE')}
                style={{
                  padding: '8px',
                  borderRadius: '8px',
                  border: scope === 'STAGE' ? '2px solid #DC2626' : '1px solid #D1D5DB',
                  background: scope === 'STAGE' ? '#FEF2F2' : '#FFFFFF',
                  color: scope === 'STAGE' ? '#991B1B' : '#4B5563',
                  fontSize: '12px',
                  fontWeight: '600',
                  cursor: 'pointer',
                }}
              >
                كل شعب المرحلة
              </button>
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
            </div>
          </div>

          {/* Stage Selection (always required) */}
          <div style={{ marginBottom: '14px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: '#4B5563', marginBottom: '6px' }}>
              المرحلة:
            </label>
            <select
              value={stage}
              onChange={(e) => {
                setStage(Number(e.target.value));
                setSectionId('');
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
              {ACADEMIC_STAGES.map((value) => (
                <option key={value} value={value}>
                  {STAGE_LABELS[value]}
                </option>
              ))}
            </select>
          </div>

          {/* Period Selection (stage scope covers every period in that stage) */}
          {scope !== 'STAGE' && (
            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: '#4B5563', marginBottom: '6px' }}>
                الدراسة:
              </label>
              <select
                value={studyPeriod}
                onChange={(e) => {
                  setStudyPeriod(e.target.value as StudyPeriod);
                  setSectionId('');
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
                value={sectionId}
                onChange={(e) => setSectionId(e.target.value)}
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
                  <option key={s.id} value={s.id}>
                    {s.label || `الشعبة ${s.name}`}
                  </option>
                ))}
              </select>
              {filteredSections.length === 0 && (
                <p style={{ marginTop: '6px', fontSize: '12px', color: '#B45309' }}>
                  لا توجد شعب مسجلة لهذه المرحلة والدراسة.
                </p>
              )}
            </div>
          )}

          {/* Scope summary */}
          <div
            style={{
              padding: '10px 12px',
              borderRadius: '8px',
              background: '#F9FAFB',
              border: '1px solid #E5E7EB',
              marginBottom: '16px',
              fontSize: '12.5px',
              color: '#374151',
            }}
          >
            <strong>سيتم التصفير ضمن:</strong> {scopeSummary}
          </div>

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
