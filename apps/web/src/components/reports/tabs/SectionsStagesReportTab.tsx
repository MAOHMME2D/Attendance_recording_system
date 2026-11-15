'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { reportsApi, stageLabel, type ReportFilters, type ReportOptions, type ReportSectionsResponse, type ReportStagesResponse } from '../../../lib/api';
import StatCard from '../StatCard';
import ReportFiltersBar from '../ReportFilters';
import ReportExport from '../ReportExport';
import { BarChart } from '../../charts/Charts';

export default function SectionsStagesReportTab() {
  const [options, setOptions] = useState<ReportOptions | null>(null);
  const [filters, setFilters] = useState<ReportFilters>({});
  const [sections, setSections] = useState<ReportSectionsResponse | null>(null);
  const [stages, setStages] = useState<ReportStagesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    reportsApi.options().then((result) => { if (!cancelled) setOptions(result); }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [sectionsResult, stagesResult] = await Promise.all([
        reportsApi.sections(filters),
        reportsApi.stages(filters),
      ]);
      setSections(sectionsResult);
      setStages(stagesResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر تحميل تقرير الشعب والمراحل');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    const id = window.setTimeout(load, 200);
    return () => window.clearTimeout(id);
  }, [load]);

  const filtersLabel = [
    filters.stage ? `المرحلة: ${stageLabel(Number(filters.stage))}` : null,
    filters.from ? `من ${filters.from}` : null,
    filters.to ? `إلى ${filters.to}` : null,
  ].filter(Boolean).join(' · ') || 'كل النطاقات';

  const sectionRows = (sections?.items ?? []).map((item) => ({
    الشعبة: `شعبة ${item.name}`,
    المرحلة: item.stageLabel,
    الدراسة: item.studyPeriod === 'EVENING' ? 'مسائية' : 'صباحية',
    الطلاب: item.students,
    'المحاضرات المنتهية': item.closedLectures,
    حضور: item.present,
    غياب: item.absent,
    إجمالي: item.totalCases,
    'نسبة الحضور': item.attendanceRate == null ? 'N/A' : `${item.attendanceRate}%`,
  }));

  const stageRows = (stages?.items ?? []).map((item) => ({
    المرحلة: item.label,
    الطلاب: item.students,
    الشعب: item.sections,
    المواد: item.courses,
    'المحاضرات المنتهية': item.closedLectures,
    حضور: item.present,
    غياب: item.absent,
    'نسبة الحضور': item.attendanceRate == null ? 'N/A' : `${item.attendanceRate}%`,
  }));

  const sectionBars = (sections?.items ?? []).map((item) => ({
    label: `شعبة ${item.name}`,
    value: item.attendanceRate,
    color: (item.attendanceRate ?? 0) >= 75 ? '#C9A84C' : (item.attendanceRate ?? 0) >= 50 ? '#F59E0B' : '#EF4444',
  }));

  return (
    <div>
      <ReportFiltersBar options={options} filters={filters} onChange={setFilters} showStatus showLecturer />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', marginBottom: '14px', flexWrap: 'wrap' }}>
        <h2 style={{ fontSize: '16px', fontWeight: '800', color: '#111827' }}>الشعب والمراحل الدراسية</h2>
        <ReportExport
          title="تقرير الشعب والمراحل"
          filtersLabel={filtersLabel}
          stats={sections?.totals ? [
            { label: 'الشعب', value: sections.totals.sections },
            { label: 'الطلاب', value: sections.totals.students },
            { label: 'حضور', value: sections.totals.present },
            { label: 'غياب', value: sections.totals.absent },
          ] : []}
          columns={[
            { header: 'الشعبة', value: (row) => row['الشعبة'] },
            { header: 'المرحلة', value: (row) => row['المرحلة'] },
            { header: 'الدراسة', value: (row) => row['الدراسة'] },
            { header: 'الطلاب', value: (row) => row['الطلاب'] },
            { header: 'المحاضرات المنتهية', value: (row) => row['المحاضرات المنتهية'] },
            { header: 'حضور', value: (row) => row['حضور'] },
            { header: 'غياب', value: (row) => row['غياب'] },
            { header: 'إجمالي', value: (row) => row['إجمالي'] },
            { header: 'نسبة الحضور', value: (row) => row['نسبة الحضور'] },
          ]}
          rows={sectionRows}
          filename="تقرير_الشعب_والمراحل"
          sheetName="الشعب"
          disabled={sectionRows.length === 0}
        />
      </div>

      {error && (
        <div role="alert" style={{ padding: '12px 16px', borderRadius: '12px', background: '#FEF2F2', border: '1px solid #FCA5A5', color: '#991B1B', fontSize: '13px', marginBottom: '14px' }}>
          ⚠️ {error}
        </div>
      )}

      {loading ? (
        <div className="empty-state"><p style={{ color: 'var(--text-muted)' }}>جاري تحميل تقرير الشعب والمراحل...</p></div>
      ) : (
        <>
          {stages?.items && (
            <div style={{ marginBottom: '16px' }}>
              <h3 style={{ fontSize: '13px', fontWeight: '800', color: '#111827', marginBottom: '8px' }}>مقارنة المراحل الدراسية</h3>
              <div className="attendance-scroll" style={{ border: '1px solid #E5E7EB', borderRadius: '12px' }}>
                <table className="attendance-table" style={{ fontSize: '12px', minWidth: '640px' }}>
                  <thead>
                    <tr>
                      <th>المرحلة</th>
                      <th style={{ textAlign: 'center' }}>الطلاب</th>
                      <th style={{ textAlign: 'center' }}>الشعب</th>
                      <th style={{ textAlign: 'center' }}>المواد</th>
                      <th style={{ textAlign: 'center' }}>منتهية</th>
                      <th style={{ textAlign: 'center' }}>حضور</th>
                      <th style={{ textAlign: 'center' }}>غياب</th>
                      <th style={{ textAlign: 'center' }}>النسبة</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stages.items.map((item) => (
                      <tr key={item.stage}>
                        <td style={{ fontWeight: '700' }}>{item.label}</td>
                        <td style={{ textAlign: 'center' }}>{item.students}</td>
                        <td style={{ textAlign: 'center' }}>{item.sections}</td>
                        <td style={{ textAlign: 'center' }}>{item.courses}</td>
                        <td style={{ textAlign: 'center' }}>{item.closedLectures}</td>
                        <td style={{ textAlign: 'center', color: '#059669', fontWeight: '700' }}>{item.present}</td>
                        <td style={{ textAlign: 'center', color: item.absent > 0 ? '#DC2626' : '#6B7280', fontWeight: '700' }}>{item.absent}</td>
                        <td style={{ textAlign: 'center', fontWeight: '700', color: item.attendanceRate == null ? '#6B7280' : item.attendanceRate >= 75 ? '#065F46' : '#92400E' }}>
                          {item.attendanceRate == null ? 'N/A' : `${item.attendanceRate}%`}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <h3 style={{ fontSize: '13px', fontWeight: '800', color: '#111827', marginBottom: '8px' }}>مقارنة الشعب</h3>
          <div className="glass-card" style={{ padding: '14px 16px', marginBottom: '14px' }}>
            <BarChart items={sectionBars} valueSuffix="%" maxValue={100} emptyLabel="لا توجد بيانات محاضرات ضمن النطاق" />
          </div>

          {sections?.items.length === 0 ? (
            <div className="empty-state"><p style={{ color: 'var(--text-muted)' }}>لا توجد شعب ضمن النطاق المحدد.</p></div>
          ) : (
            <div className="attendance-scroll" style={{ border: '1px solid #E5E7EB', borderRadius: '12px' }}>
              <table className="attendance-table" style={{ fontSize: '12px', minWidth: '820px' }}>
                <thead>
                  <tr>
                    <th>الشعبة</th>
                    <th>المرحلة</th>
                    <th>الدراسة</th>
                    <th style={{ textAlign: 'center' }}>الطلاب</th>
                    <th style={{ textAlign: 'center' }}>منتهية</th>
                    <th style={{ textAlign: 'center' }}>حضور</th>
                    <th style={{ textAlign: 'center' }}>غياب</th>
                    <th style={{ textAlign: 'center' }}>النسبة</th>
                  </tr>
                </thead>
                <tbody>
                  {sections?.items.map((item) => (
                    <tr key={item.id}>
                      <td style={{ fontWeight: '700' }}>شعبة {item.name}{item.label ? ` — ${item.label}` : ''}</td>
                      <td style={{ fontSize: '11px' }}>{item.stageLabel}</td>
                      <td style={{ fontSize: '11px' }}>{item.studyPeriod === 'EVENING' ? 'مسائية' : 'صباحية'}</td>
                      <td style={{ textAlign: 'center' }}>{item.students}</td>
                      <td style={{ textAlign: 'center' }}>{item.closedLectures}</td>
                      <td style={{ textAlign: 'center', color: '#059669', fontWeight: '700' }}>{item.present}</td>
                      <td style={{ textAlign: 'center', color: item.absent > 0 ? '#DC2626' : '#6B7280', fontWeight: '700' }}>{item.absent}</td>
                      <td style={{ textAlign: 'center', fontWeight: '700', color: item.attendanceRate == null ? '#6B7280' : item.attendanceRate >= 75 ? '#065F46' : item.attendanceRate >= 50 ? '#92400E' : '#B91C1C' }}>
                        {item.attendanceRate == null ? 'N/A' : `${item.attendanceRate}%`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
