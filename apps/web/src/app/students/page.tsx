'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Navbar from '../../components/layout/Navbar';
import {
  studentApi,
  sectionApi,
  ACADEMIC_STAGES,
  STAGE_LABELS,
  STAGE_OPTIONS,
  stageLabel,
  type ImportPreviewResult,
  type ImportRequest,
  type ImportRow,
  type SectionItem,
  type StudentListItem,
  type AcademicStatus,
} from '../../lib/api';
import * as XLSX from 'xlsx';
import StudentQrCardModal from '../../components/cards/StudentQrCardModal';
import BulkStudentCardsModal from '../../components/cards/BulkStudentCardsModal';
import ResetAbsencesModal from '../../components/modals/ResetAbsencesModal';
import AttendancePdfReportModal from '../../components/modals/AttendancePdfReportModal';
import StudentCourseEnrollmentModal from '../../components/modals/StudentCourseEnrollmentModal';
import { useAuth, PERMISSIONS } from '../../lib/auth';

const PERIOD_LABELS: Record<string, string> = {
  MORNING: 'صباحي',
  EVENING: 'مسائي',
};

type Period = 'MORNING' | 'EVENING';
type StageFilter = 'ALL' | number;

const STUDENTS_PAGE_SIZE = 50;

interface StudentForm {
  name: string;
  studentCode: string;
  stage: number;
  studyPeriod: Period;
  sectionId: string;
  orderIndex: string;
}

const EMPTY_FORM: StudentForm = {
  name: '',
  studentCode: '',
  stage: 2,
  studyPeriod: 'EVENING',
  sectionId: '',
  orderIndex: '',
};

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return 'حدث خطأ غير متوقع';
}

function hasHeaderHint(row: unknown[]): boolean {
  return row.some((cell) => {
    const text = String(cell || '').toLowerCase();
    return (
      text.includes('اسم') ||
      text.includes('طالب') ||
      text.includes('name') ||
      text.includes('باركو') ||
      text.includes('barcode') ||
      text.includes('كود') ||
      text.includes('شعب') ||
      text.includes('section')
    );
  });
}

/** Extract flat rows from an uploaded spreadsheet. */
function parseSpreadsheet(rows: unknown[][]): ImportRow[] {
  if (!rows || rows.length === 0) return [];

  let headerIndex = -1;
  let colName = -1;
  let colCode = -1;
  let colOrder = -1;
  let colSection = -1;

  for (let r = 0; r < Math.min(5, rows.length); r++) {
    const row = rows[r];
    if (!Array.isArray(row) || !hasHeaderHint(row)) continue;
    headerIndex = r;
    row.forEach((cell, index) => {
      const text = String(cell || '').toLowerCase().trim();
      if (
        colName === -1 &&
        (text.includes('اسم') || text.includes('طالب') || text.includes('name'))
      ) {
        colName = index;
      } else if (
        colCode === -1 &&
        (text.includes('باركو') ||
          text.includes('barcode') ||
          text.includes('كود') ||
          text.includes('id') ||
          text.includes('رقم') ||
          text.includes('قيد'))
      ) {
        colCode = index;
      } else if (
        colOrder === -1 &&
        (text === 'ت' ||
          text.startsWith('ت.') ||
          text.includes('تسلسل') ||
          text.includes('ترتيب') ||
          text === '#' ||
          text === 'no')
      ) {
        colOrder = index;
      } else if (
        colSection === -1 &&
        (text.includes('شعب') ||
          text.includes('section') ||
          text.includes('فئة') ||
          text.includes('group'))
      ) {
        colSection = index;
      }
    });
    break;
  }

  if (headerIndex === -1) {
    const width = Math.max(
      ...rows.slice(0, 5).map((row) => (Array.isArray(row) ? row.length : 0)),
      0,
    );
    if (width >= 7) {
      // Legacy layout: ت, الاسم, الدراسة, الشعبة, الحضور, الغياب, الإجمالي, الباركود
      colOrder = 0;
      colName = 1;
      colSection = 3;
      colCode = 7;
    } else {
      colCode = 0;
      colName = 1;
      colOrder = 2;
    }
  }

  const start = headerIndex >= 0 ? headerIndex + 1 : 0;
  const result: ImportRow[] = [];

  for (let i = start; i < rows.length; i++) {
    const row = rows[i];
    if (!Array.isArray(row) || row.length === 0) continue;

    const name = colName >= 0 ? String(row[colName] ?? '').trim() : '';
    if (!name) continue;

    const code =
      colCode >= 0 ? String(row[colCode] ?? '').trim().replace(/\.0$/, '') : '';
    const orderRaw = colOrder >= 0 ? row[colOrder] : undefined;
    const orderIndex =
      orderRaw != null && !isNaN(Number(orderRaw)) && Number(orderRaw) > 0
        ? Number(orderRaw)
        : undefined;

    const sectionRaw =
      colSection >= 0 ? String(row[colSection] ?? '').trim() : '';

    result.push({
      name,
      ...(code ? { studentCode: code } : {}),
      ...(orderIndex ? { orderIndex } : {}),
      ...(sectionRaw ? { section: sectionRaw } : {}),
    });
  }

  return result;
}

