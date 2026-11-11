'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { reportsApi, stageLabel, type ReportCourseItem, type ReportFilters, type ReportOptions, type ReportCourseStudentsResponse } from '../../../lib/api';
import StatCard from '../StatCard';
import ReportFiltersBar from '../ReportFilters';
import ReportExport from '../ReportExport';

export default function CoursesReportTab() {
  const [options, setOptions] = useState<ReportOptions | null>(null);
  const [filters, setFilters] = useState<ReportFilters>({});
  const [items, setItems] = useState<ReportCourseItem[]>([]);
  const [totals, setTotals] = useState<{ courses: number; closedLectures: number; present: number; absent: number; totalCases: number; attendanceRate: number | null; absenceRate: number | null } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ReportCourseStudentsResponse | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    reportsApi.options().then((result) => { if (!cancelled) setOptions(result); }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await reportsApi.courses(filters);
      setItems(result.items);
      setTotals(result.totals);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر تحميل تقرير المواد');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    const id = window.setTimeout(load, 200);
    return () => window.clearTimeout(id);
  }, [load]);

  const loadDetail = useCallback(async (courseId: string) => {
    setDetailLoading(true);
    setDetailError(null);
    try {
      const result = await reportsApi.courseStudents(courseId, filters);
      setDetail(result);
    } catch (err) {
      setDetailError(err instanceof Error ? err.message : 'تعذر تحميل تفاصيل المادة');
    } finally {
      setDetailLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    if (selectedCourseId) loadDetail(selectedCourseId);
    else setDetail(null);
  }, [selectedCourseId, loadDetail]);

  const filtersLabel = [
    filters.stage ? `المرحلة: ${stageLabel(Number(filters.stage))}` : null,
    filters.from ? `من ${filters.from}` : null,
    filters.to ? `إلى ${filters.to}` : null,
  ].filter(Boolean).join(' · ') || 'كل النطاقات';

  const exportRows = items.map((item) => ({
    الرمز: item.code,
    المادة: item.name,
    المرحلة: stageLabel(item.stage),
    'المحاضرات المنتهية': item.closedLectures,
    حضور: item.present,
    غياب: item.absent,
    إجمالي: item.totalCases,
    'نسبة الحضور': item.attendanceRate == null ? 'N/A' : `${item.attendanceRate}%`,
    'نسبة الغياب': item.absenceRate == null ? 'N/A' : `${item.absenceRate}%`,
  }));

  return (
    <div>
      <ReportFiltersBar
        options={options}
        filters={filters}
        onChange={(next) => { setSelectedCourseId(null); setFilters(next); }}
        showStatus
        showLecturer
      />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', marginBottom: '14px', flexWrap: 'wrap' }}>
        <h2 style={{ fontSize: '16px', fontWeight: '800', color: '#111827' }}>تقارير المواد</h2>
        <ReportExport
          title="تقرير المواد"
          filtersLabel={filtersLabel}
          stats={totals ? [
            { label: 'المواد', value: totals.courses },
            { label: 'محاضرات منتهية', value: totals.closedLectures },
            { label: 'حضور', value: totals.present },
            { label: 'غياب', value: totals.absent },
          ] : []}
          columns={[
            { header: 'الرمز', value: (row) => row['الرمز'] },
            { header: 'المادة', value: (row) => row['المادة'] },
            { header: 'المرحلة', value: (row) => row['المرحلة'] },
            { header: 'المحاضرات المنتهية', value: (row) => row['المحاضرات المنتهية'] },
            { header: 'حضور', value: (row) => row['حضور'] },
            { header: 'غياب', value: (row) => row['غياب'] },
            { header: 'إجمالي', value: (row) => row['إجمالي'] },
            { header: 'نسبة الحضور', value: (row) => row['نسبة الحضور'] },
            { header: 'نسبة الغياب', value: (row) => row['نسبة الغياب'] },
          ]}
          rows={exportRows}
          filename="تقرير_المواد"
          sheetName="المواد"
          disabled={items.length === 0}
        />
      </div>

      {totals && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '10px', marginBottom: '14px' }}>
          <StatCard label="المواد" value={totals.courses} icon="📚" />
          <StatCard label="محاضرات منتهية" value={totals.closedLectures} tone="#065F46" />
          <StatCard label="حالات الحضور" value={totals.present} tone="#065F46" />
          <StatCard label="حالات الغياب" value={totals.absent} tone="#B91C1C" />
          <StatCard label="نسبة الحضور" value={totals.attendanceRate == null ? 'N/A' : `${totals.attendanceRate}%`} tone="#065F46" />
        </div>
      )}

      {error && (
        <div role="alert" style={{ padding: '12px 16px', borderRadius: '12px', background: '#FEF2F2', border: '1px solid #FCA5A5', color: '#991B1B', fontSize: '13px', marginBottom: '14px' }}>
          ⚠️ {error}
        </div>
      )}

      {loading ? (
        <div className="empty-state"><p style={{ color: 'var(--text-muted)' }}>جاري تحميل تقرير المواد...</p></div>
      ) : items.length === 0 ? (
        <div className="empty-state"><p style={{ color: 'var(--text-muted)' }}>لا توجد مواد ضمن النطاق المحدد.</p></div>
      ) : (
        <>
          <div className="attendance-scroll" style={{ border: '1px solid #E5E7EB', borderRadius: '12px', marginBottom: '14px' }}>
            <table className="attendance-table" style={{ fontSize: '12px', minWidth: '760px' }}>
              <thead>
                <tr>
                  <th>الرمز</th>
                  <th>المادة</th>
                  <th>المرحلة</th>
                  <th style={{ textAlign: 'center' }}>منتهية</th>
                  <th style={{ textAlign: 'center' }}>حضور</th>
                  <th style={{ textAlign: 'center' }}>غياب</th>
                  <th style={{ textAlign: 'center' }}>النسبة</th>
                  <th style={{ textAlign: 'center' }}>الطلاب</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => {
                  const selected = selectedCourseId === item.id;
                  return (
                    <tr
                      key={item.id}
                      onClick={() => setSelectedCourseId(selected ? null : item.id)}
                      style={{ cursor: 'pointer', background: selected ? '#FFFBEB' : undefined }}
                    >
                      <td style={{ fontFamily: 'monospace', fontWeight: '700' }}>{item.code}</td>
                      <td style={{ fontWeight: '700' }}>{item.name}</td>
                      <td style={{ fontSize: '11px' }}>{stageLabel(item.stage)}</td>
                      <td style={{ textAlign: 'center' }}>{item.closedLectures}</td>
                      <td style={{ textAlign: 'center', color: '#059669', fontWeight: '700' }}>{item.present}</td>
                      <td style={{ textAlign: 'center', color: item.absent > 0 ? '#DC2626' : '#6B7280', fontWeight: '700' }}>{item.absent}</td>
                      <td style={{ textAlign: 'center', fontWeight: '700', color: item.attendanceRate == null ? '#6B7280' : item.attendanceRate >= 75 ? '#065F46' : item.attendanceRate >= 50 ? '#92400E' : '#B91C1C' }}>
                        {item.attendanceRate == null ? 'N/A' : `${item.attendanceRate}%`}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <button type="button" className="btn btn-ghost btn-sm" style={{ fontSize: '11px', padding: '4px 10px' }}>
                          {selected ? 'إخفاء' : 'عرض'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {selectedCourseId && (
            <div className="glass-card" style={{ padding: '16px' }}>
              {detailError && (
                <div role="alert" style={{ color: '#991B1B', fontSize: '13px' }}>⚠️ {detailError}</div>
              )}
              {detailLoading ? (
                <p style={{ color: 'var(--text-muted)' }}>جاري تحميل تفاصيل المادة...</p>
              ) : detail ? (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', marginBottom: '10px', flexWrap: 'wrap' }}>
                    <h3 style={{ fontSize: '14px', fontWeight: '800', color: '#111827' }}>
                      تفاصيل: {detail.course.code} — {detail.course.name} · {detail.totals.students} طالب · {detail.lecturesInScope} محاضرة في النطاق
                    </h3>
                    <ReportExport
                      title={`تفاصيل مادة ${detail.course.code}`}
                      filtersLabel={filtersLabel}
                      stats={[
                        { label: 'الطلاب', value: detail.totals.students },
                        { label: 'حضور', value: detail.totals.present },
                        { label: 'غياب', value: detail.totals.absent },
                        { label: 'النسبة', value: detail.totals.attendanceRate == null ? 'N/A' : `${detail.totals.attendanceRate}%` },
                      ]}
                      columns={[
                        { header: 'الباركود', value: (row) => row.studentCode },
                        { header: 'الاسم', value: (row) => row.name },
                        { header: 'الشعبة', value: (row) => row.sectionLabel || row.section || '—' },
                        { header: 'حضور', value: (row) => row.present },
                        { header: 'غياب', value: (row) => row.absent },
                        { header: 'إجمالي', value: (row) => row.totalCases },
                        { header: 'نسبة الحضور', value: (row) => row.attendanceRate == null ? 'N/A' : `${row.attendanceRate}%` },
                      ]}
                      rows={detail.items}
                      filename={`تفاصيل_مادة_${detail.course.code}`}
                      sheetName="التفاصيل"
                      disabled={detail.items.length === 0}
                    />
                  </div>
                  <div className="attendance-scroll" style={{ maxHeight: '420px', border: '1px solid #E5E7EB', borderRadius: '10px' }}>
                    <table className="attendance-table" style={{ fontSize: '12px', minWidth: '640px' }}>
                      <thead>
                        <tr>
                          <th>الباركود</th>
                          <th>الاسم</th>
                          <th>الشعبة</th>
                          <th style={{ textAlign: 'center' }}>حضور</th>
                          <th style={{ textAlign: 'center' }}>غياب</th>
                          <th style={{ textAlign: 'center' }}>النسبة</th>
                        </tr>
                      </thead>
                      <tbody>
                        {detail.items.map((row) => (
                          <tr key={row.id}>
                            <td style={{ fontFamily: 'monospace' }}>{row.studentCode}</td>
                            <td style={{ fontWeight: '700' }}>{row.name}</td>
                            <td>{row.sectionLabel || row.section || '—'}</td>
                            <td style={{ textAlign: 'center', color: '#059669', fontWeight: '700' }}>{row.present}</td>
                            <td style={{ textAlign: 'center', color: row.absent > 0 ? '#DC2626' : '#6B7280', fontWeight: '700' }}>{row.absent}</td>
                            <td style={{ textAlign: 'center' }}>{row.attendanceRate == null ? 'N/A' : `${row.attendanceRate}%`}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : null}
            </div>
          )}
        </>
      )}
    </div>
  );
}
