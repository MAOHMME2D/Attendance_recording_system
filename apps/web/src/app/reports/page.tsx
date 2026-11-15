'use client';

import React, { useState } from 'react';
import Navbar from '../../components/layout/Navbar';
import LectureReportsPanel from '../../components/reports/LectureReportsPanel';
import LecturerTimetableTab from '../../components/reports/tabs/LecturerTimetableTab';
import AdminStatsPanel from '../../components/reports/AdminStatsPanel';
import { useAuth, PERMISSIONS } from '../../lib/auth';

// التدريسي يعرض تبويبين فقط: تقارير المحاضرات والجدول الأسبوعي.
// الإدارة (البرنامج/رئيس القسم/المسجل) ترى التبويبين أعلاه وأيضاً تبويب
// «الإحصائيات والإدارة» الذي يجمع كل الإحصائيات في صفحة واحدة مرتبة.
type TabId = 'lectures' | 'timetable' | 'adminStats';

const TABS: Array<{ id: TabId; label: string }> = [
  { id: 'lectures', label: 'تقارير المحاضرات' },
  { id: 'timetable', label: 'الجدول الأسبوعي' },
  { id: 'adminStats', label: 'الإحصائيات والإدارة' },
];

export default function ReportsPage() {
  const { user, can } = useAuth();
  const isLecturer =
    user?.role === 'LECTURER' || user?.role === 'TECHNICAL_LECTURER';
  const [activeTab, setActiveTab] = useState<TabId>(
    isLecturer ? 'lectures' : 'adminStats',
  );

  const visibleTabs = isLecturer
    ? TABS.filter((tab) => tab.id !== 'adminStats')
    : TABS;

  if (!can(PERMISSIONS.REPORTS_VIEW)) {
    return (
      <div className="no-print" style={{ minHeight: '100vh', background: 'var(--bg-primary)' }}>
        <Navbar />
        <div className="app-page">
          <div className="glass-card" style={{ padding: '32px 24px', textAlign: 'center', maxWidth: '520px', margin: '60px auto' }}>
            <h1 style={{ fontSize: '20px', fontWeight: '800', marginBottom: '8px', color: '#111827' }}>
              لا تملك صلاحية عرض التقارير
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '13.5px' }}>
              تواصل مع رئيس القسم أو المسجل لمنحك صلاحية استعراض التقارير.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)' }}>
      <Navbar />

      <div className="app-page">
        <div className="no-print" style={{ marginBottom: '18px' }}>
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
                color: '#D4AF37',
                flexShrink: 0,
              }}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="20" x2="18" y2="10" />
                <line x1="12" y1="20" x2="12" y2="4" />
                <line x1="6" y1="20" x2="6" y2="14" />
              </svg>
            </div>
            <h1 style={{ fontSize: '24px', fontWeight: '800', color: '#111827' }}>التقارير والإحصائيات</h1>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '13.5px' }}>
            {isLecturer
              ? 'تقارير تفصيلية لكل محاضرة مع سجلات الحضور والغياب والطباعة — والجدول الأسبوعي لحصصك.'
              : 'تقارير تفصيلية لكل محاضرة — إحصائيات الإدارة مرتبة في تبويب واحد (الطلاب، الغيابات، المواد، المدرسون، الشعب والمراحل) — والجدول الأسبوعي.'}
          </p>
        </div>

        <div
          className="no-print"
          role="tablist"
          aria-label="أقسام التقارير"
          style={{
            display: 'flex',
            gap: '2px',
            borderBottom: '2px solid #E5E7EB',
            marginBottom: '18px',
            overflowX: 'auto',
            WebkitOverflowScrolling: 'touch',
          }}
        >
          {visibleTabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                background: 'transparent',
                border: 'none',
                borderBottom: activeTab === tab.id ? '3px solid var(--gold)' : '3px solid transparent',
                padding: '10px 16px',
                fontSize: '14px',
                fontWeight: activeTab === tab.id ? '800' : '600',
                color: activeTab === tab.id ? '#111827' : 'var(--text-muted)',
                cursor: 'pointer',
                fontFamily: 'inherit',
                whiteSpace: 'nowrap',
                minHeight: '44px',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === 'lectures' && <LectureReportsPanel />}
        {activeTab === 'timetable' && <LecturerTimetableTab />}
        {activeTab === 'adminStats' && <AdminStatsPanel />}
      </div>
    </div>
  );
}
