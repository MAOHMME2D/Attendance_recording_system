'use client';

import React, { useEffect, useState } from 'react';
import { timetableApi, courseApi, stageLabel, type TimetableItem } from '../../../lib/api';
import { useAuth } from '../../../lib/auth';
import ReportExport from '../ReportExport';

export default function LecturerTimetableTab() {
  const { user } = useAuth();
  const [entries, setEntries] = useState<TimetableItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    // جلب المواد المسندة للتدريسي أولاً، ثم جلب مواعيد الجدول التابعة لمواده فقط
    courseApi
      .getAll()
      .then(async (myCourses) => {
        if (cancelled) return;
        const myCourseIds = new Set(myCourses.map((c) => c.id));

        const allEntries = await timetableApi.getAll();
        if (cancelled) return;

        // تصفية الجدول ليحتوي حصراً على المواد المسندة لهذا الأستاذ
        const teacherEntries = allEntries.filter((entry) => myCourseIds.has(entry.course.id));
        setEntries(teacherEntries);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'تعذر تحميل الجدول');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const exportRows = entries.map((entry, index) => ({
    'ت': index + 1,
    'اليوم': entry.dayLabel,
    'المادة': `${entry.course.code} — ${entry.course.name}`,
    'النوع': (entry.type === 'PRACTICAL' || entry.typeLabel === 'عملي') ? 'عملي' : 'نظري',
    'المرحلة': stageLabel(entry.course.stage),
    'الشعبة': `شعبة ${entry.section.name}`,
    'القاعة': entry.hall || '—',
    'الدراسة': entry.section.studyPeriod === 'EVENING' ? 'مسائي' : 'صباحي',
    'وقت البدء': entry.startTime,
    'وقت الانتهاء': entry.endTime,
  }));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '10px',
          flexWrap: 'wrap',
        }}
      >
        <div>
          <h2 style={{ fontSize: '18px', fontWeight: '800', color: '#111827' }}>
            الجدول الأسبوعي للمحاضر
          </h2>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '2px' }}>
            مواعيد المحاضرات والقاعات والمواد المجدولة للمحاضر ({user?.fullName})
          </p>
        </div>

        <ReportExport
          title="الجدول الأسبوعي للمحاضر"
          subtitle={`المحاضر: ${user?.fullName || ''}`}
          columns={[
            { header: 'اليوم', value: (row) => row['اليوم'] },
            { header: 'المادة', value: (row) => row['المادة'] },
            { header: 'النوع', value: (row) => row['النوع'] },
            { header: 'المرحلة', value: (row) => row['المرحلة'] },
            { header: 'الشعبة', value: (row) => row['الشعبة'] },
            { header: 'القاعة', value: (row) => row['القاعة'] },
            { header: 'الدراسة', value: (row) => row['الدراسة'] },
            { header: 'وقت البدء', value: (row) => row['وقت البدء'] },
            { header: 'وقت الانتهاء', value: (row) => row['وقت الانتهاء'] },
          ]}
          rows={exportRows}
          filename="جدول_المحاضرات_الاسبوعي"
          sheetName="الجدول"
          disabled={entries.length === 0}
        />
      </div>

      {error && (
        <div
          role="alert"
          style={{
            padding: '12px 16px',
            borderRadius: '12px',
            background: '#FEF2F2',
            border: '1px solid #FCA5A5',
            color: '#991B1B',
            fontSize: '13px',
          }}
        >
          ⚠️ {error}
        </div>
      )}

      {loading ? (
        <div className="empty-state">
          <p style={{ color: 'var(--text-muted)' }}>جارٍ تحميل الجدول...</p>
        </div>
      ) : entries.length === 0 ? (
        <div className="empty-state">
          <p style={{ color: 'var(--text-muted)' }}>لا توجد مواعيد محاضرات مسجلة في الجدول لك حالياً.</p>
        </div>
      ) : (
        <div className="glass-card" style={{ padding: '0', overflow: 'hidden' }}>
          <div className="table-responsive">
            <table className="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#F9FAFB', borderBottom: '1px solid #E5E7EB' }}>
                  <th style={{ padding: '12px 16px', textAlign: 'right', fontWeight: '700', fontSize: '13px' }}>اليوم</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right', fontWeight: '700', fontSize: '13px' }}>المادة</th>
                  <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: '700', fontSize: '13px' }}>النوع</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right', fontWeight: '700', fontSize: '13px' }}>المرحلة</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right', fontWeight: '700', fontSize: '13px' }}>الشعبة</th>
                  <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: '700', fontSize: '13px' }}>القاعة</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right', fontWeight: '700', fontSize: '13px' }}>الدراسة</th>
                  <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: '700', fontSize: '13px' }} dir="ltr">من</th>
                  <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: '700', fontSize: '13px' }} dir="ltr">إلى</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <tr key={entry.id} style={{ borderBottom: '1px solid #F3F4F6' }}>
                    <td style={{ padding: '14px 16px', fontWeight: '700', color: '#111827' }}>{entry.dayLabel}</td>
                    <td style={{ padding: '14px 16px' }}>
                      <span style={{ fontWeight: '700', color: '#111827' }}>{entry.course.name}</span>
                      <span style={{ marginInlineStart: '6px', fontSize: '12px', color: '#6B7280' }}>({entry.course.code})</span>
                    </td>
                    <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                      <span
                        style={{
                          display: 'inline-block',
                          padding: '3px 8px',
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
                    <td style={{ padding: '14px 16px' }}>{stageLabel(entry.course.stage)}</td>
                    <td style={{ padding: '14px 16px' }}>شعبة {entry.section.name}</td>
                    <td style={{ padding: '14px 16px', textAlign: 'center', fontWeight: '600' }}>{entry.hall || '—'}</td>
                    <td style={{ padding: '14px 16px' }}>
                      <span className={`badge ${entry.section.studyPeriod === 'EVENING' ? 'badge-closed' : 'badge-active'}`}>
                        {entry.section.studyPeriod === 'EVENING' ? 'مسائي' : 'صباحي'}
                      </span>
                    </td>
                    <td style={{ padding: '14px 16px', textAlign: 'center', fontWeight: '600' }} dir="ltr">{entry.startTime}</td>
                    <td style={{ padding: '14px 16px', textAlign: 'center', fontWeight: '600' }} dir="ltr">{entry.endTime}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

