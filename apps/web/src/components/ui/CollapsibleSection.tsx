'use client';

import { useEffect, useState } from 'react';

interface CollapsibleSectionProps {
  title: React.ReactNode;
  children: React.ReactNode;
  /** Optional controlled open state (academics timetable edit flow). */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Fallback for uncontrolled mode; defaults to open on desktop, collapsed on phones. */
  defaultOpen?: boolean;
  className?: string;
  style?: React.CSSProperties;
  contentId: string;
}

/**
 * A glass-card section whose body can be collapsed behind a header toggle.
 * Used for every inline "add" form in the app so long forms do not push the
 * lists below them out of reach on phones.
 */
export default function CollapsibleSection({
  title,
  children,
  open,
  onOpenChange,
  defaultOpen,
  className = '',
  style,
  contentId,
}: CollapsibleSectionProps) {
  const isControlled = open !== undefined;
  const [internalOpen, setInternalOpen] = useState<boolean>(defaultOpen ?? true);

  // Collapse by default on phones (uncontrolled mode only).
  useEffect(() => {
    if (isControlled) return;
    if (defaultOpen !== undefined) return;
    if (typeof window !== 'undefined' && window.innerWidth <= 720) {
      setInternalOpen(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isControlled, defaultOpen]);

  const shown = isControlled ? open : internalOpen;
  const toggle = () => {
    if (isControlled) {
      onOpenChange?.(!shown);
    } else {
      setInternalOpen((value) => !value);
    }
  };

  return (
    <section className={`glass-card ${className}`} style={style}>
      <button
        type="button"
        onClick={toggle}
        aria-expanded={shown}
        aria-controls={contentId}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          width: '100%',
          background: 'transparent',
          border: 'none',
          padding: shown ? '2px 0 14px' : '2px 0',
          cursor: 'pointer',
          fontFamily: 'inherit',
          textAlign: 'right',
        }}
      >
        <h2 style={{ fontSize: '17px', fontWeight: 800 }}>{title}</h2>
        <span
          aria-hidden="true"
          style={{
            fontSize: '13px',
            fontWeight: 700,
            color: '#4B5563',
            border: '1px solid #E5E7EB',
            borderRadius: '8px',
            padding: '4px 12px',
            whiteSpace: 'nowrap',
          }}
        >
          {shown ? 'إخفاء ▲' : 'إظهار ▼'}
        </span>
      </button>
      {shown && <div id={contentId}>{children}</div>}
    </section>
  );
}
