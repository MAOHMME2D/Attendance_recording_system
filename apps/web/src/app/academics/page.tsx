'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
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
  type DeleteDependencies,
  type ManagedStaff,
  type SectionItem,
  type StaffRole,
  type TimetableInput,
  type TimetableItem,
} from '../../lib/api';
import { useAuth, PERMISSIONS, ROLE_LABELS } from '../../lib/auth';
import CollapsibleSection from '../../components/ui/CollapsibleSection';
import DeleteGuardModal from '../../components/modals/DeleteGuardModal';

type Tab = 'sections' | 'courses' | 'assignments' | 'timetable';

const PERIOD_LABELS: Record<string, string> = {
  MORNING: 'صباحي',
  EVENING: 'مسائي',
};

// ---------- Timetable Excel import helpers ----------
const ARABIC_DIGITS = '٠١٢٣٤٥٦٧٨٩';
const PERSIAN_DIGITS = '۰۱۲۳۴۵۶۷۸۹';

function normalizeDigits(value: string): string {
  return value
    .split('')
    .map((ch) => {
      const ar = ARABIC_DIGITS.indexOf(ch);
      if (ar >= 0) return String(ar);
      const fa = PERSIAN_DIGITS.indexOf(ch);
      if (fa >= 0) return String(fa);
      return ch;
    })
    .join('');
}

function normalizeKey(value: unknown): string {
  return normalizeDigits(String(value ?? '')).trim().toUpperCase();
}

