function getApiBase(): string {
  if (typeof window !== 'undefined') {
    return '/api';
  }
  return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
}

/**
 * WebSocket origin. The Next.js rewrite proxy only handles HTTP, so realtime
 * connections go directly to the API origin. Cookies are host-scoped, so the
 * HttpOnly session cookie is sent to this origin as well.
 */
export function getWsBase(): string {
  const configured = process.env.NEXT_PUBLIC_WS_ORIGIN;
  if (configured) return configured;
  if (typeof window !== 'undefined') {
    const port = process.env.NEXT_PUBLIC_API_PORT || '3001';
    return `${window.location.protocol}//${window.location.hostname}:${port}`;
  }
  return 'http://localhost:3001';
}

/** Error carrying the HTTP status so pages can distinguish 401/403/etc. */
export class ApiError extends Error {
  status: number;
  details?: unknown;

  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

function extractMessage(payload: any, status: number): string {
  if (payload) {
    const message = payload.message;
    if (Array.isArray(message) && message.length > 0) {
      return message.join('، ');
    }
    if (typeof message === 'string' && message.trim()) {
      return message;
    }
    if (typeof payload.error === 'string' && payload.error.trim()) {
      return payload.error;
    }
  }
  if (status === 401) return 'يجب تسجيل الدخول للمتابعة';
  if (status === 403) return 'ليست لديك صلاحية لتنفيذ هذا الإجراء';
  return `فشل الطلب (${status})`;
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
    // Required so the HttpOnly staff session cookie is stored and sent.
    credentials: 'include',
  });

  const text = await res.text();
  let payload: any = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = text;
    }
  }

  if (!res.ok) {
    // Session expiry is broadcast so AuthProvider can clear its state once.
    if (
      res.status === 401 &&
      typeof window !== 'undefined' &&
      !cleanEndpoint.startsWith('/auth/login')
    ) {
      window.dispatchEvent(new Event('attendance:unauthorized'));
    }
    throw new ApiError(extractMessage(payload, res.status), res.status, payload);
  }

  return payload as T;
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

// ============ Authentication ============
export type StaffRole =
  | 'HEAD_OF_DEPARTMENT'
  | 'REGISTRAR'
  | 'LECTURER'
  | 'TECHNICAL_LECTURER'
  | 'SYSTEM_OWNER';

export interface StaffUser {
  id: string;
  staffId: string;
  fullName: string;
  role: StaffRole;
  permissions: string[];
  lastLoginAt: string | null;
}

export const authApi = {
  login: (staffId: string, password: string) =>
    apiFetch<{ expiresAt: string; user: StaffUser }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ staffId, password }),
    }),

  logout: () => apiFetch<{ success: boolean }>('/auth/logout', { method: 'POST' }),

  me: () => apiFetch<StaffUser>('/auth/me'),
};

// ============ Staff management ============
export interface ManagedStaff {
  id: string;
  staffId: string;
  fullName: string;
  role: StaffRole;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

export interface CreateStaffInput {
  staffId: string;
  fullName: string;
  role: Exclude<StaffRole, 'SYSTEM_OWNER'>;
  password: string;
}

export interface UpdateStaffInput {
  staffId?: string;
  fullName?: string;
  role?: Exclude<StaffRole, 'SYSTEM_OWNER'>;
}

export const staffApi = {
  list: () => apiFetch<ManagedStaff[]>('/staff'),

  create: (input: CreateStaffInput) =>
    apiFetch<ManagedStaff>('/staff', {
      method: 'POST',
      body: JSON.stringify(input),
    }),

  update: (id: string, input: UpdateStaffInput) =>
    apiFetch<ManagedStaff>(`/staff/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    }),

  setActive: (id: string, isActive: boolean) =>
    apiFetch<ManagedStaff>(`/staff/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ isActive }),
    }),

  resetPassword: (id: string, password: string) =>
    apiFetch<{ success: boolean }>(`/staff/${id}/password`, {
      method: 'PATCH',
      body: JSON.stringify({ password }),
    }),
};

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
export interface StudentHistoryItem {
  attendanceId: string;
  lectureId: string;
  lectureName: string;
  lectureDate: string;
  status: string;
  registeredAt: string;
}

/** Full student row returned by GET /students (Head of Department / Registrar). */
export interface StudentListItem {
  id: string;
  orderIndex: number;
  studentCode: string;
  name: string;
  studyPeriod?: string;
  section?: string;
  presentCount: number;
  absentCount: number;
  totalLectures: number;
  createdAt: string;
  history: StudentHistoryItem[];
}

/** Minimal row returned by GET /students/options (lecturers, no QR/statistics). */
export interface StudentOption {
  id: string;
  name: string;
  studentCode: string;
  studyPeriod?: string;
  section?: string;
  orderIndex?: number;
}

export const studentApi = {
  getAll: (studyPeriod?: string, section?: string) => {
    const params = new URLSearchParams();
    if (studyPeriod) params.append('studyPeriod', studyPeriod);
    if (section) params.append('section', section);
    const query = params.toString();
    return apiFetch<StudentListItem[]>(`/students${query ? `?${query}` : ''}`);
  },

  /** Minimal list (no QR credentials) used by lecturers for manual attendance. */
  getOptions: (studyPeriod?: string, section?: string) => {
    const params = new URLSearchParams();
    if (studyPeriod) params.append('studyPeriod', studyPeriod);
    if (section) params.append('section', section);
    const query = params.toString();
    return apiFetch<StudentOption[]>(`/students/options${query ? `?${query}` : ''}`);
  },

  lookup: (code: string) =>
    apiFetch<any>(`/students/lookup/${encodeURIComponent(code)}`),

  getQr: (studentId: string) =>
    apiFetch<{ studentId: string; token: string }>(
      `/students/${encodeURIComponent(studentId)}/qr`,
    ),

  rotateQr: (studentId: string) =>
    apiFetch<{ studentId: string; token: string; rotatedAt: string }>(
      `/students/${encodeURIComponent(studentId)}/qr/rotate`,
      { method: 'POST' },
    ),

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

  resetAbsences: (data: {
    studyPeriod?: string;
    section?: string;
    studentId?: string;
    resetType?: 'ABSENCES_ONLY' | 'ALL_ATTENDANCE';
  }) =>
    apiFetch<{ success: boolean; count: number; message: string }>('/students/reset-absences', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
};

// ============ Sections ============
export interface SectionItem {
  id: string;
  studyPeriod: 'MORNING' | 'EVENING';
  name: string;
  label?: string | null;
  createdAt?: string;
}

export const sectionApi = {
  getAll: (studyPeriod?: string) => {
    const q = studyPeriod ? `?studyPeriod=${studyPeriod}` : '';
    return apiFetch<SectionItem[]>(`/sections${q}`);
  },

  create: (data: { studyPeriod: string; name: string; label?: string }) =>
    apiFetch<SectionItem>('/sections', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  delete: (id: string) =>
    apiFetch<{ success: boolean; message: string }>(`/sections/${id}`, {
      method: 'DELETE',
    }),
};
