'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Navbar from '../../components/layout/Navbar';
import {
  courseApi,
  followupApi,
  sectionApi,
  stageLabel,
  type FollowupCourse,
  type FollowupOverview,
  type FollowupStudentsPage,
  type SectionItem,
} from '../../lib/api';

const PERIOD_LABELS: Record<string, string> = {
  MORNING: 'صباحي',
  EVENING: 'مسائي',
};

const SORT_OPTIONS = [
  { value: 'name', label: 'الاسم' },
  { value: 'studentCode', label: 'الباركود' },
  { value: 'attendanceRate_desc', label: 'أعلى حضور' },
  { value: 'attendanceRate_asc', label: 'أقل حضور' },
  { value: 'absenceRate_desc', label: 'أعلى غياب' },
];

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return 'تعذر تحميل البيانات';
}

export default function FollowupPage() {
  const [overview, setOverview] = useState<FollowupOverview | null>(null);
  const [data, setData] = useState<FollowupStudentsPage | null>(null);
  const [sections, setSections] = useState<SectionItem[]>([]);
  const [availableCourses, setAvailableCourses] = useState<FollowupCourse[]>([]);
  const [coursesLoaded, setCoursesLoaded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [courseId, setCourseId] = useState('');
  const [stage, setStage] = useState('');
  const [sectionId, setSectionId] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('name');
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    if (!coursesLoaded) return;

    // The backend refuses to merge several courses into one statistic. Keep the
    // page idle until the lecturer picks a course instead of showing an error.
    if (!courseId && availableCourses.length > 1) {
      setOverview(null);
      setData(null);
      setError(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const filters = {
        courseId: courseId || undefined,
        stage: stage || undefined,
        sectionId: sectionId || undefined,
        search: search || undefined,
        sort,
        page,
        pageSize: 25,
      };
      const [overviewResult, studentsResult] = await Promise.all([
        followupApi.overview(filters),
        followupApi.students(filters),
      ]);
      setOverview(overviewResult);
      setData(studentsResult);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [courseId, stage, sectionId, search, sort, page, coursesLoaded, availableCourses.length]);

  useEffect(() => {
    load();
  }, [load]);

  // Sections are only used to refine the filter; failures are non-fatal.
  useEffect(() => {
    sectionApi
      .getAll()
      .then(setSections)
      .catch(() => setSections([]));
  }, []);

  // The assigned course list is scoped server-side. It is needed before the
  // follow-up statistics so a lecturer with several courses can choose one.
  useEffect(() => {
    courseApi
      .getAll()
      .then((rows) => {
        const mapped = rows.map((course) => ({
          id: course.id,
          code: course.code,
          name: course.name,
          stage: course.stage,
        }));
        setAvailableCourses(mapped);
        if (mapped.length === 1) setCourseId(mapped[0].id);
      })
      .catch(() => setAvailableCourses([]))
      .finally(() => setCoursesLoaded(true));
  }, []);

  const courses = availableCourses.length
    ? availableCourses
    : overview?.courses || data?.courses || [];
  const needsCourse = courses.length > 1 && !courseId;
  const availableStages = useMemo(
    () => Array.from(new Set(courses.map((course) => course.stage))).sort((a, b) => a - b),
    [courses],
  );

  const visibleSections = sections.filter((section) => {
    if (stage) return section.stage === Number(stage);
    // Only offer sections that belong to a stage reachable through the
    // assigned courses; anything else is rejected by the backend.
    return courses.some((course) => course.stage === section.stage);
  });

  const totals = overview?.totals;
  const pagination = data?.pagination;
  const scope = overview?.scope || data?.scope;
  const scopeLabel = (() => {
    if (!scope) return null;
    const courseNames = scope.courseIds
      .map((id) => courses.find((course) => course.id === id))
      .filter(Boolean)
      .map((course) => `${course!.code} — ${course!.name}`)
      .join('، ');
    const stageNames = scope.stages.map((value) => stageLabel(value)).join('، ');
    const sectionName = scope.section
      ? `${scope.section.name} (${PERIOD_LABELS[scope.section.studyPeriod] || scope.section.studyPeriod})`
      : null;
    return [courseNames, stageNames, sectionName].filter(Boolean).join(' · ');
  })();

  const resetToFirstPage = () => setPage(1);

  return (
    <div style={{ minHeight: '100vh' }}>
      <Navbar />

      <div className="app-page">
        <div style={{ marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '6px' }}>
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '12px',
                background: '#111827',
                border: '1.5px solid var(--gold)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '20px',
              }}
            >
              👥
            </div>
            <h1 style={{ fontSize: '25px', fontWeight: '800', color: '#111827' }}>
              متابعة الطلاب
            </h1>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
            عرض للقراءة فقط لطلاب المراحل التي تدرّسها. تُحتسب المحاضرات المغلقة فقط في نسب
            الحضور والغياب، ولا تُصدر هذه الصفحة أي رموز QR.
          </p>
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

        {scopeLabel && (
          <div
            className="glass-card"
            style={{
              padding: '10px 14px',
              marginBottom: '16px',
              fontSize: '12.5px',
              color: '#374151',
              fontWeight: '600',
            }}
          >
            النطاق الحالي: {scopeLabel}
          </div>
        )}

        {/* Totals */}
        {!needsCourse && (
        <div className="followup-stats">
          <StatCard label="الطلاب" value={totals?.students ?? 0} icon="👨‍🎓" />
          <StatCard label="المحاضرات المغلقة" value={totals?.closedLectures ?? 0} icon="📘" />
          <StatCard label="حاضر" value={totals?.present ?? 0} icon="✅" tone="#065F46" />
          <StatCard label="غائب" value={totals?.absent ?? 0} icon="⚠️" tone="#B91C1C" />
          <StatCard
            label="نسبة الحضور"
            value={`${totals?.attendanceRate ?? 0}%`}
            icon="📈"
            tone="#065F46"
          />
          <StatCard
            label="نسبة الغياب"
            value={`${totals?.absenceRate ?? 0}%`}
            icon="📉"
            tone="#B91C1C"
          />
        </div>
        )}
        {!needsCourse && totals && totals.activeLectures > 0 && (
          <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', marginBottom: '16px' }}>
            توجد {totals.activeLectures} محاضرة جارية غير محتسبة في النسب حتى إغلاقها.
          </p>
        )}

        {/* Filters */}
        <div className="glass-card" style={{ padding: '16px', marginBottom: '18px' }}>
          <div className="followup-filters">
            <div>
              <label className="followup-label">المادة</label>
              <select
                className="input"
                value={courseId}
                required={courses.length > 1}
                onChange={(e) => {
                  setCourseId(e.target.value);
                  setStage('');
                  setSectionId('');
                  resetToFirstPage();
                }}
              >
                <option value="">
                  {courses.length > 1 ? '-- اختر المادة --' : 'كل المواد'}
                </option>
                {courses.map((course) => (
                  <option key={course.id} value={course.id}>
                    {stageLabel(course.stage)} — {course.code} — {course.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="followup-label">المرحلة</label>
              <select
                className="input"
                value={stage}
                onChange={(e) => {
                  setStage(e.target.value);
                  setSectionId('');
                  resetToFirstPage();
                }}
              >
                <option value="">كل المراحل</option>
                {availableStages.map((value) => (
                  <option key={value} value={value}>
                    {stageLabel(value)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="followup-label">الشعبة</label>
              <select
                className="input"
                value={sectionId}
                onChange={(e) => {
                  setSectionId(e.target.value);
                  resetToFirstPage();
                }}
              >
                <option value="">كل الشعب</option>
                {visibleSections.map((section) => (
                  <option key={section.id} value={section.id}>
                    {stageLabel(section.stage)} — {section.name} (
                    {PERIOD_LABELS[section.studyPeriod] || section.studyPeriod})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="followup-label">الترتيب</label>
              <select
                className="input"
                value={sort}
                onChange={(e) => {
                  setSort(e.target.value);
                  resetToFirstPage();
                }}
              >
                {SORT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="followup-search">
              <label className="followup-label">بحث</label>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  setSearch(searchInput.trim());
                  resetToFirstPage();
                }}
                style={{ display: 'flex', gap: '8px' }}
              >
                <input
                  className="input"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="الاسم أو الباركود..."
                  style={{ minWidth: 0 }}
                />
                <button type="submit" className="btn btn-primary btn-sm">
                  بحث
                </button>
              </form>
            </div>
          </div>
        </div>

        {/* Students */}
        {needsCourse ? (
          <div className="empty-state">
            <p style={{ color: 'var(--text-muted)', fontSize: '16px', fontWeight: '600' }}>
              اختر المادة أولاً
            </p>
            <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
              لديك أكثر من مادة مسندة. تُعرض متابعة مادة واحدة في كل مرة حتى لا تختلط
              الإحصائيات بين مواد مختلفة.
            </p>
          </div>
        ) : loading ? (
          <div className="empty-state">
            <p style={{ color: 'var(--text-muted)' }}>جاري التحميل...</p>
          </div>
        ) : !data || data.items.length === 0 ? (
          <div className="empty-state">
            <p style={{ color: 'var(--text-muted)', fontSize: '16px', fontWeight: '600' }}>
              لا يوجد طلاب مطابقون
            </p>
            <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
              {courses.length === 0
                ? 'لم تُسند إليك أي مادة بعد. راجع إدارة التعيينات.'
                : 'جرّب تغيير المادة أو الشعبة أو كلمة البحث.'}
            </p>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {data.items.map((student) => (
                <div
                  key={student.id}
                  className="glass-card"
                  style={{ padding: '14px 16px' }}
                >
                  <div className="followup-student-row">
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: '16px', fontWeight: '800' }}>{student.name}</div>
                      <div style={{ fontSize: '12.5px', color: 'var(--text-muted)' }}>
                        <bdi dir="ltr">{student.studentCode}</bdi> ·{' '}
                        {stageLabel(student.stage)} ·{' '}
                        {PERIOD_LABELS[student.studyPeriod] || student.studyPeriod} ·{' '}
                        {student.sectionLabel || student.section || 'بلا شعبة'}
                      </div>
                    </div>

                    <div className="followup-metrics">
                      <Metric label="حاضر" value={student.presentCount} tone="#065F46" />
                      <Metric label="غائب" value={student.absentCount} tone="#B91C1C" />
                      <Metric label="الحضور" value={`${student.attendanceRate}%`} />
                      <Metric label="الغياب" value={`${student.absenceRate}%`} tone="#B91C1C" />
                    </div>

                    <Link
                      href={`/followup/${student.id}${(() => {
                        const params = new URLSearchParams();
                        if (courseId) params.set('courseId', courseId);
                        if (stage) params.set('stage', stage);
                        if (sectionId) params.set('sectionId', sectionId);
                        const query = params.toString();
                        return query ? `?${query}` : '';
                      })()}`}
                      className="btn btn-sm"
                      style={{ textDecoration: 'none', whiteSpace: 'nowrap' }}
                    >
                      التفاصيل
                    </Link>
                  </div>
                </div>
              ))}
            </div>

            {pagination && pagination.totalPages > 1 && (
              <div className="followup-pagination">
                <button
                  type="button"
                  className="btn btn-sm"
                  disabled={pagination.page <= 1}
                  onClick={() => setPage((current) => Math.max(current - 1, 1))}
                >
                  السابق
                </button>
                <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                  صفحة {pagination.page} من {pagination.totalPages} — {pagination.total} طالب
                </span>
                <button
                  type="button"
                  className="btn btn-sm"
                  disabled={pagination.page >= pagination.totalPages}
                  onClick={() => setPage((current) => current + 1)}
                >
                  التالي
                </button>
              </div>
            )}
          </>
        )}
      </div>

      <style jsx>{`
        .followup-stats {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
          gap: 12px;
          margin-bottom: 16px;
        }
        .followup-filters {
          display: grid;
          grid-template-columns: repeat(5, minmax(0, 1fr));
          gap: 12px;
          align-items: end;
        }
        .followup-label {
          display: block;
          margin-bottom: 4px;
          font-size: 12.5px;
          font-weight: 700;
          color: #374151;
        }
        .followup-search {
          grid-column: span 1;
        }
        .followup-student-row {
          display: flex;
          align-items: center;
          gap: 14px;
          flex-wrap: wrap;
        }
        .followup-metrics {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }
        .followup-pagination {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 14px;
          margin-top: 18px;
          flex-wrap: wrap;
        }
        @media (max-width: 1000px) {
          .followup-filters {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
          .followup-search {
            grid-column: span 2;
          }
          .followup-stats {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }
        }
        @media (max-width: 560px) {
          /* Keep the filters in a compact 2-column grid instead of a long
             single-column stack; the search box takes a full row. */
          .followup-filters {
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 10px;
          }
          .followup-search {
            grid-column: span 2;
          }
          .followup-stats {
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 10px;
          }
          .followup-student-row {
            align-items: flex-start;
          }
        }
      `}</style>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
  tone,
}: {
  label: string;
  value: number | string;
  icon: string;
  tone?: string;
}) {
  return (
    <div className="glass-card" style={{ padding: '14px 16px' }}>
      <div style={{ fontSize: '18px' }}>{icon}</div>
      <div style={{ fontSize: '24px', fontWeight: '800', color: tone || '#111827' }}>{value}</div>
      <div style={{ fontSize: '12.5px', color: 'var(--text-muted)', fontWeight: '600' }}>
        {label}
      </div>
    </div>
  );
}

function Metric({ label, value, tone }: { label: string; value: number | string; tone?: string }) {
  return (
    <div
      style={{
        minWidth: '64px',
        textAlign: 'center',
        padding: '6px 8px',
        borderRadius: '10px',
        background: '#F9FAFB',
        border: '1px solid #E5E7EB',
      }}
    >
      <div style={{ fontSize: '15px', fontWeight: '800', color: tone || '#111827' }}>{value}</div>
      <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '600' }}>{label}</div>
    </div>
  );
}
