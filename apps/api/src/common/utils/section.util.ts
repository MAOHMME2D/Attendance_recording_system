/**
 * Normalizes section names for comparison.
 *
 * Numeric names ("1".."8", Arabic-Indic digits, and Arabic ordinal words) keep
 * their historical representation. Alphanumeric names such as "A1" are kept
 * intact instead of being reduced to "1".
 */
export function normalizeSection(sec?: string | null): string {
  if (!sec) return '';
  let s = String(sec).trim().replace(/^(شعبة|الشعبة)\s*/i, '').trim();
  if (!s) return '';

  // Fold Arabic-Indic digits into ASCII so "١" and "1" compare equal.
  s = s.replace(/[٠-٩]/g, (digit) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)));

  // Pure numeric names ("1", "01", "12").
  if (/^\d+$/.test(s)) return s;

  const map: Record<string, string> = {
    'الاولى': '1', 'الأولى': '1', 'الاول': '1', 'الأول': '1', 'اولى': '1', 'أولى': '1', 'اول': '1', 'أول': '1', 'واحد': '1', '١': '1',
    'الثانية': '2', 'الثاني': '2', 'ثانية': '2', 'ثاني': '2', 'اثنين': '2', 'إثنين': '2', '٢': '2',
    'الثالثة': '3', 'الثالث': '3', 'ثالثة': '3', 'ثالث': '3', 'ثلاثة': '3', '٣': '3',
    'الرابعة': '4', 'الرابع': '4', 'رابعة': '4', 'رابع': '4', 'اربعة': '4', 'أربعة': '4', '٤': '4',
    'الخامسة': '5', 'الخامس': '5', 'خامسة': '5', 'خامس': '5', 'خمسة': '5', '٥': '5',
    'السادسة': '6', 'السادس': '6', 'سادسة': '6', 'سادس': '6', 'ستة': '6', '٦': '6',
    'السابعة': '7', 'السابع': '7', 'سابعة': '7', 'سابع': '7', 'سبعة': '7', '٧': '7',
    'الثامنة': '8', 'الثامن': '8', 'ثامنة': '8', 'ثامن': '8', 'ثمانية': '8', '٨': '8',
  };
  return map[s] || s;
}

