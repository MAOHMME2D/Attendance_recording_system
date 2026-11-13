'use client';

import React, { useState, useEffect } from 'react';
import {
  sectionApi,
  SectionItem,
  STUDY_PERIODS,
  STAGE_OPTIONS,
  STAGE_LABELS,
  type DeleteDependencies,
} from '../../lib/api';
import DeleteGuardModal from './DeleteGuardModal';

interface SectionManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSectionsChanged?: () => void;
  initialPeriod?: 'MORNING' | 'EVENING';
  initialStage?: number;
}

export default function SectionManagerModal({
  isOpen,
  onClose,
  onSectionsChanged,
  initialPeriod = 'MORNING',
  initialStage = 2,
}: SectionManagerModalProps) {
  const [sections, setSections] = useState<SectionItem[]>([]);
  const [activeTab, setActiveTab] = useState<'MORNING' | 'EVENING'>(initialPeriod);
  const [activeStage, setActiveStage] = useState<number>(initialStage);
  const [newSectionName, setNewSectionName] = useState('');
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Pre-flight delete check: the modal lists every blocker that has to be
  // removed first, then asks for confirmation only when nothing blocks.
  const [deleteCandidate, setDeleteCandidate] = useState<SectionItem | null>(null);
  const [deleteDeps, setDeleteDeps] = useState<DeleteDependencies | null>(null);
  const [deleteDepsLoading, setDeleteDepsLoading] = useState(false);
  const [deleteDepsError, setDeleteDepsError] = useState<string | null>(null);

  const loadSections = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await sectionApi.getAll();
      setSections(data);
    } catch (err: any) {
      setError(err.message || 'فشل في تحميل قائمة الشُعب');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadSections();
      setActiveTab(initialPeriod);
      setActiveStage(initialStage);
      setNewSectionName('');
      setError(null);
      setSuccessMsg(null);
    }
  }, [isOpen, initialPeriod, initialStage]);

  if (!isOpen) return null;

  const currentTabSections = sections.filter(
    (s) => s.studyPeriod === activeTab && s.stage === activeStage,
  );

  const handleAddSection = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = newSectionName.trim();
    if (!cleanName) return;

    setActionLoading(true);
    setError(null);
    setSuccessMsg(null);

    try {
      await sectionApi.create({
        stage: activeStage,
        studyPeriod: activeTab,
        name: cleanName,
        label: `الشعبة ${cleanName}`,
      });
      setNewSectionName('');
      setSuccessMsg(
        `تمت إضافة الشعبة (${cleanName}) إلى ${STAGE_LABELS[activeStage as 1 | 2 | 3 | 4]}`,
      );
      await loadSections();
      if (onSectionsChanged) onSectionsChanged();
    } catch (err: any) {
      setError(err.message || 'فشل في إضافة الشعبة');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteSection = (sec: SectionItem) => {
    // Never delete directly: open the guard modal which lists the blockers.
    setDeleteCandidate(sec);
    setDeleteDeps(null);
    setDeleteDepsError(null);
    setDeleteDepsLoading(true);
    sectionApi
      .dependencies(sec.id)
      .then((deps) => setDeleteDeps(deps))
      .catch((err: any) => setDeleteDepsError(err?.message || 'فشل التحقق من الارتباطات'))
      .finally(() => setDeleteDepsLoading(false));
  };

  const confirmDeleteSection = () => {
    if (!deleteCandidate || !deleteDeps?.canDelete || actionLoading) return;

    setActionLoading(true);
    setError(null);
    setSuccessMsg(null);

    sectionApi
      .delete(deleteCandidate.id)
      .then(async () => {
        setSuccessMsg(`تم حذف الشعبة (${deleteCandidate.name}) بنجاح`);
        setDeleteCandidate(null);
        setDeleteDeps(null);
        await loadSections();
        if (onSectionsChanged) onSectionsChanged();
      })
      .catch((err: any) => {
        setDeleteDepsError(err?.message || 'فشل في حذف الشعبة');
        // Refresh the blockers list in case it changed while the modal was open.
        sectionApi
          .dependencies(deleteCandidate.id)
          .then((deps) => setDeleteDeps(deps))
          .catch(() => {});
      })
      .finally(() => setActionLoading(false));
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
        if (e.target === e.currentTarget) onClose();
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
            borderBottom: '1px solid #E5E7EB',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'linear-gradient(135deg, #F9FAFB 0%, #FFFFFF 100%)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                background: '#EEF2FF',
                color: '#4F46E5',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '18px',
                fontWeight: 'bold',
              }}
            >
              ⚙️
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 'bold', color: '#111827' }}>
                إدارة الشُعب الدراسية
              </h3>
              <p style={{ margin: 0, fontSize: '12px', color: '#6B7280' }}>
                إضافة وحذف الشُعب للدراسة الصباحية والمسائية
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '20px',
              cursor: 'pointer',
              color: '#9CA3AF',
              padding: '4px 8px',
              borderRadius: '6px',
            }}
          >
            ✕
          </button>
        </div>

        {/* Stage Selector */}
        <div
          style={{
            display: 'flex',
            gap: '6px',
            padding: '12px 20px 0',
            flexWrap: 'wrap',
          }}
        >
          {STAGE_OPTIONS.map((stage) => {
            const isActive = activeStage === stage.value;
            return (
              <button
                key={stage.value}
                type="button"
                onClick={() => {
                  setActiveStage(stage.value);
                  setError(null);
                  setSuccessMsg(null);
                }}
                style={{
                  padding: '6px 14px',
                  borderRadius: '20px',
                  border: isActive ? '1.5px solid #4F46E5' : '1px solid #D1D5DB',
                  background: isActive ? '#EEF2FF' : '#FFFFFF',
                  color: isActive ? '#4338CA' : '#4B5563',
                  cursor: 'pointer',
                  fontWeight: isActive ? '700' : '600',
                  fontSize: '12.5px',
                }}
              >
                {stage.label}
              </button>
            );
          })}
        </div>

        {/* Study Period Tabs */}
        <div
          style={{
            display: 'flex',
            padding: '12px 20px 0',
            borderBottom: '1px solid #E5E7EB',
            gap: '8px',
          }}
        >
          {STUDY_PERIODS.map((p) => {
            const isActive = activeTab === p.value;
            return (
              <button
                key={p.value}
                onClick={() => {
                  setActiveTab(p.value as any);
                  setError(null);
                  setSuccessMsg(null);
                }}
                style={{
                  padding: '10px 20px',
                  border: 'none',
                  background: 'none',
                  cursor: 'pointer',
                  fontWeight: isActive ? 'bold' : 'normal',
                  color: isActive ? '#4F46E5' : '#6B7280',
                  borderBottom: isActive ? '3px solid #4F46E5' : '3px solid transparent',
                  transition: 'all 0.2s',
                  fontSize: '14px',
                }}
              >
                {p.label}
              </button>
            );
          })}
        </div>

        {/* Body Content */}
        <div style={{ padding: '20px', overflowY: 'auto', flex: 1 }}>
          {error && (
            <div
              style={{
                padding: '10px 14px',
                borderRadius: '8px',
                background: '#FEF2F2',
                color: '#DC2626',
                fontSize: '13px',
                marginBottom: '16px',
                border: '1px solid #FEE2E2',
              }}
            >
              ⚠️ {error}
            </div>
          )}

          {successMsg && (
            <div
              style={{
                padding: '10px 14px',
                borderRadius: '8px',
                background: '#ECFDF5',
                color: '#059669',
                fontSize: '13px',
                marginBottom: '16px',
                border: '1px solid #D1FAE5',
              }}
            >
              ✅ {successMsg}
            </div>
          )}

          {/* Add Section Form */}
          <form onSubmit={handleAddSection} style={{ marginBottom: '20px' }}>
            <label
              style={{
                display: 'block',
                fontSize: '13px',
                fontWeight: '600',
                color: '#374151',
                marginBottom: '6px',
              }}
            >
              إضافة شعبة جديدة إلى ({STAGE_LABELS[activeStage as 1 | 2 | 3 | 4]} -{' '}
              {activeTab === 'EVENING' ? 'الدراسة المسائية' : 'الدراسة الصباحية'}):
            </label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="text"
                placeholder="اسم أو رقم الشعبة (مثال: 9 أو D أو أ)"
                value={newSectionName}
                onChange={(e) => setNewSectionName(e.target.value)}
                style={{
                  flex: 1,
                  padding: '10px 14px',
                  borderRadius: '8px',
                  border: '1px solid #D1D5DB',
                  fontSize: '14px',
                  outline: 'none',
                }}
              />
              <button
                type="submit"
                disabled={actionLoading || !newSectionName.trim()}
                style={{
                  padding: '10px 18px',
                  borderRadius: '8px',
                  border: 'none',
                  backgroundColor: '#4F46E5',
                  color: '#FFFFFF',
                  fontWeight: '600',
                  fontSize: '14px',
                  cursor: actionLoading || !newSectionName.trim() ? 'not-allowed' : 'pointer',
                  opacity: actionLoading || !newSectionName.trim() ? 0.6 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                + إضافة
              </button>
            </div>
          </form>

          {/* Current Sections List */}
          <div>
            <h4
              style={{
                fontSize: '13px',
                fontWeight: '600',
                color: '#4B5563',
                marginBottom: '10px',
                display: 'flex',
                justifyContent: 'space-between',
              }}
            >
              <span>الشُعب الحالية المسجلة:</span>
              <span style={{ color: '#9CA3AF' }}>({currentTabSections.length} شعبة)</span>
            </h4>

            {loading ? (
              <p style={{ textAlign: 'center', color: '#9CA3AF', fontSize: '13px', padding: '20px' }}>
                جاري التحميل...
              </p>
            ) : currentTabSections.length === 0 ? (
              <div
                style={{
                  textAlign: 'center',
                  padding: '30px 20px',
                  background: '#F9FAFB',
                  borderRadius: '10px',
                  color: '#6B7280',
                  fontSize: '13px',
                }}
              >
                لا توجد شُعب مضافة حالياً لهذه الدراسة. أضف أول شعبة من الحقل أعلاه.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {currentTabSections.map((sec) => (
                  <div
                    key={sec.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 14px',
                      borderRadius: '10px',
                      backgroundColor: '#F9FAFB',
                      border: '1px solid #E5E7EB',
                      transition: 'background-color 0.2s',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span
                        style={{
                          width: '28px',
                          height: '28px',
                          borderRadius: '8px',
                          background: '#E0E7FF',
                          color: '#4338CA',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 'bold',
                          fontSize: '13px',
                        }}
                      >
                        {sec.name}
                      </span>
                      <span style={{ fontWeight: '600', fontSize: '14px', color: '#1F2937' }}>
                        {sec.label || `الشعبة ${sec.name}`}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleDeleteSection(sec)}
                      disabled={actionLoading}
                      title="حذف هذه الشعبة"
                      style={{
                        padding: '6px 12px',
                        borderRadius: '6px',
                        border: '1px solid #FCA5A5',
                        background: '#FEF2F2',
                        color: '#DC2626',
                        fontSize: '12px',
                        fontWeight: '500',
                        cursor: actionLoading ? 'not-allowed' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        transition: 'all 0.15s',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = '#FEE2E2')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = '#FEF2F2')}
                    >
                      🗑️ حذف
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <DeleteGuardModal
        isOpen={Boolean(deleteCandidate)}
        title="حذف الشعبة"
        entityName={
          deleteCandidate
            ? `الشعبة «${deleteCandidate.label || deleteCandidate.name}»`
            : ''
        }
        entityMeta={
          deleteCandidate
            ? `المرحلة ${deleteCandidate.stage} · ${
                deleteCandidate.studyPeriod === 'EVENING' ? 'الدراسة المسائية' : 'الدراسة الصباحية'
              }`
            : undefined
        }
        loading={deleteDepsLoading}
        error={deleteDepsError}
        dependencies={deleteDeps}
        busy={actionLoading}
        onClose={() => {
          if (actionLoading) return;
          setDeleteCandidate(null);
          setDeleteDeps(null);
          setDeleteDepsError(null);
        }}
        onConfirm={confirmDeleteSection}
      />

      {/* Footer */}
        <div
          style={{
            padding: '14px 20px',
            borderTop: '1px solid #E5E7EB',
            display: 'flex',
            justifyContent: 'flex-end',
            background: '#F9FAFB',
          }}
        >
          <button
            onClick={onClose}
            style={{
              padding: '8px 18px',
              borderRadius: '8px',
              border: '1px solid #D1D5DB',
              background: '#FFFFFF',
              color: '#374151',
              fontWeight: '500',
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

