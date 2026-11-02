'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { studentApi, MORNING_SECTIONS, EVENING_SECTIONS } from '../../lib/api';
import * as XLSX from 'xlsx';
import StudentQrCardModal from '../../components/cards/StudentQrCardModal';
import BulkStudentCardsModal from '../../components/cards/BulkStudentCardsModal';
import Navbar from '../../components/layout/Navbar';

interface AttendanceHistoryItem {
  attendanceId: string;
  lectureId: string;
  lectureName: string;
  lectureDate: string;
  status: string;
  registeredAt: string;
}

interface StudentWithStats {
  id: string;
  orderIndex: number;
  studentCode: string;
  name: string;
  studyPeriod?: string;
  section?: string;
  presentCount: number;
  absentCount: number;
  totalLectures: number;
  createdAt: string;
  history: AttendanceHistoryItem[];
}

interface ParsedImportStudent {
  orderIndex?: number;
  studentCode: string;
  name: string;
  studyPeriod?: string;
  section?: string;
  presentCount?: number;
  absentCount?: number;
  totalSessions?: number;
}

export default function StudentsPage() {
  const [students, setStudents] = useState<StudentWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Study period and section filter
  const [selectedStudyPeriod, setSelectedStudyPeriod] = useState<'ALL' | 'MORNING' | 'EVENING'>('ALL');
  const [selectedSection, setSelectedSection] = useState<string>('ALL');

  // Selected student for detail modal
  const [selectedStudent, setSelectedStudent] = useState<StudentWithStats | null>(null);

  // Student QR Card Modal & Bulk Print Modal
  const [selectedStudentForCard, setSelectedStudentForCard] = useState<StudentWithStats | null>(null);
  const [showBulkPrintModal, setShowBulkPrintModal] = useState(false);

  // Add single student modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [newCode, setNewCode] = useState('');
  const [newStudyPeriod, setNewStudyPeriod] = useState<'MORNING' | 'EVENING'>('MORNING');
  const [newSection, setNewSection] = useState('1');
  const [newOrder, setNewOrder] = useState<number | string>('');
  const [newPresent, setNewPresent] = useState<number | string>(0);
  const [newAbsent, setNewAbsent] = useState<number | string>(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [addError, setAddError] = useState('');

  // Delete confirmation modal
  const [deleteTarget, setDeleteTarget] = useState<StudentWithStats | null>(null);

  // Import modal
  const [showImportModal, setShowImportModal] = useState(false);
  const [importStudyPeriod, setImportStudyPeriod] = useState<'DETECT' | 'MORNING' | 'EVENING'>('DETECT');
  const [importSectionOverride, setImportSectionOverride] = useState<string>('AUTO');
  const [importText, setImportText] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load students on mount
  useEffect(() => {
    loadStudents();
  }, []);

  const loadStudents = async () => {
    setLoading(true);
    try {
      const data = await studentApi.getAll();
      setStudents(data);
    } catch (err: any) {
      console.error('Failed to load students:', err);
    } finally {
      setLoading(false);
    }
  };

  // Add a single student
  const handleAddStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newCode.trim()) return;

    setIsSubmitting(true);
    setAddError('');

    try {
      await studentApi.create({
        studentCode: newCode.trim(),
        name: newName.trim(),
        studyPeriod: newStudyPeriod,
        section: newSection.trim() || undefined,
        orderIndex: newOrder !== '' ? Number(newOrder) : undefined,
        presentCount: Number(newPresent || 0),
        absentCount: Number(newAbsent || 0),
      });
      setNewName('');
      setNewCode('');
      setNewSection('1');
      setNewOrder('');
      setNewPresent(0);
      setNewAbsent(0);
      setShowAddModal(false);
      loadStudents();
    } catch (err: any) {
      setAddError(err.message || 'فشل في إضافة الطالب');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete student with centered confirmation
  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await studentApi.delete(deleteTarget.id);
      setStudents(prev => prev.filter(s => s.id !== deleteTarget.id));
      if (selectedStudent?.id === deleteTarget.id) setSelectedStudent(null);
    } catch (err: any) {
      alert(err.message || 'فشل في الحذف');
    }
    setDeleteTarget(null);
  };

  // Bulk import via parsed list
  const handleBatchImport = async (parsedList: ParsedImportStudent[]) => {
    if (parsedList.length === 0) {
      alert('لم يتم العثور على بيانات صالحة للاستيراد');
      return;
    }

    setIsImporting(true);
    try {
      const res = await studentApi.createBatch(parsedList);
      setImportResult(res);
      loadStudents();
    } catch (err: any) {
      alert(err.message || 'فشل الاستيراد');
    } finally {
      setIsImporting(false);
    }
  };

  // Parse text area input
  const handleImportFromText = () => {
    const lines = importText.split('\n');
    const list: ParsedImportStudent[] = [];

    lines.forEach((line, idx) => {
      const trimmed = line.trim();
      if (!trimmed) return;

      const parts = trimmed.split(/[,;\t]+/).map(p => p.trim());
      if (parts.length >= 2) {
        let orderIndex = idx + 1;
        let studentCode = '';
        let name = '';
        let section = '';
        let presentCount = 0;
        let absentCount = 0;
        let totalSessions: number | undefined = undefined;

        // Format: orderIndex, name, section, presentCount, absentCount, totalSessions, barcode
        if (!isNaN(Number(parts[0])) && parts.length >= 3) {
          orderIndex = Number(parts[0]);
          name = parts[1];
          section = parts[2] || '';
          if (parts[3] && !isNaN(Number(parts[3]))) presentCount = Number(parts[3]);
          if (parts[4] && !isNaN(Number(parts[4]))) absentCount = Number(parts[4]);
          if (parts[5] && !isNaN(Number(parts[5]))) totalSessions = Number(parts[5]);
          studentCode = parts[6] || String(orderIndex);
        } else {
          studentCode = parts[0];
          name = parts[1];
          if (parts[2]) section = parts[2];
          if (parts[3] && !isNaN(Number(parts[3]))) presentCount = Number(parts[3]);
          if (parts[4] && !isNaN(Number(parts[4]))) absentCount = Number(parts[4]);
        }

        const targetStudyPeriod = importStudyPeriod !== 'DETECT' ? importStudyPeriod : 'MORNING';
        const finalSection = importSectionOverride !== 'AUTO' ? importSectionOverride : section;

        if (studentCode && name) {
          list.push({ orderIndex, studentCode, name, studyPeriod: targetStudyPeriod, section: finalSection || undefined, presentCount, absentCount, totalSessions });
        }
      }
    });

    handleBatchImport(list);
  };

  /**
   * Handle Excel file upload
   * Expected columns:
   *   A: الرقم التسلسلي (orderIndex)
   *   B: اسم الطالب (name)
   *   C: الشعبة (section)
   *   D: عدد الحضور (presentCount)
   *   E: عدد مرات الغياب (absentCount)
   *   F: إجمالي المحاضرات (totalSessions)
   *   G: الباركود (studentCode)
   * If columns have no header or values start from zero, handle accordingly.
   */
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });

        if (!rows || rows.length === 0) {
          alert('الملف فارغ أو لا يحتوي على بيانات');
          return;
        }

        // Detect header row
        let headerRowIndex = -1;
        let colOrder = -1;
        let colName = -1;
        let colStudyPeriod = -1;
        let colSection = -1;
        let colPresent = -1;
        let colAbsent = -1;
        let colTotal = -1;
        let colBarcode = -1;

        for (let r = 0; r < Math.min(5, rows.length); r++) {
          const row = rows[r];
          if (!row || !Array.isArray(row)) continue;
          const strRow = row.map(c => String(c || '').toLowerCase().trim());

          const hasName = strRow.some(c => c.includes('اسم') || c.includes('name') || c.includes('طالب'));
          const hasCodeOrOrder = strRow.some(c => c.includes('ت') || c.includes('رقم') || c.includes('باركو') || c.includes('barcode') || c.includes('id'));

          if (hasName || hasCodeOrOrder) {
            headerRowIndex = r;
            strRow.forEach((c, idx) => {
              if (c === 'ت' || c.startsWith('ت.') || c.includes('تسلسل') || c.includes('ترتيب') || c === '#' || c === 'no' || c === 'seq') {
                if (colOrder === -1) colOrder = idx;
              } else if (c.includes('اسم') || c.includes('طالب') || c.includes('name')) {
                if (colName === -1) colName = idx;
              } else if (c.includes('دراس') || c.includes('صباح') || c.includes('مسائ') || c.includes('period') || c.includes('shift')) {
                if (colStudyPeriod === -1) colStudyPeriod = idx;
              } else if (c.includes('شعب') || c.includes('section') || c.includes('group') || c.includes('قسم')) {
                if (colSection === -1) colSection = idx;
              } else if (c.includes('حضور') || c.includes('حاضر') || c.includes('present')) {
                if (colPresent === -1) colPresent = idx;
              } else if (c.includes('غياب') || c.includes('غائب') || c.includes('absent')) {
                if (colAbsent === -1) colAbsent = idx;
              } else if (c.includes('اجمال') || c.includes('إجمال') || c.includes('مجموع') || c.includes('total') || c.includes('محاضر')) {
                if (colTotal === -1) colTotal = idx;
              } else if (c.includes('باركو') || c.includes('barcode') || c.includes('كود') || c.includes('id') || c.includes('معرف') || c.includes('قيد') || c.includes('جامعي') || c.includes('احصائي') || c.includes('إحصائي')) {
                if (colBarcode === -1) colBarcode = idx;
              }
            });
            break;
          }
        }

        // Positional fallback if no header detected:
        // A=ت, B=اسم الطالب, C=الدراسة, D=الشعبة, E=الحضور, F=الغياب, G=إجمالي المحاضرات, H=الباركود
        if (headerRowIndex === -1) {
          const maxCols = Math.max(...rows.slice(0, 5).map(r => Array.isArray(r) ? r.length : 0));
          if (maxCols >= 8) {
            colOrder = 0;
            colName = 1;
            colStudyPeriod = 2;
            colSection = 3;
            colPresent = 4;
            colAbsent = 5;
            colTotal = 6;
            colBarcode = 7;
          } else {
            colOrder = 0;
            colName = 1;
            colSection = 2;
            colPresent = 3;
            colAbsent = 4;
            colTotal = 5;
            colBarcode = 6;
          }
        }

        const startRow = headerRowIndex >= 0 ? headerRowIndex + 1 : 0;
        const list: ParsedImportStudent[] = [];

        for (let i = startRow; i < rows.length; i++) {
          const row = rows[i];
          if (!row || row.length === 0) continue;

          let orderIndex = i - startRow + 1;
          let name = '';
          let studyPeriod = 'MORNING';
          let section = '';
          let presentCount = 0;
          let absentCount = 0;
          let totalSessions: number | undefined = undefined;
          let studentCode = '';

          // Use detected columns
          if (colOrder >= 0 && row[colOrder] != null && !isNaN(Number(row[colOrder]))) {
            orderIndex = Number(row[colOrder]);
          }
          if (colName >= 0) name = String(row[colName] || '').trim();

          // Study period detection from row
          if (colStudyPeriod >= 0 && row[colStudyPeriod]) {
            const pVal = String(row[colStudyPeriod]).toLowerCase();
            if (pVal.includes('مسائ') || pVal.includes('evening')) {
              studyPeriod = 'EVENING';
            } else {
              studyPeriod = 'MORNING';
            }
          }
          // User explicit override
          if (importStudyPeriod !== 'DETECT') {
            studyPeriod = importStudyPeriod;
          }

          if (colSection >= 0 && row[colSection] != null) {
            let sRaw = String(row[colSection] || '').trim();
            sRaw = sRaw.replace(/^(شعبة|الشعبة)\s*/i, '').trim();
            const arabicNumMap: Record<string, string> = {
              'الاولى': '1', 'الأولى': '1', 'الاول': '1', 'الأول': '1',
              'الثانية': '2', 'الثاني': '2',
              'الثالثة': '3', 'الثالث': '3',
              'الرابعة': '4', 'الرابع': '4',
              'الخامسة': '5', 'الخامس': '5',
              'السادسة': '6', 'السادس': '6',
              'السابعة': '7', 'السابع': '7',
              'الثامنة': '8', 'الثامن': '8',
            };
            section = arabicNumMap[sRaw] || sRaw;
          }
          if (importSectionOverride !== 'AUTO') {
            section = importSectionOverride;
          }

          if (colPresent >= 0 && row[colPresent] != null) presentCount = Math.max(0, Number(row[colPresent]) || 0);
          if (colAbsent >= 0 && row[colAbsent] != null) absentCount = Math.max(0, Number(row[colAbsent]) || 0);
          if (colTotal >= 0 && row[colTotal] != null && !isNaN(Number(row[colTotal]))) {
            totalSessions = Number(row[colTotal]);
          }
          if (colBarcode >= 0 && row[colBarcode] != null) {
            studentCode = String(row[colBarcode] || '').trim().replace(/\.0$/, '');
          }

          // If barcode column is empty, generate from orderIndex
          if (!studentCode && orderIndex > 0) {
            studentCode = String(orderIndex);
          }

          if (studentCode && name) {
            list.push({
              orderIndex,
              studentCode,
              name,
              studyPeriod,
              section: section || undefined,
              presentCount,
              absentCount,
              totalSessions,
            });
          }
        }

        handleBatchImport(list);
      } catch (err: any) {
        alert('فشل قراءة ملف الإكسل: ' + err.message);
      }
    };
    reader.readAsBinaryString(file);
  };

  /**
   * Export students to Excel (.xlsx)
   * Columns: A=ت, B=اسم الطالب, C=الدراسة, D=الشعبة, E=عدد مرات الحضور, F=عدد مرات الغياب, G=اجمالى المحاضرات, H=الباركود
   */
  const handleExportExcel = () => {
    if (students.length === 0) {
      alert('لا توجد بيانات طلاب للتصدير');
      return;
    }

    const exportData = students.map((s, index) => ({
      'ت': s.orderIndex != null ? s.orderIndex : (index + 1),
      'اسم الطالب': s.name,
      'الدراسة': (s.studyPeriod || 'MORNING') === 'EVENING' ? 'مسائي' : 'صباحي',
      'الشعبة': s.section || '',
      'عدد مرات الحضور': s.presentCount,
      'عدد مرات الغياب': s.absentCount,
      'اجمالى المحاضرات': s.totalLectures,
      'الباركود': s.studentCode,
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);

    worksheet['!cols'] = [
      { wch: 8 },
      { wch: 28 },
      { wch: 12 },
      { wch: 12 },
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

  // Sections definitions from unified lib/api
  const morningSections = MORNING_SECTIONS;
  const eveningSections = EVENING_SECTIONS;

  // Helper to get formatted section name
  const getSectionDisplayName = (sec?: string | null) => {
    if (!sec) return '-';
    const num = String(sec).replace(/[^0-9]/g, '');
    const names: Record<string, string> = {
      '1': 'الأولى (1)',
      '2': 'الثانية (2)',
      '3': 'الثالثة (3)',
      '4': 'الرابعة (4)',
      '5': 'الخامسة (5)',
      '6': 'السادسة (6)',
      '7': 'السابعة (7)',
      '8': 'الثامنة (8)',
    };
    return names[num] ? `الشعبة ${names[num]}` : sec;
  };

  const filteredStudents = students.filter(s => {
    // 1. Study period filter
    if (selectedStudyPeriod !== 'ALL') {
      const period = s.studyPeriod || 'MORNING';
      if (period !== selectedStudyPeriod) return false;
    }

    // 2. Section filter
    if (selectedSection !== 'ALL') {
      const sec = String(s.section || '').trim();
      const secNum = sec.replace(/[^0-9]/g, '');
      const filterNum = selectedSection.replace(/[^0-9]/g, '');
      if (filterNum && secNum) {
        if (secNum !== filterNum) return false;
      } else if (sec !== selectedSection) {
        return false;
      }
    }

    // 3. Search term filter
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      const matchesName = s.name.toLowerCase().includes(term);
      const matchesCode = s.studentCode.toLowerCase().includes(term);
      const matchesSection = (s.section && s.section.toLowerCase().includes(term));
      return matchesName || matchesCode || matchesSection;
    }

    return true;
  });

  const morningCount = students.filter(s => (s.studyPeriod || 'MORNING') === 'MORNING').length;
  const eveningCount = students.filter(s => s.studyPeriod === 'EVENING').length;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)' }}>
      {/* Unified Header / Navbar Component */}
      <Navbar />

      <div className="students-page-main-layout" style={{ maxWidth: '1200px', margin: '0 auto', padding: '24px 20px' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h1 style={{ fontSize: '24px', fontWeight: '800', color: '#111827', marginBottom: '4px' }}>
              سجل الطلاب وقاعدة البيانات
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
              قسم تقنيات المختبرات الطبية • الدراسة الصباحية والمسائية
            </p>
          </div>

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button
              className="btn btn-primary btn-sm"
              onClick={() => setShowBulkPrintModal(true)}
              disabled={filteredStudents.length === 0}
              style={{ fontSize: '12px' }}
            >
              طباعة بطاقات الطلاب ({filteredStudents.length})
            </button>
            <button
              className="btn btn-primary btn-sm"
              onClick={() => { setShowAddModal(true); setAddError(''); }}
              style={{ fontSize: '12px' }}
            >
              إضافة طالب
            </button>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => { setShowImportModal(true); setImportResult(null); }}
              style={{ fontSize: '12px' }}
            >
              استيراد طلاب
            </button>
            <button
              className="btn btn-success btn-sm"
              onClick={handleExportExcel}
              style={{ fontSize: '12px' }}
            >
              تصدير Excel
            </button>
          </div>
        </div>

        {/* Study Period Filter Selector (Tabs) */}
        <div style={{ background: '#FFFFFF', padding: '16px 20px', borderRadius: '16px', border: '1px solid #E5E7EB', marginBottom: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', marginBottom: selectedStudyPeriod !== 'ALL' ? '14px' : '0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '14px', fontWeight: '800', color: '#111827' }}>نوع الدراسة:</span>
              <div style={{ display: 'flex', gap: '6px', background: '#F3F4F6', padding: '4px', borderRadius: '10px' }}>
                <button
                  type="button"
                  onClick={() => { setSelectedStudyPeriod('ALL'); setSelectedSection('ALL'); }}
                  style={{
                    padding: '6px 14px',
                    borderRadius: '8px',
                    fontSize: '13px',
                    fontWeight: '700',
                    border: 'none',
                    cursor: 'pointer',
                    background: selectedStudyPeriod === 'ALL' ? '#111827' : 'transparent',
                    color: selectedStudyPeriod === 'ALL' ? '#FFFFFF' : '#4B5563',
                    transition: 'all 0.15s ease',
                  }}
                >
                  الكل ({students.length})
                </button>
                <button
                  type="button"
                  onClick={() => { setSelectedStudyPeriod('MORNING'); setSelectedSection('ALL'); }}
                  style={{
                    padding: '6px 14px',
                    borderRadius: '8px',
                    fontSize: '13px',
                    fontWeight: '700',
                    border: 'none',
                    cursor: 'pointer',
                    background: selectedStudyPeriod === 'MORNING' ? '#2563EB' : 'transparent',
                    color: selectedStudyPeriod === 'MORNING' ? '#FFFFFF' : '#4B5563',
                    transition: 'all 0.15s ease',
                  }}
                >
                  الصباحي ({morningCount})
                </button>
                <button
                  type="button"
                  onClick={() => { setSelectedStudyPeriod('EVENING'); setSelectedSection('ALL'); }}
                  style={{
                    padding: '6px 14px',
                    borderRadius: '8px',
                    fontSize: '13px',
                    fontWeight: '700',
                    border: 'none',
                    cursor: 'pointer',
                    background: selectedStudyPeriod === 'EVENING' ? '#7C3AED' : 'transparent',
                    color: selectedStudyPeriod === 'EVENING' ? '#FFFFFF' : '#4B5563',
                    transition: 'all 0.15s ease',
                  }}
                >
                  المسائي ({eveningCount})
                </button>
              </div>
            </div>

            {/* Student Counts */}
            <div style={{ fontSize: '13px', color: '#6B7280' }}>
              المعروض حالياً: <strong style={{ color: '#111827' }}>{filteredStudents.length}</strong> طالب
            </div>
          </div>

          {/* Section Filter Buttons: Dynamic depending on Morning vs Evening */}
          {selectedStudyPeriod === 'MORNING' && (
            <div style={{ paddingTop: '12px', borderTop: '1px solid #F3F4F6', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '13px', fontWeight: '700', color: '#1E40AF' }}>شعب الصباحي (1 - 3):</span>
              <button
                type="button"
                onClick={() => setSelectedSection('ALL')}
                style={{
                  padding: '5px 12px',
                  borderRadius: '20px',
                  fontSize: '12px',
                  fontWeight: '700',
                  border: selectedSection === 'ALL' ? '1.5px solid #2563EB' : '1px solid #D1D5DB',
                  background: selectedSection === 'ALL' ? '#EFF6FF' : '#FFFFFF',
                  color: selectedSection === 'ALL' ? '#1D4ED8' : '#4B5563',
                  cursor: 'pointer',
                }}
              >
                كافة الشعب الصباحية
              </button>
              {morningSections.map(sec => (
                <button
                  key={sec.value}
                  type="button"
                  onClick={() => setSelectedSection(sec.value)}
                  style={{
                    padding: '5px 12px',
                    borderRadius: '20px',
                    fontSize: '12px',
                    fontWeight: '700',
                    border: selectedSection === sec.value ? '1.5px solid #2563EB' : '1px solid #D1D5DB',
                    background: selectedSection === sec.value ? '#EFF6FF' : '#FFFFFF',
                    color: selectedSection === sec.value ? '#1D4ED8' : '#4B5563',
                    cursor: 'pointer',
                  }}
                >
                  {sec.label} ({sec.value})
                </button>
              ))}
            </div>
          )}

          {selectedStudyPeriod === 'EVENING' && (
            <div style={{ paddingTop: '12px', borderTop: '1px solid #F3F4F6', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '13px', fontWeight: '700', color: '#6D28D9' }}>شعب المسائي (1 - 8):</span>
              <button
                type="button"
                onClick={() => setSelectedSection('ALL')}
                style={{
                  padding: '5px 12px',
                  borderRadius: '20px',
                  fontSize: '12px',
                  fontWeight: '700',
                  border: selectedSection === 'ALL' ? '1.5px solid #7C3AED' : '1px solid #D1D5DB',
                  background: selectedSection === 'ALL' ? '#F5F3FF' : '#FFFFFF',
                  color: selectedSection === 'ALL' ? '#6D28D9' : '#4B5563',
                  cursor: 'pointer',
                }}
              >
                كافة الشعب المسائية
              </button>
              {eveningSections.map(sec => (
                <button
                  key={sec.value}
                  type="button"
                  onClick={() => setSelectedSection(sec.value)}
                  style={{
                    padding: '5px 12px',
                    borderRadius: '20px',
                    fontSize: '12px',
                    fontWeight: '700',
                    border: selectedSection === sec.value ? '1.5px solid #7C3AED' : '1px solid #D1D5DB',
                    background: selectedSection === sec.value ? '#F5F3FF' : '#FFFFFF',
                    color: selectedSection === sec.value ? '#6D28D9' : '#4B5563',
                    cursor: 'pointer',
                  }}
                >
                  {sec.label} ({sec.value})
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Quick Stats Cards: NO Rate */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px', marginBottom: '24px' }}>
          <div className="counter-card" style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', borderTop: '3px solid var(--gold)', padding: '14px' }}>
            <span className="count" style={{ color: 'var(--gold-dark)' }}>{filteredStudents.length}</span>
            <span className="label" style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>الطلاب المطابقون للفلتر</span>
          </div>
          <div className="counter-card" style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', borderTop: '3px solid #6B7280', padding: '14px' }}>
            <span className="count" style={{ color: '#111827' }}>
              {filteredStudents.filter(s => s.absentCount >= 3).length}
            </span>
            <span className="label" style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>معرض للإنذار (3+ غياب)</span>
          </div>
        </div>

        {/* Search */}
        <div style={{ marginBottom: '20px' }}>
          <input
            type="text"
            className="input"
            placeholder="ابحث بالاسم أو بالباركود أو بالشعبة..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            style={{ maxWidth: '420px', fontSize: '13px', padding: '10px 14px' }}
          />
        </div>

        {/* Students Table */}
        {loading ? (
          <div className="empty-state">
            <p style={{ color: 'var(--text-muted)' }}>جاري تحميل بيانات الطلاب...</p>
          </div>
        ) : filteredStudents.length === 0 ? (
          <div className="empty-state" style={{ padding: '40px', textAlign: 'center' }}>
            <p style={{ color: 'var(--text-muted)', fontSize: '16px', fontWeight: '600' }}>
              {searchTerm || selectedStudyPeriod !== 'ALL' || selectedSection !== 'ALL'
                ? 'لا توجد نتائج مطابقة للبحث أو للفلتر المحدد'
                : 'لا يوجد طلاب مسجلون بعد'}
            </p>
            <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '6px' }}>
              قم بإضافة طلاب فردياً أو استيرادهم من ملف إكسل
            </p>
            <div style={{ display: 'flex', gap: '10px', marginTop: '16px', justifyContent: 'center' }}>
              <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>إضافة طالب جديد</button>
              <button className="btn btn-ghost" onClick={() => setShowImportModal(true)}>استيراد ملف إكسل</button>
            </div>
          </div>
        ) : (
          <div className="glass-card" style={{ padding: '16px', overflowX: 'auto', background: '#FFFFFF', borderRadius: '14px', border: '1px solid #E5E7EB' }}>
            <table className="attendance-table" style={{ fontSize: '13px' }}>
              <thead>
                <tr>
                  <th style={{ width: '50px', textAlign: 'center' }}>ت</th>
                  <th>اسم الطالب</th>
                  <th style={{ textAlign: 'center' }}>الدراسة</th>
                  <th style={{ textAlign: 'center' }}>الشعبة</th>
                  <th style={{ textAlign: 'center' }}>الحضور</th>
                  <th style={{ textAlign: 'center' }}>الغياب</th>
                  <th style={{ textAlign: 'center' }}>الإجمالي</th>
                  <th>الباركود</th>
                  <th style={{ textAlign: 'center' }}>بطاقة QR</th>
                  <th style={{ textAlign: 'center' }}>التفاصيل</th>
                  <th style={{ textAlign: 'center', width: '60px' }}>حذف</th>
                </tr>
              </thead>
              <tbody>
                {filteredStudents.map((student) => (
                  <tr key={student.id} className="animate-fade-in">
                    <td style={{ color: 'var(--text-muted)', fontWeight: '700', textAlign: 'center' }}>
                      {student.orderIndex}
                    </td>
                    <td style={{ fontWeight: '700', fontSize: '14px', color: '#111827' }}>{student.name}</td>
                    <td style={{ textAlign: 'center' }}>
                      <span
                        style={{
                          padding: '3px 8px',
                          borderRadius: '6px',
                          fontSize: '11px',
                          fontWeight: '700',
                          background: (student.studyPeriod || 'MORNING') === 'EVENING' ? '#F5F3FF' : '#EFF6FF',
                          color: (student.studyPeriod || 'MORNING') === 'EVENING' ? '#6D28D9' : '#1D4ED8',
                          border: (student.studyPeriod || 'MORNING') === 'EVENING' ? '1px solid #DDD6FE' : '1px solid #BFDBFE',
                        }}
                      >
                        {(student.studyPeriod || 'MORNING') === 'EVENING' ? 'مسائي' : 'صباحي'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'center', fontSize: '12px', fontWeight: '600', color: '#374151' }}>
                      {getSectionDisplayName(student.section)}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <span style={{ color: '#059669', fontWeight: '700' }}>{student.presentCount}</span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <span style={{ color: student.absentCount > 0 ? '#DC2626' : '#6B7280', fontWeight: '700' }}>
                        {student.absentCount}
                      </span>
                    </td>
                    <td style={{ textAlign: 'center', fontWeight: '600', color: '#374151' }}>
                      {student.totalLectures}
                    </td>
                    <td>
                      <span style={{ fontFamily: 'monospace', fontSize: '13px', letterSpacing: '0.5px', color: '#111827', fontWeight: '600' }}>
                        {student.studentCode}
                      </span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <button
                        className="btn btn-ghost btn-sm"
                        style={{ fontSize: '11px', padding: '3px 8px', fontWeight: '700' }}
                        onClick={() => setSelectedStudentForCard(student)}
                      >
                        بطاقة QR
                      </button>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <button
                        className="btn btn-ghost btn-sm"
                        style={{ fontSize: '11px', padding: '3px 8px' }}
                        onClick={() => setSelectedStudent(student)}
                      >
                        عرض السجل
                      </button>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <button
                        className="btn btn-ghost btn-sm"
                        style={{ color: '#DC2626', padding: '3px 6px', fontSize: '11px' }}
                        onClick={() => setDeleteTarget(student)}
                      >
                        حذف
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ======== Detail History Modal ======== */}
        {selectedStudent && (
          <div className="modal-backdrop animate-fade-in" onClick={() => setSelectedStudent(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', zIndex: 1000 }}>
            <div className="glass-card animate-slide-up" onClick={e => e.stopPropagation()} style={{ maxWidth: '580px', width: '100%', maxHeight: '85vh', overflowY: 'auto', padding: '24px', background: '#FFFFFF', borderRadius: '18px', border: '1px solid #E5E7EB' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '18px' }}>
                <div>
                  <h2 style={{ fontSize: '20px', fontWeight: '800', marginBottom: '4px', color: '#111827' }}>{selectedStudent.name}</h2>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <span style={{ fontFamily: 'monospace', fontSize: '13px', color: '#4B5563' }}>الباركود: {selectedStudent.studentCode}</span>
                    {selectedStudent.section && <span style={{ fontSize: '12px', color: '#6B7280' }}>- شعبة {selectedStudent.section}</span>}
                  </div>
                </div>
                <button className="btn btn-ghost btn-sm" onClick={() => setSelectedStudent(null)} style={{ fontSize: '14px' }}>✕</button>
              </div>

              {/* Stats Bar: No rate */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '18px' }}>
                <div className="counter-card" style={{ padding: '10px', background: '#F9FAFB', border: '1px solid #E5E7EB' }}>
                  <span className="count" style={{ fontSize: '20px', color: '#059669' }}>{selectedStudent.presentCount}</span>
                  <span className="label" style={{ fontSize: '11px' }}>حضور</span>
                </div>
                <div className="counter-card" style={{ padding: '10px', background: '#F9FAFB', border: '1px solid #E5E7EB' }}>
                  <span className="count" style={{ fontSize: '20px', color: '#DC2626' }}>{selectedStudent.absentCount}</span>
                  <span className="label" style={{ fontSize: '11px' }}>غياب</span>
                </div>
                <div className="counter-card" style={{ padding: '10px', background: '#F9FAFB', border: '1px solid #E5E7EB' }}>
                  <span className="count" style={{ fontSize: '20px', color: 'var(--gold-dark)' }}>{selectedStudent.totalLectures}</span>
                  <span className="label" style={{ fontSize: '11px' }}>إجمالي</span>
                </div>
              </div>

              <h3 style={{ fontSize: '14px', fontWeight: '700', marginBottom: '10px', color: '#374151' }}>سجل المحاضرات:</h3>

              {selectedStudent.history.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', fontSize: '13px', textAlign: 'center', padding: '16px' }}>
                  لم يتم تسجيل أي حضور بعد لهذا الطالب
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {selectedStudent.history.map(item => (
                    <div key={item.attendanceId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: '#F9FAFB', borderRadius: '8px', fontSize: '12px', border: '1px solid #F3F4F6' }}>
                      <div>
                        <div style={{ fontWeight: '600', color: '#111827' }}>{item.lectureName}</div>
                        <div style={{ color: '#6B7280', fontSize: '11px' }}>{new Date(item.lectureDate).toLocaleDateString('ar-IQ')}</div>
                      </div>
                      <div style={{ textAlign: 'left' }}>
                        <span style={{ padding: '2px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: '700', background: item.status === 'PRESENT' ? '#ECFDF5' : '#FEF2F2', color: item.status === 'PRESENT' ? '#065F46' : '#991B1B' }}>
                          {item.status === 'PRESENT' ? 'حاضر' : 'غائب'}
                        </span>
                        <div style={{ color: '#9CA3AF', fontSize: '10px', marginTop: '2px', direction: 'ltr' }}>
                          {new Date(item.registeredAt).toLocaleTimeString('ar-IQ', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ======== DELETE CONFIRMATION MODAL (Centered Professional) ======== */}
        {deleteTarget && (
          <div className="modal-backdrop animate-fade-in" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', zIndex: 1000 }}>
            <div className="glass-card animate-slide-up" style={{ maxWidth: '400px', width: '100%', background: '#FFFFFF', borderRadius: '18px', padding: '28px', textAlign: 'center', boxShadow: '0 20px 50px rgba(0,0,0,0.25)', border: '1px solid #E5E7EB' }}>
              <div style={{ width: '50px', height: '50px', borderRadius: '50%', background: '#FEF2F2', color: '#DC2626', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px auto' }}>
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6"/>
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                </svg>
              </div>
              <h3 style={{ fontSize: '17px', fontWeight: '800', color: '#111827', marginBottom: '8px' }}>تأكيد حذف الطالب</h3>
              <p style={{ fontSize: '13px', color: '#4B5563', lineHeight: '1.6', marginBottom: '20px' }}>
                هل أنت متأكد من حذف الطالب <strong>{deleteTarget.name}</strong> (باركود: {deleteTarget.studentCode})؟<br />
                هذا الإجراء لا يمكن التراجع عنه.
              </p>
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
                <button className="btn btn-ghost" onClick={() => setDeleteTarget(null)} style={{ flex: 1, fontSize: '13px' }}>إلغاء</button>
                <button className="btn btn-danger" onClick={handleConfirmDelete} style={{ flex: 1, fontSize: '13px', fontWeight: '700' }}>تأكيد الحذف</button>
              </div>
            </div>
          </div>
        )}

        {/* ======== Add Student Modal ======== */}
        {showAddModal && (
          <div className="modal-backdrop animate-fade-in" onClick={() => setShowAddModal(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', zIndex: 1000 }}>
            <div className="glass-card animate-slide-up" onClick={e => e.stopPropagation()} style={{ maxWidth: '460px', width: '100%', padding: '24px', background: '#FFFFFF', borderRadius: '18px', border: '1px solid #E5E7EB' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
                <h2 style={{ fontSize: '18px', fontWeight: '800', color: '#111827' }}>إضافة طالب جديد</h2>
                <button className="btn btn-ghost btn-sm" onClick={() => setShowAddModal(false)}>✕</button>
              </div>

              <form onSubmit={handleAddStudent}>
                {/* Study Period & Section Selector */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: '600', color: '#374151' }}>نوع الدراسة *</label>
                    <select
                      className="input"
                      value={newStudyPeriod}
                      onChange={(e) => {
                        const p = e.target.value as 'MORNING' | 'EVENING';
                        setNewStudyPeriod(p);
                        // reset section to 1
                        setNewSection('1');
                      }}
                      style={{ fontSize: '13px', fontWeight: '700', padding: '8px 10px', width: '100%' }}
                    >
                      <option value="MORNING">الدراسة الصباحية</option>
                      <option value="EVENING">الدراسة المسائية</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: '600', color: '#374151' }}>الشعبة *</label>
                    <select
                      className="input"
                      value={newSection}
                      onChange={(e) => setNewSection(e.target.value)}
                      style={{ fontSize: '13px', fontWeight: '700', padding: '8px 10px', width: '100%' }}
                    >
                      {newStudyPeriod === 'MORNING' ? (
                        morningSections.map(s => (
                          <option key={s.value} value={s.value}>
                            {s.label} ({s.value})
                          </option>
                        ))
                      ) : (
                        eveningSections.map(s => (
                          <option key={s.value} value={s.value}>
                            {s.label} ({s.value})
                          </option>
                        ))
                      )}
                    </select>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: '600', color: '#374151' }}>الباركود (رقم الطالب) *</label>
                    <input type="text" className="input" placeholder="مثال: 1001" value={newCode} onChange={e => setNewCode(e.target.value)} required style={{ direction: 'ltr', textAlign: 'center', fontFamily: 'monospace', fontSize: '14px', fontWeight: '700' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: '600', color: '#374151' }}>التسلسل (ت اختياري)</label>
                    <input type="number" className="input" placeholder="مثال: 1" value={newOrder} onChange={e => setNewOrder(e.target.value)} style={{ textAlign: 'center', fontSize: '14px' }} />
                  </div>
                </div>

                <div style={{ marginBottom: '14px' }}>
                  <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: '600', color: '#374151' }}>اسم الطالب الثلاثي أو الرباعي *</label>
                  <input type="text" className="input" placeholder="مثال: محمد رضا علي" value={newName} onChange={e => setNewName(e.target.value)} required style={{ fontSize: '14px' }} />
                </div>

                {addError && (
                  <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '8px', padding: '8px 12px', marginBottom: '14px', color: '#991B1B', fontSize: '12px' }}>
                    {addError}
                  </div>
                )}

                <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                  <button type="button" className="btn btn-ghost" onClick={() => setShowAddModal(false)} style={{ fontSize: '13px' }}>إلغاء</button>
                  <button type="submit" className="btn btn-primary" disabled={isSubmitting || !newName.trim() || !newCode.trim()} style={{ fontSize: '13px' }}>
                    {isSubmitting ? 'جاري الحفظ...' : 'حفظ الطالب'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ======== Bulk Import Modal ======== */}
        {showImportModal && (
          <div className="modal-backdrop animate-fade-in" onClick={() => setShowImportModal(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', zIndex: 1000 }}>
            <div className="glass-card animate-slide-up" onClick={e => e.stopPropagation()} style={{ maxWidth: '620px', width: '100%', maxHeight: '90vh', overflowY: 'auto', padding: '24px', background: '#FFFFFF', borderRadius: '18px', border: '1px solid #E5E7EB' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
                <h2 style={{ fontSize: '18px', fontWeight: '800', color: '#111827' }}>استيراد طلاب دفعة واحدة</h2>
                <button className="btn btn-ghost btn-sm" onClick={() => setShowImportModal(false)}>✕</button>
              </div>

              {/* Import Options: Study Period & Section assignment */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px', background: '#F9FAFB', padding: '14px', borderRadius: '12px', border: '1px solid #E5E7EB' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: '700', color: '#374151' }}>
                    تعيين نوع الدراسة للطلاب المستوردين:
                  </label>
                  <select
                    className="input"
                    value={importStudyPeriod}
                    onChange={(e) => setImportStudyPeriod(e.target.value as any)}
                    style={{ fontSize: '13px', fontWeight: '600', padding: '8px 10px', width: '100%' }}
                  >
                    <option value="DETECT">تلقائي (حسب المكتوب بالملف)</option>
                    <option value="MORNING">الدراسة الصباحية</option>
                    <option value="EVENING">الدراسة المسائية</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: '700', color: '#374151' }}>
                    تحديد الشعبة (اختياري):
                  </label>
                  <select
                    className="input"
                    value={importSectionOverride}
                    onChange={(e) => setImportSectionOverride(e.target.value)}
                    style={{ fontSize: '13px', fontWeight: '600', padding: '8px 10px', width: '100%' }}
                  >
                    <option value="AUTO">تلقائي (حسب المكتوب بالملف)</option>
                    <option value="1">الشعبة الأولى (1)</option>
                    <option value="2">الشعبة الثانية (2)</option>
                    <option value="3">الشعبة الثالثة (3)</option>
                    <option value="4">الشعبة الرابعة (4 - مسائي)</option>
                    <option value="5">الشعبة الخامسة (5 - مسائي)</option>
                    <option value="6">الشعبة السادسة (6 - مسائي)</option>
                    <option value="7">الشعبة السابعة (7 - مسائي)</option>
                    <option value="8">الشعبة الثامنة (8 - مسائي)</option>
                  </select>
                </div>
              </div>

              {/* Option 1: File Upload */}
              <div style={{ marginBottom: '18px', padding: '16px', background: '#F9FAFB', borderRadius: '10px', border: '1px dashed var(--gold)', textAlign: 'center' }}>
                <p style={{ fontWeight: '600', marginBottom: '4px', fontSize: '13px', color: '#111827' }}>رفع ملف Excel أو CSV</p>
                <p style={{ color: '#6B7280', fontSize: '12px', marginBottom: '10px' }}>قم باختيار ملف الإكسل المباشر لتحميل بيانات الطلاب</p>
                <input type="file" accept=".xlsx, .xls, .csv" ref={fileInputRef} style={{ display: 'none' }} onChange={handleFileUpload} />
                <button type="button" className="btn btn-primary btn-sm" onClick={() => fileInputRef.current?.click()} disabled={isImporting} style={{ fontSize: '12px' }}>
                  {isImporting ? 'جاري المعالجة...' : 'اختر ملف الإكسل'}
                </button>
              </div>

              {/* Option 2: Copy-Paste */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: '600', color: '#374151' }}>
                  أو الصق القائمة هنا (كل سطر: الباركود ثم الاسم مفصولة بفاصلة):
                </label>
                <textarea
                  className="input"
                  rows={5}
                  placeholder={`1001, محمد رضا علي, 1\n1002, أحمد محمد حسن, 2\n1003, زينب خالد عباس, 1`}
                  value={importText}
                  onChange={e => setImportText(e.target.value)}
                  style={{ fontFamily: 'monospace', fontSize: '12px' }}
                />
              </div>

              {importResult && (
                <div style={{ background: '#ECFDF5', border: '1px solid #A7F3D0', borderRadius: '8px', padding: '10px 14px', marginBottom: '14px', color: '#065F46', fontSize: '12px', fontWeight: '600' }}>
                  تم استيراد/تحديث {importResult.count} طالب بنجاح
                  {importResult.created > 0 && <span> ({importResult.created} جديد)</span>}
                  {importResult.updated > 0 && <span> ({importResult.updated} محدث)</span>}
                </div>
              )}

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-ghost" onClick={() => setShowImportModal(false)} style={{ fontSize: '13px' }}>إغلاق</button>
                <button type="button" className="btn btn-primary" onClick={handleImportFromText} disabled={isImporting || !importText.trim()} style={{ fontSize: '13px' }}>
                  {isImporting ? 'جاري الاستيراد...' : 'بدء الاستيراد'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Individual Student QR Card Modal */}
      <StudentQrCardModal
        student={selectedStudentForCard}
        onClose={() => setSelectedStudentForCard(null)}
      />

      {/* Bulk Student Cards Print Modal */}
      {showBulkPrintModal && (
        <BulkStudentCardsModal
          students={filteredStudents}
          onClose={() => setShowBulkPrintModal(false)}
        />
      )}
    </div>
  );
}
