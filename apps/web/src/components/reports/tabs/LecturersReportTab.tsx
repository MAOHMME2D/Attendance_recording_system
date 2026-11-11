'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { reportsApi, stageLabel, type ReportFilters, type ReportLecturerItem, type ReportLecturerDetail, type ReportLecturersResponse, type ReportOptions } from '../../../lib/api';
import { useAuth, ROLE_LABELS, PERMISSIONS } from '../../../lib/auth';
import StatCard from '../StatCard';
import ReportFiltersBar from '../ReportFilters';
import ReportExport from '../ReportExport';

export default function LecturersReportTab() {
  const { can } = useAuth();
  const [options, setOptions] = useState<ReportOptions | null>(null);
  const [filters, setFilters] = useState<ReportFilters>({});
  const [data, setData] = useState<ReportLecturersResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ReportLecturerDetail | null>(null);
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
      const result = await reportsApi.lecturers(filters);
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر تحميل تقرير المدرسين');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    const id = window.setTimeout(load, 200);
    return () => window.clearTimeout(id);
  }, [load]);

  const loadDetail = useCallback(async (lecturerId: string) => {
    setDetailLoading(true);
    setDetailError(null);
    try {
      const result = await reportsApi.lecturerDetail(lecturerId, filters);
      setDetail(result);
    } catch (err) {
      setDetailError(err instanceof Error ? err.message : 'تعذر تحميل تفاصيل المدرس');
    } finally {
      setDetailLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    if (selectedId) loadDetail(selectedId);
    else setDetail(null);
  }, [selectedId, loadDetail]);

  const items = data?.items ?? [];
  const totals = data?.totals;
  const filtersLabel = [
    filters.stage ? `المرحلة: ${stageLabel(Number(filters.stage))}` : null,
    filters.from ? `من ${filters.from}` : null,
    filters.to ? `إلى ${filters.to}` : null,
  ].filter(Boolean).join(' · ') || 'كل النطاقات';

  const exportRows = items.map((item) => ({
    المعرف: item.staffId,
    الاسم: item.fullName,
    'الصلاحية': ROLE_LABELS[item.role as keyof typeof ROLE_LABELS] || item.role,
    'المواد المسندة': item.assignments.map((a) => `${a.code}`).join('، ') || '—',
    'المحاضرات المنفذة': item.conductedLectures,
    حضور: item.present,
    غياب: item.absent,
    'نسبة الحضور': item.attendanceRate == null ? 'N/A' : `${item.attendanceRate}%`,
  }));

  return (
    <div>
      <ReportFiltersBar
        options={options}
        filters={filters}
        onChange={(next) => { setSelectedId(null); setFilters(next); }}
        showStatus
        showLecturer={can(PERMISSIONS.LECTURE_VIEW_ALL)}
      />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', marginBottom: '14px', flexWrap: 'wrap' }}>
        <h2 style={{ fontSize: '16px', fontWeight: '800', color: '#111827' }}>تقارير المدرسين</h2>
        <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
          «المحاضرات المنفذة» تُحتسب للمدرس الفعلي (conducting) وليس صاحب الإسناد بالضرورة.
        </p>
        <ReportExport
          title="تقرير المدرسين"
          filtersLabel={filtersLabel}
          stats={totals ? [
            { label: 'المدرسون', value: totals.lecturers },
            { label: 'محاضرات منفذة', value: totals.conductedLectures },
            { label: 'حضور', value: totals.present },
            { label: 'غياب', value: totals.absent },
          ] : []}
          columns={[
            { header: 'المعرف', value: (row) => row['المعرف'] },
            { header: 'الاسم', value: (row) => row['الاسم'] },
            { header: 'الصلاحية', value: (row) => row['الصلاحية'] },
            { header: 'المواد المسندة', value: (row) => row['المواد المسندة'] },
            { header: 'المحاضرات المنفذة', value: (row) => row['المحاضرات المنفذة'] },
            { header: 'حضور', value: (row) => row['حضور'] },
            { header: 'غياب', value: (row) => row['غياب'] },
            { header: 'نسبة الحضور', value: (row) => row['نسبة الحضور'] },
          ]}
          rows={exportRows}
          filename="تقرير_المدرسين"
          sheetName="المدرسون"
          disabled={items.length === 0}
        />
      </div>

      {totals && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '10px', marginBottom: '14px' }}>
          <StatCard label="المدرسون" value={totals.lecturers} icon="🧑‍🏫" />
          <StatCard label="محاضرات منفذة" value={totals.conductedLectures} tone="#065F46" />
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
        <div className="empty-state"><p style={{ color: 'var(--text-muted)' }}>جاري تحميل تقرير المدرسين...</p></div>
      ) : items.length === 0 ? (
        <div className="empty-state"><p style={{ color: 'var(--text-muted)' }}>لا يوجد مدرسون ضمن النطاق المحدد.</p></div>
      ) : (
        <>
          <div className="attendance-scroll" style={{ border: '1px solid #E5E7EB', borderRadius: '12px', marginBottom: '14px' }}>
            <table className="attendance-table" style={{ fontSize: '12px', minWidth: '820px' }}>
              <thead>
                <tr>
                  <th>الاسم / المعرف</th>
                  <th>الصلاحية</th>
                  <th>المواد المسندة</th>
                  <th style={{ textAlign: 'center' }}>منفذة</th>
                  <th style={{ textAlign: 'center' }}>حضور</th>
                  <th style={{ textAlign: 'center' }}>غياب</th>
                  <th style={{ textAlign: 'center' }}>النسبة</th>
                  <th style={{ textAlign: 'center' }}>التفاصيل</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} onClick={() => setSelectedId(selectedId === item.id ? null : item.id)} style={{ cursor: 'pointer', background: selectedId === item.id ? '#FFFBEB' : undefined }}>
                    <td>
                      <div style={{ fontWeight: '700', color: '#111827' }}>{item.fullName}</div>
                      <div style={{ fontFamily: 'monospace', fontSize: '11px', color: '#6B7280' }}>{item.staffId}</div>
                    </td>
                    <td style={{ fontSize: '11px' }}>{ROLE_LABELS[item.role as keyof typeof ROLE_LABELS] || item.role}</td>
                    <td style={{ fontSize: '11px' }}>
                      {item.assignments.length > 0
                        ? item.assignments.map((a) => a.code).join('، ')
                        : '—'}
                    </td>
                    <td style={{ textAlign: 'center', fontWeight: '700' }}>{item.conductedLectures}</td>
                    <td style={{ textAlign: 'center', color: '#059669', fontWeight: '700' }}>{item.present}</td>
                    <td style={{ textAlign: 'center', color: item.absent > 0 ? '#DC2626' : '#6B7280', fontWeight: '700' }}>{item.absent}</td>
                    <td style={{ textAlign: 'center', fontWeight: '700', color: item.attendanceRate == null ? '#6B7280' : item.attendanceRate >= 75 ? '#065F46' : item.attendanceRate >= 50 ? '#92400E' : '#B91C1C' }}>
                      {item.attendanceRate == null ? 'N/A' : `${item.attendanceRate}%`}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <button type="button" className="btn btn-ghost btn-sm" style={{ fontSize: '11px', padding: '4px 10px' }}>
                        {selectedId === item.id ? 'إخفاء' : 'عرض'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {selectedId && (
            <div className="glass-card" style={{ padding: '16px' }}>
              {detailError && (
                <div role="alert" style={{ color: '#991B1B', fontSize: '13px' }}>⚠️ {detailError}</div>
              )}
              {detailLoading ? (
                <p style={{ color: 'var(--text-muted)' }}>جاري تحميل سجل المدرس...</p>
              ) : detail ? (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', marginBottom: '10px', flexWrap: 'wrap' }}>
                    <div>
                      <h3 style={{ fontSize: '14px', fontWeight: '800', color: '#111827' }}>{detail.lecturer.fullName} ({detail.lecturer.staffId})</h3>
                      <p style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '2px' }}>
                        المهام: {detail.assignments.map((a) => `${a.code} (${stageLabel(a.stage)})`).join('، ') || 'لا توجد مواد مسندة'}
                      </p>
                    </div>
                    <ReportExport
                      title={`سجل المدرس: ${detail.lecturer.fullName}`}
                      filtersLabel={filtersLabel}
                      stats={[
                        { label: 'محاضرات منفذة', value: detail.totals.conductedLectures },
                        { label: 'حضور', value: detail.totals.studentsPresent },
                        { label: 'غياب', value: detail.totals.studentsAbsent },
                        { label: 'النسبة', value: detail.totals.attendanceRate == null ? 'N/A' : `${detail.totals.attendanceRate}%` },
                      ]}
                      columns={[
                        { header: 'المحاضرة', value: (row) => row.name },
                        { header: 'التاريخ', value: (row) => new Date(row.lectureDate).toLocaleDateString('ar') },
                        { header: 'المادة', value: (row) => row.courseCode || '—' },
                        { header: 'الشعبة', value: (row) => row.sections.join('، ') || '—' },
                        { header: 'حضور', value: (row) => row.present },
                        { header: 'غياب', value: (row) => row.absent },
                        { header: 'نسبة الحضور', value: (row) => row.attendanceRate == null ? 'N/A' : `${row.attendanceRate}%` },
                      ]}
                      rows={detail.lectures as any[]}
                      filename={`سجل_المدرس_${detail.lecturer.staffId}`}
                      sheetName="المدرس"
                    />
                  </div>
                  <div className="attendance-scroll" style={{ maxHeight: '420px', border: '1px solid #E5E7EB', borderRadius: '10px' }}>
                    <table className="attendance-table" style={{ fontSize: '12px', minWidth: '720px' }}>
                      <thead>
                        <tr>
                          <th>المحاضرة</th>
                          <th>التاريخ</th>
                          <th>المادة</th>
                          <th>الشعبة</th>
                          <th style={{ textAlign: 'center' }}>حضور</th>
                          <th style={{ textAlign: 'center' }}>غياب</th>
                          <th style={{ textAlign: 'center' }}>النسبة</th>
                        </tr>
                      </thead>
                      <tbody>
                        {detail.lectures.map((lecture) => (
                          <tr key={lecture.id}>
                            <td style={{ fontWeight: '700' }}>{lecture.name}</td>
                            <td style={{ fontSize: '11px' }}>{new Date(lecture.lectureDate).toLocaleDateString('ar')}</td>
                            <td>{lecture.courseCode || '—'}</td>
                            <td>{lecture.sections.join('، ') || '—'}</td>
                            <td style={{ textAlign: 'center', color: '#059669', fontWeight: '700' }}>{lecture.present}</td>
                            <td style={{ textAlign: 'center', color: lecture.absent > 0 ? '#DC2626' : '#6B7280', fontWeight: '700' }}>{lecture.absent}</td>
                            <td style={{ textAlign: 'center' }}>{lecture.attendanceRate == null ? 'N/A' : `${lecture.attendanceRate}%`}</td>
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
