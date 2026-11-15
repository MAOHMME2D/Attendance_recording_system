'use client';

import React, { useMemo } from 'react';

/* Hand-rolled, dependency-free SVG charts tuned for Arabic RTL layouts. */

export function DonutChart({
  present,
  absent,
  size = 150,
  thickness = 22,
}: {
  present: number;
  absent: number;
  size?: number;
  thickness?: number;
}) {
  const total = present + absent;
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  const fraction = total > 0 ? present / total : 0;
  const dash = fraction * circumference;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label="توزيع الحضور والغياب">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="#FEE2E2"
        strokeWidth={thickness}
      />
      {total > 0 && (
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#10B981"
          strokeWidth={thickness}
          strokeDasharray={`${dash} ${circumference - dash}`}
          strokeDashoffset={circumference / 4}
          strokeLinecap="round"
          style={{ transition: 'stroke-dasharray 0.6s ease' }}
        />
      )}
      <text
        x="50%"
        y="45%"
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize="19"
        fontWeight="800"
        fill="#111827"
      >
        {total > 0 ? `${Math.round(fraction * 100)}%` : '—'}
      </text>
      <text
        x="50%"
        y="62%"
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize="9"
        fontWeight="700"
        fill="#6B7280"
      >
        حضور
      </text>
    </svg>
  );
}

export function BarChart({
  items,
  valueSuffix = '',
  maxValue,
  emptyLabel = 'لا توجد بيانات في النطاق المحدد',
}: {
  items: Array<{ label: string; value: number | null; color?: string; hint?: string }>;
  valueSuffix?: string;
  maxValue?: number | null;
  emptyLabel?: string;
}) {
  const max = maxValue != null && maxValue > 0
    ? maxValue
    : Math.max(1, ...items.map((item) => item.value ?? 0));
  const hasData = items.some((item) => (item.value ?? 0) > 0);

  if (!hasData) {
    return (
      <p style={{ color: 'var(--text-muted)', fontSize: '13px', textAlign: 'center', padding: '18px 8px' }}>
        {emptyLabel}
      </p>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {items.map((item, index) => {
        const value = item.value ?? 0;
        const width = Math.max((value / max) * 100, value > 0 ? 3 : 0);
        return (
          <div key={index} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                flex: '0 0 108px',
                fontSize: '12px',
                fontWeight: '700',
                color: '#374151',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                textAlign: 'right',
              }}
              title={item.label}
            >
              {item.label}
            </div>
            <div style={{ flex: 1, background: '#F3F4F6', borderRadius: '6px', height: '22px', position: 'relative' }}>
              <div
                style={{
                  width: `${width}%`,
                  height: '100%',
                  background: item.color || '#C9A84C',
                  borderRadius: '6px',
                  transition: 'width 0.5s ease',
                  minWidth: value > 0 ? '8px' : 0,
                }}
              />
            </div>
            <div style={{ flex: '0 0 54px', fontSize: '12px', fontWeight: '800', color: '#111827', direction: 'ltr', textAlign: 'left' }}>
              {item.value == null ? 'N/A' : `${value}${valueSuffix}`}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export interface TrendPoint {
  key: string;
  present: number;
  absent: number;
  lectures: number;
}

export function TrendChart({ points }: { points: TrendPoint[] }) {
  const width = 720;
  const height = 190;
  const padding = { top: 14, right: 8, bottom: 34, left: 8 };
  const innerWidth = width - padding.left - padding.right;
  const innerHeight = height - padding.top - padding.bottom;

  const { presentPoints, absentPoints, xFor, maxValue } = useMemo(() => {
    const values = points.flatMap((point) => [point.present, point.absent]);
    const max = Math.max(1, ...values);
    const step = points.length > 1 ? innerWidth / (points.length - 1) : innerWidth;
    const xFor = (index: number) => padding.left + (points.length > 1 ? index * step : innerWidth / 2);
    const yFor = (value: number) => padding.top + innerHeight - (value / max) * innerHeight;
    return {
      maxValue: max,
      xFor,
      presentPoints: points.map((point, index) => `${xFor(index)},${yFor(point.present)}`).join(' '),
      absentPoints: points.map((point, index) => `${xFor(index)},${yFor(point.absent)}`).join(' '),
    };
  }, [points, innerWidth, innerHeight, padding.top, padding.left]);

  if (points.length === 0) {
    return (
      <p style={{ color: 'var(--text-muted)', fontSize: '13px', textAlign: 'center', padding: '18px 8px' }}>
        لا توجد محاضرات مغلقة في النطاق المحدد
      </p>
    );
  }

  const labelEvery = Math.ceil(points.length / 6);

  return (
    <div style={{ overflowX: 'auto' }}>
      <svg width="100%" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="تطور الحضور والغياب" style={{ minWidth: '460px' }}>
        {/* grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((fraction) => {
          const y = padding.top + innerHeight * (1 - fraction);
          return (
            <line
              key={fraction}
              x1={padding.left}
              x2={width - padding.right}
              y1={y}
              y2={y}
              stroke="#E5E7EB"
              strokeDasharray={fraction === 0 ? '0' : '3 3'}
            />
          );
        })}
        {/* series */}
        <polyline
          points={presentPoints}
          fill="none"
          stroke="#C9A84C"
          strokeWidth="3"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        <polyline
          points={absentPoints}
          fill="none"
          stroke="#9CA3AF"
          strokeWidth="2.5"
          strokeLinejoin="round"
          strokeLinecap="round"
          strokeDasharray="6 4"
        />
        {/* points */}
        {points.map((point, index) => (
          <g key={index}>
            <circle cx={xFor(index)} cy={padding.top + innerHeight - (point.present / maxValue) * innerHeight} r="3.4" fill="#C9A84C" />
            <circle cx={xFor(index)} cy={padding.top + innerHeight - (point.absent / maxValue) * innerHeight} r="2.8" fill="#6B7280" />
          </g>
        ))}
        {/* x labels */}
        {points.map((point, index) =>
          index % labelEvery === 0 ? (
            <text
              key={index}
              x={xFor(index)}
              y={height - 12}
              textAnchor="middle"
              fontSize="9"
              fill="#6B7280"
              direction="ltr"
            >
              {point.key}
            </text>
          ) : null,
        )}
      </svg>
      <div style={{ display: 'flex', gap: '14px', justifyContent: 'center', marginTop: '4px', fontSize: '11px', color: '#4B5563' }}>
        <span><span style={{ color: '#C9A84C' }}>●</span> حضور</span>
        <span><span style={{ color: '#6B7280' }}>●</span> غياب</span>
      </div>
    </div>
  );
}
