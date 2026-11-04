'use client';

import { useState, useEffect } from 'react';
import { lectureApi } from '../../lib/api';
import Link from 'next/link';
import * as XLSX from 'xlsx';
import Navbar from '../../components/layout/Navbar';
import ResetAbsencesModal from '../../components/modals/ResetAbsencesModal';
import AttendancePdfReportModal from '../../components/modals/AttendancePdfReportModal';
import { formatAttendanceDate, formatAttendanceTime } from '../../lib/formatTime';

interface AttendanceRecord {
  id: string;
  studentName: string;
  studentCode?: string | null;
  status: string;
  registeredAt: string;
}

interface Lecture {
  id: string;
  name: string;
  studyPeriod?: string | null;
  section?: string | null;
  status: string;
  startedAt: string;
  closedAt: string | null;
  createdAt: string;
  attendances: AttendanceRecord[];
  _count: { attendances: number };
}

export default function ReportsPage() {
  const [lectures, setLectures] = useState<Lecture[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLecture, setSelectedLecture] = useState<Lecture | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; name: string } | null>(null);
  const [showResetModal, setShowResetModal] = useState(false);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);
  const [pdfLectureForReport, setPdfLectureForReport] = useState<Lecture | null>(null);

  useEffect(() => {
    loadLectures();
  }, []);

  const loadLectures = async () => {
    setLoading(true);
    try {
      const data = await lectureApi.getAll();
      setLectures(data);
    } catch (err) {
      console.error('Failed to load lectures:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteConfirmed = async () => {
    if (!deleteConfirm) return;
    try {
      await lectureApi.delete(deleteConfirm.id);
      setLectures(prev => prev.filter(l => l.id !== deleteConfirm.id));
      if (selectedLecture?.id === deleteConfirm.id) setSelectedLecture(null);
    } catch (err: any) {
      alert(err.message || 'فشل في الحذف');
    } finally {
      setDeleteConfirm(null);
    }
  };

  const filteredLectures = lectures.filter(l =>
    l.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStats = (lecture: Lecture) => {
    const present = lecture.attendances.filter(a => a.status === 'PRESENT').length;
    const absent = lecture.attendances.filter(a => a.status === 'ABSENT').length;
    return { present, absent, total: lecture.attendances.length };
  };

  /**
   * Export all (or filtered) lectures summary to Excel (.xlsx)
   */
  const handleExportAllLecturesExcel = () => {
    const listToExport = filteredLectures.length > 0 ? filteredLectures : lectures;
    if (listToExport.length === 0) {
      alert('لا توجد محاضرات للتصدير');
      return;
    }

    const exportData = listToExport.map((lecture, index) => {
      const stats = getStats(lecture);
      const rate = stats.total > 0 ? Math.round((stats.present / stats.total) * 100) : 0;

      return {
        'ت': index + 1,
        'اسم المحاضرة': lecture.name,
        'الدراسة': (lecture.studyPeriod || 'MORNING') === 'EVENING' ? 'مسائي' : 'صباحي',
        'الشعبة': lecture.section && lecture.section !== 'ALL' ? `شعبة ${lecture.section}` : 'الكل',
        'الحالة': lecture.status === 'ACTIVE' ? 'جارية' : 'منتهية',
        'تاريخ البدء': formatAttendanceDate(lecture.startedAt),
        'وقت البدء': formatAttendanceTime(lecture.startedAt, false),
        'وقت الانتهاء': lecture.closedAt ? formatAttendanceTime(lecture.closedAt, false) : '-',
        'عدد الحضور': stats.present,
        'عدد الغياب': stats.absent,
        'إجمالي الطلاب': stats.total,
        'نسبة الحضور': `${rate}%`,
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    worksheet['!cols'] = [
      { wch: 6 },
      { wch: 30 },
      { wch: 10 },
      { wch: 12 },
      { wch: 10 },
      { wch: 14 },
      { wch: 12 },
      { wch: 12 },
      { wch: 12 },
      { wch: 12 },
      { wch: 14 },
      { wch: 14 },
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'تقرير المحاضرات');
    const dateStr = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(workbook, `تقرير_المحاضرات_${dateStr}.xlsx`);
  };

  /**
   * Export detailed attendance for a single lecture to Excel (.xlsx)
   */
  const handleExportLectureDetailsExcel = (lecture: Lecture) => {
    if (!lecture || lecture.attendances.length === 0) {
      alert('لا توجد سجلات حضور لهذه المحاضرة');
      return;
    }

    const exportData = lecture.attendances.map((rec, index) => ({
      'ت': index + 1,
      'اسم الطالب': rec.studentName,
      'الباركود / ID': rec.studentCode || '-',
      'الحالة': rec.status === 'PRESENT' ? 'حاضر' : 'غائب',
      'وقت التسجيل': rec.status === 'PRESENT'
        ? formatAttendanceTime(rec.registeredAt, false)
        : '-',
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    worksheet['!cols'] = [
      { wch: 6 },
      { wch: 30 },
      { wch: 18 },
      { wch: 12 },
      { wch: 18 },
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'سجل الحضور');
    const safeName = lecture.name.replace(/[/\\?%*:|"<>]/g, '_');
    const dateStr = new Date(lecture.startedAt).toISOString().slice(0, 10);
    XLSX.writeFile(workbook, `سجل_${safeName}_${dateStr}.xlsx`);
  };

  return (
    <div className="no-print" style={{ minHeight: '100vh' }}>
      {/* Unified Header / Navbar Component */}
      <Navbar />

      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '24px' }}>
        {/* Header */}
        <div style={{ marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
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
                color: '#D4AF37',
              }}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="20" x2="18" y2="10" />
                <line x1="12" y1="20" x2="12" y2="4" />
                <line x1="6" y1="20" x2="6" y2="14" />
              </svg>
            </div>
            <h1 style={{ fontSize: '26px', fontWeight: '800', color: '#111827' }}>
              تقارير المحاضرات
            </h1>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>عرض المحاضرات السابقة وسجلات الحضور مع إمكانية التصدير إلى Excel</p>
        </div>

        {/* Search & Global Actions */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
          <input
            type="text"
            className="input"
            placeholder="ابحث عن محاضرة بالاسم..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            id="search-input"
            style={{ maxWidth: '400px', flex: 1 }}
          />

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button
              className="btn btn-sm"
              onClick={() => setShowResetModal(true)}
              style={{
                fontSize: '13px',
                backgroundColor: '#FEF2F2',
                color: '#DC2626',
                border: '1px solid #FCA5A5',
                fontWeight: '700',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 14px',
              }}
            >
              🔄 تصفير الغيابات
            </button>

            <button
              className="btn btn-sm"
              onClick={() => {
                if (selectedLecture) {
                  setPdfLectureForReport(selectedLecture);
                } else if (lectures.length > 0) {
                  setPdfLectureForReport(lectures[0]);
                }
              }}
              disabled={lectures.length === 0}
              style={{
                fontSize: '13px',
                fontWeight: '700',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 16px',
                backgroundColor: '#DC2626',
                color: '#FFFFFF',
                border: 'none',
                boxShadow: '0 2px 6px rgba(220, 38, 38, 0.25)',
              }}
              title="تصدير كشف الغيابات والحضور بصيغة PDF الرسمية"
            >
              📄 تصدير كشف الغيابات (PDF)
            </button>
          </div>
        </div>

        {/* Success Banner */}
        {successBanner && (
          <div
            style={{
              padding: '12px 16px',
              borderRadius: '12px',
              backgroundColor: '#ECFDF5',
              border: '1px solid #A7F3D0',
              color: '#065F46',
              marginBottom: '20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: '14px',
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

        {loading ? (
          <div className="empty-state">
            <div className="empty-state-icon" style={{ animation: 'pulse-glow 2s infinite' }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
            </div>
            <p style={{ color: 'var(--text-muted)' }}>جاري التحميل...</p>
          </div>
        ) : filteredLectures.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
              </svg>
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: '18px', fontWeight: '600' }}>
              {searchTerm ? 'لا توجد نتائج' : 'لا توجد محاضرات بعد'}
            </p>
            <p style={{ color: 'var(--text-muted)' }}>
              {!searchTerm && 'ابدأ بإنشاء محاضرة من صفحة الحضور'}
            </p>
            {!searchTerm && (
              <Link href="/" className="btn btn-primary" style={{ marginTop: '12px' }}>
                إنشاء محاضرة جديدة
              </Link>
            )}
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: selectedLecture ? '1fr 1fr' : '1fr', gap: '24px' }}>
            {/* Lecture List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {filteredLectures.map((lecture, index) => {
                const stats = getStats(lecture);
                const isSelected = selectedLecture?.id === lecture.id;

                return (
                  <div
                    key={lecture.id}
                    className={`glass-card animate-fade-in`}
                    style={{
                      padding: '20px',
                      cursor: 'pointer',
                      borderColor: isSelected ? 'var(--accent)' : undefined,
                      boxShadow: isSelected ? '0 0 30px var(--accent-glow)' : undefined,
                      animationDelay: `${index * 0.05}s`,
                      animationFillMode: 'both',
                    }}
                    onClick={() => setSelectedLecture(isSelected ? null : lecture)}
                    id={`lecture-card-${lecture.id}`}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                      <div>
                        <h3 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '4px', color: '#111827' }}>
                          {lecture.name}
                        </h3>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '5px',
                              padding: '3px 10px',
                              borderRadius: '6px',
                              fontSize: '11px',
                              fontWeight: '700',
                              background: lecture.status === 'ACTIVE' ? '#ECFDF5' : '#F3F4F6',
                              color: lecture.status === 'ACTIVE' ? '#065F46' : '#4B5563',
                              border: lecture.status === 'ACTIVE' ? '1px solid #A7F3D0' : '1px solid #D1D5DB',
                            }}
                          >
                            <span
                              style={{
                                width: '6px',
                                height: '6px',
                                borderRadius: '50%',
                                background: lecture.status === 'ACTIVE' ? '#10B981' : '#9CA3AF',
                              }}
                            />
                            {lecture.status === 'ACTIVE' ? 'جارية' : 'منتهية'}
                          </span>
                          {lecture.status === 'ACTIVE' && (
                            <Link
                              href="/"
                              className="btn btn-primary btn-sm"
                              style={{ fontSize: '11px', padding: '3px 8px', textDecoration: 'none', height: 'auto' }}
                              onClick={(e) => e.stopPropagation()}
                            >
                              شاشة الحضور المباشرة
                            </Link>
                          )}
                          <span style={{ color: 'var(--text-muted)', fontSize: '13px', display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                            <span>{formatAttendanceDate(lecture.startedAt)}</span>
                            <bdi dir="ltr">{formatAttendanceTime(lecture.startedAt, false)}</bdi>
                          </span>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            setPdfLectureForReport(lecture);
                          }}
                          style={{ padding: '4px 8px', fontSize: '12px', color: '#DC2626' }}
                          title="تصدير كشف هذه المحاضرة كـ PDF"
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                            <polyline points="14 2 14 8 20 8" />
                            <line x1="16" y1="13" x2="8" y2="13" />
                            <line x1="16" y1="17" x2="8" y2="17" />
                            <polyline points="10 9 9 9 8 9" />
                          </svg>
                        </button>
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteConfirm({ id: lecture.id, name: lecture.name });
                          }}
                          style={{ padding: '4px 8px', fontSize: '12px', color: 'var(--danger)' }}
                          title="حذف المحاضرة"
                          id={`delete-${lecture.id}`}
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="3 6 5 6 21 6" />
                            <path d="m19 6-.867 12.142A2 2 0 0 1 16.138 20H7.862a2 2 0 0 1-1.995-1.858L5 6m5 0V4a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v2" />
                          </svg>
                        </button>
                      </div>
                    </div>

                    {/* Quick Stats */}
                    <div style={{ display: 'flex', gap: '16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ color: '#047857', fontWeight: '700', fontSize: '18px' }}>{stats.present}</span>
                        <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>حاضر</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ color: '#4B5563', fontWeight: '700', fontSize: '18px' }}>{stats.absent}</span>
                        <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>غائب</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ color: 'var(--gold-dark)', fontWeight: '700', fontSize: '18px' }}>{stats.total}</span>
                        <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>إجمالي</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Attendance Details Panel */}
            {selectedLecture && (
              <div className="glass-card animate-slide-up glow-border" style={{ padding: '24px', position: 'sticky', top: '80px', maxHeight: 'calc(100vh - 120px)', overflowY: 'auto' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
                  <div>
                    <h2 style={{ fontSize: '22px', fontWeight: '700', marginBottom: '6px', color: '#111827' }}>
                      {selectedLecture.name}
                    </h2>
                    <p style={{ color: 'var(--text-muted)', fontSize: '13.5px', margin: 0 }}>
                      {formatAttendanceDate(selectedLecture.startedAt, true)}
                    </p>
                  </div>

                  <button
                    className="btn btn-sm"
                    onClick={() => setPdfLectureForReport(selectedLecture)}
                    disabled={selectedLecture.attendances.length === 0}
                    style={{
                      fontSize: '12.5px',
                      fontWeight: '700',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '6px 12px',
                      backgroundColor: '#DC2626',
                      color: '#FFFFFF',
                      border: 'none',
                      boxShadow: '0 2px 6px rgba(220, 38, 38, 0.25)',
                    }}
                  >
                    📄 تصدير سجل هذه المحاضرة (PDF)
                  </button>
                </div>

                {/* Stats */}
                <div style={{ display: 'flex', gap: '12px', marginBottom: '20px' }}>
                  <div className="counter-card" style={{ flex: 1, background: '#FFFFFF', border: '1px solid #E5E7EB', borderTop: '3px solid #10B981' }}>
                    <span className="count" style={{ color: '#047857', fontSize: '28px' }}>
                      {selectedLecture.attendances.filter(a => a.status === 'PRESENT').length}
                    </span>
                    <span className="label" style={{ color: '#047857' }}>حاضر</span>
                  </div>
                  <div className="counter-card" style={{ flex: 1, background: '#FFFFFF', border: '1px solid #E5E7EB', borderTop: '3px solid #6B7280' }}>
                    <span className="count" style={{ color: '#111827', fontSize: '28px' }}>
                      {selectedLecture.attendances.filter(a => a.status === 'ABSENT').length}
                    </span>
                    <span className="label" style={{ color: '#4B5563' }}>غائب</span>
                  </div>
                </div>

                {/* Student List */}
                {selectedLecture.attendances.length === 0 ? (
                  <div className="empty-state" style={{ padding: '32px 16px' }}>
                    <p style={{ color: 'var(--text-muted)' }}>لا توجد سجلات حضور</p>
                  </div>
                ) : (
                  <table className="attendance-table">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>اسم الطالب</th>
                        <th>الباركود / ID</th>
                        <th>الحالة</th>
                        <th>الوقت</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedLecture.attendances.map((record, index) => (
                        <tr key={record.id} className="animate-fade-in">
                          <td style={{ color: 'var(--text-muted)', fontWeight: '600' }}>{index + 1}</td>
                          <td style={{ fontWeight: '600', color: '#111827' }}>{record.studentName}</td>
                          <td style={{ fontFamily: 'monospace', fontSize: '12px', color: '#4B5563' }}>
                            {record.studentCode || '-'}
                          </td>
                          <td>
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                padding: '3px 10px',
                                borderRadius: '6px',
                                fontSize: '12px',
                                fontWeight: '700',
                                background: record.status === 'PRESENT' ? '#ECFDF5' : '#F3F4F6',
                                color: record.status === 'PRESENT' ? '#065F46' : '#374151',
                                border: record.status === 'PRESENT' ? '1px solid #A7F3D0' : '1px solid #E5E7EB',
                              }}
                            >
                              {record.status === 'PRESENT' ? 'حاضر' : 'غائب'}
                            </span>
                          </td>
                          <td style={{ color: 'var(--text-muted)', fontSize: '13px', textAlign: 'center' }}>
                            {record.status === 'PRESENT' ? (
                              <bdi dir="ltr">{formatAttendanceTime(record.registeredAt, false)}</bdi>
                            ) : '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div
          className="modal-backdrop animate-fade-in"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.65)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
            zIndex: 1000,
          }}
        >
          <div
            className="glass-card animate-slide-up"
            style={{
              maxWidth: '420px',
              width: '100%',
              background: '#FFFFFF',
              borderRadius: '20px',
              padding: '28px',
              textAlign: 'center',
              boxShadow: '0 20px 50px rgba(0,0,0,0.25)',
              border: '1px solid #E5E7EB',
            }}
          >
            <div
              style={{
                width: '54px',
                height: '54px',
                borderRadius: '50%',
                background: '#FEF2F2',
                color: '#DC2626',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px auto',
              }}
            >
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6" />
                <path d="m19 6-.867 12.142A2 2 0 0 1 16.138 20H7.862a2 2 0 0 1-1.995-1.858L5 6m5 0V4a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v2" />
              </svg>
            </div>

            <h3 style={{ fontSize: '19px', fontWeight: '800', color: '#111827', marginBottom: '8px' }}>
              تأكيد حذف المحاضرة
            </h3>

            <p style={{ fontSize: '14px', color: '#4B5563', lineHeight: '1.6', marginBottom: '24px' }}>
              هل أنت متأكد من حذف محاضرة ({deleteConfirm.name})؟<br />
              سيتم حذف جميع سجلات الحضور المرتبطة بها نهائياً.
            </p>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setDeleteConfirm(null)}
                style={{ flex: 1, fontSize: '13px', fontWeight: '600' }}
              >
                إلغاء
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={handleDeleteConfirmed}
                style={{ flex: 1, fontSize: '13px', fontWeight: '700' }}
              >
                تأكيد الحذف
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reset Absences Modal */}
      <ResetAbsencesModal
        isOpen={showResetModal}
        onClose={() => setShowResetModal(false)}
        onSuccess={(msg) => {
          setSuccessBanner(msg);
          loadLectures();
        }}
      />

      {/* Attendance & Absences PDF Report Modal */}
      {pdfLectureForReport && (
        <AttendancePdfReportModal
          isOpen={!!pdfLectureForReport}
          onClose={() => setPdfLectureForReport(null)}
          reportTitle={`كشف غيابات وحضور - ${pdfLectureForReport.name}`}
          studyPeriodLabel={
            pdfLectureForReport.studyPeriod === 'EVENING'
              ? 'الدراسة المسائية'
              : 'الدراسة الصباحية'
          }
          sectionLabel={
            pdfLectureForReport.section ? `شعبة ${pdfLectureForReport.section}` : 'كافة الشُعب'
          }
          lectureDate={pdfLectureForReport.startedAt}
          records={pdfLectureForReport.attendances.map((rec) => ({
            id: rec.id,
            studentName: rec.studentName,
            studentCode: rec.studentCode,
            status: rec.status,
            registeredAt: rec.registeredAt,
            studyPeriod: pdfLectureForReport.studyPeriod || undefined,
            section: pdfLectureForReport.section || undefined,
          }))}
        />
      )}
    </div>
  );
}