function parseTimeValue(raw: unknown): string | null {
  if (raw == null) return null;
  if (typeof raw === 'number') {
    // Excel time cells may arrive as a fraction of a day.
    if (raw >= 0 && raw < 1) {
      const totalMinutes = Math.round(raw * 24 * 60);
      const hour = Math.floor(totalMinutes / 60) % 24;
      const minute = totalMinutes % 60;
      return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
    }
    return null;
  }
  const text = normalizeDigits(String(raw)).trim();
  if (!text) return null;
  let meridiem: 'AM' | 'PM' | null = null;
  if (/(ص|صباح)/.test(text)) meridiem = 'AM';
  else if (/(م|مساء)/.test(text)) meridiem = 'PM';
  else if (/am/i.test(text)) meridiem = 'AM';
  else if (/pm/i.test(text)) meridiem = 'PM';
  const match = text.match(/(\d{1,2})\s*[:.٫]\s*(\d{2})/);
  if (!match) return null;
  let hour = Number(match[1]);
  const minute = Number(match[2]);
  if (minute > 59) return null;
  if (meridiem === 'PM' && hour < 12) hour += 12;
  if (meridiem === 'AM' && hour === 12) hour = 0;
  if (hour > 23) return null;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function parseDayValue(raw: unknown): number | null {
  if (raw == null) return null;
  if (typeof raw === 'number' && Number.isFinite(raw) && raw >= 0 && raw <= 6) {
    return Math.trunc(raw);
  }
  const text = normalizeDigits(String(raw)).trim();
  if (/^\d+$/.test(text)) {
    const numeric = Number(text);
    if (numeric >= 0 && numeric <= 6) return numeric;
    return null;
  }
  const exact = TIMETABLE_DAYS.find((day) => day.label === text);
  if (exact) return exact.value;
  const fuzzy = TIMETABLE_DAYS.find((day) => text.includes(day.label));
  return fuzzy ? fuzzy.value : null;
}

function parseStageValue(raw: unknown): number | null {
  if (raw == null) return null;
  if (typeof raw === 'number' && Number.isFinite(raw) && raw >= 1 && raw <= 4) {
    return Math.trunc(raw);
  }
  const text = normalizeDigits(String(raw));
  const digit = text.match(/[1-4]/);
  if (digit) return Number(digit[0]);
  if (/أولى|اولى/.test(text)) return 1;
  if (/ثانية/.test(text)) return 2;
  if (/ثالثة/.test(text)) return 3;
  if (/رابعة/.test(text)) return 4;
  return null;
}

type TimetableImportRowStatus = 'ok' | 'exists' | 'error';

interface TimetableImportRow {
  index: number;
  courseCode: string;
  courseName: string;
  sectionLabel: string;
  periodLabel: string;
  dayLabel: string;
  type?: string;
  typeLabel?: string;
  startTime: string;
  endTime: string;
  hall?: string;
  status: TimetableImportRowStatus;
  message: string;
  courseId?: string;
  sectionId?: string;
  dayOfWeek?: number;
}

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

  // Pre-flight check before deleting a section/course: the modal lists every
  // blocker that has to be removed first before the user can confirm.
  const [deleteGuard, setDeleteGuard] = useState<{
    kind: 'section' | 'course';
    id: string;
    name: string;
    meta?: string;
  } | null>(null);
  const [deleteDeps, setDeleteDeps] = useState<DeleteDependencies | null>(null);
  const [deleteDepsLoading, setDeleteDepsLoading] = useState(false);
  const [deleteDepsError, setDeleteDepsError] = useState<string | null>(null);

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
    type: 'THEORETICAL',
    hall: '',
  });
  const [timetableFilter, setTimetableFilter] = useState<{
    courseId: string;
    sectionId: string;
    dayOfWeek: string;
    type: string;
  }>({ courseId: '', sectionId: '', dayOfWeek: '', type: '' });
  const [editTimetableId, setEditTimetableId] = useState<string | null>(null);
  const [timetableFormOpen, setTimetableFormOpen] = useState(true);

  // Open the (possibly collapsed) form automatically when the user starts editing a row.
  useEffect(() => {
    if (editTimetableId) setTimetableFormOpen(true);
  }, [editTimetableId]);

  // Collapse the long form by default on phones (same behavior as the other add sections).
  useEffect(() => {
    if (typeof window !== 'undefined' && window.innerWidth <= 720) {
      setTimetableFormOpen(false);
    }
  }, []);

  const timetableFileRef = useRef<HTMLInputElement>(null);
  const [timetableImportOpen, setTimetableImportOpen] = useState(false);
  const [timetableImportRows, setTimetableImportRows] = useState<TimetableImportRow[] | null>(null);
  const [timetableImportError, setTimetableImportError] = useState<string | null>(null);
  const [timetableImportLoading, setTimetableImportLoading] = useState(false);

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
    type: 'THEORETICAL',
  });
  const [editCourse, setEditCourse] = useState<{
    id: string;
    code: string;
    name: string;
    description: string;
    type: string;
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
      const [rawEntries, courseData, sectionData] = await Promise.all([
        timetableApi.getAll({
          courseId: timetableFilter.courseId || undefined,
          sectionId: timetableFilter.sectionId || undefined,
          dayOfWeek: timetableFilter.dayOfWeek === '' ? undefined : Number(timetableFilter.dayOfWeek),
        }),
        courseApi.getAll(),
        sectionApi.getAll(),
      ]);
      const filteredEntries = timetableFilter.type
        ? rawEntries.filter((e) => (e.type || 'THEORETICAL') === timetableFilter.type)
        : rawEntries;
      setTimetableEntries(filteredEntries);
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

  // ---------------- Delete guard (pre-flight check) ----------------
  // Clicking «حذف» never deletes directly: a modal appears that first lists
  // everything still linked to the entity and what has to be removed, then
  // asks for confirmation only when nothing blocks the deletion.
  const openDeleteGuard = (
    kind: 'section' | 'course',
    id: string,
    name: string,
    meta?: string,
  ) => {
    setDeleteGuard({ kind, id, name, meta });
    setDeleteDeps(null);
    setDeleteDepsError(null);
    setDeleteDepsLoading(true);
    const fetcher =
      kind === 'section' ? sectionApi.dependencies : courseApi.dependencies;
    fetcher(id)
      .then((deps) => setDeleteDeps(deps))
      .catch((err) => setDeleteDepsError(errorMessage(err)))
      .finally(() => setDeleteDepsLoading(false));
  };

  const closeDeleteGuard = () => {
    if (actionLoading) return;
    setDeleteGuard(null);
    setDeleteDeps(null);
    setDeleteDepsError(null);
  };

  const confirmGuardedDelete = () => {
    if (!deleteGuard || !deleteDeps?.canDelete || actionLoading) return;
    const { kind, id } = deleteGuard;
    setActionLoading(true);
    setError(null);
    (async () => {
      try {
        if (kind === 'section') {
          await sectionApi.delete(id);
          setSuccess('تم حذف الشعبة بنجاح');
          await loadSections();
        } else {
          await courseApi.delete(id);
          setSuccess('تم حذف المادة بنجاح');
          await loadCourses();
        }
        setDeleteGuard(null);
        setDeleteDeps(null);
        setDeleteDepsError(null);
      } catch (err) {
        // The guard may be stale (something was created while the modal was
        // open). Show the error and refresh the blockers list.
        setDeleteDepsError(errorMessage(err));
        try {
          const fetcher =
            kind === 'section' ? sectionApi.dependencies : courseApi.dependencies;
          setDeleteDeps(await fetcher(id));
        } catch {
          // keep the error visible
        }
      } finally {
        setActionLoading(false);
      }
    })();
  };

  const handleDeleteSection = (section: SectionItem) => {
    const meta: string[] = [];
    if (section.stage) meta.push(`المرحلة ${section.stage}`);
    if (section.studyPeriod)
      meta.push(section.studyPeriod === 'EVENING' ? 'مسائي' : 'صباحي');
    openDeleteGuard(
      'section',
      section.id,
      `الشعبة «${section.label || section.name}»`,
      meta.join(' · '),
    );
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
        type: courseForm.type || 'THEORETICAL',
      });
      setCourseForm((form) => ({ ...form, code: '', name: '', description: '', type: 'THEORETICAL' }));
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
        type: editCourse.type || 'THEORETICAL',
      });
      setEditCourse(null);
      await loadCourses();
    }, 'تم تحديث المادة بنجاح');
  };

  const handleDeleteCourse = (course: CourseItem) => {
    openDeleteGuard(
      'course',
      course.id,
      `${course.code} — ${course.name}`,
      course.stage ? `المرحلة ${course.stage}` : undefined,
    );
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
      if (editTimetableId) {
        await timetableApi.update(editTimetableId, timetableForm);
      } else {
        await timetableApi.create(timetableForm);
      }
      setTimetableForm((form) => ({ ...form, courseId: '', sectionId: '' }));
      setEditTimetableId(null);
      await loadTimetable();
    }, editTimetableId ? 'تم تحديث موعد الجدول' : 'تم إضافة الموعد إلى الجدول');
  };

  const startEditTimetableEntry = (entry: TimetableItem) => {
    setEditTimetableId(entry.id);
    setTimetableForm({
      courseId: entry.course.id,
      sectionId: entry.section.id,
      dayOfWeek: entry.dayOfWeek,
      startTime: entry.startTime,
      endTime: entry.endTime,
      type: entry.type || 'THEORETICAL',
      hall: entry.hall || '',
    });
    setError(null);
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const cancelEditTimetable = () => {
    setEditTimetableId(null);
    setTimetableForm((form) => ({ ...form, courseId: '', sectionId: '', type: 'THEORETICAL', hall: '' }));
  };

  const handleExportTimetableExcel = () => {
    if (timetableEntries.length === 0) {
      setError('لا توجد مواعيد في الجدول لتصديرها');
      return;
    }
    const rows = timetableEntries.map((entry, index) => ({
      'ت': index + 1,
      'المادة': `${entry.course.code} — ${entry.course.name}`,
      'النوع': (entry.type === 'PRACTICAL' || entry.typeLabel === 'عملي') ? 'عملي' : 'نظري',
      'المرحلة': stageLabel(entry.course.stage),
      'الشعبة': entry.section.name,
      'القاعة': entry.hall || '—',
      'الدراسة': entry.section.studyPeriod === 'EVENING' ? 'مسائية' : 'صباحية',
      'اليوم': entry.dayLabel,
      'من': entry.startTime,
      'إلى': entry.endTime,
    }));
    const worksheet = XLSX.utils.json_to_sheet(rows);
    worksheet['!cols'] = [
      { wch: 6 },
      { wch: 34 },
      { wch: 10 },
      { wch: 12 },
      { wch: 10 },
      { wch: 10 },
      { wch: 12 },
      { wch: 9 },
      { wch: 9 },
    ];
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'الجدول الدراسي');
    XLSX.writeFile(
      workbook,
      `الجدول_الدراسي_${new Date().toISOString().slice(0, 10)}.xlsx`,
    );
  };

  // ---------------- Timetable Excel import ----------------
  const buildTimetableImportRows = (grid: unknown[][]): TimetableImportRow[] => {
    const header = (grid[0] || []).map((cell) => String(cell ?? '').trim());
    const hasHeader = header.some((cell) => /المادة|الشعبة|اليوم|المرحلة|الدراسة/.test(cell));
    const colIndex = (matchers: RegExp[], fallback: number): number => {
      if (!hasHeader) return fallback;
      const found = header.findIndex((cell) => matchers.some((re) => re.test(cell)));
      return found >= 0 ? found : fallback;
    };
    const col = {
      course: colIndex([/المادة|مادة|course/i], 1),
      type: colIndex([/النوع|نوع|type/i], -1),
      stage: colIndex([/المرحلة|stage/i], 2),
      section: colIndex([/الشعبة|شعبة|section/i], 3),
      hall: colIndex([/القاعة|قاعة|المختبر|مختبر|hall|room/i], -1),
      period: colIndex([/الدراسة|صباحي|مسائي|period/i], 4),
      day: colIndex([/اليوم|day/i], 5),
      start: colIndex([/من|البداية|start/i], 6),
      end: colIndex([/إلى|النهاية|end/i], 7),
    };
    const startRow = hasHeader ? 1 : 0;

    const seen = new Set<string>();
    const rows: TimetableImportRow[] = [];

    for (let i = startRow; i < grid.length; i += 1) {
      const rawRow = grid[i];
      if (!Array.isArray(rawRow)) continue;
      const cells = rawRow.map((cell) => (cell == null ? '' : String(cell).trim()));
      if (cells.every((cell) => cell === '')) continue;

      const courseText = col.course >= 0 ? cells[col.course] : '';
      const typeText = col.type >= 0 ? cells[col.type] : '';
      const stageText = col.stage >= 0 ? cells[col.stage] : '';
      const sectionText = col.section >= 0 ? cells[col.section] : '';
      const hallText = col.hall >= 0 ? cells[col.hall] : '';
      const periodText = col.period >= 0 ? cells[col.period] : '';
      const dayText = col.day >= 0 ? normalizeDigits(cells[col.day] ?? '') : '';

      const dashSplit = courseText.split(/[—–-]/);
      const courseCode = normalizeKey(dashSplit[0] || courseText);
      const startTime = parseTimeValue(col.start >= 0 ? rawRow[col.start] : undefined);
      const endTime = parseTimeValue(col.end >= 0 ? rawRow[col.end] : undefined);
      const dayOfWeek = parseDayValue(col.day >= 0 ? rawRow[col.day] : undefined);
      const wantStage = parseStageValue(stageText);
      const wantPeriod = /مسائ/.test(normalizeDigits(periodText))
        ? 'EVENING'
        : /صباح/.test(normalizeDigits(periodText))
          ? 'MORNING'
          : null;
      const wantType = /عملي|practical/i.test(typeText)
        ? 'PRACTICAL'
        : /نظري|theoretical/i.test(typeText)
          ? 'THEORETICAL'
          : undefined;

      const course = courses.find((item) => normalizeKey(item.code) === courseCode)
        || courses.find((item) => normalizeKey(item.name) === normalizeKey(courseText))
        || null;

      const sectionKey = normalizeKey(sectionText).replace(/^شعبة\s+/, '');
      let candidates = sections.filter(
        (section) =>
          normalizeKey(section.name) === sectionKey ||
          normalizeKey(section.label ?? '') === sectionKey,
      );
      if (wantPeriod) {
        candidates = candidates.filter(
          (section) => (section.studyPeriod || 'MORNING') === wantPeriod,
        );
      }
      if (wantStage) {
        candidates = candidates.filter((section) => Number(section.stage) === wantStage);
      }
      if (candidates.length > 1 && course) {
        const byCourseStage = candidates.filter(
          (section) => Number(section.stage) === Number(course.stage),
        );
        if (byCourseStage.length > 0) candidates = byCourseStage;
      }
      const section = candidates[0] ?? null;

      const errors: string[] = [];
      if (!course) errors.push('المادة غير موجودة (تحقق من رمز المادة)');
      if (!section) {
        errors.push(
          sections.length === 0
            ? 'لا توجد شعب محمّلة للتطابق معها'
            : 'الشعبة غير موجودة أو غير واضحة (أضف نوع الدراسة/المرحلة أو تحقق من الاسم)',
        );
      } else if (candidates.length > 1) {
        errors.push('تعذر تحديد الشعبة (هناك عدة شعب بنفس الاسم)');
      }
      if (dayOfWeek == null) errors.push('اليوم غير واضح (الأحد…السبت)');
      if (!startTime) errors.push('وقت البداية غير صالح');
      if (!endTime) errors.push('وقت النهاية غير صالح');
      if (startTime && endTime && startTime >= endTime) {
        errors.push('وقت النهاية يجب أن يكون بعد البداية');
      }

      const baseRow: TimetableImportRow = {
        index: i + 1,
        courseCode: course?.code || dashSplit[0]?.trim() || courseText || '—',
        courseName: course?.name || (dashSplit.length > 1 ? dashSplit.slice(1).join('—').trim() : ''),
        sectionLabel: section ? `شعبة ${section.name}` : sectionText || '—',
        periodLabel: wantPeriod === 'EVENING' ? 'مسائية' : wantPeriod === 'MORNING' ? 'صباحية' : periodText || '—',
        dayLabel: dayOfWeek != null ? TIMETABLE_DAYS.find((day) => day.value === dayOfWeek)?.label || String(dayOfWeek) : dayText || '—',
        type: wantType || course?.type || 'THEORETICAL',
        typeLabel: (wantType || course?.type) === 'PRACTICAL' ? 'عملي' : 'نظري',
        startTime: startTime || '—',
        endTime: endTime || '—',
        hall: hallText || undefined,
        status: 'error',
        message: '',
        courseId: course?.id,
        sectionId: section?.id,
        dayOfWeek: dayOfWeek ?? undefined,
      };

      if (errors.length > 0) {
        baseRow.status = 'error';
        baseRow.message = errors.join(' · ');
        rows.push(baseRow);
        continue;
      }

      const key = `${course!.id}|${section!.id}|${dayOfWeek}|${startTime}|${endTime}`;
      if (seen.has(key)) {
        baseRow.status = 'exists';
        baseRow.message = 'مكرر داخل الملف — سيتم تخطيه';
        rows.push(baseRow);
        continue;
      }
      seen.add(key);

      const existing = timetableEntries.find(
        (entry) =>
          entry.courseId === course!.id &&
          entry.sectionId === section!.id &&
          entry.dayOfWeek === dayOfWeek &&
          entry.startTime === startTime &&
          entry.endTime === endTime,
      );
      if (existing) {
        baseRow.status = 'exists';
        baseRow.message = 'موجود مسبقًا — سيتم تخطيه';
      } else {
        baseRow.status = 'ok';
        baseRow.message = 'جاهز للاستيراد';
      }
      rows.push(baseRow);
    }

    return rows;
  };

  const handleTimetableFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setTimetableImportError(null);

    const reader = new FileReader();
    reader.onload = (loadEvent) => {
      try {
        const workbook = XLSX.read(loadEvent.target?.result, { type: 'binary' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const grid = XLSX.utils.sheet_to_json<unknown[]>(firstSheet, { header: 1, defval: '' });
        const rows = buildTimetableImportRows(grid);
        if (rows.length === 0) {
          setTimetableImportError('لم يتم العثور على أي صفوف صالحة في الملف');
          setTimetableImportRows(null);
          return;
        }
        setTimetableImportRows(rows);
      } catch (err) {
        setTimetableImportError('فشل قراءة ملف الإكسل: ' + errorMessage(err));
        setTimetableImportRows(null);
      }
    };
    reader.readAsBinaryString(file);
  };

  const resetTimetableImport = () => {
    setTimetableImportRows(null);
    setTimetableImportError(null);
    if (timetableFileRef.current) timetableFileRef.current.value = '';
  };

  const closeTimetableImport = () => {
    setTimetableImportOpen(false);
    resetTimetableImport();
  };

  const handleConfirmTimetableImport = async () => {
    if (!timetableImportRows) return;
    const ready = timetableImportRows.filter((row) => row.status === 'ok');
    if (ready.length === 0) {
      setTimetableImportError('لا توجد صفوف جاهزة للاستيراد');
      return;
    }
    setTimetableImportLoading(true);
    setTimetableImportError(null);
    const failures: string[] = [];
    let created = 0;
    for (const row of ready) {
      try {
        await timetableApi.create({
          courseId: row.courseId!,
          sectionId: row.sectionId!,
          dayOfWeek: row.dayOfWeek!,
          startTime: row.startTime,
          endTime: row.endTime,
          type: row.type || 'THEORETICAL',
          hall: row.hall,
        });
        created += 1;
      } catch (err) {
        failures.push(`صف ${row.index}: ${errorMessage(err)}`);
      }
    }
    await loadTimetable();
    setTimetableImportLoading(false);
    if (failures.length > 0) {
      setTimetableImportError(`أُضيف ${created} موعد، وفشل ${failures.length}:\n${failures.join('\n')}`);
      return;
    }
    flashSuccess(`تم استيراد ${created} موعد بنجاح`);
    closeTimetableImport();
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
              🎓
            </div>
            <h1 style={{ fontSize: '25px', fontWeight: '800', color: '#111827' }}>
              المراحل والمواد
            </h1>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
            إدارة الشعب والمواد الدراسية وإسناد المواد إلى التدريسيين والتدريسيين الخارجيين.
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
              <CollapsibleSection
                title="إضافة شعبة"
                contentId="create-section-form"
                style={{ padding: '18px' }}
              >
                <form onSubmit={handleCreateSection}>
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
              </CollapsibleSection>
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
                            <div className="academics-card-actions" style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
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
              <CollapsibleSection
                title="إضافة مادة"
                contentId="create-course-form"
                style={{ padding: '18px' }}
              >
                <form onSubmit={handleCreateCourse}>
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
                  <div>
                    <label className="academics-label">نوع المادة</label>
                    <select
                      className="input"
                      value={courseForm.type}
                      onChange={(e) =>
                        setCourseForm((form) => ({ ...form, type: e.target.value }))
                      }
                    >
                      <option value="THEORETICAL">نظري</option>
                      <option value="PRACTICAL">عملي</option>
                      <option value="BOTH">نظري وعملي</option>
                    </select>
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
              </CollapsibleSection>
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
                      <label className="academics-label" style={{ marginTop: '8px' }}>
                        نوع المادة
                      </label>
                      <select
                        className="input"
                        value={editCourse.type}
                        onChange={(e) =>
                          setEditCourse({ ...editCourse, type: e.target.value })
                        }
                      >
                        <option value="THEORETICAL">نظري</option>
                        <option value="PRACTICAL">عملي</option>
                        <option value="BOTH">نظري وعملي</option>
                      </select>
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
                            <bdi dir="ltr">{course.code}</bdi> · {stageLabel(course.stage)} · {course.type === 'PRACTICAL' ? '🔬 عملي' : course.type === 'BOTH' ? '📚 نظري وعملي' : '📖 نظري'}
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
                        <div className="academics-card-actions" style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                          <button
                            type="button"
                            className="btn btn-sm"
                            onClick={() =>
                              setEditCourse({
                                id: course.id,
                                code: course.code,
                                name: course.name,
                                description: course.description || '',
                                type: course.type || 'THEORETICAL',
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
              <CollapsibleSection
                title={editTimetableId ? 'تعديل موعد في الجدول' : 'إضافة موعد إلى الجدول'}
                contentId="create-timetable-form"
                open={timetableFormOpen}
                onOpenChange={setTimetableFormOpen}
                style={{ padding: '18px' }}
              >
                <form onSubmit={handleCreateTimetableEntry}>
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
                  <div>
                    <label className="academics-label">النوع</label>
                    <select
                      className="input"
                      value={timetableForm.type || 'THEORETICAL'}
                      onChange={(e) =>
                        setTimetableForm((form) => ({ ...form, type: e.target.value }))
                      }
                    >
                      <option value="THEORETICAL">نظري</option>
                      <option value="PRACTICAL">عملي</option>
                    </select>
                  </div>
                  <div>
                    <label className="academics-label">القاعة / المختبر (اختياري)</label>
                    <input
                      className="input"
                      value={timetableForm.hall || ''}
                      onChange={(e) =>
                        setTimetableForm((form) => ({ ...form, hall: e.target.value }))
                      }
                      placeholder="مثال: قاعة 15 أو مختبر الكيمياء"
                      maxLength={100}
                    />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '14px' }}>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={actionLoading}
                  >
                    {editTimetableId ? 'حفظ التعديل' : 'إضافة الموعد'}
                  </button>
                  {editTimetableId && (
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={cancelEditTimetable}
                      disabled={actionLoading}
                    >
                      إلغاء التعديل
                    </button>
                  )}
                </div>
                </form>
              </CollapsibleSection>
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
                  {canManageTimetable && (
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={() => {
                        resetTimetableImport();
                        setTimetableImportOpen(true);
                      }}
                      title="استيراد المواعيد من ملف Excel (بنفس تنسيق ملف التنزيل)"
                      style={{ fontSize: '12.5px', fontWeight: '700' }}
                    >
                      ⬆️ استيراد الجدول (Excel)
                    </button>
                  )}
                  <button
                    type="button"
                    className="btn btn-sm"
                    onClick={handleExportTimetableExcel}
                    disabled={timetableEntries.length === 0}
                    title="تنزيل الجدول كملف Excel"
                    style={{ fontSize: '12.5px', fontWeight: '700' }}
                  >
                    ⬇️ تنزيل الجدول (Excel)
                  </button>
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
                  <select
                    className="input"
                    style={{ width: 'auto' }}
                    value={timetableFilter.type}
                    onChange={(e) =>
                      setTimetableFilter((filter) => ({ ...filter, type: e.target.value }))
                    }
                  >
                    <option value="">كل الأنواع</option>
                    <option value="THEORETICAL">📖 نظري فقط</option>
                    <option value="PRACTICAL">🔬 عملي فقط</option>
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
                        <th>النوع</th>
                        <th>الشعبة</th>
                        <th>القاعة</th>
                        <th>اليوم</th>
                        <th style={{ textAlign: 'center' }}>من</th>
                        <th style={{ textAlign: 'center' }}>إلى</th>
                        <th>المرحلة</th>
                        {canManageTimetable && <th style={{ textAlign: 'center' }}>إجراءات</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {timetableEntries.map((entry) => (
                        <tr key={entry.id}>
                          <td style={{ fontWeight: '700' }}>
                            <bdi dir="ltr">{entry.course.code}</bdi> — {entry.course.name}
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <span
                              style={{
                                display: 'inline-block',
                                padding: '2px 8px',
                                borderRadius: '6px',
                                fontSize: '12px',
                                fontWeight: '700',
                                backgroundColor: (entry.type === 'PRACTICAL' || entry.typeLabel === 'عملي') ? '#EDE9FE' : '#E0F2FE',
                                color: (entry.type === 'PRACTICAL' || entry.typeLabel === 'عملي') ? '#6D28D9' : '#0369A1',
                                border: `1px solid ${(entry.type === 'PRACTICAL' || entry.typeLabel === 'عملي') ? '#DDD6FE' : '#BAE6FD'}`,
                              }}
                            >
                              {(entry.type === 'PRACTICAL' || entry.typeLabel === 'عملي') ? '🔬 عملي' : '📖 نظري'}
                            </span>
                          </td>
                          <td>
                            شعبة {entry.section.name}{' '}
                            {entry.section.studyPeriod === 'EVENING' ? '(مساء)' : '(صباح)'}
                          </td>
                          <td style={{ textAlign: 'center', fontWeight: '600' }}>
                            {entry.hall || '—'}
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
                              <div style={{ display: 'flex', gap: '6px', justifyContent: 'center', flexWrap: 'wrap' }}>
                                <button
                                  type="button"
                                  className="btn btn-sm"
                                  onClick={() => startEditTimetableEntry(entry)}
                                  title="تعديل سريع لهذا الموعد"
                                >
                                  تعديل
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-sm"
                                  style={{ color: '#B91C1C' }}
                                  onClick={() => handleDeleteTimetableEntry(entry)}
                                >
                                  حذف
                                </button>
                              </div>
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
              <CollapsibleSection
                title="إسناد مادة إلى تدريسي"
                contentId="assign-course-form"
                style={{ padding: '18px' }}
              >
                <form onSubmit={handleCreateAssignment}>
                <div className="academics-form-grid">
                  <div>
                    <label className="academics-label">التدريسي</label>
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
                    لا يوجد تدريسيون أو تدريسيون خارجيون نشطون. أضفهم من صفحة الموظفين أولاً.
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
              </CollapsibleSection>
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

      {/* ======== Timetable Excel import modal ======== */}
      {timetableImportOpen && canManageTimetable && (
        <div
          className="modal-backdrop"
          onClick={() => {
            if (!timetableImportLoading) closeTimetableImport();
          }}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
            zIndex: 60,
          }}
        >
          <div
            className="glass-card"
            style={{
              background: '#FFFFFF',
              width: '100%',
              maxWidth: '760px',
              maxHeight: '88vh',
              overflowY: 'auto',
              padding: '20px',
              borderRadius: '18px',
              border: '1px solid #E5E7EB',
            }}
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="استيراد الجدول الدراسي من ملف Excel"
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px', marginBottom: '12px' }}>
              <div>
                <h2 style={{ fontSize: '18px', fontWeight: '800', color: '#111827', marginBottom: '4px' }}>
                  ⬆️ استيراد الجدول الدراسي (Excel)
                </h2>
                <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', lineHeight: 1.8 }}>
                  نفس تنسيق ملف «تنزيل الجدول (Excel)»: الأعمدة
                  <strong> المادة، المرحلة، الشعبة، الدراسة، اليوم، من، إلى</strong>.
                  تُطابق المواد برمزها والشعب برقمها مع الدراسة (صباحي/مسائي)، ويُتجاهل ما
                  هو موجود مسبقًا.
                </p>
              </div>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={closeTimetableImport}
                disabled={timetableImportLoading}
                aria-label="إغلاق"
                style={{ flexShrink: 0 }}
              >
                ✕
              </button>
            </div>

            <input
              ref={timetableFileRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleTimetableFileUpload}
              style={{ display: 'none' }}
              aria-hidden="true"
              tabIndex={-1}
            />

            {!timetableImportRows && (
              <button
                type="button"
                onClick={() => timetableFileRef.current?.click()}
                style={{
                  width: '100%',
                  padding: '28px 16px',
                  border: '1.5px dashed #D1D5DB',
                  borderRadius: '14px',
                  background: '#F9FAFB',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  textAlign: 'center',
                  transition: 'border-color 0.15s ease, background 0.15s ease',
                }}
              >
                <div style={{ fontSize: '30px', lineHeight: 1, marginBottom: '8px' }}>📄</div>
                <div style={{ fontWeight: '800', fontSize: '14px', color: '#111827' }}>
                  اختر ملف Excel للجدول
                </div>
                <div style={{ fontSize: '11.5px', color: '#6B7280', marginTop: '4px' }}>
                  .xlsx / .xls / .csv — يمكن ملؤه بتعديل ملف التنزيل السابق
                </div>
              </button>
            )}

            {timetableImportError && (
              <div
                role="alert"
                style={{
                  marginTop: '12px',
                  background: '#FEF2F2',
                  border: '1px solid #FCA5A5',
                  color: '#991B1B',
                  borderRadius: '12px',
                  padding: '10px 12px',
                  fontSize: '12px',
                  fontWeight: '600',
                  whiteSpace: 'pre-line',
                  lineHeight: 1.8,
                }}
              >
                {timetableImportError}
              </div>
            )}

            {timetableImportRows && (
              <>
                {(() => {
                  const ready = timetableImportRows.filter((row) => row.status === 'ok').length;
                  const skipped = timetableImportRows.length - ready;
                  const errors = timetableImportRows.filter((row) => row.status === 'error').length;
                  return (
                    <p style={{ fontSize: '12.5px', color: '#374151', margin: '12px 0 8px', fontWeight: '600' }}>
                      المعروض: <strong style={{ color: '#065F46' }}>{ready} جاهز للاستيراد</strong>
                      {skipped > 0 && <> · <strong style={{ color: '#92400E' }}>{skipped} سيتم تخطيه</strong></>}
                      {errors > 0 && <> · <strong style={{ color: '#B91C1C' }}>{errors} خطأ</strong></>}
                    </p>
                  );
                })()}

                <div className="attendance-scroll" style={{ maxHeight: '46vh', border: '1px solid #E5E7EB', borderRadius: '12px', marginBottom: '14px' }}>
                  <table className="attendance-table" style={{ fontSize: '12px', minWidth: '700px' }}>
                    <thead>
                      <tr>
                        <th style={{ width: '44px' }}>صف</th>
                        <th>المادة</th>
                        <th>النوع</th>
                        <th>الشعبة</th>
                        <th>القاعة</th>
                        <th>اليوم</th>
                        <th style={{ textAlign: 'center' }}>من</th>
                        <th style={{ textAlign: 'center' }}>إلى</th>
                        <th>الحالة</th>
                      </tr>
                    </thead>
                    <tbody>
                      {timetableImportRows.map((row) => (
                        <tr
                          key={row.index}
                          style={row.status === 'error' ? { background: '#FEF2F2' } : undefined}
                        >
                          <td style={{ color: 'var(--text-muted)' }}>{row.index}</td>
                          <td>
                            <div style={{ fontWeight: '700' }}>
                              <bdi dir="ltr">{row.courseCode}</bdi>
                              {row.courseName && <> — {row.courseName}</>}
                            </div>
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <span
                              style={{
                                display: 'inline-block',
                                padding: '2px 6px',
                                borderRadius: '4px',
                                fontSize: '11px',
                                fontWeight: '700',
                                backgroundColor: row.type === 'PRACTICAL' ? '#EDE9FE' : '#E0F2FE',
                                color: row.type === 'PRACTICAL' ? '#6D28D9' : '#0369A1',
                              }}
                            >
                              {row.type === 'PRACTICAL' ? '🔬 عملي' : '📖 نظري'}
                            </span>
                          </td>
                          <td>{row.sectionLabel}</td>
                          <td style={{ textAlign: 'center' }}>{row.hall || '—'}</td>
                          <td>{row.dayLabel}</td>
                          <td style={{ textAlign: 'center' }} dir="ltr">{row.startTime}</td>
                          <td style={{ textAlign: 'center' }} dir="ltr">{row.endTime}</td>
                          <td>
                            <span
                              title={row.message}
                              style={{
                                display: 'inline-block',
                                padding: '2px 8px',
                                borderRadius: '999px',
                                fontSize: '11px',
                                fontWeight: '700',
                                background:
                                  row.status === 'ok' ? '#ECFDF5' : row.status === 'exists' ? '#F3F4F6' : '#FEF2F2',
                                color:
                                  row.status === 'ok' ? '#065F46' : row.status === 'exists' ? '#374151' : '#991B1B',
                                border:
                                  row.status === 'ok'
                                    ? '1px solid #A7F3D0'
                                    : row.status === 'exists'
                                      ? '1px solid #D1D5DB'
                                      : '1px solid #FCA5A5',
                                maxWidth: '220px',
                              }}
                            >
                              {row.status === 'ok' ? '✓ صالح' : row.status === 'exists' ? 'سيُتخطى' : row.message}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={resetTimetableImport}
                    disabled={timetableImportLoading}
                  >
                    اختيار ملف آخر
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={handleConfirmTimetableImport}
                    disabled={
                      timetableImportLoading ||
                      timetableImportRows.filter((row) => row.status === 'ok').length === 0
                    }
                  >
                    {timetableImportLoading
                      ? 'جارٍ الاستيراد...'
                      : `استيراد ${timetableImportRows.filter((row) => row.status === 'ok').length} موعد`}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <DeleteGuardModal
        isOpen={Boolean(deleteGuard)}
        title={deleteGuard?.kind === 'course' ? 'حذف المادة' : 'حذف الشعبة'}
        entityName={deleteGuard?.name || ''}
        entityMeta={deleteGuard?.meta}
        loading={deleteDepsLoading}
        error={deleteDepsError}
        dependencies={deleteDeps}
        busy={actionLoading}
        onClose={closeDeleteGuard}
        onConfirm={confirmGuardedDelete}
      />

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
