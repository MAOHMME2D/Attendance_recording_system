'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { reportsApi, stageLabel, type ReportFilters, type ReportOptions, type ReportStudentsPage } from '../../../lib/api';
import StatCard from '../StatCard';
import ReportFiltersBar from '../ReportFilters';
import ReportExport from '../ReportExport';

const PAGE_SIZE = 25;

export default function StudentsReportTab() {
  const router = useRouter();
  const [options, setOptions] = useState<ReportOptions | null>(null);
  const [filters, setFilters] = useState<ReportFilters>({});
  const [sort, setSort] = useState<string>('name');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<ReportStudentsPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    reportsApi.options().then((result) => { if (!cancelled) setOptions(result); }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    setPage(1);
  }, [filters]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await reportsApi.students({ ...filters, sort, page, pageSize: PAGE_SIZE });
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر تحميل بيانات الطلاب');
    } finally {
      setLoading(false);
    }
  }, [filters, sort, page]);

  useEffect(() => {
    const id = window.setTimeout(load, 200);
    return () => window.clearTimeout(id);
  }, [load]);

  const totals = data?.totals;
  const filtersLabel = [
    filters.stage ? `المرحلة: ${stageLabel(Number(filters.stage))}` : null,
    filters.from ? `من ${filters.from}` : null,
    filters.to ? `إلى ${filters.to}` : null,
  ].filter(Boolean).join(' · ') || 'كل النطاقات';

  const exportRows = (data?.items ?? []).map((item, index) => ({
    ت: index + 1,
    الباركود: item.studentCode,
    الاسم: item.name,
    المرحلة: item.stageLabel,
    الدراسة: item.studyPeriod === 'EVENING' ? 'مسائية' : 'صباحية',
    الشعبة: item.sectionLabel || item.section || '—',
    حضور: item.present,
    غياب: item.absent,
    إجمالي: item.totalCases,
    'نسبة الحضور': item.attendanceRate == null ? 'N/A' : `${item.attendanceRate}%`,
  }));

  return (
    <div>
      <ReportFiltersBar
        options={options}
        filters={filters}
        onChange={setFilters}
        showSearch
        searchPlaceholder="ابحث بالاسم أو الباركود..."
        showLecturer={false}
      />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', marginBottom: '14px', flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ fontSize: '16px', fontWeight: '800', color: '#111827' }}>تقارير الطلاب</h2>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
            تُحسب المعدلات على المحاضرات المنتهية فقط · {data?.lecturesInScope ?? 0} محاضرة في النطاق
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <select className="input" value={sort} onChange={(e) => setSort(e.target.value)} style={{ width: 'auto', fontSize: '12px' }} aria-label="الترتيب">
            <option value="name">الترتيب: الاسم</option>
            <option value="studentCode">الترتيب: الباركود</option>
            <option value="attendanceRate_desc">أعلى حضور</option>
            <option value="absenceRate_desc">أعلى غياب</option>
            <option value="absentCount_desc">الأكثر غيابًا</option>
          </select>
          <ReportExport
            title="تقرير الطلاب"
            filtersLabel={filtersLabel}
            stats={totals ? [
              { label: 'الطلاب', value: totals.students },
              { label: 'حضور', value: totals.present },
              { label: 'غياب', value: totals.absent },
              { label: 'النسبة', value: totals.attendanceRate == null ? 'N/A' : `${totals.attendanceRate}%` },
            ] : []}
            columns={[
              { header: 'ت', value: (row) => row['ت'] },
              { header: 'الباركود', value: (row) => row['الباركود'] },
              { header: 'الاسم', value: (row) => row['الاسم'] },
              { header: 'المرحلة', value: (row) => row['المرحلة'] },
              { header: 'الدراسة', value: (row) => row['الدراسة'] },
              { header: 'الشعبة', value: (row) => row['الشعبة'] },
              { header: 'حضور', value: (row) => row['حضور'] },
              { header: 'غياب', value: (row) => row['غياب'] },
              { header: 'إجمالي', value: (row) => row['إجمالي'] },
              { header: 'نسبة الحضور', value: (row) => row['نسبة الحضور'] },
            ]}
            rows={exportRows}
            filename="تقرير_الطلاب"
            sheetName="الطلاب"
            disabled={!data?.items.length}
          />
        </div>
      </div>

      {totals && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '10px', marginBottom: '14px' }}>
          <StatCard label="الطلاب المشمولون" value={totals.students} icon="👨‍🎓" />
          <StatCard label="حالات الحضور" value={totals.present} tone="#065F46" />
          <StatCard label="حالات الغياب" value={totals.absent} tone="#B91C1C" />
          <StatCard label="نسبة الحضور العامة" value={totals.attendanceRate == null ? 'N/A' : `${totals.attendanceRate}%`} tone="#065F46" />
        </div>
      )}

      {error && (
        <div role="alert" style={{ padding: '12px 16px', borderRadius: '12px', background: '#FEF2F2', border: '1px solid #FCA5A5', color: '#991B1B', fontSize: '13px', marginBottom: '14px' }}>
          ⚠️ {error}
        </div>
      )}

      {loading ? (
        <div className="empty-state"><p style={{ color: 'var(--text-muted)' }}>جاري تحميل بيانات الطلاب...</p></div>
      ) : !data || data.items.length === 0 ? (
        <div className="empty-state"><p style={{ color: 'var(--text-muted)' }}>لا توجد نتائج مطابقة للفلاتر.</p></div>
      ) : (
        <>
          <div className="attendance-scroll" style={{ border: '1px solid #E5E7EB', borderRadius: '12px' }}>
            <table className="attendance-table" style={{ fontSize: '12px', minWidth: '780px' }}>
              <thead>
                <tr>
                  <th>#</th>
                  <th>الاسم / الباركود</th>
                  <th>المرحلة</th>
                  <th>الشعبة</th>
                  <th style={{ textAlign: 'center' }}>حضور</th>
                  <th style={{ textAlign: 'center' }}>غياب</th>
                  <th style={{ textAlign: 'center' }}>الإجمالي</th>
                  <th style={{ textAlign: 'center' }}>النسبة</th>
                  <th style={{ textAlign: 'center' }}>التفاصيل</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((item, index) => (
                  <tr
                    key={item.id}
                    style={{ cursor: 'pointer' }}
                    onClick={() => router.push(`/reports/students/${item.id}`)}
                    title="افتح ملف الطالب التفصيلي"
                  >
                    <td style={{ color: 'var(--text-muted)' }}>{(data.pagination.page - 1) * PAGE_SIZE + index + 1}</td>
                    <td>
                      <div style={{ fontWeight: '700', color: '#111827' }}>{item.name}</div>
                      <div style={{ fontFamily: 'monospace', fontSize: '11px', color: '#6B7280' }}>{item.studentCode}</div>
                    </td>
                    <td style={{ fontSize: '11px' }}>{item.stageLabel}</td>
                    <td>{item.sectionLabel || item.section || '—'}</td>
                    <td style={{ textAlign: 'center', color: '#059669', fontWeight: '700' }}>{item.present}</td>
                    <td style={{ textAlign: 'center', color: item.absent > 0 ? '#DC2626' : '#6B7280', fontWeight: '700' }}>{item.absent}</td>
                    <td style={{ textAlign: 'center' }}>{item.totalCases}</td>
                    <td style={{ textAlign: 'center', fontWeight: '700', color: item.attendanceRate == null ? '#6B7280' : item.attendanceRate >= 75 ? '#065F46' : item.attendanceRate >= 50 ? '#92400E' : '#B91C1C' }}>
                      {item.attendanceRate == null ? 'N/A' : `${item.attendanceRate}%`}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <Link href={`/reports/students/${item.id}`} className="btn btn-ghost btn-sm" style={{ fontSize: '11px', padding: '4px 10px' }} onClick={(e) => e.stopPropagation()}>
                        ملف الطالب
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '12px', marginTop: '14px', flexWrap: 'wrap' }}>
            <button type="button" className="btn btn-ghost btn-sm" disabled={data.pagination.page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>السابق</button>
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
              صفحة {data.pagination.page} من {data.pagination.totalPages} — {data.pagination.total} طالب
            </span>
            <button type="button" className="btn btn-ghost btn-sm" disabled={data.pagination.page >= data.pagination.totalPages} onClick={() => setPage((p) => Math.min(data.pagination.totalPages, p + 1))}>التالي</button>
          </div>
        </>
      )}
    </div>
  );
}
