'use client';

import React from 'react';

export default function StatCard({
  label,
  value,
  sub,
  tone = '#111827',
  icon,
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  tone?: string;
  icon?: React.ReactNode;
}) {
  return (
    <div
      className="glass-card"
      style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0 }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
        <span style={{ fontSize: '11.5px', fontWeight: '700', color: 'var(--text-muted)' }}>
          {label}
        </span>
        {icon && <span style={{ fontSize: '14px', lineHeight: 1 }}>{icon}</span>}
      </div>
      <div
        style={{
          fontSize: '24px',
          fontWeight: '800',
          color: tone,
          lineHeight: 1.15,
          fontVariantNumeric: 'tabular-nums',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {value}
      </div>
      {sub && (
        <div style={{ fontSize: '10.5px', color: 'var(--text-muted)', lineHeight: 1.5 }}>
          {sub}
        </div>
      )}
    </div>
  );
}
