'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { reportsApi, type ReportFilters, type ReportsDashboard, type ReportOptions, stageLabel } from '../../../lib/api';
import { useAuth, PERMISSIONS } from '../../../lib/auth';
import StatCard from '../StatCard';
import ReportFiltersBar from '../ReportFilters';
import ReportExport from '../ReportExport';
import { DonutChart, BarChart, TrendChart } from '../../charts/Charts';

const rate = (value: number | null) => (value == null ? 'N/A' : `${value}%`);

export default function DashboardTab() {
  const { can } = useAuth();
  const [options, setOptions] = useState<ReportOptions | null>(null);
  const [filters, setFilters] = useState<ReportFilters>({});
  const [data, setData] = useState<ReportsDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [granularity, setGranularity] = useState<'day' | 'week' | 'month'>('day');

  useEffect(() => {
    let cancelled = false;
    reportsApi.options().then((result) => {
      if (!cancelled) setOptions(result);
    }).catch(() => { /* filters degrade gracefully */ });
    return () => { cancelled = true; };
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await reportsApi.dashboard(filters);
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر تحميل الإحصائيات');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    const id = window.setTimeout(load, 200);
    return () => window.clearTimeout(id);
  }, [load]);

  const totals = data?.totals;
  const filtersLabel = [
    filters.stage ? `المرحلة: ${stageLabel(Number(filters.stage))}` : null,
    filters.sectionId ? `شعبة محددة` : null,
    filters.courseId ? `مادة محددة` : null,
    filters.from ? `من ${filters.from}` : null,
    filters.to ? `إلى ${filters.to}` : null,
    filters.status ? `الحالة: ${filters.status === 'ACTIVE' ? 'جارية' : 'منتهية'}` : null,
  ].filter(Boolean).join(' · ') || 'كل النطاقات';

  const trend = granularity === 'day' ? data?.trendDaily ?? [] : granularity === 'week' ? data?.trendWeekly ?? [] : data?.trendMonthly ?? [];

  const courseBars = (data?.courseComparison ?? []).map((item) => ({
    label: item.course ? `${item.course.code}` : '—',
    value: item.attendanceRate,
    color: (item.attendanceRate ?? 0) >= 75 ? '#10B981' : (item.attendanceRate ?? 0) >= 50 ? '#F59E0B' : '#EF4444',
  }));

  const sectionBars = (data?.sectionComparison ?? []).map((item) => ({
    label: `شعبة ${item.section.name}`,
    value: item.attendanceRate,
    color: (item.attendanceRate ?? 0) >= 75 ? '#C9A84C' : (item.attendanceRate ?? 0) >= 50 ? '#F59E0B' : '#EF4444',
  }));

  const exportRows = totals
    ? [
        { المؤشر: 'إجمالي الطلاب', القيمة: totals.students },
        { المؤشر: 'إجمالي المدرسين', القيمة: totals.teachers },
        { المؤشر: 'إجمالي الشعب', القيمة: totals.sections },
        { المؤشر: 'إجمالي المواد', القيمة: totals.courses },
        { المؤشر: 'إجمالي المحاضرات', القيمة: totals.lectures },
        { المؤشر: 'المحاضرات المنتهية', القيمة: totals.closedLectures },
        { المؤشر: 'المحاضرات المفتوحة', القيمة: totals.openLectures },
        { المؤشر: 'إجمالي سجلات الحضور', القيمة: totals.present },
        { المؤشر: 'إجمالي الغياب', القيمة: totals.absent },
        { المؤشر: 'معدل الحضور', القيمة: rate(totals.attendanceRate) },
        { المؤشر: 'معدل الغياب', القيمة: rate(totals.absenceRate) },
      ]
    : [];

  return (
    <div>
      <ReportFiltersBar
        options={options}
        filters={filters}
        onChange={setFilters}
        showStatus
        showLecturer={can(PERMISSIONS.LECTURE_CREATE)}
      />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', marginBottom: '14px', flexWrap: 'wrap' }}>
        <h2 style={{ fontSize: '16px', fontWeight: '800', color: '#111827' }}>لوحة الإحصائيات العامة</h2>
        <ReportExport
          title="لوحة الإحصائيات — التقرير العام"
          subtitle={subtitleFor(data)}
          filtersLabel={filtersLabel}
          stats={totals ? [
            { label: 'الطلاب', value: totals.students },
            { label: 'المحاضرات المنتهية', value: totals.closedLectures },
            { label: 'حاضر', value: totals.present },
            { label: 'غائب', value: totals.absent },
          ] : []}
          columns={[
            { header: 'المؤشر', value: (row) => row['المؤشر'] },
            { header: 'القيمة', value: (row) => row['القيمة'] },
          ]}
          rows={exportRows}
          filename="لوحة_الإحصائيات"
          sheetName="الملخص"
          disabled={!totals}
        />
      </div>

      {error && (
        <div role="alert" style={{ padding: '12px 16px', borderRadius: '12px', background: '#FEF2F2', border: '1px solid #FCA5A5', color: '#991B1B', fontSize: '13px', marginBottom: '14px' }}>
          ⚠️ {error}
        </div>
      )}

      {loading ? (
        <div className="empty-state"><p style={{ color: 'var(--text-muted)' }}>جاري حساب الإحصائيات...</p></div>
      ) : !totals ? (
        <div className="empty-state"><p style={{ color: 'var(--text-muted)' }}>لا توجد بيانات لعرضها ضمن الفلاتر المحددة.</p></div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '10px', marginBottom: '16px' }}>
            <StatCard label="إجمالي الطلاب" value={totals.students} icon="👨‍🎓" />
            <StatCard label="إجمالي المدرسين" value={totals.teachers} icon="🧑‍🏫" />
            <StatCard label="الشعب" value={totals.sections} icon="🏫" />
            <StatCard label="المواد" value={totals.courses} icon="📚" />
            <StatCard label="المحاضرات" value={totals.lectures} sub="الكل ضمن النطاق" icon="🗓️" />
            <StatCard label="محاضرات منتهية" value={totals.closedLectures} tone="#065F46" icon="✅" />
            <StatCard label="محاضرات مفتوحة" value={totals.openLectures} tone="#92400E" icon="⏳" />
            <StatCard label="سجلات الحضور" value={totals.present} tone="#065F46" icon="✓" />
            <StatCard label="حالات الغياب" value={totals.absent} tone="#B91C1C" icon="✗" />
            <StatCard label="معدل الحضور" value={rate(totals.attendanceRate)} tone="#065F46" sub="من المحاضرات المنتهية" icon="📈" />
            <StatCard label="معدل الغياب" value={rate(totals.absenceRate)} tone="#B91C1C" icon="📉" />
            <StatCard label="حاضرون الآن" value={totals.activePresent} sub="في محاضرات جارية" tone="#1D4ED8" icon="🟢" />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(260px, 1fr) 2fr', gap: '14px', marginBottom: '14px' }} className="dashboard-grid-2">
            <div className="glass-card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
              <h3 style={{ fontSize: '13.5px', fontWeight: '800', color: '#111827', alignSelf: 'flex-start' }}>توزيع الحضور والغياب</h3>
              <DonutChart present={totals.present} absent={totals.absent} size={150} thickness={24} />
              <div style={{ display: 'flex', gap: '12px', fontSize: '11px', color: '#4B5563' }}>
                <span><span style={{ color: '#10B981' }}>●</span> حاضر {totals.present}</span>
                <span><span style={{ color: '#EF4444' }}>●</span> غائب {totals.absent}</span>
              </div>
            </div>

            <div className="glass-card" style={{ padding: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', marginBottom: '10px', flexWrap: 'wrap' }}>
                <h3 style={{ fontSize: '13.5px', fontWeight: '800', color: '#111827' }}>تطور الحضور والغياب</h3>
                <div style={{ display: 'flex', gap: '6px' }}>
                  {(['day', 'week', 'month'] as const).map((value) => (
                    <button
                      key={value}
                      type="button"
                      className={`btn btn-sm ${granularity === value ? 'btn-primary' : 'btn-ghost'}`}
                      onClick={() => setGranularity(value)}
                      style={{ fontSize: '11.5px', padding: '4px 12px', minHeight: '32px' }}
                    >
                      {value === 'day' ? 'يومي' : value === 'week' ? 'أسبوعي' : 'شهري'}
                    </button>
                  ))}
                </div>
              </div>
              <TrendChart points={trend} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px' }}>
            <div className="glass-card" style={{ padding: '16px' }}>
              <h3 style={{ fontSize: '13.5px', fontWeight: '800', color: '#111827', marginBottom: '12px' }}>معدل الحضور حسب المادة</h3>
              <BarChart items={courseBars} valueSuffix="%" maxValue={100} emptyLabel="لا توجد محاضرات مغلقة ضمن النطاق" />
            </div>
            <div className="glass-card" style={{ padding: '16px' }}>
              <h3 style={{ fontSize: '13.5px', fontWeight: '800', color: '#111827', marginBottom: '12px' }}>معدل الحضور حسب الشعبة</h3>
              <BarChart items={sectionBars} valueSuffix="%" maxValue={100} emptyLabel="لا توجد محاضرات مغلقة ضمن النطاق" />
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function subtitleFor(data: ReportsDashboard | null): string {
  if (!data) return 'التقرير العام للإحصائيات';
  return `المستوى: ${data.scope.isAdmin ? 'كامل النظام' : 'نطاق التدريس الخاص بك'} · ${data.scope.stages.length} مراحل`;
}
