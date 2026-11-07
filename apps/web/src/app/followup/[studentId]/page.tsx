'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import Navbar from '../../../components/layout/Navbar';
import { followupApi, stageLabel, type FollowupStudentDetail } from '../../../lib/api';
import { formatAttendanceDate, formatAttendanceTime } from '../../../lib/formatTime';

const PERIOD_LABELS: Record<string, string> = {
  MORNING: 'صباحي',
  EVENING: 'مسائي',
};

export default function FollowupStudentPage() {
  const params = useParams<{ studentId: string }>();
  const studentId = Array.isArray(params?.studentId) ? params.studentId[0] : params?.studentId;

  const [courseId, setCourseId] = useState('');
  const [sectionId, setSectionId] = useState('');
  const [stage, setStage] = useState('');
  const [detail, setDetail] = useState<FollowupStudentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Read the optional scope filters from the URL without useSearchParams so the
  // page does not require a Suspense boundary during static export. Passing the
  // same scope as the list guarantees the detail cannot escape it.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    setCourseId(params.get('courseId') || '');
    setSectionId(params.get('sectionId') || '');
    setStage(params.get('stage') || '');
  }, []);

  useEffect(() => {
    if (!studentId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    followupApi
      .studentDetail(studentId, {
        courseId: courseId || undefined,
        sectionId: sectionId || undefined,
        stage: stage || undefined,
      })
      .then((result) => {
        if (!cancelled) setDetail(result);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'تعذر تحميل بيانات الطالب');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [studentId, courseId, sectionId, stage]);

  return (
    <div style={{ minHeight: '100vh' }}>
      <Navbar />

      <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '24px 20px 48px' }}>
        <div style={{ marginBottom: '16px' }}>
          <Link
            href="/followup"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              textDecoration: 'none',
              fontSize: '13.5px',
              fontWeight: '700',
              color: 'var(--text-secondary)',
            }}
          >
            ← العودة إلى متابعة الطلاب
          </Link>
        </div>

        {error && (
          <div
            style={{
              padding: '12px 16px',
              borderRadius: '12px',
              background: '#FEF2F2',
              border: '1px solid #FCA5A5',
              color: '#991B1B',
              marginBottom: '16px',
              fontSize: '14px',
              fontWeight: '600',
            }}
          >
            ⚠️ {error}
          </div>
        )}

        {loading ? (
          <div className="empty-state">
            <p style={{ color: 'var(--text-muted)' }}>جاري التحميل...</p>
          </div>
        ) : detail ? (
          <>
            <div className="glass-card" style={{ padding: '20px', marginBottom: '18px' }}>
              <h1 style={{ fontSize: '22px', fontWeight: '800', marginBottom: '4px' }}>
                {detail.student.name}
              </h1>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                <bdi dir="ltr">{detail.student.studentCode}</bdi> ·{' '}
                {stageLabel(detail.student.stage)} ·{' '}
                {PERIOD_LABELS[detail.student.studyPeriod] || detail.student.studyPeriod} ·{' '}
                {detail.student.sectionLabel || detail.student.section || 'بلا شعبة'}
              </p>
            </div>

            <div className="detail-stats">
              <StatBox label="حاضر" value={detail.stats.present} tone="#065F46" />
              <StatBox label="غائب" value={detail.stats.absent} tone="#B91C1C" />
              <StatBox label="المحاضرات المحتسبة" value={detail.stats.totalLectures} />
              <StatBox label="نسبة الحضور" value={`${detail.stats.attendanceRate}%`} tone="#065F46" />
              <StatBox label="نسبة الغياب" value={`${detail.stats.absenceRate}%`} tone="#B91C1C" />
            </div>

            {detail.stats.excludedActiveLectures > 0 && (
              <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', marginBottom: '16px' }}>
                {detail.stats.excludedActiveLectures} محاضرة جارية غير محتسبة في هذه الأرقام حتى
                إغلاقها.
              </p>
            )}

            <h2 style={{ fontSize: '16px', fontWeight: '800', margin: '18px 0 10px' }}>
              سجل المحاضرات المغلقة
            </h2>

            {detail.lectures.length === 0 ? (
              <div className="empty-state">
                <p style={{ color: 'var(--text-muted)' }}>
                  لا توجد محاضرات مغلقة مسجّلة لهذا الطالب ضمن موادك.
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {detail.lectures.map((lecture) => (
                  <div
                    key={lecture.attendanceId}
                    className="glass-card"
                    style={{ padding: '14px 16px' }}
                  >
                    <div className="detail-lecture-row">
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontSize: '15px', fontWeight: '800' }}>
                          {lecture.lectureName}
                        </div>
                        <div style={{ fontSize: '12.5px', color: 'var(--text-muted)' }}>
                          {lecture.courseCode ? (
                            <bdi dir="ltr">{lecture.courseCode}</bdi>
                          ) : (
                            'بدون مادة'
                          )}
                          {lecture.courseName ? ` — ${lecture.courseName}` : ''}
                          {' · '}
                          {formatAttendanceDate(lecture.lectureDate)}
                          {' · '}
                          <bdi dir="ltr">{formatAttendanceTime(lecture.lectureDate, false)}</bdi>
                        </div>
                      </div>
                      <span
                        style={{
                          padding: '4px 12px',
                          borderRadius: '999px',
                          fontSize: '12.5px',
                          fontWeight: '800',
                          whiteSpace: 'nowrap',
                          background:
                            lecture.status === 'PRESENT' ? '#ECFDF5' : '#FEF2F2',
                          border:
                            lecture.status === 'PRESENT'
                              ? '1px solid #A7F3D0'
                              : '1px solid #FCA5A5',
                          color: lecture.status === 'PRESENT' ? '#065F46' : '#B91C1C',
                        }}
                      >
                        {lecture.status === 'PRESENT' ? 'حاضر' : 'غائب'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          <div className="empty-state">
            <p style={{ color: 'var(--text-muted)' }}>الطالب غير موجود ضمن نطاق موادك.</p>
          </div>
        )}
      </div>

      <style jsx>{`
        .detail-stats {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
          gap: 12px;
        }
        .detail-lecture-row {
          display: flex;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
        }
      `}</style>
    </div>
  );
}

function StatBox({
  label,
  value,
  tone,
}: {
  label: string;
  value: number | string;
  tone?: string;
}) {
  return (
    <div className="glass-card" style={{ padding: '14px 16px' }}>
      <div style={{ fontSize: '24px', fontWeight: '800', color: tone || '#111827' }}>{value}</div>
      <div style={{ fontSize: '12.5px', color: 'var(--text-muted)', fontWeight: '600' }}>
        {label}
      </div>
    </div>
  );
}
