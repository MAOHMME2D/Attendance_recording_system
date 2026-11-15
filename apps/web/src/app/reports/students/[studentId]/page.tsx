'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Navbar from '../../../../components/layout/Navbar';
import { reportsApi, type ReportStudentDetail } from '../../../../lib/api';
import { useAuth, PERMISSIONS } from '../../../../lib/auth';
import ReportExport from '../../../../components/reports/ReportExport';
import { formatAttendanceDate, formatAttendanceTime } from '../../../../lib/formatTime';

const rate = (value: number | null) => (value == null ? 'N/A' : `${value}%`);

export default function ReportStudentDetailPage() {
  const params = useParams<{ studentId: string }>();
  const router = useRouter();
  const { can } = useAuth();
  const studentId = decodeURIComponent(params.studentId);

  const [detail, setDetail] = useState<ReportStudentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!can(PERMISSIONS.REPORTS_VIEW)) {
      setLoading(false);
      setError('لا تملك صلاحية عرض التقارير');
      return;
    }
    let cancelled = false;
    setLoading(true);
    reportsApi.studentDetail(studentId)
      .then((result) => {
        if (!cancelled) setDetail(result);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'تعذر تحميل ملف الطالب');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [studentId, can]);

  const exportRows = (detail?.lectures ?? []).map((row, index) => ({
    ت: index + 1,
    المحاضرة: row.lectureName,
    التاريخ: formatAttendanceDate(row.lectureDate),
    المادة: row.courseCode ? `${row.courseCode} — ${row.courseName}` : '—',
    الشعبة: row.sections.join('، ') || '—',
    'المدرس المنفذ': row.conductedBy || '—',
    الحالة: row.status === 'PRESENT' ? (row.note ? 'حاضر عبر' : 'حاضر') : row.status === 'ABSENT' ? 'غائب' : '—',
    الملاحظة: row.note || '',
  }));

  return (
    <div className="no-print" style={{ minHeight: '100vh', background: 'var(--bg-primary)' }}>
      <Navbar />

      <div className="app-page">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
          <Link href="/reports" className="btn btn-ghost btn-sm" style={{ fontSize: '12px' }}>
            ← عودة إلى التقارير
          </Link>
          {detail && (
            <ReportExport
              title={`ملف الطالب: ${detail.student.name}`}
              subtitle={`${detail.student.studentCode} · ${detail.student.stageLabel} · ${detail.student.sectionLabel || detail.student.section || 'بلا شعبة'}`}
              stats={[
                { label: 'حضور', value: detail.stats.present },
                { label: 'غياب', value: detail.stats.absent },
                { label: 'إجمالي', value: detail.stats.totalCases },
                { label: 'نسبة الحضور', value: rate(detail.stats.attendanceRate) },
              ]}
              columns={[
                { header: 'ت', value: (row) => row['ت'] },
                { header: 'المحاضرة', value: (row) => row['المحاضرة'] },
                { header: 'التاريخ', value: (row) => row['التاريخ'] },
                { header: 'المادة', value: (row) => row['المادة'] },
                { header: 'الشعبة', value: (row) => row['الشعبة'] },
                { header: 'المدرس المنفذ', value: (row) => row['المدرس المنفذ'] },
                { header: 'الحالة', value: (row) => row['الحالة'] },
                { header: 'الملاحظة', value: (row) => row['الملاحظة'] },
              ]}
              rows={exportRows}
              filename={`ملف_الطالب_${detail.student.studentCode}`}
              sheetName="ملف الطالب"
            />
          )}
        </div>

        {error && (
          <div role="alert" style={{ padding: '12px 16px', borderRadius: '12px', background: '#FEF2F2', border: '1px solid #FCA5A5', color: '#991B1B', fontSize: '13px', marginBottom: '16px' }}>
            ⚠️ {error}
          </div>
        )}

        {loading ? (
          <div className="empty-state"><p style={{ color: 'var(--text-muted)' }}>جاري تحميل ملف الطالب...</p></div>
        ) : detail ? (
          <>
            <div className="glass-card" style={{ padding: '20px', marginBottom: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '14px', flexWrap: 'wrap', alignItems: 'flex-start' }}>
                <div>
                  <h1 style={{ fontSize: '22px', fontWeight: '800', color: '#111827', marginBottom: '4px' }}>
                    {detail.student.name}
                  </h1>
                  <div style={{ fontSize: '13px', color: '#4B5563' }}>
                    <bdi dir="ltr">{detail.student.studentCode}</bdi> · {detail.student.stageLabel} ·{' '}
                    {detail.student.studyPeriod === 'EVENING' ? 'مسائية' : 'صباحية'} ·{' '}
                    {detail.student.sectionLabel || detail.student.section || 'بلا شعبة'}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <div style={{ textAlign: 'center', padding: '8px 18px', background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: '12px' }}>
                    <div style={{ fontSize: '26px', fontWeight: '800', color: '#059669' }}>{detail.stats.present}</div>
                    <div style={{ fontSize: '11px', color: '#6B7280' }}>حضور</div>
                  </div>
                  <div style={{ textAlign: 'center', padding: '8px 18px', background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: '12px' }}>
                    <div style={{ fontSize: '26px', fontWeight: '800', color: '#DC2626' }}>{detail.stats.absent}</div>
                    <div style={{ fontSize: '11px', color: '#6B7280' }}>غياب</div>
                  </div>
                  <div style={{ textAlign: 'center', padding: '8px 18px', background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: '12px' }}>
                    <div style={{ fontSize: '26px', fontWeight: '800', color: '#111827' }}>{detail.stats.totalCases}</div>
                    <div style={{ fontSize: '11px', color: '#6B7280' }}>إجمالي</div>
                  </div>
                  <div style={{ textAlign: 'center', padding: '8px 18px', background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: '12px' }}>
                    <div style={{ fontSize: '26px', fontWeight: '800', color: '#92400E' }}>{rate(detail.stats.attendanceRate)}</div>
                    <div style={{ fontSize: '11px', color: '#92400E' }}>نسبة الحضور</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="glass-card" style={{ padding: '16px' }}>
              <h2 style={{ fontSize: '15px', fontWeight: '800', color: '#111827', marginBottom: '12px' }}>
                سجل المحاضرات ({detail.lectures.length})
              </h2>

              {detail.lectures.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', fontSize: '13px', padding: '16px', textAlign: 'center' }}>
                  لا توجد محاضرات منتهية ضمن نطاقك.
                </p>
              ) : (
                <div className="attendance-scroll" style={{ maxHeight: '540px', border: '1px solid #E5E7EB', borderRadius: '12px' }}>
                  <table className="attendance-table" style={{ fontSize: '12px', minWidth: '760px' }}>
                    <thead>
                      <tr>
                        <th>التاريخ</th>
                        <th>المحاضرة</th>
                        <th>المادة</th>
                        <th>الشعبة</th>
                        <th>المدرس المنفذ</th>
                        <th style={{ textAlign: 'center' }}>الحالة</th>
                        <th>الملاحظة</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detail.lectures.map((row) => (
                        <tr key={row.lectureId}>
                          <td style={{ whiteSpace: 'nowrap', fontSize: '11px' }}>
                            {formatAttendanceDate(row.lectureDate)}
                            <br />
                            <span style={{ color: '#9CA3AF' }}>{formatAttendanceTime(row.lectureDate, false)}</span>
                          </td>
                          <td style={{ fontWeight: '700' }}>{row.lectureName}</td>
                          <td style={{ fontSize: '11px' }}>
                            {row.courseCode ? (
                              <>
                                <bdi dir="ltr">{row.courseCode}</bdi> — {row.courseName}
                              </>
                            ) : '—'}
                          </td>
                          <td>{row.sections.join('، ') || '—'}</td>
                          <td style={{ fontSize: '11px' }}>{row.conductedBy || '—'}</td>
                          <td style={{ textAlign: 'center' }}>
                            {row.status ? (
                              <span
                                style={{
                                  padding: '2px 10px',
                                  borderRadius: '999px',
                                  fontSize: '11px',
                                  fontWeight: '800',
                                  background: row.status === 'PRESENT' ? '#ECFDF5' : '#FEF2F2',
                                  color: row.status === 'PRESENT' ? '#065F46' : '#991B1B',
                                }}
                              >
                                {row.status === 'PRESENT' ? 'حاضر' : 'غائب'}
                              </span>
                            ) : (
                              '—'
                            )}
                          </td>
                          <td style={{ fontSize: '11px', color: '#6D28D9' }}>{row.note || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
