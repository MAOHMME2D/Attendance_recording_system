'use client';

import React, { useEffect, useState, useMemo } from 'react';
import {
  studentApi,
  stageLabel,
  type CourseItem,
  type StudentListItem,
  type StudentEnrollment,
  type AcademicStatus,
} from '../../lib/api';

interface StudentCourseEnrollmentModalProps {
  isOpen: boolean;
  student: StudentListItem | null;
  onClose: () => void;
  onSaved: () => void;
}

export default function StudentCourseEnrollmentModal({
  isOpen,
  student,
  onClose,
  onSaved,
}: StudentCourseEnrollmentModalProps) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [academicStatus, setAcademicStatus] = useState<AcademicStatus>('REGULAR');
  const [selectedCourseIds, setSelectedCourseIds] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  const [allCourses, setAllCourses] = useState<CourseItem[]>([]);

  useEffect(() => {
    if (!isOpen || !student) return;

    let cancelled = false;
    setLoading(true);
    setError(null);

    studentApi
      .getEnrollment(student.id)
      .then((data: StudentEnrollment) => {
        if (cancelled) return;
        setAcademicStatus(data.academicStatus || 'REGULAR');
        setSelectedCourseIds(data.courseIds || []);
        setNotes(data.notes || '');
        setAllCourses(data.allCourses || []);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'تعذر تحميل بيانات مواد الطالب');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen, student]);

  const coursesByStage = useMemo(() => {
    const map = new Map<number, CourseItem[]>();
    for (const course of allCourses) {
      const list = map.get(course.stage) || [];
      list.push(course);
      map.set(course.stage, list);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a - b);
  }, [allCourses]);

  if (!isOpen || !student) return null;

  const toggleCourse = (courseId: string) => {
    setSelectedCourseIds((prev) =>
      prev.includes(courseId) ? prev.filter((id) => id !== courseId) : [...prev, courseId],
    );
  };

  const selectCurrentStageCourses = () => {
    const currentStageIds = allCourses
      .filter((c) => c.stage === student.stage)
      .map((c) => c.id);
    setSelectedCourseIds((prev) => Array.from(new Set([...prev, ...currentStageIds])));
  };

  const clearSelection = () => {
    setSelectedCourseIds([]);
  };

  const handleSave = async () => {
    if (academicStatus !== 'REGULAR' && selectedCourseIds.length === 0) {
      setError('يجب تحديد مادة واحدة على الأقل للطالب الراسب أو طالب العبور');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await studentApi.updateEnrollment(student.id, {
        academicStatus,
        courseIds: academicStatus === 'REGULAR' ? [] : selectedCourseIds,
        notes: notes.trim(),
      });
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'فشل حفظ المواد المطالب بها');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="modal-backdrop animate-fade-in"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.65)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        zIndex: 1050,
      }}
      onClick={onClose}
    >
      <div
        className="glass-card"
        style={{
          width: '100%',
          maxWidth: '680px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          background: '#FFFFFF',
          borderRadius: '16px',
          boxShadow: '0 20px 40px rgba(0,0,0,0.25)',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '18px 24px',
            borderBottom: '1px solid #E5E7EB',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: '#F9FAFB',
          }}
        >
          <div>
            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '800', color: '#111827' }}>
              المواد والمطالبة الأكاديمية
            </h3>
            <div style={{ fontSize: '13px', color: '#6B7280', marginTop: '4px' }}>
              {student.name} · {student.studentCode} · {stageLabel(student.stage)} · {student.studyPeriod === 'EVENING' ? 'مسائي' : 'صباحي'} ({student.sectionLabel || student.section || 'بلا شعبة'})
            </div>
          </div>
          <button
            onClick={onClose}
            className="btn btn-ghost btn-sm"
            style={{ fontSize: '16px', padding: '6px 12px' }}
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1 }}>
          {error && (
            <div
              style={{
                padding: '12px 16px',
                background: '#FEE2E2',
                color: '#991B1B',
                borderRadius: '8px',
                marginBottom: '16px',
                fontSize: '13.5px',
                border: '1px solid #FCA5A5',
              }}
            >
              {error}
            </div>
          )}

          {loading ? (
            <div style={{ padding: '40px', textAlign: 'center', color: '#6B7280' }}>
              جاري تحميل بيانات المواد...
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Status Radio Group */}
              <div>
                <label style={{ display: 'block', fontWeight: '700', fontSize: '14px', marginBottom: '10px', color: '#374151' }}>
                  الحالة الأكاديمية للطالب:
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px' }}>
                  <label
                    style={{
                      border: academicStatus === 'REGULAR' ? '2px solid #2563EB' : '1px solid #D1D5DB',
                      background: academicStatus === 'REGULAR' ? '#EFF6FF' : '#FFFFFF',
                      borderRadius: '10px',
                      padding: '12px 14px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '10px',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <input
                      type="radio"
                      name="academicStatus"
                      value="REGULAR"
                      checked={academicStatus === 'REGULAR'}
                      onChange={() => {
                        setAcademicStatus('REGULAR');
                        setError(null);
                      }}
                      style={{ marginTop: '3px' }}
                    />
                    <div>
                      <div style={{ fontWeight: '700', fontSize: '14px', color: '#1E3A8A' }}>طالب منتظم</div>
                      <div style={{ fontSize: '11.5px', color: '#4B5563', marginTop: '2px' }}>
                        مطالب بكافة مواد المرحلة الحالية تلقائياً
                      </div>
                    </div>
                  </label>

                  <label
                    style={{
                      border: academicStatus === 'REPEAT' ? '2px solid #DC2626' : '1px solid #D1D5DB',
                      background: academicStatus === 'REPEAT' ? '#FEF2F2' : '#FFFFFF',
                      borderRadius: '10px',
                      padding: '12px 14px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '10px',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <input
                      type="radio"
                      name="academicStatus"
                      value="REPEAT"
                      checked={academicStatus === 'REPEAT'}
                      onChange={() => {
                        setAcademicStatus('REPEAT');
                        setError(null);
                      }}
                      style={{ marginTop: '3px' }}
                    />
                    <div>
                      <div style={{ fontWeight: '700', fontSize: '14px', color: '#991B1B' }}>طالب راسب / معيد</div>
                      <div style={{ fontSize: '11.5px', color: '#4B5563', marginTop: '2px' }}>
                        مطالب بمواد الرسوب فقط (حماية من غيابات المواد الأخرى)
                      </div>
                    </div>
                  </label>

                  <label
                    style={{
                      border: academicStatus === 'CARRY_OVER' ? '2px solid #059669' : '1px solid #D1D5DB',
                      background: academicStatus === 'CARRY_OVER' ? '#ECFDF5' : '#FFFFFF',
                      borderRadius: '10px',
                      padding: '12px 14px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '10px',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <input
                      type="radio"
                      name="academicStatus"
                      value="CARRY_OVER"
                      checked={academicStatus === 'CARRY_OVER'}
                      onChange={() => {
                        setAcademicStatus('CARRY_OVER');
                        setError(null);
                      }}
                      style={{ marginTop: '3px' }}
                    />
                    <div>
                      <div style={{ fontWeight: '700', fontSize: '14px', color: '#065F46' }}>طالب عبور</div>
                      <div style={{ fontSize: '11.5px', color: '#4B5563', marginTop: '2px' }}>
                        مطالب بمواد مرحلته + مادة أو مادتين من مرحلة سابقة
                      </div>
                    </div>
                  </label>
                </div>
              </div>

              {/* Course Selection Panel */}
              {academicStatus !== 'REGULAR' ? (
                <div style={{ border: '1px solid #E5E7EB', borderRadius: '12px', padding: '16px', background: '#FAFAFA' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontWeight: '800', fontSize: '14px', color: '#111827' }}>
                        اختر المواد المطالب بها الطالب:
                      </span>
                      <span
                        style={{
                          background: selectedCourseIds.length > 0 ? '#DBEAFE' : '#F3F4F6',
                          color: selectedCourseIds.length > 0 ? '#1D4ED8' : '#6B7280',
                          padding: '2px 8px',
                          borderRadius: '12px',
                          fontSize: '12px',
                          fontWeight: '700',
                        }}
                      >
                        {selectedCourseIds.length} مادة محددة
                      </span>
                    </div>

                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button
                        type="button"
                        onClick={selectCurrentStageCourses}
                        className="btn btn-ghost btn-sm"
                        style={{ fontSize: '11.5px', padding: '4px 8px' }}
                      >
                        + مواد المرحلة {student.stage}
                      </button>
                      <button
                        type="button"
                        onClick={clearSelection}
                        className="btn btn-ghost btn-sm"
                        style={{ fontSize: '11.5px', padding: '4px 8px', color: '#DC2626' }}
                      >
                        إلغاء التحديد
                      </button>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    {coursesByStage.map(([stageNum, courses]) => (
                      <div
                        key={stageNum}
                        style={{
                          background: '#FFFFFF',
                          border: stageNum === student.stage ? '1.5px solid #BFDBFE' : '1px solid #E5E7EB',
                          borderRadius: '8px',
                          padding: '10px 12px',
                        }}
                      >
                        <div
                          style={{
                            fontSize: '12px',
                            fontWeight: '800',
                            color: stageNum === student.stage ? '#1D4ED8' : '#4B5563',
                            marginBottom: '8px',
                            display: 'flex',
                            justifyContent: 'space-between',
                          }}
                        >
                          <span>{stageLabel(stageNum)}</span>
                          {stageNum === student.stage && (
                            <span style={{ fontSize: '11px', color: '#2563EB', fontWeight: 'normal' }}>
                              (المرحلة الحالية للطالب)
                            </span>
                          )}
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '8px' }}>
                          {courses.map((course) => {
                            const isChecked = selectedCourseIds.includes(course.id);
                            return (
                              <label
                                key={course.id}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '8px',
                                  padding: '6px 8px',
                                  borderRadius: '6px',
                                  background: isChecked ? '#EFF6FF' : 'transparent',
                                  border: isChecked ? '1px solid #93C5FD' : '1px solid transparent',
                                  cursor: 'pointer',
                                  userSelect: 'none',
                                }}
                              >
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => toggleCourse(course.id)}
                                  style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                                />
                                <div style={{ fontSize: '13px', color: isChecked ? '#1E3A8A' : '#1F2937', fontWeight: isChecked ? '700' : '500' }}>
                                  {course.name}
                                  <span style={{ fontSize: '11px', color: '#6B7280', marginRight: '6px' }}>
                                    ({course.code})
                                  </span>
                                </div>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div
                  style={{
                    padding: '16px',
                    borderRadius: '10px',
                    background: '#F0FDF4',
                    border: '1px solid #BBF7D0',
                    color: '#166534',
                    fontSize: '13.5px',
                    lineHeight: '1.6',
                  }}
                >
                  ✓ <strong>الطالب منتظم:</strong> سيتم تسجيل حضوره وغيابه تلقائياً في جميع محاضرات مواد {stageLabel(student.stage)}. لا يتطلب تخصيصاً يدوياً للمواد.
                </div>
              )}

              {/* Notes Field */}
              <div>
                <label style={{ display: 'block', fontWeight: '700', fontSize: '13px', marginBottom: '6px', color: '#374151' }}>
                  ملاحظات أكاديمية (اختياري):
                </label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="مثال: راسب بمادة الكيمياء السريرية فقط، أو عبور مادة علم الأنسجة"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  style={{ width: '100%', fontSize: '13px', padding: '8px 12px' }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '14px 24px',
            borderTop: '1px solid #E5E7EB',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '10px',
            background: '#F9FAFB',
          }}
        >
          <button
            type="button"
            className="btn btn-ghost"
            onClick={onClose}
            disabled={saving}
            style={{ fontSize: '13px' }}
          >
            إلغاء
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleSave}
            disabled={saving || loading}
            style={{ fontSize: '13px', minWidth: '100px' }}
          >
            {saving ? 'جاري الحفظ...' : 'حفظ المواد'}
          </button>
        </div>
      </div>
    </div>
  );
}

