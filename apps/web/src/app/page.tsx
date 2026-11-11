'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { lectureApi, attendanceApi, studentApi, sectionApi, courseApi, SectionItem, CourseItem, stageLabel, getWsBase, ApiError } from '../lib/api';
import Link from 'next/link';
import { io, Socket } from 'socket.io-client';
import * as XLSX from 'xlsx';
import CameraScanner from '../components/camera/CameraScanner';
import Navbar from '../components/layout/Navbar';
import AttendancePdfReportModal from '../components/modals/AttendancePdfReportModal';
import RequireAuth from '../components/auth/RequireAuth';
import { useAuth, PERMISSIONS } from '../lib/auth';
import { formatAttendanceTime } from '../lib/formatTime';

interface AttendanceRecord {
  id: string;
  studentName: string;
  studentCode?: string;
  status: string;
  registeredAt: string;
  note?: string | null;
}

interface StudentOption {
  id: string;
  name: string;
  studentCode: string;
  studyPeriod?: string;
  section?: string;
}

function HomeContent() {
  const { can } = useAuth();
  const canManualAttendance = can(PERMISSIONS.ATTENDANCE_MANUAL);
  const canLoadStudentOptions = can(PERMISSIONS.STUDENT_OPTIONS);

  // State for creating a new lecture. A lecture is bound to one or more
  // sections (by id): the backend rejects lectures without at least one.
  const [lectureName, setLectureName] = useState('');
  const [lectureStudyPeriod, setLectureStudyPeriod] = useState<'MORNING' | 'EVENING'>('MORNING');
  const [selectedSectionIds, setSelectedSectionIds] = useState<string[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [dbSections, setDbSections] = useState<SectionItem[]>([]);
  const [courses, setCourses] = useState<CourseItem[]>([]);
  const [courseId, setCourseId] = useState('');
  const [showSummaryPdfModal, setShowSummaryPdfModal] = useState(false);

  // Load dynamic sections from database
  const loadDynamicSections = useCallback(async () => {
    try {
      const data = await sectionApi.getAll();
      if (data && data.length > 0) {
        setDbSections(data);
      }
    } catch (_) {}
  }, []);

  useEffect(() => {
    loadDynamicSections();
  }, [loadDynamicSections]);

  // Courses are already scoped server-side: lecturers/technical lecturers get
  // only the courses assigned to them, administrators get every course.
  useEffect(() => {
    courseApi
      .getAll()
      .then((data) => {
        setCourses(data);
        setCourseId((current) => {
          if (current && data.some((course) => course.id === current)) return current;
          return data.length === 1 ? data[0].id : '';
        });
      })
      .catch(() => setCourses([]));
  }, []);

  const selectedCourse = courses.find((course) => course.id === courseId) || null;
  const courseStage = selectedCourse ? selectedCourse.stage : null;

  // Sections are constrained by the selected course stage (and study period).
  const stageSections = dbSections.filter(
    (section) => courseStage === null || section.stage === courseStage,
  );

  // Pick a meaningful study period when the course only has sections in one of
  // them (for example stage 2 is evening-only in the current data set).
  useEffect(() => {
    if (courseStage === null) return;
    const matching = dbSections.filter((section) => section.stage === courseStage);
    if (matching.length === 0) return;
    setLectureStudyPeriod((current) =>
      matching.some((section) => section.studyPeriod === current)
        ? current
        : (matching[0].studyPeriod as 'MORNING' | 'EVENING'),
    );
    setSelectedSectionIds([]);
  }, [courseStage, dbSections]);

  const availableSections = stageSections
    .filter((section) => section.studyPeriod === lectureStudyPeriod)
    .map((section) => ({
      id: section.id,
      name: section.name,
      label: section.label || `الشعبة ${section.name}`,
    }));

  // Prune selections that no longer match the visible study period.
  useEffect(() => {
    setSelectedSectionIds((current) =>
      current.filter((id) => availableSections.some((sec) => sec.id === id)),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lectureStudyPeriod, courseStage, dbSections]);

  const selectedSections = availableSections.filter((sec) =>
    selectedSectionIds.includes(sec.id),
  );

  // Active lecture state
  const [lecture, setLecture] = useState<any>(null);
  const [attendances, setAttendances] = useState<AttendanceRecord[]>([]);

  // Pre-registered students list for searchable manual attendance
  const [allStudents, setAllStudents] = useState<StudentOption[]>([]);
  const [manualSearch, setManualSearch] = useState('');
  const [isSearchingManual, setIsSearchingManual] = useState(false);
  const [addingManual, setAddingManual] = useState(false);

  // Confirmation modal for ending lecture (centered & professional)
  const [showEndConfirm, setShowEndConfirm] = useState(false);
  const [isEnding, setIsEnding] = useState(false);

  // Closed lecture summary modal state
  const [closedSummary, setClosedSummary] = useState<{
    lectureId: string;
    lectureName: string;
    studyPeriod?: string;
    section?: string;
    courseCode?: string;
    courseName?: string;
    courseStage?: number;
    present: number;
    absent: number;
    total: number;
    presentStudents: any[];
    absentStudents: any[];
  } | null>(null);
  const [summaryTab, setSummaryTab] = useState<'absent' | 'present'>('absent');

  // Socket ref
  const socketRef = useRef<Socket | null>(null);
  // Realtime is optional (the page polls below). After a few failed attempts the
  // socket is dropped silently instead of retrying forever.
  const socketFailuresRef = useRef(0);

  // Fetch the minimal student list used by the manual-attendance autocomplete.
  // Technical lecturers and roles without STUDENT_OPTIONS never receive it.
  useEffect(() => {
    if (!canLoadStudentOptions) {
      setAllStudents([]);
      return;
    }
    studentApi.getOptions().then((data) => {
      setAllStudents(data || []);
    }).catch((err) => {
      if (!(err instanceof ApiError) || (err.status !== 401 && err.status !== 403)) {
        console.error('Failed to load student options:', err);
      }
    });
  }, [canLoadStudentOptions, lecture?.id]);

  // Connect to Socket.IO for real-time updates. The socket authenticates with
  // the HttpOnly session cookie; anonymous sockets are rejected server-side.
  const connectSocket = useCallback((lectureId: string) => {
    if (socketRef.current) {
      socketRef.current.disconnect();
    }

    const socket = io(`${getWsBase()}/attendance`, {
      // Start with polling: it works through HTTP proxies (Vercel) and carries
      // the same-origin session cookie. Socket.IO upgrades to WebSocket when the
      // host supports it, so this is the safe order everywhere.
      transports: ['polling', 'websocket'],
      withCredentials: true,
    });

    socket.on('connect', () => {
      socketFailuresRef.current = 0;
      socket.emit('lecture:join', { lectureId });
    });

    // A socket that cannot authenticate must NEVER bounce the user back to
    // /login: the session cookie may be valid while the socket target is a
    // different origin (host-scoped cookies are not sent there). Doing so made
    // an authenticated session loop between "/" and "/login" forever.
    socket.on('auth:error', () => {
      socketFailuresRef.current = 3;
      socket.disconnect();
    });

    socket.on('connect_error', () => {
      socketFailuresRef.current += 1;
      if (socketFailuresRef.current >= 3) {
        // Give up on realtime; the polling fallback keeps attendance fresh.
        socket.disconnect();
      }
    });

    socket.on('lecture:join:denied', (payload: { message?: string }) => {
      console.warn('Lecture room join denied:', payload?.message);
    });

    socket.on('attendance:new', (data: AttendanceRecord) => {
      setAttendances((prev) => {
        const existingIdx = prev.findIndex((a) => a.id === data.id || (a.studentCode && a.studentCode === data.studentCode));
        if (existingIdx >= 0) {
          const updated = [...prev];
          updated[existingIdx] = data;
          return updated;
        }
        return [...prev, data];
      });
    });

    socket.on('lecture:closed', () => {
      setLecture((prev: any) => (prev ? { ...prev, status: 'CLOSED' } : null));
    });

    socketRef.current = socket;
  }, []);

  // Restore active lecture on load
  useEffect(() => {
    let isMounted = true;
    const restoreActive = async () => {
      try {
        const active = await lectureApi.getActive();
        if (isMounted && active && active.status === 'ACTIVE') {
          setLecture(active);
          setAttendances(active.attendances || []);
          connectSocket(active.id);
        }
      } catch (err) {
        console.error('Failed to restore active lecture:', err);
      }
    };

    restoreActive();
    return () => { isMounted = false; };
  }, [connectSocket]);

  // Periodic polling fallback
  useEffect(() => {
    if (!lecture || lecture.status !== 'ACTIVE') return;

    const syncAttendance = async () => {
      try {
        const records = await attendanceApi.getByLecture(lecture.id);
        setAttendances(records);
      } catch (e) {
        // Silently ignore background polling errors
      }
    };

    const interval = setInterval(syncAttendance, 4000);
    return () => clearInterval(interval);
  }, [lecture?.id, lecture?.status]);

  // Create a new lecture
  const handleCreate = async () => {
    if (!lectureName.trim()) return;
    if (!courseId) {
      alert('اختر المادة قبل إنشاء المحاضرة');
      return;
    }
    if (selectedSectionIds.length === 0) {
      alert('اختر شعبة واحدة على الأقل قبل الإنشاء.');
      return;
    }
    const primary = selectedSections[0];
    setIsCreating(true);
    try {
      const result = await lectureApi.create(
        lectureName.trim(),
        lectureStudyPeriod,
        primary?.name,
        courseId,
        primary?.id,
        selectedSectionIds,
      );
      setLecture(result);
      setAttendances([]);
      connectSocket(result.id);
    } catch (err: any) {
      alert(err.message || 'فشل في إنشاء المحاضرة');
    } finally {
      setIsCreating(false);
    }
  };

  // Close lecture
  const handleConfirmClose = async () => {
    if (!lecture) return;
    setShowEndConfirm(false);
    setIsEnding(true);
    try {
      const summary = await lectureApi.close(lecture.id);
      setClosedSummary({
        ...summary,
        studyPeriod: lecture?.studyPeriod,
        section: lecture?.section,
        courseCode: lecture?.course?.code,
        courseName: lecture?.course?.name,
        courseStage: lecture?.course?.stage,
      });
      setLecture((prev: any) => (prev ? { ...prev, status: 'CLOSED' } : null));
      setSummaryTab(summary.absent > 0 ? 'absent' : 'present');
    } catch (err: any) {
      alert(err.message || 'فشل في إنهاء المحاضرة');
    } finally {
      setIsEnding(false);
    }
  };

  // Export closed lecture summary to Excel (Without rate)
  const handleExportSummaryExcel = () => {
    if (!closedSummary) return;

    const allRecords = [
      ...(closedSummary.presentStudents || []).map((s, idx) => ({
        'ت': idx + 1,
        'اسم الطالب': s.studentName,
        'الرقم التعريفي (الباركود)': s.studentCode || '-',
        'الحالة': 'حاضر',
        'وقت التسجيل': formatAttendanceTime(s.registeredAt),
      })),
      ...(closedSummary.absentStudents || []).map((s, idx) => ({
        'ت': (closedSummary.presentStudents?.length || 0) + idx + 1,
        'اسم الطالب': s.studentName,
        'الرقم التعريفي (الباركود)': s.studentCode || '-',
        'الحالة': 'غائب',
        'وقت التسجيل': 'لم يسجل',
      })),
    ];

    const worksheet = XLSX.utils.json_to_sheet(allRecords);
    worksheet['!cols'] = [
      { wch: 8 },
      { wch: 30 },
      { wch: 22 },
      { wch: 14 },
      { wch: 18 },
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'كشف الحضور والغياب');

    const cleanName = (closedSummary.lectureName || 'المحاضرة').replace(/[/\\?%*:|"<>]/g, '_');
    XLSX.writeFile(workbook, `${cleanName}_كشف_الغياب_والحضور.xlsx`);
  };

  // Reset after closed lecture summary (Return to home creation form)
  const handleCloseSummaryAndReturnHome = () => {
    if (socketRef.current) {
      socketRef.current.disconnect();
    }
    setLecture(null);
    setAttendances([]);
    setLectureName('');
    setManualSearch('');
    setClosedSummary(null);
  };

  // Manual add student by selecting from registered list
  const handleManualAddStudent = async (student: StudentOption, status: 'PRESENT' | 'ABSENT') => {
    if (!lecture) return;
    setAddingManual(true);
    try {
      await attendanceApi.addManual(lecture.id, student.name, status);
      // Refresh list
      const records = await attendanceApi.getByLecture(lecture.id);
      setAttendances(records);
      setManualSearch('');
      setIsSearchingManual(false);
    } catch (err: any) {
      alert(err.message || 'فشل في إضافة الطالب');
    } finally {
      setAddingManual(false);
    }
  };

  // Manual raw add (if student not in list)
  const handleManualRawAdd = async (status: 'PRESENT' | 'ABSENT') => {
    if (!lecture || !manualSearch.trim()) return;
    setAddingManual(true);
    try {
      await attendanceApi.addManual(lecture.id, manualSearch.trim(), status);
      const records = await attendanceApi.getByLecture(lecture.id);
      setAttendances(records);
      setManualSearch('');
      setIsSearchingManual(false);
    } catch (err: any) {
      alert(err.message || 'فشل في إضافة الطالب');
    } finally {
      setAddingManual(false);
    }
  };

  // Toggle attendance status
  const handleToggle = async (recordId: string) => {
    try {
      const updated = await attendanceApi.toggleStatus(recordId);
      setAttendances((prev) =>
        prev.map((a) => (a.id === recordId ? { ...a, status: updated.status } : a))
      );
    } catch (err: any) {
      alert(err.message || 'فشل في تعديل الحالة');
    }
  };

  // Cleanup socket on unmount
  useEffect(() => {
    return () => {
      if (socketRef.current) socketRef.current.disconnect();
    };
  }, []);

  // Display names of the sections linked to the open lecture (multi-section).
  const lectureSectionNames: string[] = (() => {
    const current: any = lecture;
    if (!current) return [];
    if (Array.isArray(current.lectureSections) && current.lectureSections.length > 0) {
      return current.lectureSections
        .map((ls: any) => String(ls?.section?.name ?? ''))
        .filter(Boolean);
    }
    if (current.sectionRef?.name) return [String(current.sectionRef.name)];
    if (current.section) return [String(current.section)];
    return [];
  })();

  // Filter students for manual search (Isolated to this lecture's Study Period
  // and stage; the backend remains the authority on section/timetable
  // eligibility when the record is written).
  const filteredStudentsForManual = manualSearch.trim()
    ? allStudents.filter((s: any) => {
        // Match study period
        if (lecture?.studyPeriod && (s.studyPeriod || 'MORNING') !== lecture.studyPeriod) {
          return false;
        }
        if (lecture?.course?.stage && Number(s.stage) !== Number(lecture.course.stage)) {
          return false;
        }
        return (
          s.name.toLowerCase().includes(manualSearch.toLowerCase()) ||
          s.studentCode.toLowerCase().includes(manualSearch.toLowerCase()) ||
          (s.section && s.section.toLowerCase().includes(manualSearch.toLowerCase()))
        );
      }).slice(0, 8)
    : [];

  const presentCount = attendances.filter((a) => a.status === 'PRESENT').length;
  const absentCount = attendances.filter((a) => a.status === 'ABSENT').length;

  // Callback when a student is scanned via camera
  const handleStudentScanned = useCallback(() => {
    if (lecture?.id) {
      attendanceApi.getByLecture(lecture.id).then((records) => {
        setAttendances(records);
      }).catch(() => {});
    }
  }, [lecture?.id]);

  return (
    <div className="no-print" style={{ minHeight: '100vh', background: 'var(--bg-primary)' }}>
      {/* Unified Header / Navbar Component */}
      <Navbar />

      <div className="app-page">
        {/* If no active lecture, show create form */}
        {!lecture && (
          <div className="animate-fade-in" style={{ maxWidth: '640px', margin: '20px auto', textAlign: 'center' }}>
            <div
              style={{
                width: '68px',
                height: '68px',
                borderRadius: '18px',
                background: '#111827',
                border: '1.5px solid var(--gold)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px auto',
                color: '#D4AF37',
              }}
            >
              <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
                <line x1="8" y1="21" x2="16" y2="21"/>
                <line x1="12" y1="17" x2="12" y2="21"/>
              </svg>
            </div>

            <h1 style={{ fontSize: '26px', fontWeight: '800', marginBottom: '6px', color: '#111827' }}>
              بدء محاضرة جديدة
            </h1>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '24px', fontSize: '14px', lineHeight: '1.6' }}>
              كلية البوليتكنك | قسم تقنيات المختبرات الطبية
            </p>

            <div style={{ background: '#FFFFFF', padding: '24px', borderRadius: '18px', border: '1px solid #E5E7EB', boxShadow: '0 4px 20px rgba(0,0,0,0.04)', textAlign: 'right' }}>
              {/* Course Selection */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#374151', marginBottom: '6px' }}>
                  المادة الدراسية:
                </label>
                <select
                  className="input"
                  value={courseId}
                  onChange={(e) => {
                    const value = e.target.value;
                    setCourseId(value);
                    setSelectedSectionIds([]);
                    const picked = courses.find((course) => course.id === value);
                    if (picked) {
                      setLectureName((current) => {
                        const trimmed = current.trim();
                        if (!trimmed || courses.some((course) => course.name === trimmed)) {
                          return picked.name;
                        }
                        return current;
                      });
                    }
                  }}
                  style={{ fontSize: '14px', fontWeight: '700', width: '100%', padding: '11px 14px' }}
                >
                  <option value="">اختر المادة...</option>
                  {courses.map((course) => (
                    <option key={course.id} value={course.id}>
                      {stageLabel(course.stage)} — {course.code} — {course.name}
                    </option>
                  ))}
                </select>
                {courses.length === 0 ? (
                  <div style={{ marginTop: '6px', fontSize: '12px', color: '#B45309', fontWeight: '600' }}>
                    لم تُسند إليك أي مادة بعد. راجع إدارة التعيينات أو اطلب من رئيس القسم إسناد موادك.
                  </div>
                ) : (
                  <div style={{ marginTop: '6px', fontSize: '12px', color: '#6B7280' }}>
                    {selectedCourse
                      ? `${stageLabel(selectedCourse.stage)} · رمز المادة ${selectedCourse.code}`
                      : 'اختر المادة قبل بدء المحاضرة'}
                  </div>
                )}
              </div>

              {/* Study Period Selection */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#374151', marginBottom: '6px' }}>
                  نوع الدراسة:
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={() => {
                      setLectureStudyPeriod('MORNING');
                      setSelectedSectionIds([]);
                    }}
                    style={{
                      padding: '10px 14px',
                      borderRadius: '10px',
                      fontSize: '14px',
                      fontWeight: '700',
                      border: lectureStudyPeriod === 'MORNING' ? '2px solid #2563EB' : '1px solid #D1D5DB',
                      background: lectureStudyPeriod === 'MORNING' ? '#EFF6FF' : '#F9FAFB',
                      color: lectureStudyPeriod === 'MORNING' ? '#1D4ED8' : '#4B5563',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                    }}
                  >
                    <span>☀️</span>
                    <span>الدراسة الصباحية</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setLectureStudyPeriod('EVENING');
                      setSelectedSectionIds([]);
                    }}
                    style={{
                      padding: '10px 14px',
                      borderRadius: '10px',
                      fontSize: '14px',
                      fontWeight: '700',
                      border: lectureStudyPeriod === 'EVENING' ? '2px solid #7C3AED' : '1px solid #D1D5DB',
                      background: lectureStudyPeriod === 'EVENING' ? '#F5F3FF' : '#F9FAFB',
                      color: lectureStudyPeriod === 'EVENING' ? '#6D28D9' : '#4B5563',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                    }}
                  >
                    <span>🌙</span>
                    <span>الدراسة المسائية</span>
                  </button>
                </div>
              </div>

              {/* Section Selection: one or more sections per lecture */}
              <div style={{ marginBottom: '18px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap', gap: '6px' }}>
                  <label style={{ fontSize: '13px', fontWeight: '700', color: '#374151' }}>
                    شعب المحاضرة (شعبة واحدة على الأقل):
                  </label>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '8px' }}>
                  {availableSections.length === 0 ? (
                    <div
                      style={{
                        gridColumn: '1 / -1',
                        padding: '12px 14px',
                        borderRadius: '10px',
                        background: '#FFFBEB',
                        border: '1px solid #FCD34D',
                        color: '#92400E',
                        fontSize: '12.5px',
                        fontWeight: '600',
                      }}
                    >
                      لا توجد شعب مسجّلة لهذه المرحلة في{' '}
                      {lectureStudyPeriod === 'MORNING' ? 'الدراسة الصباحية' : 'الدراسة المسائية'}.
                      أضف الشعب من «إدارة الشُعب» أو اختر نوع دراسة آخر.
                    </div>
                  ) : (
                    availableSections.map((sec) => {
                    const isSelected = selectedSectionIds.includes(sec.id);
                    return (
                      <button
                        key={sec.id}
                        type="button"
                        onClick={() =>
                          setSelectedSectionIds((current) =>
                            isSelected
                              ? current.filter((id) => id !== sec.id)
                              : [...current, sec.id],
                          )
                        }
                        style={{
                          padding: '10px 12px',
                          borderRadius: '10px',
                          fontSize: '13px',
                          fontWeight: '700',
                          border: isSelected
                            ? (lectureStudyPeriod === 'MORNING' ? '2px solid #2563EB' : '2px solid #7C3AED')
                            : '1.5px solid #D1D5DB',
                          background: isSelected
                            ? (lectureStudyPeriod === 'MORNING' ? '#EFF6FF' : '#F5F3FF')
                            : '#FFFFFF',
                          color: isSelected
                            ? (lectureStudyPeriod === 'MORNING' ? '#1D4ED8' : '#6D28D9')
                            : '#4B5563',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          boxShadow: isSelected ? '0 2px 8px rgba(37,99,235,0.15)' : 'none',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        <span>{sec.label}</span>
                        <span
                          style={{
                            width: '18px',
                            height: '18px',
                            borderRadius: '50%',
                            background: isSelected
                              ? (lectureStudyPeriod === 'MORNING' ? '#2563EB' : '#7C3AED')
                              : '#F3F4F6',
                            color: isSelected ? '#FFFFFF' : '#9CA3AF',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '11px',
                            fontWeight: '800',
                          }}
                        >
                          {isSelected ? '✓' : sec.name}
                        </span>
                      </button>
                    );
                    })
                  )}
                </div>

                {/* Selection Summary */}
                <div style={{ fontSize: '12px', color: '#6B7280', marginTop: '10px', background: '#F9FAFB', padding: '8px 12px', borderRadius: '8px', border: '1px solid #F3F4F6' }}>
                  {availableSections.length === 0 ? null : selectedSections.length > 0 ? (
                    <span style={{ color: '#059669', fontWeight: '600' }}>
                      ✓ المحاضرة مخصصة لـ{' '}
                      <strong style={{ color: '#111827' }}>
                        {selectedSections.map((sec) => sec.label).join('، ')}
                      </strong>{' '}
                      من{' '}
                      {selectedCourse ? `${stageLabel(selectedCourse.stage)} ` : ''}
                      {lectureStudyPeriod === 'MORNING' ? 'الصباحية' : 'المسائية'}
                    </span>
                  ) : (
                    <span style={{ color: '#B45309', fontWeight: '600' }}>
                      ⚠️ اختر شعبة واحدة على الأقل. يمكن اختيار أكثر من شعبة لنفس المحاضرة.
                    </span>
                  )}
                </div>
              </div>

              {/* Lecture Name Input */}
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#374151', marginBottom: '6px' }}>
                  اسم المحاضرة / العنوان:
                </label>
                <input
                  type="text"
                  className="input"
                  placeholder="مثال: محاضرة 1 — الكيمياء السريرية"
                  value={lectureName}
                  onChange={(e) => setLectureName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                  id="lecture-name-input"
                  style={{ fontSize: '15px', padding: '12px 16px', width: '100%' }}
                  autoFocus
                />
              </div>

              <button
                className="btn btn-primary"
                onClick={handleCreate}
                disabled={isCreating || !lectureName.trim() || !courseId || selectedSectionIds.length === 0}
                style={{ width: '100%', fontSize: '15px', fontWeight: '800', padding: '12px 20px' }}
                id="create-lecture-btn"
              >
                {isCreating ? 'جاري بدء المحاضرة...' : 'بدء المحاضرة وتشغيل الكاميرا'}
              </button>
            </div>
          </div>
        )}

        {/* Active lecture view: DIRECT TO CAMERA */}
        {lecture && (
          <div className="animate-slide-up">
            {/* Header: Lecture info + ONLY Close Lecture Button */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '20px',
                flexWrap: 'wrap',
                gap: '12px',
                padding: '16px 20px',
                background: '#FFFFFF',
                borderRadius: '16px',
                border: '1px solid #E5E7EB',
                boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <h1 style={{ fontSize: '22px', fontWeight: '800', color: '#111827', margin: 0 }}>
                    {lecture.name}
                  </h1>
                  {lecture.course && (
                    <span
                      style={{
                        padding: '3px 10px',
                        borderRadius: '6px',
                        fontSize: '11px',
                        fontWeight: '700',
                        background: '#FEF3C7',
                        color: '#92400E',
                        border: '1px solid #FCD34D',
                      }}
                    >
                      {stageLabel(lecture.course.stage)} · {lecture.course.code} — {lecture.course.name}
                    </span>
                  )}
                  <span
                    style={{
                      padding: '3px 10px',
                      borderRadius: '6px',
                      fontSize: '11px',
                      fontWeight: '700',
                      background: (lecture.studyPeriod || 'MORNING') === 'EVENING' ? '#F5F3FF' : '#EFF6FF',
                      color: (lecture.studyPeriod || 'MORNING') === 'EVENING' ? '#6D28D9' : '#1D4ED8',
                      border: (lecture.studyPeriod || 'MORNING') === 'EVENING' ? '1px solid #DDD6FE' : '1px solid #BFDBFE',
                    }}
                  >
                    {(lecture.studyPeriod || 'MORNING') === 'EVENING' ? 'دراسة مسائية' : 'دراسة صباحية'}
                  </span>
                  {lectureSectionNames.length > 0 && (
                    <span
                      style={{
                        padding: '3px 9px',
                        borderRadius: '6px',
                        fontSize: '11px',
                        fontWeight: '700',
                        background: '#F3F4F6',
                        color: '#1F2937',
                        border: '1px solid #D1D5DB',
                      }}
                    >
                      شعب {lectureSectionNames.join('، ')}
                    </span>
                  )}
                  {lecture.conductedBy && (
                    <span
                      style={{
                        padding: '3px 9px',
                        borderRadius: '6px',
                        fontSize: '11px',
                        fontWeight: '700',
                        background: '#FFF7ED',
                        color: '#9A3412',
                        border: '1px solid #FED7AA',
                      }}
                    >
                      المشرف: {lecture.conductedBy.fullName}
                    </span>
                  )}
                  <span
                    style={{
                      padding: '3px 10px',
                      borderRadius: '6px',
                      fontSize: '11px',
                      fontWeight: '700',
                      background: lecture.status === 'ACTIVE' ? '#ECFDF5' : '#F3F4F6',
                      color: lecture.status === 'ACTIVE' ? '#065F46' : '#4B5563',
                      border: lecture.status === 'ACTIVE' ? '1px solid #A7F3D0' : '1px solid #D1D5DB',
                    }}
                  >
                    {lecture.status === 'ACTIVE' ? 'المحاضرة جارية' : 'منتهية'}
                  </span>
                </div>
                <div style={{ fontSize: '12px', color: '#6B7280', marginTop: '4px' }}>
                  كلية البوليتكنك | قسم تقنيات المختبرات الطبية • تسجيل الحضور مفعل عبر كاميرا الحاسبة
                </div>
              </div>

              {/* ONLY Close lecture button (No new lecture button while active) */}
              {lecture.status === 'ACTIVE' && (
                <button
                  className="btn btn-danger"
                  onClick={() => setShowEndConfirm(true)}
                  disabled={isEnding}
                  id="close-lecture-btn"
                  style={{ fontSize: '13px', fontWeight: '700', padding: '9px 18px' }}
                >
                  {isEnding ? 'جاري الإنهاء واحتساب الغياب...' : 'إنهاء المحاضرة'}
                </button>
              )}
            </div>

            {/* Main Grid: Direct Camera Scanner + Attendance List */}
            <div
              className="lecture-main-grid"
              style={{
                display: 'grid',
                gridTemplateColumns: lecture.status === 'ACTIVE' ? 'minmax(420px, 480px) 1fr' : '1fr',
                gap: '20px',
                alignItems: 'start',
              }}
            >
              {/* Left Column: Camera Scanner (Direct, No QR switch) */}
              {lecture.status === 'ACTIVE' && (
                <CameraScanner
                  lectureId={lecture.id}
                  isActive={lecture.status === 'ACTIVE'}
                  onStudentScanned={handleStudentScanned}
                />
              )}

              {/* Right Column: Attendance Statistics & Searchable Manual Add */}
              <div className="glass-card" style={{ padding: '20px', background: '#FFFFFF', borderRadius: '16px', border: '1px solid #E5E7EB' }}>
                {/* Clean Counters (No percentages, No emojis) */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '18px' }}>
                  <div className="counter-card" style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', borderTop: '3px solid #10B981', padding: '12px' }}>
                    <span className="count" style={{ color: '#065F46', fontSize: '24px' }}>{presentCount}</span>
                    <span className="label" style={{ color: '#047857', fontSize: '12px', fontWeight: '700' }}>حاضر</span>
                  </div>
                  <div className="counter-card" style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', borderTop: '3px solid #6B7280', padding: '12px' }}>
                    <span className="count" style={{ color: '#1F2937', fontSize: '24px' }}>{absentCount}</span>
                    <span className="label" style={{ color: '#4B5563', fontSize: '12px', fontWeight: '700' }}>غائب</span>
                  </div>
                  <div className="counter-card" style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', borderTop: '3px solid var(--gold)', padding: '12px' }}>
                    <span className="count" style={{ color: 'var(--gold-dark)', fontSize: '24px' }}>{attendances.length}</span>
                    <span className="label" style={{ color: 'var(--gold-dark)', fontSize: '12px', fontWeight: '700' }}>إجمالي المسجلين</span>
                  </div>
                </div>

                {/* Searchable Manual Add Section (requires ATTENDANCE_MANUAL) */}
                {canManualAttendance && (
                <div style={{ position: 'relative', marginBottom: '18px' }}>
                  <div style={{ fontSize: '12px', fontWeight: '700', color: '#374151', marginBottom: '6px' }}>
                    إضافة حضور يدوي (ابحث بالاسم أو الباركود):
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <div style={{ position: 'relative', flex: 1 }}>
                      <input
                        type="text"
                        className="input"
                        placeholder="اكتب اسم الطالب أو رقمه التعريفي..."
                        value={manualSearch}
                        onChange={(e) => {
                          setManualSearch(e.target.value);
                          setIsSearchingManual(true);
                        }}
                        onFocus={() => setIsSearchingManual(true)}
                        id="manual-name-input"
                        style={{ fontSize: '13px', padding: '9px 12px', width: '100%' }}
                      />
                      {manualSearch && (
                        <button
                          type="button"
                          onClick={() => { setManualSearch(''); setIsSearchingManual(false); }}
                          style={{
                            position: 'absolute',
                            left: '10px',
                            top: '50%',
                            transform: 'translateY(-50%)',
                            background: 'none',
                            border: 'none',
                            color: '#9CA3AF',
                            cursor: 'pointer',
                            fontSize: '12px',
                          }}
                        >
                          ✕
                        </button>
                      )}
                    </div>

                    <button
                      className="btn btn-primary"
                      onClick={() => handleManualRawAdd('PRESENT')}
                      disabled={addingManual || !manualSearch.trim()}
                      style={{ fontSize: '12px', padding: '8px 14px', whiteSpace: 'nowrap' }}
                      title="تسجيل كحاضر"
                    >
                      تسجيل حاضر
                    </button>
                    <button
                      className="btn btn-ghost"
                      onClick={() => handleManualRawAdd('ABSENT')}
                      disabled={addingManual || !manualSearch.trim()}
                      style={{ fontSize: '12px', padding: '8px 14px', whiteSpace: 'nowrap', border: '1px solid #D1D5DB' }}
                      title="تسجيل كغائب"
                    >
                      تسجيل غائب
                    </button>
                  </div>

                  {/* Autocomplete Dropdown List */}
                  {isSearchingManual && manualSearch.trim() && (
                    <div
                      style={{
                        position: 'absolute',
                        top: '100%',
                        left: 0,
                        right: 0,
                        zIndex: 40,
                        background: '#FFFFFF',
                        border: '1px solid #D1D5DB',
                        borderRadius: '10px',
                        boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
                        marginTop: '4px',
                        maxHeight: '220px',
                        overflowY: 'auto',
                      }}
                    >
                      {filteredStudentsForManual.length === 0 ? (
                        <div style={{ padding: '10px 14px', fontSize: '12px', color: '#6B7280', textAlign: 'center' }}>
                          لا يوجد طالب مسجل بهذا الاسم أو الرقم
                        </div>
                      ) : (
                        filteredStudentsForManual.map((s) => {
                          const alreadyRecord = attendances.find((a) => a.studentCode === s.studentCode || a.studentName === s.name);
                          return (
                            <div
                              key={s.id}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: '8px 12px',
                                borderBottom: '1px solid #F3F4F6',
                                background: alreadyRecord ? '#F9FAFB' : '#FFFFFF',
                              }}
                            >
                              <div>
                                <div style={{ fontSize: '13px', fontWeight: '700', color: '#111827' }}>
                                  {s.name}
                                  {s.section && (
                                    <span style={{ marginRight: '6px', fontSize: '11px', color: '#6B7280', fontWeight: 'normal' }}>
                                      (شعبة {s.section})
                                    </span>
                                  )}
                                </div>
                                <div style={{ fontSize: '11px', color: '#6B7280', fontFamily: 'monospace' }}>
                                  الباركود: {s.studentCode}
                                </div>
                              </div>

                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                {alreadyRecord ? (
                                  <span
                                    style={{
                                      fontSize: '11px',
                                      padding: '3px 8px',
                                      borderRadius: '6px',
                                      background: alreadyRecord.status === 'PRESENT' ? '#ECFDF5' : '#FEF2F2',
                                      color: alreadyRecord.status === 'PRESENT' ? '#065F46' : '#991B1B',
                                      fontWeight: '600',
                                    }}
                                  >
                                    {alreadyRecord.status === 'PRESENT' ? 'حاضر حالياً' : 'غائب حالياً'}
                                  </span>
                                ) : (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => handleManualAddStudent(s, 'PRESENT')}
                                      style={{
                                        fontSize: '11px',
                                        padding: '4px 10px',
                                        borderRadius: '6px',
                                        border: 'none',
                                        background: '#10B981',
                                        color: '#FFFFFF',
                                        fontWeight: '700',
                                        cursor: 'pointer',
                                      }}
                                    >
                                      حاضر
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleManualAddStudent(s, 'ABSENT')}
                                      style={{
                                        fontSize: '11px',
                                        padding: '4px 10px',
                                        borderRadius: '6px',
                                        border: '1px solid #D1D5DB',
                                        background: '#F3F4F6',
                                        color: '#374151',
                                        fontWeight: '700',
                                        cursor: 'pointer',
                                      }}
                                    >
                                      غائب
                                    </button>
                                  </>
                                )}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>
                )}

                {/* Attendance Table */}
                {attendances.length === 0 ? (
                  <div className="empty-state" style={{ padding: '30px', textAlign: 'center' }}>
                    <p style={{ color: 'var(--text-muted)', fontSize: '13px', margin: 0 }}>
                      بانتظار توجيه باركود الطلاب نحو الكاميرا أو الإضافة اليدوية...
                    </p>
                  </div>
                ) : (
                  <>
                  <div className="attendance-table-wrap">
                    <table className="attendance-table" style={{ fontSize: '13px' }}>
                      <thead>
                        <tr>
                          <th style={{ width: '40px' }}>ت</th>
                          <th>اسم الطالب</th>
                          <th>الباركود</th>
                          <th style={{ textAlign: 'center' }}>الحالة</th>
                          <th>وقت التسجيل</th>
                          {canManualAttendance && lecture.status === 'ACTIVE' && (
                            <th style={{ textAlign: 'center', width: '70px' }}>تعديل</th>
                          )}
                        </tr>
                      </thead>
                      <tbody>
                        {attendances.map((record, index) => (
                          <tr key={record.id} className="animate-fade-in">
                            <td style={{ color: 'var(--text-muted)', fontWeight: '600' }}>{index + 1}</td>
                            <td style={{ fontWeight: '700', color: '#111827' }}>
                              {record.studentName}
                              {record.note && (
                                <span style={{ display: 'block', fontSize: '10px', fontWeight: '600', color: '#6D28D9' }}>
                                  {record.note}
                                </span>
                              )}
                            </td>
                            <td>
                              <span style={{ fontFamily: 'monospace', fontSize: '12px', color: '#4B5563' }}>
                                {record.studentCode || '-'}
                              </span>
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              <span
                                style={{
                                  padding: '3px 8px',
                                  borderRadius: '6px',
                                  fontSize: '11px',
                                  fontWeight: '700',
                                  background: record.status === 'PRESENT' ? '#ECFDF5' : '#FEF2F2',
                                  color: record.status === 'PRESENT' ? '#065F46' : '#991B1B',
                                }}
                              >
                                {record.status === 'PRESENT' ? 'حاضر' : 'غائب'}
                              </span>
                            </td>
                            <td style={{ color: '#6B7280', fontSize: '12px', textAlign: 'center' }}>
                              <span dir="ltr" style={{ unicodeBidi: 'isolate', display: 'inline-block' }}>
                                {formatAttendanceTime(record.registeredAt)}
                              </span>
                            </td>
                            {canManualAttendance && lecture.status === 'ACTIVE' && (
                              <td style={{ textAlign: 'center' }}>
                                <button
                                  className="btn btn-ghost btn-sm"
                                  onClick={() => handleToggle(record.id)}
                                  style={{ padding: '3px 8px', fontSize: '11px' }}
                                >
                                  تبديل
                                </button>
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile: one compact card per student */}
                  <div className="attendance-mobile-list">
                    {attendances.map((record) => (
                      <div key={record.id} className="attendance-mobile-item">
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{ fontWeight: '700', color: '#111827', fontSize: '14px', lineHeight: 1.5 }}>
                            {record.studentName}
                            {record.note && (
                              <span style={{ display: 'block', fontSize: '10.5px', fontWeight: '600', color: '#6D28D9' }}>
                                {record.note}
                              </span>
                            )}
                          </div>
                          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginTop: '2px', flexWrap: 'wrap' }}>
                            <span style={{ fontFamily: 'monospace', fontSize: '11px', color: '#6B7280' }}>
                              {record.studentCode || '-'}
                            </span>
                            <span dir="ltr" style={{ fontSize: '11px', color: '#6B7280' }}>
                              {formatAttendanceTime(record.registeredAt)}
                            </span>
                          </div>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                          <span
                            style={{
                              padding: '3px 12px',
                              borderRadius: '999px',
                              fontSize: '11.5px',
                              fontWeight: '800',
                              background: record.status === 'PRESENT' ? '#ECFDF5' : '#FEF2F2',
                              color: record.status === 'PRESENT' ? '#065F46' : '#991B1B',
                              border: record.status === 'PRESENT' ? '1px solid #A7F3D0' : '1px solid #FECACA',
                            }}
                          >
                            {record.status === 'PRESENT' ? 'حاضر' : 'غائب'}
                          </span>
                          {canManualAttendance && lecture.status === 'ACTIVE' && (
                            <button
                              className="btn btn-ghost btn-sm"
                              onClick={() => handleToggle(record.id)}
                              style={{ padding: '4px 14px', fontSize: '11px', minHeight: '34px' }}
                            >
                              تبديل
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* CENTERED CONFIRMATION MODAL: END LECTURE */}
        {/* ======================================================== */}
        {showEndConfirm && (
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
                maxWidth: '440px',
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
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="12" y1="8" x2="12" y2="12"/>
                  <line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
              </div>

              <h3 style={{ fontSize: '19px', fontWeight: '800', color: '#111827', marginBottom: '8px' }}>
                تأكيد إنهاء المحاضرة
              </h3>

              <p style={{ fontSize: '14px', color: '#4B5563', lineHeight: '1.6', marginBottom: '24px' }}>
                هل أنت متأكد من إنهاء محاضرة ({lecture?.name})؟<br />
                سيتم احتساب جميع الطلاب غير المسجلين كـ <strong>غائبين</strong> تلقائياً وإصدار الكشف النهائي.
              </p>

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setShowEndConfirm(false)}
                  style={{ flex: 1, fontSize: '13px', fontWeight: '600' }}
                >
                  إلغاء
                </button>
                <button
                  type="button"
                  className="btn btn-danger"
                  onClick={handleConfirmClose}
                  style={{ flex: 1, fontSize: '13px', fontWeight: '700' }}
                >
                  تأكيد الإنهاء
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* CLOSED LECTURE SUMMARY MODAL (Clean Design, Close Returns to Home) */}
        {/* ======================================================== */}
        {closedSummary && (
          <div
            className="modal-backdrop animate-fade-in"
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0, 0, 0, 0.7)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '20px',
              zIndex: 1000,
            }}
          >
            <div
              className="glass-card animate-slide-up"
              onClick={(e) => e.stopPropagation()}
              style={{
                maxWidth: '720px',
                width: '100%',
                maxHeight: '90vh',
                overflowY: 'auto',
                padding: '28px',
                background: '#FFFFFF',
                borderRadius: '20px',
                border: '1px solid #E5E7EB',
                boxShadow: '0 20px 60px rgba(0, 0, 0, 0.25)',
              }}
            >
              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
                <div>
                  <h2 style={{ fontSize: '22px', fontWeight: '800', color: '#111827', margin: 0 }}>
                    كشف انتهاء المحاضرة
                  </h2>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginTop: '4px' }}>
                    {closedSummary.lectureName} • تم توثيق الحضور وتثبيت غياب بقية الطلاب
                  </p>
                  {(closedSummary.courseCode || closedSummary.courseName) && (
                    <p style={{ color: '#92400E', fontSize: '12.5px', marginTop: '4px', fontWeight: '700' }}>
                      {closedSummary.courseStage ? `${stageLabel(closedSummary.courseStage)} · ` : ''}
                      {closedSummary.courseCode || ''}
                      {closedSummary.courseName ? ` — ${closedSummary.courseName}` : ''}
                    </p>
                  )}
                </div>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={handleCloseSummaryAndReturnHome}
                  style={{ borderRadius: '50%', width: '32px', height: '32px', padding: 0 }}
                  title="إغلاق والعودة للصفحة الرئيسية"
                >
                  ✕
                </button>
              </div>

              {/* Statistics Overview Cards: ONLY Counts, NO Percentage */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '20px' }}>
                <div className="counter-card" style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', borderTop: '3px solid #10B981', padding: '14px' }}>
                  <span className="count" style={{ color: '#047857', fontSize: '28px' }}>{closedSummary.present}</span>
                  <span className="label" style={{ color: '#065F46', fontWeight: '700', fontSize: '13px' }}>إجمالي الحضور</span>
                </div>
                <div className="counter-card" style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', borderTop: '3px solid #6B7280', padding: '14px' }}>
                  <span className="count" style={{ color: '#111827', fontSize: '28px' }}>{closedSummary.absent}</span>
                  <span className="label" style={{ color: '#4B5563', fontWeight: '700', fontSize: '13px' }}>إجمالي الغياب</span>
                </div>
                <div className="counter-card" style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', borderTop: '3px solid var(--gold)', padding: '14px' }}>
                  <span className="count" style={{ color: 'var(--gold-dark)', fontSize: '28px' }}>{closedSummary.total}</span>
                  <span className="label" style={{ color: 'var(--gold-dark)', fontWeight: '700', fontSize: '13px' }}>إجمالي طلاب القائمة</span>
                </div>
              </div>

              {/* Tabs: Absent list vs Present list */}
              <div style={{ display: 'flex', gap: '8px', marginBottom: '14px', borderBottom: '1px solid #E5E7EB', paddingBottom: '10px' }}>
                <button
                  onClick={() => setSummaryTab('absent')}
                  style={{
                    padding: '7px 16px',
                    borderRadius: '8px',
                    fontWeight: '700',
                    fontSize: '13px',
                    border: 'none',
                    cursor: 'pointer',
                    background: summaryTab === 'absent' ? '#111827' : '#F3F4F6',
                    color: summaryTab === 'absent' ? '#FFFFFF' : '#4B5563',
                  }}
                >
                  قائمة الغائبين ({closedSummary.absent})
                </button>
                <button
                  onClick={() => setSummaryTab('present')}
                  style={{
                    padding: '7px 16px',
                    borderRadius: '8px',
                    fontWeight: '700',
                    fontSize: '13px',
                    border: 'none',
                    cursor: 'pointer',
                    background: summaryTab === 'present' ? 'var(--gold)' : '#F3F4F6',
                    color: summaryTab === 'present' ? '#0A0A0A' : '#4B5563',
                  }}
                >
                  قائمة الحاضرين ({closedSummary.present})
                </button>
              </div>

              {/* Student List in Table */}
              <div className="attendance-scroll" style={{ maxHeight: '280px', border: '1px solid #E5E7EB', borderRadius: '10px', marginBottom: '20px' }}>
                {summaryTab === 'absent' ? (
                  closedSummary.absentStudents?.length === 0 ? (
                    <div style={{ padding: '24px', textAlign: 'center', color: '#059669', fontWeight: '700', fontSize: '14px' }}>
                      لم يسجل أي غياب في هذه المحاضرة، جميع الطلاب حضروا.
                    </div>
                  ) : (
                    <table className="attendance-table" style={{ fontSize: '13px' }}>
                      <thead>
                        <tr>
                          <th style={{ width: '40px', textAlign: 'center' }}>ت</th>
                          <th>اسم الطالب الغائب</th>
                          <th>الباركود</th>
                          <th style={{ textAlign: 'center' }}>الحالة</th>
                        </tr>
                      </thead>
                      <tbody>
                        {closedSummary.absentStudents.map((s, idx) => (
                          <tr key={s.id || idx}>
                            <td style={{ textAlign: 'center', color: 'var(--text-muted)' }}>{idx + 1}</td>
                            <td style={{ fontWeight: '700', color: '#111827' }}>{s.studentName}</td>
                            <td style={{ fontFamily: 'monospace', color: '#4B5563' }}>{s.studentCode || '-'}</td>
                            <td style={{ textAlign: 'center' }}>
                              <span style={{ padding: '2px 8px', borderRadius: '6px', background: '#FEF2F2', color: '#991B1B', fontSize: '11px', fontWeight: '700' }}>
                                غائب
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )
                ) : (
                  closedSummary.presentStudents?.length === 0 ? (
                    <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '14px' }}>
                      لم يسجل أي طالب حضور في هذه المحاضرة
                    </div>
                  ) : (
                    <table className="attendance-table" style={{ fontSize: '13px' }}>
                      <thead>
                        <tr>
                          <th style={{ width: '40px', textAlign: 'center' }}>ت</th>
                          <th>اسم الطالب الحاضر</th>
                          <th>الباركود</th>
                          <th>وقت التسجيل</th>
                          <th style={{ textAlign: 'center' }}>الحالة</th>
                        </tr>
                      </thead>
                      <tbody>
                        {closedSummary.presentStudents.map((s, idx) => (
                          <tr key={s.id || idx}>
                            <td style={{ textAlign: 'center', color: 'var(--text-muted)' }}>{idx + 1}</td>
                            <td style={{ fontWeight: '700', color: '#111827' }}>
                              {s.studentName}
                              {s.note && (
                                <span style={{ display: 'block', fontSize: '10px', fontWeight: '600', color: '#6D28D9' }}>
                                  {s.note}
                                </span>
                              )}
                            </td>
                            <td style={{ fontFamily: 'monospace', color: '#4B5563' }}>{s.studentCode || '-'}</td>
                            <td style={{ color: '#6B7280', fontSize: '12px', textAlign: 'center' }}>
                              <span dir="ltr" style={{ unicodeBidi: 'isolate', display: 'inline-block' }}>
                                {formatAttendanceTime(s.registeredAt)}
                              </span>
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              <span style={{ padding: '2px 8px', borderRadius: '6px', background: '#ECFDF5', color: '#065F46', fontSize: '11px', fontWeight: '700' }}>
                                حاضر
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )
                )}
              </div>

              {/* Modal Actions */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                <button
                  className="btn btn-success btn-sm"
                  onClick={() => setShowSummaryPdfModal(true)}
                  id="export-summary-pdf-btn"
                  title="تصدير كشف الحضور والغياب بصيغة PDF الرسمية"
                >
                  📄 تصدير كشف الحضور والغياب (PDF)
                </button>

                <button
                  className="btn btn-ghost"
                  onClick={handleCloseSummaryAndReturnHome}
                  style={{ fontSize: '13px', fontWeight: '700', border: '1px solid #D1D5DB' }}
                >
                  إغلاق والعودة للرئيسية
                </button>
              </div>
            </div>
          </div>
        )}
        {/* Closed Lecture Attendance & Absences PDF Modal */}
        {closedSummary && (
          <AttendancePdfReportModal
            isOpen={showSummaryPdfModal}
            onClose={() => setShowSummaryPdfModal(false)}
            reportTitle={`كشف حضور وغياب - ${closedSummary.lectureName || 'المحاضرة'}`}
            studyPeriodLabel={
              closedSummary.studyPeriod === 'EVENING' ? 'الدراسة المسائية' : 'الدراسة الصباحية'
            }
            sectionLabel={closedSummary.section ? `شعبة ${closedSummary.section}` : 'كافة الشُعب'}
            lectureDate={lecture?.startedAt}
            records={[
              ...(closedSummary.presentStudents || []).map((s) => ({
                id: s.studentId,
                studentName: s.studentName,
                studentCode: s.studentCode,
                status: 'PRESENT',
                registeredAt: s.registeredAt,
                studyPeriod: closedSummary.studyPeriod,
                section: closedSummary.section,
              })),
              ...(closedSummary.absentStudents || []).map((s) => ({
                id: s.studentId,
                studentName: s.studentName,
                studentCode: s.studentCode,
                status: 'ABSENT',
                studyPeriod: closedSummary.studyPeriod,
                section: closedSummary.section,
              })),
            ]}
          />
        )}
      </div>
    </div>
  );
}

/**
 * Phase 1: the attendance workspace is available only to authenticated staff
 * who hold LECTURE_CONDUCT (all four roles do; students have no accounts).
 */
export default function HomePage() {
  return (
    <RequireAuth permission={PERMISSIONS.LECTURE_CONDUCT}>
      <HomeContent />
    </RequireAuth>
  );
}
