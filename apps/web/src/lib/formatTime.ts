const MONTHS = [
  'كانون الثاني',
  'شباط',
  'آذار',
  'نيسان',
  'أيار',
  'حزيران',
  'تموز',
  'آب',
  'أيلول',
  'تشرين الأول',
  'تشرين الثاني',
  'كانون الأول',
];

const WEEKDAYS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

/** Date that keeps day, month, then year in RTL pages and printed PDFs. */
export function formatAttendanceDate(value?: string | null, withWeekday = false): string {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';

  const core = `${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
  if (!withWeekday) return core;
  return `${WEEKDAYS[date.getDay()]}، ${core}`;
}

/** Clock time that stays in order inside RTL pages and printed PDFs. */
export function formatAttendanceTime(value?: string | null, withSeconds = true): string {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';

  const hours24 = date.getHours();
  const hours12 = hours24 % 12 || 12;
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  const period = hours24 < 12 ? 'ص' : 'م';
  const clock = withSeconds ? `${hours12}:${minutes}:${seconds}` : `${hours12}:${minutes}`;
  return `${clock} ${period}`;
}
