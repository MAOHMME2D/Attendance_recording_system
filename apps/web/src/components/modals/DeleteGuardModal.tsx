'use client';

import React, { useEffect } from 'react';
import type { DeleteDependencies } from '../../lib/api';

interface DeleteGuardModalProps {
  isOpen: boolean;
  /** e.g. «حذف الشعبة» / «حذف المادة» */
  title: string;
  /** Card under the title: subject name with its meta line. */
  entityName: string;
  entityMeta?: string;
  loading: boolean;
  error: string | null;
  dependencies: DeleteDependencies | null;
  busy: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

/**
 * Centered, pre-flight confirmation modal. It first shows what still links to
 * the entity (students, lectures, required enrollments, …) and what has to be
 * removed before deletion; the destructive button is disabled until the server
 * confirms there is nothing blocking.
 */
export default function DeleteGuardModal({
  isOpen,
  title,
  entityName,
  entityMeta,
  loading,
  error,
  dependencies,
  busy,
  onClose,
  onConfirm,
}: DeleteGuardModalProps) {
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, busy, onClose]);

  if (!isOpen) return null;

  const blockers = dependencies?.blockers ?? [];
  const canDelete = Boolean(dependencies?.canDelete) && !loading && !error;
  const notes = dependencies?.notes ?? [];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      style={{
        direction: 'rtl',
        position: 'fixed',
        inset: 0,
        zIndex: 10060,
        background: 'rgba(17, 24, 39, 0.55)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
      }}
      onClick={() => {
        if (!busy) onClose();
      }}
    >
      <div
        style={{
          background: '#FFFFFF',
          borderRadius: '20px',
          width: '100%',
          maxWidth: '540px',
          maxHeight: '88vh',
          overflowY: 'auto',
          boxShadow: '0 24px 48px -12px rgba(0,0,0,0.35)',
          border: '1px solid #E5E7EB',
          animation: 'fadeInScale 0.22s ease',
        }}
        onClick={(event) => event.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '18px 22px',
            borderBottom: '1px solid #F3F4F6',
            background: 'linear-gradient(135deg, #FFF7F7 0%, #FFFFFF 100%)',
            borderTopLeftRadius: '20px',
            borderTopRightRadius: '20px',
          }}
        >
          <div
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '12px',
              background: blockers.length > 0 ? '#FEF2F2' : '#ECFDF5',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '22px',
              flexShrink: 0,
            }}
          >
            {blockers.length > 0 ? '🚫' : '🗑️'}
          </div>
          <div style={{ minWidth: 0 }}>
            <h2
              style={{
                margin: 0,
                fontSize: '18px',
                fontWeight: '800',
                color: '#111827',
              }}
            >
              {title}
            </h2>
            <p
              style={{
                margin: '2px 0 0',
                fontSize: '12.5px',
                color: '#6B7280',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {entityName}
              {entityMeta ? ` · ${entityMeta}` : ''}
            </p>
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: '18px 22px' }}>
          {loading && !dependencies && (
            <div
              style={{
                textAlign: 'center',
                padding: '26px 10px',
                color: '#6B7280',
                fontSize: '14px',
                fontWeight: '600',
              }}
            >
              ⏳ جاري التحقق من الارتباطات قبل الحذف...
            </div>
          )}

          {error && (
            <div
              style={{
                marginBottom: '12px',
                padding: '10px 14px',
                borderRadius: '10px',
                background: '#FEF2F2',
                border: '1px solid #FECACA',
                color: '#991B1B',
                fontSize: '13px',
                fontWeight: '600',
              }}
            >
              ⚠️ {error}
            </div>
          )}

          {dependencies && blockers.length > 0 && (
            <>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '10px',
                  padding: '12px 14px',
                  borderRadius: '12px',
                  background: '#FFFBEB',
                  border: '1px solid #FDE68A',
                  marginBottom: '14px',
                }}
              >
                <span style={{ fontSize: '20px', lineHeight: 1.2 }}>⚠️</span>
                <div>
                  <p
                    style={{
                      margin: 0,
                      fontWeight: '800',
                      fontSize: '14px',
                      color: '#92400E',
                    }}
                  >
                    لا يمكن الحذف الآن
                  </p>
                  <p
                    style={{
                      margin: '3px 0 0',
                      fontSize: '12.5px',
                      color: '#A16207',
                      lineHeight: 1.6,
                    }}
                  >
                    يجب إزالة الارتباطات التالية أولاً، وبعدها يمكن الحذف:
                  </p>
                </div>
              </div>

              <ul
                style={{
                  listStyle: 'none',
                  margin: 0,
                  padding: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                }}
              >
                {blockers.map((blocker) => (
                  <li
                    key={blocker.key}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '12px',
                      padding: '12px 14px',
                      borderRadius: '12px',
                      background: '#FEF2F2',
                      border: '1px solid #FECACA',
                    }}
                  >
                    <span
                      style={{
                        minWidth: '40px',
                        height: '40px',
                        padding: '0 8px',
                        borderRadius: '10px',
                        background: '#DC2626',
                        color: '#FFFFFF',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: '800',
                        fontSize: '15px',
                        lineHeight: 1,
                      }}
                    >
                      {blocker.count}
                      <span style={{ fontSize: '9px', fontWeight: '700', marginTop: '2px' }}>
                        {blocker.count === 1 ? 'عنصر' : 'عناصر'}
                      </span>
                    </span>
                    <span style={{ minWidth: 0 }}>
                      <span
                        style={{
                          display: 'block',
                          fontWeight: '700',
                          fontSize: '13.5px',
                          color: '#7F1D1D',
                        }}
                      >
                        {blocker.label}
                      </span>
                      <span
                        style={{
                          display: 'block',
                          marginTop: '3px',
                          fontSize: '12px',
                          color: '#B91C1C',
                          lineHeight: 1.7,
                        }}
                      >
                        <strong>ما يجب فعله:</strong> {blocker.action}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}

          {dependencies && blockers.length === 0 && (
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '10px',
                padding: '12px 14px',
                borderRadius: '12px',
                background: '#ECFDF5',
                border: '1px solid #A7F3D0',
              }}
            >
              <span style={{ fontSize: '20px', lineHeight: 1.2 }}>✅</span>
              <div>
                <p
                  style={{
                    margin: 0,
                    fontWeight: '800',
                    fontSize: '14px',
                    color: '#065F46',
                  }}
                >
                  لا توجد أي ارتباطات تمنع الحذف
                </p>
                <p
                  style={{
                    margin: '3px 0 0',
                    fontSize: '12.5px',
                    color: '#047857',
                    lineHeight: 1.7,
                  }}
                >
                  سيتم حذف هذا بالكامل من قاعدة البيانات ولا يمكن التراجع عن هذه العملية.
                </p>
              </div>
            </div>
          )}

          {notes.length > 0 && (
            <ul
              style={{
                margin: '12px 0 0',
                padding: '0 0 0 2px',
                listStyle: 'none',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
              }}
            >
              {notes.map((note, index) => (
                <li
                  key={index}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '8px',
                    fontSize: '12.5px',
                    color: '#1E40AF',
                    background: '#EFF6FF',
                    border: '1px solid #BFDBFE',
                    borderRadius: '10px',
                    padding: '8px 12px',
                    lineHeight: 1.7,
                  }}
                >
                  <span>ℹ️</span>
                  <span>{note}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '10px',
            padding: '14px 22px',
            borderTop: '1px solid #F3F4F6',
            background: '#F9FAFB',
            borderBottomLeftRadius: '20px',
            borderBottomRightRadius: '20px',
          }}
        >
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            style={{
              padding: '10px 18px',
              borderRadius: '10px',
              border: '1px solid #D1D5DB',
              background: '#FFFFFF',
              color: '#374151',
              fontWeight: '700',
              fontSize: '13px',
              cursor: busy ? 'not-allowed' : 'pointer',
              opacity: busy ? 0.6 : 1,
            }}
          >
            إغلاق
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={!canDelete || busy}
            title={
              !canDelete
                ? 'لا يمكن الحذف قبل إزالة الارتباطات'
                : 'تأكيد الحذف النهائي'
            }
            style={{
              padding: '10px 22px',
              borderRadius: '10px',
              border: 'none',
              background: canDelete && !busy ? '#DC2626' : '#E5E7EB',
              color: canDelete && !busy ? '#FFFFFF' : '#9CA3AF',
              fontWeight: '800',
              fontSize: '13px',
              cursor: canDelete && !busy ? 'pointer' : 'not-allowed',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            {busy ? '⏳ جاري الحذف...' : '🗑️ حذف نهائي'}
          </button>
        </div>

        <style jsx global>{`
          @keyframes fadeInScale {
            from {
              opacity: 0;
              transform: scale(0.96) translateY(12px);
            }
            to {
              opacity: 1;
              transform: scale(1) translateY(0);
            }
          }
        `}</style>
      </div>
    </div>
  );
}
