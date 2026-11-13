'use client';

import React, { useState } from 'react';
import DashboardTab from './tabs/DashboardTab';
import StudentsReportTab from './tabs/StudentsReportTab';
import AbsenteesReportTab from './tabs/AbsenteesReportTab';
import CoursesReportTab from './tabs/CoursesReportTab';
import LecturersReportTab from './tabs/LecturersReportTab';
import SectionsStagesReportTab from './tabs/SectionsStagesReportTab';
import AcademicYearResetSection from './AcademicYearResetSection';
import { useAuth, PERMISSIONS } from '../../lib/auth';

/**
 * Statistics for administrative roles, organised in ONE tab with clearly
 * separated sections instead of multiple duplicate top-level tabs. Every
 * section answers one question: overview → per student → by absence threshold →
 * by course → by lecturer → by section/stage. The final section starts a brand
 * new academic year and is shown only to roles allowed to wipe academic data.
 */
const SECTIONS = [
  { id: 'overview', label: 'لوحة الإحصائيات', icon: '📊' },
  { id: 'students', label: 'الطلاب', icon: '👨‍🎓' },
  { id: 'absentees', label: 'الغيابات', icon: '🚩' },
  { id: 'courses', label: 'المواد', icon: '📘' },
  { id: 'lecturers', label: 'المدرسون', icon: '🧑‍🏫' },
  { id: 'sections', label: 'الشعب والمراحل', icon: '🏫' },
  { id: 'academicYear', label: 'بدء سنة دراسية جديدة', icon: '🗓️' },
] as const;

type SectionId = (typeof SECTIONS)[number]['id'];

export default function AdminStatsPanel() {
  const { can } = useAuth();
  const [section, setSection] = useState<SectionId>('overview');

  const visibleSections = SECTIONS.filter(
    (item) => item.id !== 'academicYear' || can(PERMISSIONS.ACADEMIC_YEAR_RESET),
  );

  return (
    <section>
      <div
        role="tablist"
        aria-label="أقسام الإحصائيات"
        style={{
          display: 'flex',
          gap: '6px',
          flexWrap: 'wrap',
          padding: '6px',
          marginBottom: '16px',
          background: '#F3F4F6',
          border: '1px solid #E5E7EB',
          borderRadius: '14px',
        }}
      >
        {visibleSections.map((item) => {
          const isActive = section === item.id;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setSection(item.id)}
              style={{
                padding: '8px 14px',
                borderRadius: '10px',
                border: isActive ? '1.5px solid #D4AF37' : '1px solid transparent',
                background: isActive ? '#111827' : 'transparent',
                color: isActive ? '#FFFFFF' : '#374151',
                fontWeight: isActive ? '800' : '600',
                fontSize: '13px',
                cursor: 'pointer',
                fontFamily: 'inherit',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'all 0.15s ease',
              }}
            >
              <span aria-hidden="true">{item.icon}</span>
              {item.label}
            </button>
          );
        })}
      </div>

      {section === 'overview' && <DashboardTab />}
      {section === 'students' && <StudentsReportTab />}
      {section === 'absentees' && <AbsenteesReportTab />}
      {section === 'courses' && <CoursesReportTab />}
      {section === 'lecturers' && <LecturersReportTab />}
      {section === 'sections' && <SectionsStagesReportTab />}
      {section === 'academicYear' && can(PERMISSIONS.ACADEMIC_YEAR_RESET) && (
        <AcademicYearResetSection />
      )}
    </section>
  );
}
