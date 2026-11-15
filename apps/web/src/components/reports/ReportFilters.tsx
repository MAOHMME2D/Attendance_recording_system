'use client';

import React from 'react';
import type { ReportFilters, ReportOptions } from '../../lib/api';

/**
 * Shared, cross-filterable report filter bar. Every control limits what the
 * backend returns and stays consistent with the others; the user can reset
 * everything with one button.
 */
export default function ReportFilters({
  options,
  filters,
  onChange,
  showSearch = false,
  searchPlaceholder = 'ابحث...',
  showStatus = false,
  showLecturer = true,
  compact = false,
}: {
  options: ReportOptions | null;
  filters: ReportFilters;
  onChange: (next: ReportFilters) => void;
  showSearch?: boolean;
  searchPlaceholder?: string;
  showStatus?: boolean;
  showLecturer?: boolean;
  compact?: boolean;
}) {
  const set = (patch: Partial<ReportFilters>) => onChange({ ...filters, ...patch });

  const reset = () =>
    onChange({});

  const hasActiveFilters = Object.values(filters).some(
    (value) => value !== undefined && String(value).trim() !== '' && String(value) !== 'ALL',
  );

  return (
    <div
      className="glass-card"
      style={{ padding: compact ? '10px 12px' : '14px 16px', marginBottom: '14px' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', marginBottom: '10px' }}>
        <span style={{ fontSize: '12.5px', fontWeight: '800', color: '#111827' }}>
          الفلاتر
        </span>
        {hasActiveFilters && (
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={reset}
            style={{ fontSize: '11.5px', padding: '5px 12px', minHeight: '34px' }}
          >
            مسح الفلاتر
          </button>
        )}
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
          gap: '10px',
          alignItems: 'end',
        }}
      >
        <label style={{ fontSize: '11px', fontWeight: '700', color: '#374151' }}>
          المرحلة
          <select className="input" value={filters.stage ?? ''} onChange={(e) => set({ stage: e.target.value || undefined })} style={{ marginTop: '3px', fontSize: '13px' }}>
            <option value="">الكل</option>
            {(options?.stages ?? []).map((stage) => (
              <option key={stage.value} value={stage.value}>{stage.label}</option>
            ))}
          </select>
        </label>

        <label style={{ fontSize: '11px', fontWeight: '700', color: '#374151' }}>
          الشعبة
          <select className="input" value={filters.sectionId ?? ''} onChange={(e) => set({ sectionId: e.target.value || undefined })} style={{ marginTop: '3px', fontSize: '13px' }}>
            <option value="">الكل</option>
            {(options?.sections ?? []).map((section) => (
              <option key={section.id} value={section.id}>
                شعبة {section.name} — {section.stage} · {section.studyPeriod === 'EVENING' ? 'مسائي' : 'صباحي'}
              </option>
            ))}
          </select>
        </label>

        <label style={{ fontSize: '11px', fontWeight: '700', color: '#374151' }}>
          المادة
          <select className="input" value={filters.courseId ?? ''} onChange={(e) => set({ courseId: e.target.value || undefined })} style={{ marginTop: '3px', fontSize: '13px' }}>
            <option value="">الكل</option>
            {(options?.courses ?? []).map((course) => (
              <option key={course.id} value={course.id}>
                {course.code} — {course.name}
              </option>
            ))}
          </select>
        </label>

        {showLecturer && (
          <label style={{ fontSize: '11px', fontWeight: '700', color: '#374151' }}>
            المدرس
            <select className="input" value={filters.lecturerId ?? ''} onChange={(e) => set({ lecturerId: e.target.value || undefined })} style={{ marginTop: '3px', fontSize: '13px' }}>
              <option value="">الكل</option>
              {(options?.lecturers ?? []).map((lecturer) => (
                <option key={lecturer.id} value={lecturer.id}>
                  {lecturer.fullName}
                </option>
              ))}
            </select>
          </label>
        )}

        {showStatus && (
          <label style={{ fontSize: '11px', fontWeight: '700', color: '#374151' }}>
            حالة المحاضرة
            <select className="input" value={filters.status ?? ''} onChange={(e) => set({ status: e.target.value || undefined })} style={{ marginTop: '3px', fontSize: '13px' }}>
              <option value="">الكل</option>
              <option value="CLOSED">منتهية</option>
              <option value="ACTIVE">جارية</option>
            </select>
          </label>
        )}

        <label style={{ fontSize: '11px', fontWeight: '700', color: '#374151' }}>
          من تاريخ
          <input type="date" className="input" value={filters.from ?? ''} onChange={(e) => set({ from: e.target.value || undefined })} style={{ marginTop: '3px', fontSize: '13px' }} />
        </label>

        <label style={{ fontSize: '11px', fontWeight: '700', color: '#374151' }}>
          إلى تاريخ
          <input type="date" className="input" value={filters.to ?? ''} onChange={(e) => set({ to: e.target.value || undefined })} style={{ marginTop: '3px', fontSize: '13px' }} />
        </label>

        {showSearch && (
          <label style={{ fontSize: '11px', fontWeight: '700', color: '#374151', gridColumn: 'span 2', minWidth: '180px' }}>
            بحث
            <input
              type="text"
              className="input"
              value={filters.search ?? ''}
              onChange={(e) => set({ search: e.target.value || undefined })}
              placeholder={searchPlaceholder}
              style={{ marginTop: '3px', fontSize: '13px' }}
            />
          </label>
        )}
      </div>
    </div>
  );
}