export default function StudentsPage() {
  const { can } = useAuth();
  const canManageStudents = can(PERMISSIONS.STUDENTS_MANAGE);
  const canResetAbsences = can(PERMISSIONS.ABSENCES_RESET);
  const canIssueQr = can(PERMISSIONS.QR_ISSUE);

  const [students, setStudents] = useState<StudentListItem[]>([]);
  const [sections, setSections] = useState<SectionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);

  // Filters
  const [stageFilter, setStageFilter] = useState<StageFilter>('ALL');
  const [periodFilter, setPeriodFilter] = useState<'ALL' | Period>('ALL');
  const [sectionFilter, setSectionFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | AcademicStatus>('ALL');

  // Detail / cards
  const [selectedStudent, setSelectedStudent] = useState<StudentListItem | null>(null);
  const [selectedStudentForCard, setSelectedStudentForCard] = useState<StudentListItem | null>(null);
  const [selectedStudentForCourses, setSelectedStudentForCourses] = useState<StudentListItem | null>(null);
  const [showBulkPrintModal, setShowBulkPrintModal] = useState(false);

  // Existing modals
  const [showResetModal, setShowResetModal] = useState(false);
  const [showPdfReportModal, setShowPdfReportModal] = useState(false);

  // Add / edit modal
  const [formMode, setFormMode] = useState<'add' | 'edit' | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<StudentForm>(EMPTY_FORM);
  const [formError, setFormError] = useState('');
  const [formSubmitting, setFormSubmitting] = useState(false);

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<StudentListItem | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Multi-select for bulk deletion
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkDeleteLoading, setBulkDeleteLoading] = useState(false);

  // Import modal
  const [showImportModal, setShowImportModal] = useState(false);
  const [importStage, setImportStage] = useState(2);
  const [importPeriod, setImportPeriod] = useState<Period>('EVENING');
  const [importSectionId, setImportSectionId] = useState('');
  const [importText, setImportText] = useState('');
  const [importRows, setImportRows] = useState<ImportRow[]>([]);
  const [preview, setPreview] = useState<ImportPreviewResult | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadStudents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await studentApi.getAll();
      setStudents(data);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  const loadSections = useCallback(async () => {
    try {
      const data = await sectionApi.getAll();
      setSections(data);
    } catch {
      setSections([]);
    }
  }, []);

  useEffect(() => {
    loadStudents();
    loadSections();
  }, [loadStudents, loadSections]);

  const filterSections = useMemo(
    () =>
      sections.filter(
        (section) =>
          (stageFilter === 'ALL' || section.stage === Number(stageFilter)) &&
          (periodFilter === 'ALL' || section.studyPeriod === periodFilter),
      ),
    [sections, stageFilter, periodFilter],
  );

  const formSections = useMemo(
    () =>
      sections.filter(
        (section) =>
          section.stage === form.stage && section.studyPeriod === form.studyPeriod,
      ),
    [sections, form.stage, form.studyPeriod],
  );

  const importSections = useMemo(
    () =>
      sections.filter(
        (section) =>
          section.stage === importStage && section.studyPeriod === importPeriod,
      ),
    [sections, importStage, importPeriod],
  );

  const filteredStudents = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    const filterSection =
      sectionFilter !== 'ALL'
        ? sections.find((section) => section.id === sectionFilter) || null
        : null;
    return students.filter((student) => {
      if (stageFilter !== 'ALL') {
        const stage = Number(stageFilter);
        const requiredStages = student.customCourseStages || [];
        // A carry-over student stays registered in his own stage but must also
        // appear with the lower stage he is required to take a course from.
        if (student.stage !== stage && !requiredStages.includes(stage)) return false;
      }
      if (periodFilter !== 'ALL' && student.studyPeriod !== periodFilter) return false;
      if (filterSection) {
        const sectionName = String(filterSection.name || '').trim();
        const ownSection = String(student.section || '').trim();
        const matchesSection =
          student.sectionId === filterSection.id ||
          (student.stage !== filterSection.stage &&
            Boolean(sectionName) &&
            ownSection === sectionName);
        if (!matchesSection) return false;
      }
      if (statusFilter !== 'ALL') {
        const studentStatus = student.academicStatus || 'REGULAR';
        if (studentStatus !== statusFilter) return false;
      }
      if (term) {
        const matchesName = student.name.toLowerCase().includes(term);
        const matchesCode = student.studentCode.toLowerCase().includes(term);
        const matchesSection = (student.sectionLabel || student.section || '')
          .toLowerCase()
          .includes(term);
        if (!matchesName && !matchesCode && !matchesSection) return false;
      }
      return true;
    });
  }, [students, stageFilter, periodFilter, sectionFilter, statusFilter, searchTerm, sections]);

  const stageCounts = useMemo(() => {
    const counts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
    students.forEach((student) => {
      const stages = new Set<number>([student.stage]);
      for (const stage of student.customCourseStages || []) stages.add(stage);
      stages.forEach((stage) => {
        if (stage >= 1 && stage <= 4) counts[stage] += 1;
      });
    });
    return counts;
  }, [students]);

  // Counters follow the selected stage: a carry-over student's attendance is
  // counted only for the stage of the course it belongs to, so the stage 1
  // view never shows the stage 2 numbers (and the other way round).
  const statsFor = useCallback(
    (student: StudentListItem) => {
      if (stageFilter === 'ALL') {
        return {
          presentCount: student.presentCount,
          absentCount: student.absentCount,
          totalLectures: student.totalLectures,
        };
      }
      const stage = Number(stageFilter);
      let presentCount = 0;
      let absentCount = 0;
      for (const item of student.history || []) {
        // A record whose course stage is unknown belongs to the student's own
        // stage; records of other stages are excluded from this view.
        const recordStage = item.courseStage ?? student.stage;
        if (recordStage !== stage) continue;
        if (item.status === 'PRESENT') presentCount += 1;
        else if (item.status === 'ABSENT') absentCount += 1;
      }
      return { presentCount, absentCount, totalLectures: presentCount + absentCount };
    },
    [stageFilter],
  );

  const statusCounts = useMemo(() => {
    let regular = 0;
    let repeat = 0;
    let carryOver = 0;
    students.forEach((s) => {
      const st = s.academicStatus || 'REGULAR';
      if (st === 'REPEAT') repeat++;
      else if (st === 'CARRY_OVER') carryOver++;
      else regular++;
    });
    return { regular, repeat, carryOver };
  }, [students]);

  const monthlyAlertCount = filteredStudents.filter(
    (student) => statsFor(student).absentCount >= 3,
  ).length;

  const selectedFilterSection =
    sectionFilter !== 'ALL'
      ? sections.find((section) => section.id === sectionFilter) || null
      : null;

  // The detail modal mirrors the stage filter so its numbers and history match
  // the row the user opened.
  const selectedStudentStats = selectedStudent ? statsFor(selectedStudent) : null;
  const selectedStudentHistory =
    selectedStudent && stageFilter !== 'ALL'
      ? selectedStudent.history.filter(
          (item) => (item.courseStage ?? selectedStudent.stage) === Number(stageFilter),
        )
      : selectedStudent?.history || [];

  // Client-side pagination keeps the table usable with hundreds of students.
  const totalPages = Math.max(1, Math.ceil(filteredStudents.length / STUDENTS_PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pagedStudents = filteredStudents.slice(
    (safePage - 1) * STUDENTS_PAGE_SIZE,
    safePage * STUDENTS_PAGE_SIZE,
  );

  useEffect(() => {
    setPage(1);
    setSelectedIds(new Set());
  }, [stageFilter, periodFilter, sectionFilter, searchTerm]);

  // ---------------- Form handlers ----------------
  const openAddModal = () => {
    setForm({
      ...EMPTY_FORM,
      stage: stageFilter === 'ALL' ? 2 : Number(stageFilter),
      studyPeriod: periodFilter === 'ALL' ? 'EVENING' : periodFilter,
      sectionId: sectionFilter !== 'ALL' ? sectionFilter : '',
    });
    setEditingId(null);
    setFormError('');
    setFormMode('add');
  };

  const openEditModal = (student: StudentListItem) => {
    setForm({
      name: student.name,
      studentCode: student.studentCode,
      stage: student.stage,
      studyPeriod: (student.studyPeriod === 'MORNING' ? 'MORNING' : 'EVENING') as Period,
      sectionId: student.sectionId || '',
      orderIndex: student.orderIndex != null ? String(student.orderIndex) : '',
    });
    setEditingId(student.id);
    setFormError('');
    setFormMode('edit');
  };

  const handleFormStage = (value: number) => {
    setForm((current) => ({
      ...current,
      stage: value,
      sectionId: '',
    }));
  };

  const handleFormPeriod = (value: Period) => {
    setForm((current) => ({ ...current, studyPeriod: value, sectionId: '' }));
  };

  const handleFormSection = (value: string) => {
    const section = sections.find((item) => item.id === value);
    setForm((current) => ({
      ...current,
      sectionId: value,
      ...(section
        ? {
            stage: section.stage,
            studyPeriod: section.studyPeriod as Period,
          }
        : {}),
    }));
  };

  const handleSaveStudent = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.name.trim()) {
      setFormError('اسم الطالب مطلوب');
      return;
    }
    setFormSubmitting(true);
    setFormError('');
    try {
      const payload = {
        name: form.name.trim(),
        ...(form.studentCode.trim() ? { studentCode: form.studentCode.trim() } : {}),
        stage: form.stage,
        studyPeriod: form.studyPeriod,
        ...(form.sectionId ? { sectionId: form.sectionId } : {}),
        ...(form.orderIndex !== '' && !isNaN(Number(form.orderIndex))
          ? { orderIndex: Number(form.orderIndex) }
          : {}),
      };

      if (formMode === 'edit' && editingId) {
        await studentApi.update(editingId, {
          ...payload,
          sectionId: form.sectionId || null,
        });
        setSuccessBanner('تم تحديث بيانات الطالب بنجاح');
      } else {
        await studentApi.create(payload);
        setSuccessBanner('تمت إضافة الطالب بنجاح');
      }
      setFormMode(null);
      await loadStudents();
    } catch (err) {
      setFormError(errorMessage(err));
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      await studentApi.delete(deleteTarget.id);
      setSuccessBanner(
        'تم حذف الطالب. تُحفظ سجلات الحضور السابقة ويُخفى الطالب من القوائم.',
      );
      if (selectedStudent?.id === deleteTarget.id) setSelectedStudent(null);
      setSelectedIds((current) => {
        const next = new Set(current);
        next.delete(deleteTarget.id);
        return next;
      });
      setDeleteTarget(null);
      await loadStudents();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setDeleteLoading(false);
    }
  };

  // ---------------- Multi-select / bulk delete ----------------
  const toggleSelected = (id: string) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const pagedAllSelected =
    pagedStudents.length > 0 && pagedStudents.every((student) => selectedIds.has(student.id));

  const toggleSelectPage = () => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (pagedAllSelected) {
        pagedStudents.forEach((student) => next.delete(student.id));
      } else {
        pagedStudents.forEach((student) => next.add(student.id));
      }
      return next;
    });
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    setBulkDeleteLoading(true);
    setError(null);
    let deleted = 0;
    let failed = 0;
    for (const id of Array.from(selectedIds)) {
      try {
        await studentApi.delete(id);
        deleted += 1;
      } catch {
        failed += 1;
      }
    }
    setBulkDeleteLoading(false);
    setBulkDeleteOpen(false);
    setSelectedIds(new Set());
    setSelectedStudent(null);
    await loadStudents();
    if (failed > 0) {
      setError(`تم حذف ${deleted} طالبًا، وتعذّر حذف ${failed} طالبًا. أعد المحاولة للمتبقين.`);
    }
    if (deleted > 0) {
      setSuccessBanner(
        `تم حذف ${deleted} طالبًا من القوائم مع الحفاظ على سجلات الحضور السابقة.`,
      );
    }
  };

  // ---------------- Import handlers ----------------
  const resetImport = () => {
    setImportText('');
    setImportRows([]);
    setPreview(null);
    setImportError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const closeImport = () => {
    setShowImportModal(false);
    resetImport();
  };

  const buildImportRequest = (rows: ImportRow[]): ImportRequest => ({
    stage: importStage,
    studyPeriod: importPeriod,
    ...(importSectionId ? { sectionId: importSectionId } : {}),
    students: rows,
  });

  const runPreview = async (rows: ImportRow[]) => {
    if (rows.length === 0) {
      setImportError('لم يتم العثور على صفوف صالحة في الملف');
      setPreview(null);
      return;
    }
    setPreviewLoading(true);
    setImportError(null);
    try {
      const result = await studentApi.previewImport(buildImportRequest(rows));
      setImportRows(rows);
      setPreview(result);
    } catch (err) {
      setImportError(errorMessage(err));
      setPreview(null);
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (loadEvent) => {
      try {
        const workbook = XLSX.read(loadEvent.target?.result, { type: 'binary' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<unknown[]>(firstSheet, { header: 1 });
        runPreview(parseSpreadsheet(rows));
      } catch (err) {
        setImportError('فشل قراءة ملف الإكسل: ' + errorMessage(err));
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleTextPreview = () => {
    const rows: ImportRow[] = [];
    importText
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .forEach((line) => {
        const parts = line.split(/[,;\t]+/).map((part) => part.trim());
        if (parts.length < 2) return;
        const code = parts[0];
        const name = parts[1];
        if (!name) return;
        const orderRaw = parts[2];
        const orderIndex =
          orderRaw && !isNaN(Number(orderRaw)) ? Number(orderRaw) : undefined;
        const sectionRaw = parts[3];
        rows.push({
          name,
          ...(code ? { studentCode: code } : {}),
          ...(orderIndex ? { orderIndex } : {}),
          ...(sectionRaw ? { section: sectionRaw } : {}),
        });
      });
    runPreview(rows);
  };

  const handleConfirmImport = async () => {
    if (!preview) return;
    setConfirmLoading(true);
    setImportError(null);
    try {
      const result = await studentApi.confirmImport(buildImportRequest(importRows));
      setSuccessBanner(
        `تم استيراد ${result.created} طالب بنجاح` +
          (result.rejected > 0 ? `، ورُفض ${result.rejected} صف مكرر أو غير صالح` : ''),
      );
      closeImport();
      await loadStudents();
    } catch (err) {
      setImportError(errorMessage(err));
    } finally {
      setConfirmLoading(false);
    }
  };

  // ---------------- Export ----------------
  const handleExportExcel = () => {
    if (filteredStudents.length === 0) {
      alert('لا توجد بيانات طلاب للتصدير');
      return;
    }

    const exportData = filteredStudents.map((student, index) => {
      const stats = statsFor(student);
      return {
        ت: student.orderIndex != null ? student.orderIndex : index + 1,
        'اسم الطالب': student.name,
        المرحلة: stageLabel(student.stage),
        الدراسة: PERIOD_LABELS[student.studyPeriod || 'MORNING'] || student.studyPeriod,
        الشعبة: student.sectionLabel || student.section || '',
        'عدد مرات الحضور': stats.presentCount,
        'عدد مرات الغياب': stats.absentCount,
        'اجمالى المحاضرات': stats.totalLectures,
        الباركود: student.studentCode,
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    worksheet['!cols'] = [
      { wch: 8 },
      { wch: 28 },
      { wch: 16 },
      { wch: 12 },
      { wch: 14 },
      { wch: 18 },
      { wch: 18 },
      { wch: 18 },
      { wch: 20 },
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'سجل الطلاب');
    const dateStr = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(workbook, `سجل_الطلاب_${dateStr}.xlsx`);
  };

  const invalidPreviewRows = preview?.rows.filter((row) => row.status === 'ERROR') || [];

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)' }}>
      <Navbar />

      <div className="students-page-main-layout app-page">
        {/* Header */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '20px',
            flexWrap: 'wrap',
            gap: '14px',
          }}
        >
          <div>
            <h1 style={{ fontSize: '24px', fontWeight: '800', color: '#111827', marginBottom: '4px' }}>
              سجل الطلاب
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
              إدارة طلاب المراحل والشعب • {students.length} طالب مسجّل
            </p>
          </div>

          <div className="page-actions">
            {canResetAbsences && (
              <button
                className="btn btn-sm"
                onClick={() => setShowResetModal(true)}
                title="تصفير سجلات الحضور والغياب لبداية كورس جديد"
                style={{
                  fontSize: '12px',
                  backgroundColor: '#FEF2F2',
                  color: '#DC2626',
                  border: '1px solid #FCA5A5',
                  fontWeight: '700',
                }}
              >
                🔄 تصفير سجلات الكورس
              </button>
            )}
            {canManageStudents && selectedIds.size > 0 && (
              <button
                className="btn btn-sm"
                onClick={() => setBulkDeleteOpen(true)}
                style={{
                  fontSize: '12px',
                  backgroundColor: '#B91C1C',
                  color: '#FFFFFF',
                  border: 'none',
                  fontWeight: '800',
                }}
              >
                🗑️ حذف المحدد ({selectedIds.size})
              </button>
            )}
            {canIssueQr && (
              <button
                className="btn btn-primary btn-sm"
                onClick={() => setShowBulkPrintModal(true)}
                disabled={filteredStudents.length === 0}
                style={{ fontSize: '12px' }}
              >
                بطاقات الطلاب ({filteredStudents.length})
              </button>
            )}
            {canManageStudents && (
              <>
                <button className="btn btn-primary btn-sm" onClick={openAddModal} style={{ fontSize: '12px' }}>
                  إضافة طالب
                </button>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => {
                    resetImport();
                    setShowImportModal(true);
                  }}
                  style={{ fontSize: '12px' }}
                >
                  استيراد Excel
                </button>
              </>
            )}
            <button
              className="btn btn-success btn-sm"
              onClick={() => setShowPdfReportModal(true)}
            >
              📄 تصدير كشف الغيابات (PDF)
            </button>
            <button
              className="btn btn-ghost btn-sm"
              onClick={handleExportExcel}
              style={{ fontSize: '12px' }}
              title="تصدير الطلاب المطابقين إلى Excel"
            >
              ⬇️ Excel
            </button>
          </div>
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
              fontSize: '13.5px',
              fontWeight: '600',
            }}
          >
            ⚠️ {error}
          </div>
        )}

        {successBanner && (
          <div
            style={{
              padding: '12px 16px',
              borderRadius: '12px',
              backgroundColor: '#ECFDF5',
              border: '1px solid #A7F3D0',
              color: '#065F46',
              marginBottom: '16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
              fontSize: '13.5px',
              fontWeight: '600',
            }}
          >
            <span>✅ {successBanner}</span>
            <button
              onClick={() => setSuccessBanner(null)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#065F46', fontSize: '16px' }}
            >
              ✕
            </button>
          </div>
        )}

        {/* Filters card */}
        <div
          style={{
            background: '#FFFFFF',
            padding: '16px 18px',
            borderRadius: '16px',
            border: '1px solid #E5E7EB',
            marginBottom: '18px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
          }}
        >
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '12px' }}>
            <span style={{ fontSize: '13px', fontWeight: '800', color: '#111827' }}>المرحلة:</span>
            <FilterChip active={stageFilter === 'ALL'} onClick={() => setStageFilter('ALL')}>
              الكل ({students.length})
            </FilterChip>
            {ACADEMIC_STAGES.map((stage) => (
              <FilterChip
                key={stage}
                active={stageFilter === stage}
                onClick={() => {
                  setStageFilter(stage);
                  setSectionFilter('ALL');
                }}
              >
                {STAGE_LABELS[stage]} ({stageCounts[stage]})
              </FilterChip>
            ))}
          </div>

          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '12px' }}>
            <span style={{ fontSize: '13px', fontWeight: '800', color: '#111827' }}>نوع الدراسة:</span>
            <FilterChip
              active={periodFilter === 'ALL'}
              onClick={() => {
                setPeriodFilter('ALL');
                setSectionFilter('ALL');
              }}
            >
              الكل
            </FilterChip>
            <FilterChip
              active={periodFilter === 'MORNING'}
              onClick={() => {
                setPeriodFilter('MORNING');
                setSectionFilter('ALL');
              }}
            >
              صباحي
            </FilterChip>
            <FilterChip
              active={periodFilter === 'EVENING'}
              onClick={() => {
                setPeriodFilter('EVENING');
                setSectionFilter('ALL');
              }}
            >
              مسائي
            </FilterChip>
          </div>

          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '12px' }}>
            <span style={{ fontSize: '13px', fontWeight: '800', color: '#111827' }}>الحالة الأكاديمية:</span>
            <FilterChip
              active={statusFilter === 'ALL'}
              onClick={() => setStatusFilter('ALL')}
            >
              الكل ({students.length})
            </FilterChip>
            <FilterChip
              active={statusFilter === 'REGULAR'}
              onClick={() => setStatusFilter('REGULAR')}
            >
              منتظم ({statusCounts.regular})
            </FilterChip>
            <FilterChip
              active={statusFilter === 'REPEAT'}
              onClick={() => setStatusFilter('REPEAT')}
            >
              راسب / معيد ({statusCounts.repeat})
            </FilterChip>
            <FilterChip
              active={statusFilter === 'CARRY_OVER'}
              onClick={() => setStatusFilter('CARRY_OVER')}
            >
              طالب عبور ({statusCounts.carryOver})
            </FilterChip>
          </div>

          <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div style={{ minWidth: '200px', flex: '1 1 200px' }}>
              <label style={{ display: 'block', marginBottom: '4px', fontSize: '12.5px', fontWeight: '700', color: '#374151' }}>
                الشعبة
              </label>
              <select
                className="input"
                value={sectionFilter}
                onChange={(e) => setSectionFilter(e.target.value)}
                style={{ fontSize: '13px', fontWeight: '600' }}
              >
                <option value="ALL">كافة الشعب ({filterSections.length})</option>
                {filterSections.map((section) => (
                  <option key={section.id} value={section.id}>
                    {stageLabel(section.stage)} — {section.name} ({PERIOD_LABELS[section.studyPeriod] || section.studyPeriod})
                  </option>
                ))}
              </select>
            </div>

            <div style={{ flex: '2 1 240px' }}>
              <label style={{ display: 'block', marginBottom: '4px', fontSize: '12.5px', fontWeight: '700', color: '#374151' }}>
                بحث
              </label>
              <input
                type="text"
                className="input"
                placeholder="ابحث بالاسم أو الباركود أو الشعبة..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{ fontSize: '13px' }}
              />
            </div>
          </div>

          <div style={{ marginTop: '12px', fontSize: '12.5px', color: '#6B7280' }}>
            المعروض حالياً: <strong style={{ color: '#111827' }}>{filteredStudents.length}</strong> طالب
            {monthlyAlertCount > 0 && (
              <span style={{ color: '#B45309', fontWeight: '700' }}>
                {' '}· {monthlyAlertCount} معرّض للإنذار (3+ غياب)
              </span>
            )}
          </div>
        </div>

        {/* Bulk selection bar */}
        {selectedIds.size > 0 && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
              flexWrap: 'wrap',
              background: '#FEF2F2',
              border: '1px solid #FCA5A5',
              borderRadius: '12px',
              padding: '10px 14px',
              marginBottom: '14px',
            }}
          >
            <span style={{ fontSize: '13px', fontWeight: '800', color: '#991B1B' }}>
              تم تحديد {selectedIds.size} طالب
            </span>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setSelectedIds(new Set())}
                style={{ fontSize: '12px' }}
              >
                إلغاء التحديد
              </button>
              <button
                type="button"
                className="btn btn-danger btn-sm"
                onClick={() => setBulkDeleteOpen(true)}
                style={{ fontSize: '12px' }}
              >
                حذف المحدد
              </button>
            </div>
          </div>
        )}

        {/* Students list */}
        {loading ? (
          <div className="empty-state">
            <p style={{ color: 'var(--text-muted)' }}>جاري تحميل بيانات الطلاب...</p>
          </div>
        ) : filteredStudents.length === 0 ? (
          <div className="empty-state" style={{ padding: '40px', textAlign: 'center' }}>
            <p style={{ color: 'var(--text-muted)', fontSize: '16px', fontWeight: '600' }}>
              {students.length > 0 ? 'لا توجد نتائج مطابقة للفلاتر' : 'لا يوجد طلاب مسجلون بعد'}
            </p>
            <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '6px' }}>
              {students.length > 0
                ? 'جرّب تغيير المرحلة أو الشعبة أو كلمة البحث.'
                : 'أضف طالباً أو استورد قائمة من ملف Excel.'}
            </p>
            {canManageStudents && students.length === 0 && (
              <div style={{ display: 'flex', gap: '10px', marginTop: '16px', justifyContent: 'center' }}>
                <button className="btn btn-primary" onClick={openAddModal}>
                  إضافة طالب
                </button>
                <button className="btn btn-ghost" onClick={() => setShowImportModal(true)}>
                  استيراد Excel
                </button>
              </div>
            )}
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="students-desktop-table glass-card" style={{ padding: '8px 12px' }}>
              <table className="attendance-table" style={{ fontSize: '13px' }}>
                <thead>
                  <tr>
                    <th style={{ width: '40px', textAlign: 'center' }}>
                      <input
                        type="checkbox"
                        aria-label="تحديد كل الطلاب في الصفحة"
                        checked={pagedAllSelected}
                        onChange={toggleSelectPage}
                        style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                      />
                    </th>
                    <th style={{ width: '46px', textAlign: 'center' }}>ت</th>
                    <th>اسم الطالب / الباركود</th>
                    <th style={{ textAlign: 'center' }}>المرحلة</th>
                    <th style={{ textAlign: 'center' }}>الدراسة</th>
                    <th style={{ textAlign: 'center' }}>الشعبة</th>
                    <th style={{ textAlign: 'center' }}>حضور</th>
                    <th style={{ textAlign: 'center' }}>غياب</th>
                    <th style={{ textAlign: 'center' }}>إجمالي</th>
                    <th style={{ textAlign: 'center' }}>إجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedStudents.map((student) => {
                    const stats = statsFor(student);
                    return (
                    <tr
                      key={student.id}
                      style={selectedIds.has(student.id) ? { background: '#FEF2F2' } : undefined}
                    >
                      <td style={{ textAlign: 'center' }}>
                        <input
                          type="checkbox"
                          aria-label={`تحديد ${student.name}`}
                          checked={selectedIds.has(student.id)}
                          onChange={() => toggleSelected(student.id)}
                          style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                        />
                      </td>
                      <td style={{ textAlign: 'center', color: 'var(--text-muted)', fontWeight: '700' }}>
                        {student.orderIndex ?? '-'}
                      </td>
                      <td>
                        <div style={{ fontWeight: '700', color: '#111827', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span>{student.name}</span>
                          {student.academicStatus === 'REPEAT' && (
                            <span style={{ fontSize: '10.5px', background: '#FEE2E2', color: '#DC2626', border: '1px solid #FCA5A5', padding: '1px 6px', borderRadius: '10px', fontWeight: '700' }}>
                              راسب ({student.customCourseCount || 0} مواد)
                            </span>
                          )}
                          {student.academicStatus === 'CARRY_OVER' && (
                            <span style={{ fontSize: '10.5px', background: '#ECFDF5', color: '#059669', border: '1px solid #A7F3D0', padding: '1px 6px', borderRadius: '10px', fontWeight: '700' }}>
                              عبور ({student.customCourseCount || 0} مواد)
                            </span>
                          )}
                        </div>
                        <div style={{ fontFamily: 'monospace', fontSize: '11.5px', color: '#6B7280' }}>
                          {student.studentCode}
                        </div>
                      </td>
                      <td style={{ textAlign: 'center', fontSize: '12px', fontWeight: '600' }}>
                        {stageLabel(student.stage)}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <PeriodBadge period={student.studyPeriod} />
                      </td>
                      <td style={{ textAlign: 'center', fontSize: '12px', fontWeight: '600', color: '#374151' }}>
                        {student.sectionLabel || student.section || '-'}
                      </td>
                      <td style={{ textAlign: 'center', color: '#059669', fontWeight: '700' }}>
                        {stats.presentCount}
                      </td>
                      <td style={{ textAlign: 'center', color: stats.absentCount > 0 ? '#DC2626' : '#6B7280', fontWeight: '700' }}>
                        {stats.absentCount}
                      </td>
                      <td style={{ textAlign: 'center', fontWeight: '600', color: '#374151' }}>
                        {stats.totalLectures}
                      </td>
                      <td>
                        <StudentActions
                          student={student}
                          canIssueQr={canIssueQr}
                          canManageStudents={canManageStudents}
                          onView={() => setSelectedStudent(student)}
                          onCard={() => setSelectedStudentForCard(student)}
                          onCourses={() => setSelectedStudentForCourses(student)}
                          onEdit={() => openEditModal(student)}
                          onDelete={() => setDeleteTarget(student)}
                        />
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="students-mobile-list">
              {pagedStudents.map((student) => {
                const stats = statsFor(student);
                return (
                <div
                  key={student.id}
                  className="glass-card"
                  style={{
                    padding: '12px 14px',
                    ...(selectedIds.has(student.id)
                      ? { border: '1.5px solid #FCA5A5', background: '#FEF2F2' }
                      : {}),
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', alignItems: 'flex-start' }}>
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', minWidth: 0 }}>
                      <input
                        type="checkbox"
                        aria-label={`تحديد ${student.name}`}
                        checked={selectedIds.has(student.id)}
                        onChange={() => toggleSelected(student.id)}
                        style={{ width: '18px', height: '18px', cursor: 'pointer', marginTop: '3px' }}
                      />
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: '800', fontSize: '15.5px', color: '#111827', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                          <span>{student.name}</span>
                          {student.academicStatus === 'REPEAT' && (
                            <span style={{ fontSize: '10.5px', background: '#FEE2E2', color: '#DC2626', border: '1px solid #FCA5A5', padding: '1px 6px', borderRadius: '10px', fontWeight: '700' }}>
                              راسب ({student.customCourseCount || 0} مواد)
                            </span>
                          )}
                          {student.academicStatus === 'CARRY_OVER' && (
                            <span style={{ fontSize: '10.5px', background: '#ECFDF5', color: '#059669', border: '1px solid #A7F3D0', padding: '1px 6px', borderRadius: '10px', fontWeight: '700' }}>
                              عبور ({student.customCourseCount || 0} مواد)
                            </span>
                          )}
                        </div>
                        <div style={{ fontFamily: 'monospace', fontSize: '11.5px', color: '#6B7280' }}>
                          {student.studentCode}
                        </div>
                      </div>
                    </div>
                    <PeriodBadge period={student.studyPeriod} />
                  </div>

                  <div style={{ fontSize: '12px', color: '#4B5563', marginTop: '6px' }}>
                    {stageLabel(student.stage)} · {student.sectionLabel || student.section || 'بلا شعبة'}
                  </div>

                  <div style={{ display: 'flex', gap: '8px', marginTop: '10px', flexWrap: 'wrap' }}>
                    <MiniStat label="حضور" value={stats.presentCount} tone="#059669" />
                    <MiniStat label="غياب" value={stats.absentCount} tone={stats.absentCount > 0 ? '#DC2626' : '#6B7280'} />
                    <MiniStat label="إجمالي" value={stats.totalLectures} />
                  </div>

                  <div style={{ marginTop: '12px' }}>
                    <StudentActions
                      student={student}
                      canIssueQr={canIssueQr}
                      canManageStudents={canManageStudents}
                      onView={() => setSelectedStudent(student)}
                      onCard={() => setSelectedStudentForCard(student)}
                      onCourses={() => setSelectedStudentForCourses(student)}
                      onEdit={() => openEditModal(student)}
                      onDelete={() => setDeleteTarget(student)}
                    />
                  </div>
                </div>
                );
              })}
            </div>

            {totalPages > 1 && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '14px',
                  marginTop: '18px',
                  flexWrap: 'wrap',
                }}
              >
                <button
                  type="button"
                  className="btn btn-sm"
                  disabled={safePage <= 1}
                  onClick={() => setPage((current) => Math.max(current - 1, 1))}
                >
                  السابق
                </button>
                <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                  صفحة {safePage} من {totalPages} — {filteredStudents.length} طالب
                </span>
                <button
                  type="button"
                  className="btn btn-sm"
                  disabled={safePage >= totalPages}
                  onClick={() => setPage((current) => Math.min(current + 1, totalPages))}
                >
                  التالي
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* ======== Detail modal ======== */}
      {selectedStudent && (
        <div
          className="modal-backdrop animate-fade-in"
          onClick={() => setSelectedStudent(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', zIndex: 1000 }}
        >
          <div
            className="glass-card animate-slide-up"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '580px', width: '100%', maxHeight: '85vh', overflowY: 'auto', padding: '22px', background: '#FFFFFF', borderRadius: '18px', border: '1px solid #E5E7EB' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px', gap: '10px' }}>
              <div>
                <h2 style={{ fontSize: '19px', fontWeight: '800', marginBottom: '4px', color: '#111827' }}>{selectedStudent.name}</h2>
                <div style={{ fontSize: '12.5px', color: '#4B5563' }}>
                  <bdi dir="ltr">{selectedStudent.studentCode}</bdi> · {stageLabel(selectedStudent.stage)} ·{' '}
                  {selectedStudent.sectionLabel || selectedStudent.section || 'بلا شعبة'}
                </div>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => setSelectedStudent(null)} style={{ fontSize: '14px' }}>✕</button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '18px' }}>
              <MiniStat label="حضور" value={selectedStudentStats?.presentCount ?? 0} tone="#059669" />
              <MiniStat label="غياب" value={selectedStudentStats?.absentCount ?? 0} tone="#DC2626" />
              <MiniStat label="إجمالي" value={selectedStudentStats?.totalLectures ?? 0} />
            </div>

            <h3 style={{ fontSize: '14px', fontWeight: '700', marginBottom: '10px', color: '#374151' }}>سجل المحاضرات:</h3>

            {selectedStudentHistory.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '13px', textAlign: 'center', padding: '16px' }}>
                لم يتم تسجيل أي حضور بعد لهذا الطالب
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {selectedStudentHistory.map((item) => (
                  <div key={item.attendanceId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: '#F9FAFB', borderRadius: '8px', fontSize: '12px', border: '1px solid #F3F4F6', gap: '10px' }}>
                    <div>
                      <div style={{ fontWeight: '600', color: '#111827' }}>{item.lectureName}</div>
                      <div style={{ color: '#6B7280', fontSize: '11px' }}>
                        {new Date(item.lectureDate).toLocaleDateString('ar-IQ')}
                      </div>
                    </div>
                    <span style={{ padding: '2px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: '700', background: item.status === 'PRESENT' ? '#ECFDF5' : '#FEF2F2', color: item.status === 'PRESENT' ? '#065F46' : '#991B1B' }}>
                      {item.status === 'PRESENT' ? 'حاضر' : 'غائب'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ======== Delete confirmation ======== */}
      {deleteTarget && (
        <div className="modal-backdrop animate-fade-in" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', zIndex: 1000 }}>
          <div className="glass-card animate-slide-up" style={{ maxWidth: '400px', width: '100%', background: '#FFFFFF', borderRadius: '18px', padding: '26px', textAlign: 'center', border: '1px solid #E5E7EB' }}>
            <div style={{ width: '50px', height: '50px', borderRadius: '50%', background: '#FEF2F2', color: '#DC2626', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px auto', fontSize: '22px' }}>
              ⚠️
            </div>
            <h3 style={{ fontSize: '17px', fontWeight: '800', color: '#111827', marginBottom: '8px' }}>تأكيد حذف الطالب</h3>
            <p style={{ fontSize: '13px', color: '#4B5563', lineHeight: '1.7', marginBottom: '20px' }}>
              هل أنت متأكد من حذف <strong>{deleteTarget.name}</strong> (باركود: {deleteTarget.studentCode})؟
              <br />
              إذا كانت لديه سجلات حضور فسيُخفى من القوائم مع الحفاظ على السجلات.
            </p>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
              <button className="btn btn-ghost" onClick={() => setDeleteTarget(null)} disabled={deleteLoading} style={{ flex: 1, fontSize: '13px' }}>
                إلغاء
              </button>
              <button className="btn btn-danger" onClick={handleConfirmDelete} disabled={deleteLoading} style={{ flex: 1, fontSize: '13px', fontWeight: '700' }}>
                {deleteLoading ? 'جارٍ الحذف...' : 'تأكيد الحذف'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======== Add / edit student modal ======== */}
      {formMode && (
        <div className="modal-backdrop animate-fade-in" onClick={() => setFormMode(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', zIndex: 1000 }}>
          <div className="glass-card animate-slide-up" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '520px', width: '100%', maxHeight: '90vh', overflowY: 'auto', padding: '22px', background: '#FFFFFF', borderRadius: '18px', border: '1px solid #E5E7EB' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: '800', color: '#111827' }}>
                {formMode === 'edit' ? 'تعديل بيانات الطالب' : 'إضافة طالب جديد'}
              </h2>
              <button className="btn btn-ghost btn-sm" onClick={() => setFormMode(null)}>✕</button>
            </div>

            <form onSubmit={handleSaveStudent}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: '700', color: '#374151' }}>المرحلة *</label>
                  <select
                    className="input"
                    value={form.stage}
                    onChange={(e) => handleFormStage(Number(e.target.value))}
                    style={{ fontSize: '13px', fontWeight: '600' }}
                  >
                    {STAGE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: '700', color: '#374151' }}>نوع الدراسة *</label>
                  <select
                    className="input"
                    value={form.studyPeriod}
                    onChange={(e) => handleFormPeriod(e.target.value as Period)}
                    style={{ fontSize: '13px', fontWeight: '600' }}
                  >
                    <option value="MORNING">صباحي</option>
                    <option value="EVENING">مسائي</option>
                  </select>
                </div>
              </div>

              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: '700', color: '#374151' }}>الشعبة</label>
                <select
                  className="input"
                  value={form.sectionId}
                  onChange={(e) => handleFormSection(e.target.value)}
                  style={{ fontSize: '13px', fontWeight: '600' }}
                >
                  <option value="">بدون شعبة</option>
                  {formSections.map((section) => (
                    <option key={section.id} value={section.id}>
                      {section.name} — {section.label || 'شعبة'}
                    </option>
                  ))}
                </select>
                {formSections.length === 0 && (
                  <p style={{ fontSize: '11.5px', color: '#B45309', marginTop: '4px' }}>
                    لا توجد شعب لهذه المرحلة والدراسة. أضف شعبة من «إدارة الشُعب».
                  </p>
                )}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: '700', color: '#374151' }}>
                    الباركود {formMode === 'add' && <span style={{ color: '#6B7280', fontWeight: '500' }}>(اختياري)</span>}
                  </label>
                  <input
                    type="text"
                    className="input"
                    placeholder="تلقائي: S2-1001"
                    value={form.studentCode}
                    onChange={(e) => setForm((current) => ({ ...current, studentCode: e.target.value }))}
                    style={{ direction: 'ltr', textAlign: 'center', fontFamily: 'monospace', fontSize: '13px', fontWeight: '700' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: '700', color: '#374151' }}>التسلسل (ت)</label>
                  <input
                    type="number"
                    className="input"
                    placeholder="اختياري"
                    value={form.orderIndex}
                    onChange={(e) => setForm((current) => ({ ...current, orderIndex: e.target.value }))}
                    style={{ textAlign: 'center', fontSize: '13px' }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: '700', color: '#374151' }}>اسم الطالب الثلاثي أو الرباعي *</label>
                <input
                  type="text"
                  className="input"
                  placeholder="مثال: محمد رضا علي"
                  value={form.name}
                  onChange={(e) => setForm((current) => ({ ...current, name: e.target.value }))}
                  required
                  style={{ fontSize: '14px' }}
                />
              </div>

              {formError && (
                <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '8px', padding: '8px 12px', marginBottom: '12px', color: '#991B1B', fontSize: '12px' }}>
                  {formError}
                </div>
              )}

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-ghost" onClick={() => setFormMode(null)} style={{ fontSize: '13px' }}>
                  إلغاء
                </button>
                <button type="submit" className="btn btn-primary" disabled={formSubmitting || !form.name.trim()} style={{ fontSize: '13px' }}>
                  {formSubmitting ? 'جارٍ الحفظ...' : formMode === 'edit' ? 'حفظ التعديلات' : 'حفظ الطالب'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======== Import modal (preview then confirm) ======== */}
      {showImportModal && (
        <div className="modal-backdrop animate-fade-in" onClick={closeImport} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', zIndex: 1000 }}>
          <div className="glass-card animate-slide-up" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '720px', width: '100%', maxHeight: '90vh', overflowY: 'auto', padding: '22px', background: '#FFFFFF', borderRadius: '18px', border: '1px solid #E5E7EB' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: '800', color: '#111827' }}>استيراد الطلاب من Excel</h2>
              <button className="btn btn-ghost btn-sm" onClick={closeImport}>✕</button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginBottom: '14px', background: '#F9FAFB', padding: '12px', borderRadius: '12px', border: '1px solid #E5E7EB' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: '700', color: '#374151' }}>المرحلة الافتراضية</label>
                <select
                  className="input"
                  value={importStage}
                  onChange={(e) => {
                    setImportStage(Number(e.target.value));
                    setImportSectionId('');
                    setPreview(null);
                  }}
                  style={{ fontSize: '13px' }}
                >
                  {STAGE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: '700', color: '#374151' }}>نوع الدراسة</label>
                <select
                  className="input"
                  value={importPeriod}
                  onChange={(e) => {
                    setImportPeriod(e.target.value as Period);
                    setImportSectionId('');
                    setPreview(null);
                  }}
                  style={{ fontSize: '13px' }}
                >
                  <option value="MORNING">صباحي</option>
                  <option value="EVENING">مسائي</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: '700', color: '#374151' }}>الشعبة الافتراضية</label>
                <select
                  className="input"
                  value={importSectionId}
                  onChange={(e) => {
                    setImportSectionId(e.target.value);
                    setPreview(null);
                  }}
                  style={{ fontSize: '13px' }}
                >
                  <option value="">بدون شعبة</option>
                  {importSections.map((section) => (
                    <option key={section.id} value={section.id}>{section.name} — {section.label || 'شعبة'}</option>
                  ))}
                </select>
              </div>
            </div>

            <div style={{ marginBottom: '14px', padding: '14px', background: '#F9FAFB', borderRadius: '10px', border: '1px dashed var(--gold)', textAlign: 'center' }}>
              <p style={{ fontWeight: '700', marginBottom: '4px', fontSize: '13px', color: '#111827' }}>رفع ملف Excel / CSV</p>
              <p style={{ color: '#6B7280', fontSize: '12px', marginBottom: '10px' }}>
                الأعمدة المدعومة: الاسم، الشعبة (مثال: شعبة 1 أو A)، الباركود (اختياري)، التسلسل (اختياري)
              </p>
              <input
                type="file"
                accept=".xlsx, .xls, .csv"
                ref={fileInputRef}
                style={{ display: 'none' }}
                onChange={handleFileUpload}
              />
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={previewLoading}
                style={{ fontSize: '12px' }}
              >
                {previewLoading ? 'جارٍ التحقق...' : 'اختر ملف الإكسل'}
              </button>
            </div>

            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: '600', color: '#374151' }}>
                أو الصق القائمة (كل سطر: الباركود، الاسم، التسلسل)
              </label>
              <textarea
                className="input"
                rows={4}
                placeholder={'S2-1001, محمد رضا علي, 1\nS2-1002, أحمد محمد حسن, 2'}
                value={importText}
                onChange={(e) => {
                  setImportText(e.target.value);
                  setPreview(null);
                }}
                style={{ fontFamily: 'monospace', fontSize: '12px' }}
              />
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={handleTextPreview}
                disabled={!importText.trim() || previewLoading}
                style={{ marginTop: '8px', fontSize: '12px' }}
              >
                معاينة النص
              </button>
            </div>

            {importError && (
              <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '8px', padding: '10px 14px', marginBottom: '12px', color: '#991B1B', fontSize: '12.5px', fontWeight: '600' }}>
                ⚠️ {importError}
              </div>
            )}

            {preview && (
              <div style={{ marginBottom: '14px' }}>
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '10px' }}>
                  <PreviewPill label={`إجمالي: ${preview.summary.total}`} tone="gray" />
                  <PreviewPill label={`صالح: ${preview.summary.valid}`} tone="green" />
                  <PreviewPill label={`خطأ: ${preview.summary.invalid}`} tone="red" />
                </div>

                <div style={{ maxHeight: '230px', overflowY: 'auto', border: '1px solid #E5E7EB', borderRadius: '10px' }}>
                  <table className="attendance-table" style={{ fontSize: '12px' }}>
                    <thead>
                      <tr>
                        <th style={{ textAlign: 'center' }}>صف</th>
                        <th>الاسم</th>
                        <th style={{ textAlign: 'center' }}>الشعبة</th>
                        <th>الباركود</th>
                        <th style={{ textAlign: 'center' }}>الحالة</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.rows.map((row) => (
                        <tr key={`${row.row}-${row.studentCode}`}>
                          <td style={{ textAlign: 'center' }}>{row.row}</td>
                          <td>{row.name}</td>
                          <td style={{ textAlign: 'center', fontWeight: '700', color: row.section ? '#2563EB' : '#9CA3AF' }}>
                            {row.section ? `شعبة ${row.section}` : (importSectionId ? 'افتراضية' : 'بدون شعبة')}
                          </td>
                          <td style={{ fontFamily: 'monospace' }}>{row.studentCode}</td>
                          <td style={{ textAlign: 'center' }}>
                            {row.status === 'VALID' ? (
                              <span style={{ color: '#065F46', fontWeight: '700' }}>صالح</span>
                            ) : (
                              <span style={{ color: '#B91C1C', fontWeight: '700' }} title={row.errors.join(' — ')}>
                                مرفوض
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {invalidPreviewRows.length > 0 && (
                  <div style={{ marginTop: '10px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '8px', padding: '10px 12px', maxHeight: '120px', overflowY: 'auto' }}>
                    {invalidPreviewRows.map((row) => (
                      <div key={`err-${row.row}-${row.studentCode}`} style={{ fontSize: '12px', color: '#991B1B', marginBottom: '4px' }}>
                        صف {row.row}: {row.errors.join(' — ')}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
              <button type="button" className="btn btn-ghost" onClick={closeImport} style={{ fontSize: '13px' }}>
                إغلاق
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleConfirmImport}
                disabled={!preview || preview.summary.valid === 0 || confirmLoading}
                style={{ fontSize: '13px' }}
              >
                {confirmLoading ? 'جارٍ الاستيراد...' : `تأكيد استيراد ${preview?.summary.valid ?? 0} طالب`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk delete confirmation */}
      {bulkDeleteOpen && (
        <div
          className="modal-backdrop animate-fade-in"
          onClick={() => !bulkDeleteLoading && setBulkDeleteOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', zIndex: 1000 }}
        >
          <div
            className="glass-card animate-slide-up"
            onClick={(event) => event.stopPropagation()}
            style={{ maxWidth: '460px', width: '100%', padding: '24px' }}
          >
            <h3 style={{ fontSize: '18px', fontWeight: '800', color: '#111827', marginBottom: '8px' }}>
              حذف {selectedIds.size} طالبًا
            </h3>
            <p style={{ fontSize: '13.5px', color: '#4B5563', lineHeight: 1.8 }}>
              سيُخفى الطلاب المحددون من القوائم، وتبقى سجلات حضورهم السابقة محفوظة في التقارير.
              هل تريد المتابعة؟
            </p>
            <div style={{ display: 'flex', gap: '10px', marginTop: '18px' }}>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setBulkDeleteOpen(false)}
                disabled={bulkDeleteLoading}
                style={{ flex: 1, fontSize: '13px' }}
              >
                إلغاء
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={handleBulkDelete}
                disabled={bulkDeleteLoading}
                style={{ flex: 1, fontSize: '13px', fontWeight: '700' }}
              >
                {bulkDeleteLoading ? 'جارٍ الحذف...' : 'تأكيد الحذف'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* QR card modal */}
      <StudentQrCardModal
        student={selectedStudentForCard}
        onClose={() => setSelectedStudentForCard(null)}
      />

      {showBulkPrintModal && (
        <BulkStudentCardsModal
          students={filteredStudents}
          onClose={() => setShowBulkPrintModal(false)}
        />
      )}

      {canResetAbsences && (
        <ResetAbsencesModal
          isOpen={showResetModal}
          onClose={() => setShowResetModal(false)}
          onSuccess={(message) => {
            setSuccessBanner(message);
            loadStudents();
          }}
          currentStudyPeriod={periodFilter !== 'ALL' ? periodFilter : undefined}
          currentStage={stageFilter !== 'ALL' ? Number(stageFilter) : undefined}
          currentSection={selectedFilterSection?.name}
          currentSectionId={selectedFilterSection?.id}
        />
      )}

      <AttendancePdfReportModal
        isOpen={showPdfReportModal}
        onClose={() => setShowPdfReportModal(false)}
        reportTitle="كشف غيابات وحضور الطلبة"
        studyPeriodLabel={
          periodFilter === 'EVENING'
            ? 'الدراسة المسائية'
            : periodFilter === 'MORNING'
              ? 'الدراسة الصباحية'
              : 'كافة الدراسات'
        }
        sectionLabel={
          selectedFilterSection
            ? `شعبة ${selectedFilterSection.name}`
            : stageFilter !== 'ALL'
              ? `${STAGE_LABELS[stageFilter as 1 | 2 | 3 | 4]}`
              : 'كافة الشُعب'
        }
        records={filteredStudents.map((student) => ({
          ...student,
          ...statsFor(student),
        }))}
      />

      <StudentCourseEnrollmentModal
        isOpen={Boolean(selectedStudentForCourses)}
        student={selectedStudentForCourses}
        onClose={() => setSelectedStudentForCourses(null)}
        onSaved={() => {
          setSuccessBanner('تم حفظ المواد المطالب بها للطالب بنجاح');
          loadStudents();
        }}
      />

      <style jsx>{`
        .students-mobile-list {
          display: none;
          flex-direction: column;
          gap: 10px;
        }
        @media (max-width: 860px) {
          .students-desktop-table {
            display: none;
          }
          .students-mobile-list {
            display: flex;
          }
        }
      `}</style>
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: '6px 12px',
        borderRadius: '20px',
        fontSize: '12.5px',
        fontWeight: '700',
        border: active ? '1.5px solid #111827' : '1px solid #D1D5DB',
        background: active ? '#111827' : '#FFFFFF',
        color: active ? '#FFFFFF' : '#4B5563',
        cursor: 'pointer',
        fontFamily: 'inherit',
      }}
    >
      {children}
    </button>
  );
}

function PeriodBadge({ period }: { period?: string }) {
  const evening = period === 'EVENING';
  return (
    <span
      style={{
        padding: '3px 8px',
        borderRadius: '6px',
        fontSize: '11px',
        fontWeight: '700',
        background: evening ? '#F5F3FF' : '#EFF6FF',
        color: evening ? '#6D28D9' : '#1D4ED8',
        border: evening ? '1px solid #DDD6FE' : '1px solid #BFDBFE',
      }}
    >
      {evening ? 'مسائي' : 'صباحي'}
    </span>
  );
}

function MiniStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number | string;
  tone?: string;
}) {
  return (
    <div
      style={{
        flex: 1,
        minWidth: '74px',
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

function PreviewPill({ label, tone }: { label: string; tone: 'gray' | 'green' | 'red' }) {
  const styles = {
    gray: { background: '#F3F4F6', color: '#374151', border: '1px solid #D1D5DB' },
    green: { background: '#ECFDF5', color: '#065F46', border: '1px solid #A7F3D0' },
    red: { background: '#FEF2F2', color: '#991B1B', border: '1px solid #FCA5A5' },
  }[tone];

  return (
    <span
      style={{
        ...styles,
        padding: '4px 12px',
        borderRadius: '999px',
        fontSize: '12px',
        fontWeight: '700',
      }}
    >
      {label}
    </span>
  );
}

function StudentActions({
  student,
  canIssueQr,
  canManageStudents,
  onView,
  onCard,
  onCourses,
  onEdit,
  onDelete,
}: {
  student: StudentListItem;
  canIssueQr: boolean;
  canManageStudents: boolean;
  onView: () => void;
  onCard: () => void;
  onCourses: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const isCustom = student.academicStatus && student.academicStatus !== 'REGULAR';
  return (
    <div className="student-actions">
      <button
        className="btn btn-ghost btn-sm"
        style={{ fontSize: '12px', padding: '8px 12px' }}
        onClick={onView}
        title={`عرض سجل ${student.name}`}
      >
        السجل
      </button>
      {canIssueQr && (
        <button
          className="btn btn-ghost btn-sm"
          style={{ fontSize: '12px', padding: '8px 12px' }}
          onClick={onCard}
        >
          QR
        </button>
      )}
      {canManageStudents && (
        <>
          <button
            className="btn btn-ghost btn-sm"
            style={{
              fontSize: '12px',
              padding: '8px 12px',
              color: isCustom ? (student.academicStatus === 'REPEAT' ? '#DC2626' : '#059669') : '#2563EB',
              fontWeight: isCustom ? '800' : 'normal',
            }}
            onClick={onCourses}
            title={`تحديد المواد والمطالبة الأكاديمية لـ ${student.name}`}
          >
            المواد
          </button>
          <button
            className="btn btn-ghost btn-sm"
            style={{ fontSize: '12px', padding: '8px 12px' }}
            onClick={onEdit}
          >
            تعديل
          </button>
          <button
            className="btn btn-ghost btn-sm"
            style={{ fontSize: '12px', padding: '8px 12px', color: '#DC2626' }}
            onClick={onDelete}
          >
            حذف
          </button>
        </>
      )}
    </div>
  );
}
