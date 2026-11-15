'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { reportsApi, type ReportAbsenteesResponse, type ReportFilters, type ReportOptions } from '../../../lib/api';
import StatCard from '../StatCard';
import ReportFiltersBar from '../ReportFilters';
import ReportExport from '../ReportExport';

export default function AbsenteesReportTab() {
  const [options, setOptions] = useState<ReportOptions | null>(null);
  const [filters, setFilters] = useState<ReportFilters>({});
  const [threshold, setThreshold] = useState<string>('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<ReportAbsenteesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    reportsApi.options().then((result) => { if (!cancelled) setOptions(result); }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    setPage(1);
  }, [filters, threshold]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await reportsApi.absentees({
        ...filters,
        threshold: threshold === '' ? undefined : threshold,
        page,
        pageSize: 25,
      });
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر تحميل تقرير الغيابات');
    } finally {
      setLoading(false);
    }
  }, [filters, threshold, page]);

  useEffect(() => {
    const id = window.setTimeout(load, 200);
    return () => window.clearTimeout(id);
  }, [load]);

  const exceeded = data?.exceeded ?? 0;
  const warning = data?.warning ?? 0;
  const thresholdLabel = data ? `${data.threshold} غيابات (${data.thresholdSource === 'default' ? 'القيمة المعتمدة الافتراضية' : data.thresholdSource === 'setting' ? 'إعداد النظام ABSENCE_ALERT_THRESHOLD' : 'المحدد يدويًا'})` : '';

  const exportRows = (data?.items ?? []).map((item, index) => ({
    ت: (data!.pagination.page - 1) * data!.pagination.pageSize + index + 1,
    الباركود: item.studentCode,
    الاسم: item.name,
    المرحلة: item.stageLabel,
    الشعبة: item.sectionLabel || item.section || '—',
    حضور: item.presentCount,
    غياب: item.absentCount,
    'نسبة الغياب': item.absenceRate == null ? 'N/A' : `${item.absenceRate}%`,
    الحالة: item.status === 'EXCEEDED' ? 'تجاوز الحد' : 'اقترب من الحد',
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
          <h2 style={{ fontSize: '16px', fontWeight: '800', color: '#111827' }}>الطلاب المعرضون للإنذار (حد الغياب)</h2>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
            الحد المعتمد: {thresholdLabel || '—'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <label style={{ fontSize: '11.5px', fontWeight: '700', color: '#374151', display: 'flex', alignItems: 'center', gap: '6px' }}>
            الحد:
            <input
              type="number"
              min={1}
              max={50}
              className="input"
              value={threshold}
              onChange={(e) => setThreshold(e.target.value)}
              placeholder="الافتراضي"
              style={{ width: '90px', fontSize: '13px' }}
              aria-label="حد الغياب"
            />
          </label>
          <ReportExport
            title="الطلاب المعرضون للإنذار"
            filtersLabel={`الحد: ${thresholdLabel}`}
            stats={[
              { label: 'تجاوزوا الحد', value: exceeded },
              { label: 'اقتربوا من الحد', value: warning },
              { label: 'الحد', value: data?.threshold ?? '-' },
              { label: 'إجمالي', value: data?.pagination.total ?? 0 },
            ]}
            columns={[
              { header: 'ت', value: (row) => row['ت'] },
              { header: 'الباركود', value: (row) => row['الباركود'] },
              { header: 'الاسم', value: (row) => row['الاسم'] },
              { header: 'المرحلة', value: (row) => row['المرحلة'] },
              { header: 'الشعبة', value: (row) => row['الشعبة'] },
              { header: 'حضور', value: (row) => row['حضور'] },
              { header: 'غياب', value: (row) => row['غياب'] },
              { header: 'نسبة الغياب', value: (row) => row['نسبة الغياب'] },
              { header: 'الحالة', value: (row) => row['الحالة'] },
            ]}
            rows={exportRows}
            filename="الطلاب_المعرضون_للإنذار"
            sheetName="الغيابات"
            disabled={exportRows.length === 0}
          />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '10px', marginBottom: '14px' }}>
        <StatCard label="تجاوزوا الحد" value={exceeded} tone="#B91C1C" icon="🔴" />
        <StatCard label="اقتربوا من الحد" value={warning} tone="#92400E" icon="🟡" />
        <StatCard label="الحد المعتمد" value={data?.threshold ?? '—'} sub="غيابات" />
      </div>

      {error && (
        <div role="alert" style={{ padding: '12px 16px', borderRadius: '12px', background: '#FEF2F2', border: '1px solid #FCA5A5', color: '#991B1B', fontSize: '13px', marginBottom: '14px' }}>
          ⚠️ {error}
        </div>
      )}

      {loading ? (
        <div className="empty-state"><p style={{ color: 'var(--text-muted)' }}>جاري تحليل الغيابات...</p></div>
      ) : !data || data.items.length === 0 ? (
        <div className="empty-state">
          <p style={{ color: 'var(--text-muted)' }}>لا يوجد طلاب بلغوا حد الغياب ضمن النطاق المحدد. 👏</p>
        </div>
      ) : (
        <>
          <div className="attendance-scroll" style={{ border: '1px solid #E5E7EB', borderRadius: '12px' }}>
            <table className="attendance-table" style={{ fontSize: '12px', minWidth: '760px' }}>
              <thead>
                <tr>
                  <th>#</th>
                  <th>الاسم / الباركود</th>
                  <th>الشعبة</th>
                  <th style={{ textAlign: 'center' }}>حضور</th>
                  <th style={{ textAlign: 'center' }}>غياب</th>
                  <th style={{ textAlign: 'center' }}>نسبة الغياب</th>
                  <th style={{ textAlign: 'center' }}>الحالة</th>
                  <th style={{ textAlign: 'center' }}>الملف</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((item, index) => (
                  <tr key={item.id} style={item.status === 'EXCEEDED' ? { background: '#FEF2F2' } : { background: '#FFFBEB' }}>
                    <td style={{ color: 'var(--text-muted)' }}>{(data.pagination.page - 1) * data.pagination.pageSize + index + 1}</td>
                    <td>
                      <div style={{ fontWeight: '700', color: '#111827' }}>{item.name}</div>
                      <div style={{ fontFamily: 'monospace', fontSize: '11px', color: '#6B7280' }}>{item.studentCode}</div>
                    </td>
                    <td>{item.sectionLabel || item.section || '—'}</td>
                    <td style={{ textAlign: 'center', color: '#059669', fontWeight: '700' }}>{item.presentCount}</td>
                    <td style={{ textAlign: 'center', color: '#DC2626', fontWeight: '800' }}>{item.absentCount}</td>
                    <td style={{ textAlign: 'center', fontWeight: '700', color: '#B91C1C' }}>
                      {item.absenceRate == null ? 'N/A' : `${item.absenceRate}%`}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <span style={{
                        padding: '3px 10px',
                        borderRadius: '999px',
                        fontSize: '11px',
                        fontWeight: '800',
                        background: item.status === 'EXCEEDED' ? '#B91C1C' : '#F59E0B',
                        color: '#FFFFFF',
                      }}>
                        {item.status === 'EXCEEDED' ? 'تجاوز الحد' : 'اقترب'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <Link href={`/reports/students/${item.id}`} className="btn btn-ghost btn-sm" style={{ fontSize: '11px', padding: '4px 10px' }}>
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
