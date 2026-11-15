'use client';

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import * as XLSX from 'xlsx';

export interface ExportColumn<Row> {
  header: string;
  value: (row: Row) => string | number | null | undefined;
}

/**
 * Shared PDF (print) + Excel export buttons for every report.
 * The printed sheet is rendered in a body-level portal so the print CSS in
 * globals.css can isolate it; the Excel file mirrors the same rows exactly.
 */
export default function ReportExport<Row>({
  title,
  subtitle,
  filtersLabel,
  stats = [],
  columns,
  rows,
  filename,
  sheetName = 'التقرير',
  disabled = false,
}: {
  title: string;
  subtitle?: string;
  filtersLabel?: string;
  stats?: Array<{ label: string; value: string | number }>;
  columns: ExportColumn<Row>[];
  rows: Row[];
  filename: string;
  sheetName?: string;
  disabled?: boolean;
}) {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const handlePrint = () => {
    const root = document.documentElement;
    root.classList.add('report-print-mode');
    const cleanup = () => {
      root.classList.remove('report-print-mode');
      window.removeEventListener('afterprint', cleanup);
    };
    window.addEventListener('afterprint', cleanup);
    // منح المتصفح مهلة لتطبيق الكلاس وبناء DOM في الـ Portal قبل فتح نافذة الطباعة
    window.requestAnimationFrame(() => {
      setTimeout(() => {
        window.print();
      }, 100);
    });
    // Fallback for browsers that block afterprint in some flows.
    window.setTimeout(cleanup, 5000);
  };

  const handleExportExcel = () => {
    if (rows.length === 0) {
      alert('لا توجد بيانات للتصدير في النطاق المحدد');
      return;
    }
    const data = rows.map((row) =>
      Object.fromEntries(columns.map((col) => [col.header, col.value(row) ?? ''])),
    );
    const worksheet = XLSX.utils.json_to_sheet(data);
    worksheet['!cols'] = columns.map((col) => ({
      wch: Math.min(Math.max(String(col.header).length + 6, 12), 60),
    }));
    const lastRow = rows.length; // +1 header row, 0-based elsewhere
    worksheet['!autofilter'] = {
      ref: `A1:${XLSX.utils.encode_cell({ r: lastRow, c: columns.length - 1 })}`,
    };
    worksheet['!views'] = [{ state: 'frozen', ySplit: 1, rightToLeft: true }];
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName.slice(0, 28));
    XLSX.writeFile(workbook, `${filename}.xlsx`);
  };

  const printSheet = isClient ? createPortal(
    <div className="report-print-root" aria-hidden="true">
      <div className="report-print-sheet">
        <div className="report-print-header">
          <div>
            <h1 className="report-print-title">{title}</h1>
            {subtitle && <p className="report-print-sub">{subtitle}</p>}
          </div>
          <div className="report-print-stamp">
            نظام تسجيل الحضور الذكي<br />
            كلية البوليتكنك | قسم تقنيات المختبرات الطبية<br />
            تاريخ إصدار التقرير: {new Date().toLocaleDateString('ar', { year: 'numeric', month: 'long', day: 'numeric' })}
          </div>
        </div>

        {filtersLabel && (
          <div className="report-print-filters"><strong>الفلاتر المستخدمة:</strong> {filtersLabel}</div>
        )}

        {stats.length > 0 && (
          <div className="report-print-stats">
            {stats.map((stat) => (
              <div key={stat.label} className="report-print-stat">
                <b>{stat.value}</b>
                <span>{stat.label}</span>
              </div>
            ))}
          </div>
        )}

        <table>
          <thead>
            <tr>
              {columns.map((col) => <th key={col.header}>{col.header}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={index}>
                {columns.map((col) => <td key={col.header}>{col.value(row) ?? '—'}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>,
    document.body,
  ) : null;

  return (
    <div style={{ display: 'inline-flex', gap: '8px', flexWrap: 'wrap' }}>
      <button type="button" className="btn btn-success btn-sm" onClick={handlePrint} disabled={disabled}>
        🖨️ PDF
      </button>
      <button type="button" className="btn btn-ghost btn-sm" onClick={handleExportExcel} disabled={disabled}>
        ⬇️ Excel
      </button>
      {printSheet}
    </div>
  );
}
