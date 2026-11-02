function getApiBase(): string {
  if (typeof window !== 'undefined') {
    return '/api';
  }
  return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
}

async function apiFetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  const base = getApiBase();
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;

  const res = await fetch(`${base}${cleanEndpoint}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: 'An error occurred' }));
    throw new Error(error.message || `Request failed with status ${res.status}`);
  }

  return res.json();
}

export type StudyPeriod = 'MORNING' | 'EVENING';

export const STUDY_PERIODS = [
  { value: 'MORNING', label: 'دراسة صباحية' },
  { value: 'EVENING', label: 'دراسة مسائية' },
];

export const MORNING_SECTIONS = [
  { value: '1', label: 'الشعبة الأولى' },
  { value: '2', label: 'الشعبة الثانية' },
  { value: '3', label: 'الشعبة الثالثة' },
];

export const EVENING_SECTIONS = [
  { value: '1', label: 'الشعبة الأولى' },
  { value: '2', label: 'الشعبة الثانية' },
  { value: '3', label: 'الشعبة الثالثة' },
  { value: '4', label: 'الشعبة الرابعة' },
  { value: '5', label: 'الشعبة الخامسة' },
  { value: '6', label: 'الشعبة السادسة' },
  { value: '7', label: 'الشعبة السابعة' },
  { value: '8', label: 'الشعبة الثامنة' },
];

export function getSectionsForPeriod(period: string) {
  return period === 'EVENING' ? EVENING_SECTIONS : MORNING_SECTIONS;
}

export function formatSectionLabel(section?: string | null): string {
  if (!section) return '-';
  const clean = section.trim();
  const num = clean.replace(/[^0-9]/g, '');
  const sectionMap: Record<string, string> = {
    '1': 'الشعبة الأولى',
    '2': 'الشعبة الثانية',
    '3': 'الشعبة الثالثة',
    '4': 'الشعبة الرابعة',
    '5': 'الشعبة الخامسة',
    '6': 'الشعبة السادسة',
    '7': 'الشعبة السابعة',
    '8': 'الشعبة الثامنة',
  };
  if (num && sectionMap[num]) return sectionMap[num];
  if (sectionMap[clean]) return sectionMap[clean];
  return clean;
}

// ============ Lectures ============
export const lectureApi = {
  create: (name: string, studyPeriod?: string, section?: string) =>
    apiFetch<any>('/lectures', {
      method: 'POST',
      body: JSON.stringify({ name, studyPeriod: studyPeriod || 'MORNING', section }),
    }),

  get: (id: string) =>
    apiFetch<any>(`/lectures/${id}`),

  getActive: () =>
    apiFetch<any>('/lectures/active/current'),

  getAll: () =>
    apiFetch<any[]>('/lectures'),

  close: (id: string) =>
    apiFetch<any>(`/lectures/${id}/close`, { method: 'PATCH' }),

  delete: (id: string) =>
    apiFetch<any>(`/lectures/${id}`, { method: 'DELETE' }),

  validateQr: (token: string) =>
    apiFetch<any>('/lectures/validate-qr', {
      method: 'POST',
      body: JSON.stringify({ token }),
    }),
};

// ============ Attendance ============
export const attendanceApi = {
  register: (token: string, studentName: string, deviceId?: string) =>
    apiFetch<any>('/attendance/register', {
      method: 'POST',
      body: JSON.stringify({ token, studentName, deviceId }),
    }),

  getByLecture: (lectureId: string) =>
    apiFetch<any[]>(`/attendance/${lectureId}`),

  toggleStatus: (recordId: string) =>
    apiFetch<any>(`/attendance/${recordId}/toggle`, { method: 'PATCH' }),

  addManual: (lectureId: string, studentName: string, status?: string) =>
    apiFetch<any>(`/attendance/${lectureId}/manual`, {
      method: 'POST',
      body: JSON.stringify({ studentName, status }),
    }),

  scanStudent: (lectureId: string, studentCode: string) =>
    apiFetch<any>(`/attendance/${lectureId}/scan-student`, {
      method: 'POST',
      body: JSON.stringify({ studentCode }),
    }),
};

// ============ Students ============
export const studentApi = {
  getAll: (studyPeriod?: string, section?: string) => {
    const params = new URLSearchParams();
    if (studyPeriod) params.append('studyPeriod', studyPeriod);
    if (section) params.append('section', section);
    const query = params.toString();
    return apiFetch<any[]>(`/students${query ? `?${query}` : ''}`);
  },

  lookup: (code: string) =>
    apiFetch<any>(`/students/lookup/${encodeURIComponent(code)}`),

  create: (data: { studentCode: string; name: string; studyPeriod?: string; section?: string; orderIndex?: number; presentCount?: number; absentCount?: number; totalSessions?: number; rate?: number }) =>
    apiFetch<any>('/students', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  createBatch: (students: { studentCode: string; name: string; studyPeriod?: string; section?: string; orderIndex?: number; presentCount?: number; absentCount?: number; totalSessions?: number; rate?: number }[]) =>
    apiFetch<any>('/students/batch', {
      method: 'POST',
      body: JSON.stringify({ students }),
    }),

  update: (id: string, data: { studentCode?: string; name?: string; studyPeriod?: string; section?: string }) =>
    apiFetch<any>(`/students/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  delete: (id: string) =>
    apiFetch<any>(`/students/${id}`, { method: 'DELETE' }),
};
