'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Navbar from '../../components/layout/Navbar';
import {
  assignmentApi,
  courseApi,
  sectionApi,
  staffApi,
  timetableApi,
  ACADEMIC_STAGES,
  STAGE_LABELS,
  STAGE_OPTIONS,
  STUDY_PERIODS,
  TIMETABLE_DAYS,
  stageLabel,
  type AssignmentItem,
  type CourseItem,
  type ManagedStaff,
  type SectionItem,
  type StaffRole,
  type TimetableInput,
  type TimetableItem,
} from '../../lib/api';
import { useAuth, PERMISSIONS, ROLE_LABELS } from '../../lib/auth';

type Tab = 'sections' | 'courses' | 'assignments' | 'timetable';

const PERIOD_LABELS: Record<string, string> = {
  MORNING: 'صباحي',
  EVENING: 'مسائي',
};

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return 'حدث خطأ غير متوقع';
}

export default function AcademicsPage() {
  const { can } = useAuth();

  const canViewSections = can(PERMISSIONS.SECTIONS_VIEW);
  const canManageSections = can(PERMISSIONS.SECTIONS_MANAGE);
  const canViewCourses = can(PERMISSIONS.COURSES_VIEW);
  const canManageCourses = can(PERMISSIONS.COURSES_MANAGE);
  const canViewAssignments = can(PERMISSIONS.ASSIGNMENTS_VIEW);
  const canManageAssignments = can(PERMISSIONS.ASSIGNMENTS_MANAGE);
  const canViewTimetable = can(PERMISSIONS.TIMETABLE_VIEW);
  const canManageTimetable = can(PERMISSIONS.TIMETABLE_MANAGE);

  const tabs = useMemo(() => {
    const list: Array<{ id: Tab; label: string }> = [];
    if (canViewSections) list.push({ id: 'sections', label: 'الشعب' });
    if (canViewCourses) list.push({ id: 'courses', label: 'المواد' });
    if (canViewAssignments) list.push({ id: 'assignments', label: 'التعيينات' });
    if (canViewTimetable) list.push({ id: 'timetable', label: 'الجدول' });
    return list;
  }, [canViewSections, canViewCourses, canViewAssignments, canViewTimetable]);

  const [activeTab, setActiveTab] = useState<Tab>(tabs[0]?.id || 'sections');
  const [stageFilter, setStageFilter] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [sections, setSections] = useState<SectionItem[]>([]);
  const [courses, setCourses] = useState<CourseItem[]>([]);
  const [assignments, setAssignments] = useState<AssignmentItem[]>([]);
  const [staff, setStaff] = useState<ManagedStaff[]>([]);
  const [timetableEntries, setTimetableEntries] = useState<TimetableItem[]>([]);
  const [timetableForm, setTimetableForm] = useState<TimetableInput>({
    courseId: '',
    sectionId: '',
    dayOfWeek: 0,
    startTime: '08:00',
    endTime: '09:30',
  });
  const [timetableFilter, setTimetableFilter] = useState<{
    courseId: string;
    sectionId: string;
    dayOfWeek: string;
  }>({ courseId: '', sectionId: '', dayOfWeek: '' });

  // Section form
  const [sectionForm, setSectionForm] = useState({
    stage: 2,
    studyPeriod: 'EVENING',
    name: '',
    label: '',
  });
  const [editSection, setEditSection] = useState<{
    id: string;
    name: string;
    label: string;
  } | null>(null);

  // Course form
  const [courseForm, setCourseForm] = useState({
    code: '',
    name: '',
    stage: 2,
    description: '',
  });
  const [editCourse, setEditCourse] = useState<{
    id: string;
    code: string;
    name: string;
    description: string;
  } | null>(null);

  // Assignment form
  const [assignmentForm, setAssignmentForm] = useState({
    staffUserId: '',
    courseId: '',
  });

  const loadSections = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await sectionApi.getAll({ stage: stageFilter });
      setSections(data);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [stageFilter]);

  const loadCourses = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await courseApi.getAll(stageFilter);
      setCourses(data);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [stageFilter]);

  const loadAssignments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [assignmentData, courseData, staffData] = await Promise.all([
        assignmentApi.getAll(),
        courseApi.getAll(),
        staffApi.list(),
      ]);
      setAssignments(assignmentData);
      setCourses(courseData);
      setStaff(staffData);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  const loadTimetable = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [entries, courseData, sectionData] = await Promise.all([
        timetableApi.getAll({
          courseId: timetableFilter.courseId || undefined,
          sectionId: timetableFilter.sectionId || undefined,
          dayOfWeek: timetableFilter.dayOfWeek === '' ? undefined : Number(timetableFilter.dayOfWeek),
        }),
        courseApi.getAll(),
        sectionApi.getAll(),
      ]);
      setTimetableEntries(entries);
      setCourses(courseData);
      setSections(sectionData);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [timetableFilter]);

  useEffect(() => {
    if (activeTab === 'sections') {
      loadSections();
    } else if (activeTab === 'courses') {
      loadCourses();
    } else if (activeTab === 'assignments') {
      loadAssignments();
    } else {
      loadTimetable();
    }
  }, [activeTab, loadSections, loadCourses, loadAssignments, loadTimetable]);

  useEffect(() => {
    if (tabs.length > 0 && !tabs.some((tab) => tab.id === activeTab)) {
      setActiveTab(tabs[0].id);
    }
  }, [tabs, activeTab]);

  const flashSuccess = (message: string) => {
    setSuccess(message);
    setError(null);
  };

  const runAction = async (fn: () => Promise<void>, message: string) => {
    setActionLoading(true);
    setError(null);
    try {
      await fn();
      flashSuccess(message);
    } catch (err) {
      setError(errorMessage(err));
      setSuccess(null);
    } finally {
      setActionLoading(false);
    }
  };

  // ---------------- Section actions ----------------
  const handleCreateSection = (event: React.FormEvent) => {
    event.preventDefault();
    runAction(async () => {
      await sectionApi.create({
        stage: sectionForm.stage,
        studyPeriod: sectionForm.studyPeriod,
        name: sectionForm.name.trim(),
        label: sectionForm.label.trim() || undefined,
      });
      setSectionForm((form) => ({ ...form, name: '', label: '' }));
      await loadSections();
    }, 'تمت إضافة الشعبة بنجاح');
  };

  const handleSaveSection = (event: React.FormEvent) => {
    event.preventDefault();
    if (!editSection) return;
    runAction(async () => {
      await sectionApi.update(editSection.id, {
        name: editSection.name.trim(),
        label: editSection.label.trim(),
      });
      setEditSection(null);
      await loadSections();
    }, 'تم تحديث الشعبة بنجاح');
  };

  const handleDeleteSection = (section: SectionItem) => {
    if (!window.confirm(`حذف الشعبة «${section.name}»؟ لا يمكن حذف شعبة تحتوي طلاباً.`)) return;
    runAction(async () => {
      await sectionApi.delete(section.id);
      await loadSections();
    }, 'تم حذف الشعبة');
  };

  // ---------------- Course actions ----------------
  const handleCreateCourse = (event: React.FormEvent) => {
    event.preventDefault();
    runAction(async () => {
      await courseApi.create({
        code: courseForm.code.trim(),
        name: courseForm.name.trim(),
        stage: courseForm.stage,
        description: courseForm.description.trim() || undefined,
      });
      setCourseForm((form) => ({ ...form, code: '', name: '', description: '' }));
      await loadCourses();
    }, 'تمت إضافة المادة بنجاح');
  };

  const handleSaveCourse = (event: React.FormEvent) => {
    event.preventDefault();
    if (!editCourse) return;
    runAction(async () => {
      await courseApi.update(editCourse.id, {
        code: editCourse.code.trim(),
        name: editCourse.name.trim(),
        description: editCourse.description.trim(),
      });
      setEditCourse(null);
      await loadCourses();
    }, 'تم تحديث المادة بنجاح');
  };

  const handleDeleteCourse = (course: CourseItem) => {
    if (!window.confirm(`حذف المادة «${course.name}»؟`)) return;
    runAction(async () => {
      await courseApi.delete(course.id);
      await loadCourses();
    }, 'تم حذف المادة');
  };

  // ---------------- Assignment actions ----------------
  const handleCreateAssignment = (event: React.FormEvent) => {
    event.preventDefault();
    if (!assignmentForm.staffUserId || !assignmentForm.courseId) {
      setError('يرجى اختيار المحاضر والمادة');
      return;
    }
    runAction(async () => {
      await assignmentApi.create(assignmentForm);
      setAssignmentForm({ staffUserId: '', courseId: '' });
      await loadAssignments();
    }, 'تم إسناد المادة للمحاضر');
  };

  const handleDeleteAssignment = (assignment: AssignmentItem) => {
    if (
      !window.confirm(
        `إلغاء إسناد مادة «${assignment.course.name}» عن ${assignment.staffUser.fullName}؟`,
      )
    ) {
      return;
    }
    runAction(async () => {
      await assignmentApi.delete(assignment.id);
      await loadAssignments();
    }, 'تم إلغاء الإسناد');
  };

  // Filter assignments by the selected stage on the client (the API has no
  // stage query parameter for assignments).
  //
  // ---------------- Timetable actions ----------------
  const timetableFormCourseStage =
    courses.find((course) => course.id === timetableForm.courseId)?.stage ?? null;
  const handleCreateTimetableEntry = (event: React.FormEvent) => {
    event.preventDefault();
    if (!timetableForm.courseId || !timetableForm.sectionId) {
      setError('يرجى اختيار المادة والشعبة');
      return;
    }
    if (timetableForm.startTime >= timetableForm.endTime) {
      setError('وقت النهاية يجب أن يكون بعد وقت البداية');
      return;
    }
    runAction(async () => {
      await timetableApi.create(timetableForm);
      setTimetableForm((form) => ({ ...form, courseId: '', sectionId: '' }));
      await loadTimetable();
    }, 'تم إضافة الموعد إلى الجدول');
  };

  const handleDeleteTimetableEntry = (entry: TimetableItem) => {
    if (
      !window.confirm(
        `حذف موعد «${entry.course.code} / شعبة ${entry.section.name} / ${entry.dayLabel} ${entry.startTime}-${entry.endTime}»؟`,
      )
    ) {
      return;
    }
    runAction(async () => {
      await timetableApi.delete(entry.id);
      await loadTimetable();
    }, 'تم حذف الموعد من الجدول');
  };

  const visibleAssignments = stageFilter
    ? assignments.filter((assignment) => assignment.course.stage === Number(stageFilter))
    : assignments;

  const assignableStaff = staff.filter(
    (member) =>
      member.isActive &&
      (member.role === 'LECTURER' || member.role === 'TECHNICAL_LECTURER'),
  );

  const sectionGroups = ACADEMIC_STAGES.map((stage) => ({
    stage,
    items: sections.filter((section) => section.stage === stage),
  })).filter((group) => group.items.length > 0);

  if (tabs.length === 0) {
    return (
      <div>
        <Navbar />
        <div style={{ maxWidth: '900px', margin: '0 auto', padding: '32px 20px' }}>
          <div className="glass-card" style={{ padding: '32px', textAlign: 'center' }}>
            <h1 style={{ fontSize: '20px', fontWeight: '800', marginBottom: '8px' }}>
              لا تملك صلاحية الوصول
            </h1>
            <p style={{ color: 'var(--text-secondary)' }}>
              هذه الصفحة متاحة لإدارة الشعب والمواد والتعيينات فقط.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh' }}>
      <Navbar />

      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '24px 20px 48px' }}>
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
              🎓
            </div>
            <h1 style={{ fontSize: '25px', fontWeight: '800', color: '#111827' }}>
              المراحل والمواد
            </h1>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
            إدارة الشعب والمواد الدراسية وإسناد المواد إلى المحاضرين والمحاضرين التقنيين.
          </p>
        </div>

        {/* Stage filter */}
        <div
          style={{
            display: 'flex',
            gap: '8px',
            flexWrap: 'wrap',
            alignItems: 'center',
            marginBottom: '18px',
          }}
        >
          <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-secondary)' }}>
            المرحلة:
          </span>
          <button
            type="button"
            className={`btn btn-sm ${stageFilter === '' ? 'btn-primary' : ''}`}
            onClick={() => setStageFilter('')}
            style={{ padding: '6px 14px', fontSize: '13px' }}
          >
            كل المراحل
          </button>
          {ACADEMIC_STAGES.map((stage) => (
            <button
              key={stage}
              type="button"
              className={`btn btn-sm ${stageFilter === String(stage) ? 'btn-primary' : ''}`}
              onClick={() => setStageFilter(String(stage))}
              style={{ padding: '6px 14px', fontSize: '13px' }}
            >
              {STAGE_LABELS[stage]}
            </button>
          ))}
        </div>

        {/* Tabs */}
        <div
          style={{
            display: 'flex',
            gap: '6px',
            borderBottom: '2px solid #E5E7EB',
            marginBottom: '20px',
            overflowX: 'auto',
          }}
        >
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              style={{
                background: 'transparent',
                border: 'none',
                borderBottom:
                  activeTab === tab.id ? '3px solid var(--gold)' : '3px solid transparent',
                padding: '10px 18px',
                fontSize: '15px',
                fontWeight: activeTab === tab.id ? '800' : '600',
                color: activeTab === tab.id ? '#111827' : 'var(--text-muted)',
                cursor: 'pointer',
                fontFamily: 'inherit',
                whiteSpace: 'nowrap',
              }}
            >
              {tab.label}
            </button>
          ))}
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

        {success && (
          <div
            style={{
              padding: '12px 16px',
              borderRadius: '12px',
              background: '#ECFDF5',
              border: '1px solid #A7F3D0',
              color: '#065F46',
              marginBottom: '16px',
              fontSize: '14px',
              fontWeight: '600',
              display: 'flex',
              justifyContent: 'space-between',
              gap: '12px',
            }}
          >
            <span>✅ {success}</span>
            <button
              type="button"
              onClick={() => setSuccess(null)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#065F46' }}
            >
              ✕
            </button>
          </div>
        )}

        {loading ? (
          <div className="empty-state">
            <p style={{ color: 'var(--text-muted)' }}>جاري التحميل...</p>
          </div>
        ) : activeTab === 'sections' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            {canManageSections && (
              <form
                className="glass-card"
                onSubmit={handleCreateSection}
                style={{ padding: '18px' }}
              >
                <h2 style={{ fontSize: '16px', fontWeight: '800', marginBottom: '12px' }}>
                  إضافة شعبة
                </h2>
                <div className="academics-form-grid">
                  <div>
                    <label className="academics-label">المرحلة</label>
                    <select
                      className="input"
                      value={sectionForm.stage}
                      onChange={(e) =>
                        setSectionForm((form) => ({ ...form, stage: Number(e.target.value) }))
                      }
                    >
                      {STAGE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="academics-label">نوع الدراسة</label>
                    <select
                      className="input"
                      value={sectionForm.studyPeriod}
                      onChange={(e) =>
                        setSectionForm((form) => ({ ...form, studyPeriod: e.target.value }))
                      }
                    >
                      {STUDY_PERIODS.map((period) => (
                        <option key={period.value} value={period.value}>
                          {period.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="academics-label">اسم / رقم الشعبة</label>
                    <input
                      className="input"
                      value={sectionForm.name}
                      onChange={(e) =>
                        setSectionForm((form) => ({ ...form, name: e.target.value }))
                      }
                      placeholder="مثال: A"
                      required
                      maxLength={40}
                    />
                  </div>
                  <div>
                    <label className="academics-label">الوصف (اختياري)</label>
                    <input
                      className="input"
                      value={sectionForm.label}
                      onChange={(e) =>
                        setSectionForm((form) => ({ ...form, label: e.target.value }))
                      }
                      placeholder="مثال: الشعبة A"
                      maxLength={80}
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={actionLoading}
                  style={{ marginTop: '12px' }}
                >
                  {actionLoading ? 'جارٍ الحفظ...' : 'إضافة الشعبة'}
                </button>
              </form>
            )}

            {sections.length === 0 ? (
              <div className="empty-state">
                <p style={{ color: 'var(--text-muted)' }}>لا توجد شعب مطابقة.</p>
              </div>
            ) : (
              sectionGroups.map((group) => (
                <div key={group.stage}>
                  <h2
                    style={{
                      fontSize: '15px',
                      fontWeight: '800',
                      color: 'var(--text-secondary)',
                      marginBottom: '8px',
                    }}
                  >
                    {STAGE_LABELS[group.stage as 1 | 2 | 3 | 4]} ({group.items.length})
                  </h2>
                  <div className="academics-card-grid">
                    {group.items.map((section) =>
                      editSection?.id === section.id ? (
                        <form
                          key={section.id}
                          className="glass-card"
                          onSubmit={handleSaveSection}
                          style={{ padding: '16px' }}
                        >
                          <label className="academics-label">اسم الشعبة</label>
                          <input
                            className="input"
                            value={editSection.name}
                            onChange={(e) =>
                              setEditSection({ ...editSection, name: e.target.value })
                            }
                            required
                          />
                          <label className="academics-label" style={{ marginTop: '8px' }}>
                            الوصف
                          </label>
                          <input
                            className="input"
                            value={editSection.label}
                            onChange={(e) =>
                              setEditSection({ ...editSection, label: e.target.value })
                            }
                          />
                          <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                            <button
                              type="submit"
                              className="btn btn-primary btn-sm"
                              disabled={actionLoading}
                            >
                              حفظ
                            </button>
                            <button
                              type="button"
                              className="btn btn-sm"
                              onClick={() => setEditSection(null)}
                            >
                              إلغاء
                            </button>
                          </div>
                        </form>
                      ) : (
                        <div
                          key={section.id}
                          className="glass-card"
                          style={{ padding: '16px' }}
                        >
                          <div
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              gap: '10px',
                              alignItems: 'flex-start',
                            }}
                          >
                            <div style={{ minWidth: 0 }}>
                              <div style={{ fontSize: '17px', fontWeight: '800' }}>
                                شعبة {section.name}
                              </div>
                              <div style={{ fontSize: '12.5px', color: 'var(--text-muted)' }}>
                                {section.label || '—'} · {PERIOD_LABELS[section.studyPeriod] || section.studyPeriod}
                              </div>
                            </div>
                            <span className="academics-pill">
                              {section.studentCount ?? 0} طالب
                            </span>
                          </div>
                          {canManageSections && (
                            <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                              <button
                                type="button"
                                className="btn btn-sm"
                                onClick={() =>
                                  setEditSection({
                                    id: section.id,
                                    name: section.name,
                                    label: section.label || '',
                                  })
                                }
                              >
                                تعديل
                              </button>
                              <button
                                type="button"
                                className="btn btn-sm"
                                style={{ color: '#B91C1C' }}
                                onClick={() => handleDeleteSection(section)}
                              >
                                حذف
                              </button>
                            </div>
                          )}
                        </div>
                      ),
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        ) : activeTab === 'courses' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            {canManageCourses && (
              <form
                className="glass-card"
                onSubmit={handleCreateCourse}
                style={{ padding: '18px' }}
              >
                <h2 style={{ fontSize: '16px', fontWeight: '800', marginBottom: '12px' }}>
                  إضافة مادة
                </h2>
                <div className="academics-form-grid">
                  <div>
                    <label className="academics-label">رمز المادة</label>
                    <input
                      className="input"
                      value={courseForm.code}
                      onChange={(e) =>
                        setCourseForm((form) => ({ ...form, code: e.target.value }))
                      }
                      placeholder="مثال: MLT201"
                      required
                      maxLength={40}
                    />
                  </div>
                  <div>
                    <label className="academics-label">اسم المادة</label>
                    <input
                      className="input"
                      value={courseForm.name}
                      onChange={(e) =>
                        setCourseForm((form) => ({ ...form, name: e.target.value }))
                      }
                      placeholder="مثال: علم الدم"
                      required
                      maxLength={200}
                    />
                  </div>
                  <div>
                    <label className="academics-label">المرحلة</label>
                    <select
                      className="input"
                      value={courseForm.stage}
                      onChange={(e) =>
                        setCourseForm((form) => ({ ...form, stage: Number(e.target.value) }))
                      }
                    >
                      {STAGE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="academics-label">وصف (اختياري)</label>
                    <input
                      className="input"
                      value={courseForm.description}
                      onChange={(e) =>
                        setCourseForm((form) => ({ ...form, description: e.target.value }))
                      }
                      maxLength={500}
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={actionLoading}
                  style={{ marginTop: '12px' }}
                >
                  {actionLoading ? 'جارٍ الحفظ...' : 'إضافة المادة'}
                </button>
              </form>
            )}

            {courses.length === 0 ? (
              <div className="empty-state">
                <p style={{ color: 'var(--text-muted)' }}>لا توجد مواد مطابقة.</p>
              </div>
            ) : (
              <div className="academics-card-grid">
                {courses.map((course) =>
                  editCourse?.id === course.id ? (
                    <form
                      key={course.id}
                      className="glass-card"
                      onSubmit={handleSaveCourse}
                      style={{ padding: '16px' }}
                    >
                      <label className="academics-label">رمز المادة</label>
                      <input
                        className="input"
                        value={editCourse.code}
                        onChange={(e) => setEditCourse({ ...editCourse, code: e.target.value })}
                        required
                      />
                      <label className="academics-label" style={{ marginTop: '8px' }}>
                        اسم المادة
                      </label>
                      <input
                        className="input"
                        value={editCourse.name}
                        onChange={(e) => setEditCourse({ ...editCourse, name: e.target.value })}
                        required
                      />
                      <label className="academics-label" style={{ marginTop: '8px' }}>
                        الوصف
                      </label>
                      <input
                        className="input"
                        value={editCourse.description}
                        onChange={(e) =>
                          setEditCourse({ ...editCourse, description: e.target.value })
                        }
                      />
                      <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                        <button
                          type="submit"
                          className="btn btn-primary btn-sm"
                          disabled={actionLoading}
                        >
                          حفظ
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm"
                          onClick={() => setEditCourse(null)}
                        >
                          إلغاء
                        </button>
                      </div>
                    </form>
                  ) : (
                    <div key={course.id} className="glass-card" style={{ padding: '16px' }}>
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          gap: '10px',
                          alignItems: 'flex-start',
                        }}
                      >
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: '17px', fontWeight: '800' }}>{course.name}</div>
                          <div style={{ fontSize: '12.5px', color: 'var(--text-muted)' }}>
                            <bdi dir="ltr">{course.code}</bdi> · {stageLabel(course.stage)}
                          </div>
                          {course.description && (
                            <p
                              style={{
                                fontSize: '12.5px',
                                color: 'var(--text-secondary)',
                                marginTop: '6px',
                              }}
                            >
                              {course.description}
                            </p>
                          )}
                        </div>
                        <span className="academics-pill">{course.stage}</span>
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '8px' }}>
                        محاضرات: {course._count?.lectures ?? 0} · تعيينات:{' '}
                        {course._count?.assignments ?? 0}
                      </div>
                      {canManageCourses && (
                        <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                          <button
                            type="button"
                            className="btn btn-sm"
                            onClick={() =>
                              setEditCourse({
                                id: course.id,
                                code: course.code,
                                name: course.name,
                                description: course.description || '',
                              })
                            }
                          >
                            تعديل
                          </button>
                          <button
                            type="button"
                            className="btn btn-sm"
                            style={{ color: '#B91C1C' }}
                            onClick={() => handleDeleteCourse(course)}
                          >
                            حذف
                          </button>
                        </div>
                      )}
                    </div>
                  ),
                )}
              </div>
            )}
          </div>
        ) : activeTab === 'timetable' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            {canManageTimetable && (
              <form
                className="glass-card"
                onSubmit={handleCreateTimetableEntry}
                style={{ padding: '18px' }}
              >
                <h2 style={{ fontSize: '16px', fontWeight: '800', marginBottom: '6px' }}>
                  إضافة موعد إلى الجدول
                </h2>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '12px', lineHeight: 1.7 }}>
                  الجدول يحدد يوم ووقت محاضرة كل مادة لكل شعبة. يُستخدم للسماح للطالب بالحضور
                  في محاضرة شعبة أخرى للمادة نفسها (الموازي) مع تسجيل حضوره بملاحظة بدل الغياب.
                </p>
                <div className="academics-form-grid">
                  <div>
                    <label className="academics-label">المادة</label>
                    <select
                      className="input"
                      value={timetableForm.courseId}
                      onChange={(e) =>
                        setTimetableForm((form) => ({
                          ...form,
                          courseId: e.target.value,
                          sectionId: '',
                        }))
                      }
                      required
                    >
                      <option value="">اختر المادة</option>
                      {courses.map((course) => (
                        <option key={course.id} value={course.id}>
                          {course.code} — {course.name} ({stageLabel(course.stage)})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="academics-label">الشعبة</label>
                    <select
                      className="input"
                      value={timetableForm.sectionId}
                      onChange={(e) =>
                        setTimetableForm((form) => ({ ...form, sectionId: e.target.value }))
                      }
                      required
                    >
                      <option value="">اختر الشعبة</option>
                      {sections
                        .filter(
                          (section) =>
                            timetableFormCourseStage === null ||
                            section.stage === timetableFormCourseStage,
                        )
                        .map((section) => (
                          <option key={section.id} value={section.id}>
                            شعبة {section.name} — {stageLabel(section.stage)} (
                            {section.studyPeriod === 'EVENING' ? 'مسائية' : 'صباحية'})
                          </option>
                        ))}
                    </select>
                  </div>
                  <div>
                    <label className="academics-label">اليوم</label>
                    <select
                      className="input"
                      value={timetableForm.dayOfWeek}
                      onChange={(e) =>
                        setTimetableForm((form) => ({ ...form, dayOfWeek: Number(e.target.value) }))
                      }
                    >
                      {TIMETABLE_DAYS.map((day) => (
                        <option key={day.value} value={day.value}>
                          {day.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <div style={{ flex: 1 }}>
                      <label className="academics-label">من</label>
                      <input
                        type="time"
                        className="input"
                        value={timetableForm.startTime}
                        onChange={(e) =>
                          setTimetableForm((form) => ({ ...form, startTime: e.target.value }))
                        }
                        required
                      />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label className="academics-label">إلى</label>
                      <input
                        type="time"
                        className="input"
                        value={timetableForm.endTime}
                        onChange={(e) =>
                          setTimetableForm((form) => ({ ...form, endTime: e.target.value }))
                        }
                        required
                      />
                    </div>
                  </div>
                </div>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ marginTop: '14px' }}
                  disabled={actionLoading}
                >
                  إضافة الموعد
                </button>
              </form>
            )}

            <div className="glass-card" style={{ padding: '18px' }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '12px',
                  marginBottom: '12px',
                }}
              >
                <h2 style={{ fontSize: '16px', fontWeight: '800' }}>
                  الجدول الدراسي ({timetableEntries.length})
                </h2>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <select
                    className="input"
                    style={{ width: 'auto' }}
                    value={timetableFilter.courseId}
                    onChange={(e) =>
                      setTimetableFilter((filter) => ({ ...filter, courseId: e.target.value }))
                    }
                  >
                    <option value="">كل المواد</option>
                    {courses.map((course) => (
                      <option key={course.id} value={course.id}>
                        {course.code} — {course.name}
                      </option>
                    ))}
                  </select>
                  <select
                    className="input"
                    style={{ width: 'auto' }}
                    value={timetableFilter.sectionId}
                    onChange={(e) =>
                      setTimetableFilter((filter) => ({ ...filter, sectionId: e.target.value }))
                    }
                  >
                    <option value="">كل الشعب</option>
                    {sections.map((section) => (
                      <option key={section.id} value={section.id}>
                        شعبة {section.name} ({section.studyPeriod === 'EVENING' ? 'مسائية' : 'صباحية'})
                      </option>
                    ))}
                  </select>
                  <select
                    className="input"
                    style={{ width: 'auto' }}
                    value={timetableFilter.dayOfWeek}
                    onChange={(e) =>
                      setTimetableFilter((filter) => ({ ...filter, dayOfWeek: e.target.value }))
                    }
                  >
                    <option value="">كل الأيام</option>
                    {TIMETABLE_DAYS.map((day) => (
                      <option key={day.value} value={day.value}>
                        {day.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {timetableEntries.length === 0 ? (
                <div className="empty-state">
                  <p style={{ color: 'var(--text-muted)' }}>
                    لا توجد مواعيد في الجدول. أضف أول موعد من النموذج أعلاه.
                  </p>
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table className="attendance-table" style={{ fontSize: '13px' }}>
                    <thead>
                      <tr>
                        <th>المادة</th>
                        <th>الشعبة</th>
                        <th>اليوم</th>
                        <th style={{ textAlign: 'center' }}>من</th>
                        <th style={{ textAlign: 'center' }}>إلى</th>
                        <th>المرحلة</th>
                        {canManageTimetable && <th style={{ textAlign: 'center' }}>حذف</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {timetableEntries.map((entry) => (
                        <tr key={entry.id}>
                          <td style={{ fontWeight: '700' }}>
                            <bdi dir="ltr">{entry.course.code}</bdi> — {entry.course.name}
                          </td>
                          <td>
                            شعبة {entry.section.name}{' '}
                            {entry.section.studyPeriod === 'EVENING' ? '(مساء)' : '(صباح)'}
                          </td>
                          <td>{entry.dayLabel}</td>
                          <td style={{ textAlign: 'center' }} dir="ltr">
                            {entry.startTime}
                          </td>
                          <td style={{ textAlign: 'center' }} dir="ltr">
                            {entry.endTime}
                          </td>
                          <td>{stageLabel(entry.course.stage)}</td>
                          {canManageTimetable && (
                            <td style={{ textAlign: 'center' }}>
                              <button
                                type="button"
                                className="btn btn-sm"
                                style={{ color: '#B91C1C' }}
                                onClick={() => handleDeleteTimetableEntry(entry)}
                              >
                                حذف
                              </button>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            {canManageAssignments && (
              <form
                className="glass-card"
                onSubmit={handleCreateAssignment}
                style={{ padding: '18px' }}
              >
                <h2 style={{ fontSize: '16px', fontWeight: '800', marginBottom: '12px' }}>
                  إسناد مادة إلى محاضر
                </h2>
                <div className="academics-form-grid">
                  <div>
                    <label className="academics-label">المحاضر</label>
                    <select
                      className="input"
                      value={assignmentForm.staffUserId}
                      onChange={(e) =>
                        setAssignmentForm((form) => ({
                          ...form,
                          staffUserId: e.target.value,
                        }))
                      }
                      required
                    >
                      <option value="">اختر المحاضر...</option>
                      {assignableStaff.map((member) => (
                        <option key={member.id} value={member.id}>
                          {member.fullName} ({member.staffId}) — {ROLE_LABELS[member.role]}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="academics-label">المادة</label>
                    <select
                      className="input"
                      value={assignmentForm.courseId}
                      onChange={(e) =>
                        setAssignmentForm((form) => ({ ...form, courseId: e.target.value }))
                      }
                      required
                    >
                      <option value="">اختر المادة...</option>
                      {courses.map((course) => (
                        <option key={course.id} value={course.id}>
                          {stageLabel(course.stage)} — {course.code} — {course.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                {assignableStaff.length === 0 && (
                  <p style={{ color: '#B45309', fontSize: '13px', marginTop: '10px' }}>
                    لا يوجد محاضرون أو محاضرون تقنيون نشطون. أضفهم من صفحة الموظفين أولاً.
                  </p>
                )}
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={actionLoading || assignableStaff.length === 0}
                  style={{ marginTop: '12px' }}
                >
                  {actionLoading ? 'جارٍ الحفظ...' : 'إسناد المادة'}
                </button>
              </form>
            )}

            {visibleAssignments.length === 0 ? (
              <div className="empty-state">
                <p style={{ color: 'var(--text-muted)' }}>لا توجد تعيينات مطابقة.</p>
              </div>
            ) : (
              <div className="academics-card-grid">
                {visibleAssignments.map((assignment) => (
                  <div key={assignment.id} className="glass-card" style={{ padding: '16px' }}>
                    <div style={{ fontSize: '16px', fontWeight: '800' }}>
                      {assignment.staffUser.fullName}
                    </div>
                    <div style={{ fontSize: '12.5px', color: 'var(--text-muted)', marginTop: '2px' }}>
                      {ROLE_LABELS[assignment.staffUser.role as StaffRole] ||
                        assignment.staffUser.role}{' '}
                      · <bdi dir="ltr">{assignment.staffUser.staffId}</bdi>
                      {!assignment.staffUser.isActive && ' · موقوف'}
                    </div>
                    <div
                      style={{
                        marginTop: '10px',
                        padding: '8px 10px',
                        borderRadius: '10px',
                        background: '#F9FAFB',
                        border: '1px solid #E5E7EB',
                        fontSize: '13px',
                      }}
                    >
                      {stageLabel(assignment.course.stage)} —{' '}
                      <bdi dir="ltr">{assignment.course.code}</bdi> — {assignment.course.name}
                    </div>
                    {canManageAssignments && (
                      <button
                        type="button"
                        className="btn btn-sm"
                        style={{ color: '#B91C1C', marginTop: '12px' }}
                        onClick={() => handleDeleteAssignment(assignment)}
                      >
                        إلغاء الإسناد
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <style jsx>{`
        .academics-form-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 12px;
        }
        .academics-label {
          display: block;
          margin-bottom: 4px;
          font-size: 12.5px;
          font-weight: 700;
          color: #374151;
        }
        .academics-card-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
          gap: 14px;
        }
        .academics-pill {
          display: inline-flex;
          align-items: center;
          padding: 3px 10px;
          border-radius: 999px;
          background: #FEF3C7;
          border: 1px solid #FCD34D;
          color: #92400E;
          font-size: 12px;
          font-weight: 700;
          white-space: nowrap;
        }
        @media (max-width: 900px) {
          .academics-form-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }
        @media (max-width: 560px) {
          .academics-form-grid {
            grid-template-columns: minmax(0, 1fr);
          }
          .academics-card-grid {
            grid-template-columns: minmax(0, 1fr);
          }
        }
      `}</style>
    </div>
  );
}
