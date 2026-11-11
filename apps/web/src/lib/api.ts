function getApiBase(): string {
  if (typeof window !== 'undefined') {
    return '/api';
  }
  if (process.env.NEXT_PUBLIC_API_URL) return process.env.NEXT_PUBLIC_API_URL;
  return process.env.NODE_ENV === 'production'
    ? 'https://attendanceapi-production-8b4e.up.railway.app/api'
    : 'http://localhost:3001/api';
}

/**
 * WebSocket origin.
 *
 * The HttpOnly session cookie is host-scoped: it is only sent back to the
 * origin that issued it. A cross-origin socket target (a different host than
 * the page) therefore cannot authenticate and must never be used silently.
 *
 * By default the socket is opened against the page origin. The `/socket.io`
 * rewrite in next.config.js forwards it to the API when the platform supports
 * WebSocket upgrades. When it does not, the client falls back to HTTP polling
 * (see the attendance page) and the UI keeps working.
 */
export function getWsBase(): string {
  const configured = process.env.NEXT_PUBLIC_WS_ORIGIN;
  if (configured) return configured;
  if (typeof window !== 'undefined') {
    return window.location.origin;
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

// ============ Academic stages ============
export type AcademicStage = 1 | 2 | 3 | 4;

export const ACADEMIC_STAGES: AcademicStage[] = [1, 2, 3, 4];

export const STAGE_LABELS: Record<AcademicStage, string> = {
  1: 'المرحلة الأولى',
  2: 'المرحلة الثانية',
  3: 'المرحلة الثالثة',
  4: 'المرحلة الرابعة',
};

export const STAGE_OPTIONS = ACADEMIC_STAGES.map((stage) => ({
  value: stage,
  label: STAGE_LABELS[stage],
}));

/** Safely read a stage label for a value coming from the API. */
export function stageLabel(stage?: number | null): string {
  if (stage === 1 || stage === 2 || stage === 3 || stage === 4) {
    return STAGE_LABELS[stage];
  }
  return '-';
}

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
  // Only purely numeric names map to "الشعبة الأولى..." etc. A custom name such
  // as "A1" must be shown as-is instead of being reduced to its digits.
  const num = /^[0-9]+$/.test(clean) ? clean : '';
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

  remove: (id: string) =>
    apiFetch<{ success: boolean; archived: boolean }>(`/staff/${id}`, {
      method: 'DELETE',
    }),
};

// ============ Lectures ============
export interface LectureCourse {
  id: string;
  code: string;
  name: string;
  stage: number;
}

export const lectureApi = {
  create: (
    name: string,
    studyPeriod?: string,
    section?: string,
    courseId?: string,
    sectionId?: string,
    sectionIds?: string[],
  ) =>
    apiFetch<any>('/lectures', {
      method: 'POST',
      body: JSON.stringify({
        name,
        studyPeriod: studyPeriod || 'MORNING',
        section,
        ...(courseId ? { courseId } : {}),
        ...(sectionId ? { sectionId } : {}),
        ...(sectionIds && sectionIds.length > 0 ? { sectionIds } : {}),
      }),
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
  courseId?: string | null;
  lectureDate: string;
  status: string;
  registeredAt: string;
}

export type AcademicStatus = 'REGULAR' | 'REPEAT' | 'CARRY_OVER';

export interface StudentEnrollment {
  studentId: string;
  studentName: string;
  studentCode: string;
  stage: number;
  studyPeriod: string;
  section?: string | null;
  sectionLabel?: string | null;
  isCustom: boolean;
  academicStatus: AcademicStatus;
  courseIds: string[];
  courses: CourseItem[];
  notes?: string | null;
  updatedAt?: string | null;
  allCourses?: CourseItem[];
}

/** Full student row returned by GET /students (Head of Department / Registrar). */
export interface StudentListItem {
  id: string;
  orderIndex: number;
  studentCode: string;
  name: string;
  stage: number;
  studyPeriod?: string;
  section?: string;
  sectionId?: string | null;
  sectionLabel?: string | null;
  presentCount: number;
  absentCount: number;
  totalLectures: number;
  academicStatus?: AcademicStatus;
  customCourseCount?: number | null;
  isCustomEnrollment?: boolean;
  enrollmentNotes?: string | null;
  createdAt: string;
  history: StudentHistoryItem[];
}

/** Minimal row returned by GET /students/options (lecturers, no QR/statistics). */
export interface StudentOption {
  id: string;
  name: string;
  studentCode: string;
  stage?: number;
  studyPeriod?: string;
  section?: string;
  sectionId?: string | null;
  sectionLabel?: string | null;
  orderIndex?: number;
}

export interface StudentFilters {
  studyPeriod?: string;
  section?: string;
  stage?: number | string;
  sectionId?: string;
}

export interface StudentWriteInput {
  studentCode?: string;
  name: string;
  stage?: number;
  studyPeriod?: string;
  section?: string;
  sectionId?: string | null;
  orderIndex?: number;
  presentCount?: number;
  absentCount?: number;
  totalSessions?: number;
  rate?: number;
}

export interface ImportRow {
  studentCode?: string;
  name: string;
  stage?: number;
  studyPeriod?: string;
  section?: string;
  sectionId?: string;
  orderIndex?: number;
}

export interface ImportRowResult {
  row: number;
  studentCode: string;
  name: string;
  stage: number;
  studyPeriod: string;
  section: string | null;
  sectionId: string | null;
  status: 'VALID' | 'ERROR';
  errors: string[];
}

export interface ImportPreviewResult {
  summary: { total: number; valid: number; invalid: number };
  rows: ImportRowResult[];
}

export interface ImportConfirmResult {
  success: boolean;
  created: number;
  rejected: number;
  skipped: number;
  updated: number;
  count: number;
  errors: string[];
}

export interface ImportRequest {
  stage?: number;
  studyPeriod?: string;
  section?: string;
  sectionId?: string;
  students: ImportRow[];
}

function studentQuery(filters: StudentFilters = {}): string {
  const params = new URLSearchParams();
  if (filters.studyPeriod) params.append('studyPeriod', filters.studyPeriod);
  if (filters.section) params.append('section', filters.section);
  if (filters.sectionId) params.append('sectionId', filters.sectionId);
  if (filters.stage !== undefined && filters.stage !== '') {
    params.append('stage', String(filters.stage));
  }
  const query = params.toString();
  return query ? `?${query}` : '';
}

export const studentApi = {
  getAll: (filters: StudentFilters = {}) =>
    apiFetch<StudentListItem[]>(`/students${studentQuery(filters)}`),

  /** Minimal list (no QR credentials) used by lecturers for manual attendance. */
  getOptions: (filters: StudentFilters & { courseId?: string } = {}) => {
    const params = new URLSearchParams();
    if (filters.studyPeriod) params.append('studyPeriod', filters.studyPeriod);
    if (filters.section) params.append('section', filters.section);
    if (filters.sectionId) params.append('sectionId', filters.sectionId);
    if (filters.courseId) params.append('courseId', filters.courseId);
    if (filters.stage !== undefined && filters.stage !== '') {
      params.append('stage', String(filters.stage));
    }
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

  create: (data: StudentWriteInput) =>
    apiFetch<any>('/students', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  createBatch: (students: StudentWriteInput[]) =>
    apiFetch<any>('/students/batch', {
      method: 'POST',
      body: JSON.stringify({ students }),
    }),

  /** Validate an import and return per-row errors without writing anything. */
  previewImport: (data: ImportRequest) =>
    apiFetch<ImportPreviewResult>('/students/import/preview', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  /** Write only the valid rows; existing/duplicate students are rejected. */
  confirmImport: (data: ImportRequest) =>
    apiFetch<ImportConfirmResult>('/students/import/confirm', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (
    id: string,
    data: {
      studentCode?: string;
      name?: string;
      stage?: number;
      studyPeriod?: string;
      section?: string;
      sectionId?: string | null;
      orderIndex?: number;
    },
  ) =>
    apiFetch<any>(`/students/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  delete: (id: string) =>
    apiFetch<any>(`/students/${id}`, { method: 'DELETE' }),

  resetAbsences: (data: {
    stage?: number;
    studyPeriod?: string;
    section?: string;
    sectionId?: string;
    studentId?: string;
    resetType?: 'ABSENCES_ONLY' | 'ALL_ATTENDANCE';
  }) =>
    apiFetch<{ success: boolean; count: number; message: string }>('/students/reset-absences', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getEnrollment: (studentId: string) =>
    apiFetch<StudentEnrollment>(`/students/${encodeURIComponent(studentId)}/enrollment`),

  updateEnrollment: (
    studentId: string,
    data: {
      academicStatus: AcademicStatus;
      courseIds: string[];
      notes?: string;
    },
  ) =>
    apiFetch<StudentEnrollment>(`/students/${encodeURIComponent(studentId)}/enrollment`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
};

// ============ Sections ============
export interface SectionItem {
  id: string;
  stage: AcademicStage;
  studyPeriod: 'MORNING' | 'EVENING';
  name: string;
  label?: string | null;
  studentCount?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface SectionInput {
  stage?: number;
  studyPeriod: string;
  name: string;
  label?: string;
}

export const sectionApi = {
  getAll: (filters: { stage?: number | string; studyPeriod?: string } = {}) => {
    const params = new URLSearchParams();
    if (filters.stage !== undefined && filters.stage !== '') {
      params.append('stage', String(filters.stage));
    }
    if (filters.studyPeriod) params.append('studyPeriod', filters.studyPeriod);
    const query = params.toString();
    return apiFetch<SectionItem[]>(`/sections${query ? `?${query}` : ''}`);
  },

  create: (data: SectionInput) =>
    apiFetch<SectionItem>('/sections', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (id: string, data: Partial<SectionInput>) =>
    apiFetch<SectionItem>(`/sections/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  delete: (id: string) =>
    apiFetch<{ success: boolean; message: string }>(`/sections/${id}`, {
      method: 'DELETE',
    }),
};

// ============ Courses ============
export interface CourseItem {
  id: string;
  code: string;
  name: string;
  stage: number;
  description?: string | null;
  type?: string | null;
  typeLabel?: string | null;
  createdAt?: string;
  updatedAt?: string;
  _count?: { lectures: number; assignments: number };
}

export interface CourseInput {
  code: string;
  name: string;
  stage: number;
  description?: string;
  type?: string;
  hall?: string;
}

export const courseApi = {
  getAll: (stage?: number | string) => {
    const q =
      stage !== undefined && stage !== '' ? `?stage=${encodeURIComponent(String(stage))}` : '';
    return apiFetch<CourseItem[]>(`/courses${q}`);
  },

  create: (data: CourseInput) =>
    apiFetch<CourseItem>('/courses', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (id: string, data: Partial<CourseInput>) =>
    apiFetch<CourseItem>(`/courses/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  delete: (id: string) =>
    apiFetch<{ success: boolean }>(`/courses/${id}`, { method: 'DELETE' }),
};

// ============ Teaching assignments ============
export interface AssignmentItem {
  id: string;
  staffUserId: string;
  courseId: string;
  createdAt: string;
  staffUser: {
    id: string;
    staffId: string;
    fullName: string;
    role: StaffRole;
    isActive: boolean;
  };
  course: { id: string; code: string; name: string; stage: number };
}

export const assignmentApi = {
  getAll: (filters: { staffUserId?: string; courseId?: string } = {}) => {
    const params = new URLSearchParams();
    if (filters.staffUserId) params.append('staffUserId', filters.staffUserId);
    if (filters.courseId) params.append('courseId', filters.courseId);
    const q = params.toString();
    return apiFetch<AssignmentItem[]>(`/assignments${q ? `?${q}` : ''}`);
  },

  create: (data: { staffUserId: string; courseId: string }) =>
    apiFetch<AssignmentItem>('/assignments', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  delete: (id: string) =>
    apiFetch<{ success: boolean }>(`/assignments/${id}`, { method: 'DELETE' }),
};

// ============ Weekly timetable ============
export const TIMETABLE_DAYS = [
  { value: 0, label: 'الأحد' },
  { value: 1, label: 'الإثنين' },
  { value: 2, label: 'الثلاثاء' },
  { value: 3, label: 'الأربعاء' },
  { value: 4, label: 'الخميس' },
  { value: 5, label: 'الجمعة' },
  { value: 6, label: 'السبت' },
] as const;

export interface TimetableItem {
  id: string;
  courseId: string;
  sectionId: string;
  dayOfWeek: number;
  dayLabel?: string;
  startTime: string;
  endTime: string;
  type?: string | null;
  typeLabel?: string | null;
  hall?: string | null;
  createdAt?: string;
  updatedAt?: string;
  course: { id: string; code: string; name: string; stage: number };
  section: { id: string; name: string; stage: number; studyPeriod?: string; label?: string | null };
}

export interface TimetableInput {
  courseId: string;
  sectionId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  type?: string;
  hall?: string;
}

export const timetableApi = {
  getAll: (filters: {
    courseId?: string;
    sectionId?: string;
    dayOfWeek?: number | string;
    stage?: number | string;
    studyPeriod?: string;
  } = {}) => {
    const params = new URLSearchParams();
    if (filters.courseId) params.append('courseId', filters.courseId);
    if (filters.sectionId) params.append('sectionId', filters.sectionId);
    if (filters.dayOfWeek !== undefined && filters.dayOfWeek !== '') {
      params.append('dayOfWeek', String(filters.dayOfWeek));
    }
    if (filters.stage !== undefined && filters.stage !== '') {
      params.append('stage', String(filters.stage));
    }
    if (filters.studyPeriod) params.append('studyPeriod', filters.studyPeriod);
    const q = params.toString();
    return apiFetch<TimetableItem[]>(`/timetable${q ? `?${q}` : ''}`);
  },

  create: (data: TimetableInput) =>
    apiFetch<TimetableItem>('/timetable', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (id: string, data: Partial<TimetableInput>) =>
    apiFetch<TimetableItem>(`/timetable/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  delete: (id: string) =>
    apiFetch<{ success: boolean }>(`/timetable/${id}`, { method: 'DELETE' }),
};

// ============ Read-only student follow-up ============
export interface FollowupCourse {
  id: string;
  code: string;
  name: string;
  stage: number;
}

export interface FollowupSectionScope {
  id: string;
  name: string;
  stage: number;
  studyPeriod: string;
}

export interface FollowupScope {
  courseIds: string[];
  stages: number[];
  section: FollowupSectionScope | null;
}

export interface FollowupOverview {
  courses: FollowupCourse[];
  scope?: FollowupScope;
  totals: {
    students: number;
    lectures: number;
    closedLectures: number;
    activeLectures: number;
    present: number;
    absent: number;
    attendanceCases: number;
    attendanceRate: number;
    absenceRate: number;
  };
}

export interface FollowupStudentRow {
  id: string;
  studentCode: string;
  name: string;
  stage: number;
  studyPeriod: string;
  section: string | null;
  sectionId: string | null;
  sectionLabel: string | null;
  presentCount: number;
  absentCount: number;
  totalLectures: number;
  attendanceRate: number;
  absenceRate: number;
}

export interface FollowupStudentsPage {
  courses: FollowupCourse[];
  scope?: FollowupScope;
  items: FollowupStudentRow[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export interface FollowupStudentDetail {
  student: {
    id: string;
    studentCode: string;
    name: string;
    stage: number;
    studyPeriod: string;
    section: string | null;
    sectionId: string | null;
    sectionLabel: string | null;
  };
  stats: {
    present: number;
    absent: number;
    totalLectures: number;
    attendanceRate: number;
    absenceRate: number;
    excludedActiveLectures: number;
  };
  lectures: Array<{
    attendanceId: string;
    lectureId: string;
    lectureName: string;
    lectureDate: string;
    closedAt: string | null;
    courseId: string | null;
    courseCode: string | null;
    courseName: string | null;
    status: string;
    note: string | null;
  }>;
}

export interface FollowupFilters {
  courseId?: string;
  sectionId?: string;
  stage?: number | string;
  search?: string;
  sort?: string;
  page?: number;
  pageSize?: number;
}

function followupQuery(filters: FollowupFilters = {}): string {
  const params = new URLSearchParams();
  if (filters.courseId) params.append('courseId', filters.courseId);
  if (filters.sectionId) params.append('sectionId', filters.sectionId);
  if (filters.stage !== undefined && filters.stage !== '') {
    params.append('stage', String(filters.stage));
  }
  if (filters.search) params.append('search', filters.search);
  if (filters.sort) params.append('sort', filters.sort);
  if (filters.page) params.append('page', String(filters.page));
  if (filters.pageSize) params.append('pageSize', String(filters.pageSize));
  const q = params.toString();
  return q ? `?${q}` : '';
}

export const followupApi = {
  overview: (filters: FollowupFilters = {}) =>
    apiFetch<FollowupOverview>(`/followup/overview${followupQuery(filters)}`),

  students: (filters: FollowupFilters = {}) =>
    apiFetch<FollowupStudentsPage>(`/followup/students${followupQuery(filters)}`),

  studentDetail: (
    studentId: string,
    filters: { courseId?: string; sectionId?: string; stage?: number | string } = {},
  ) =>
    apiFetch<FollowupStudentDetail>(
      `/followup/students/${encodeURIComponent(studentId)}${followupQuery(filters)}`,
    ),
};


// ============ Phase 4: Advanced reports & statistics ============
export interface ReportOptions {
  stages: Array<{ value: number; label: string }>;
  sections: Array<{ id: string; name: string; stage: number; studyPeriod: string; label?: string | null }>;
  courses: Array<{ id: string; code: string; name: string; stage: number }>;
  lecturers: Array<{ id: string; fullName: string; staffId: string; role: string }>;
}

export interface ReportFilters {
  from?: string;
  to?: string;
  stage?: string;
  sectionId?: string;
  courseId?: string;
  lecturerId?: string;
  status?: string;
  search?: string;
  sort?: string;
  page?: number | string;
  pageSize?: number | string;
  threshold?: number | string;
}

export interface SummaryCounts {
  present: number;
  absent: number;
  totalCases: number;
  attendanceRate: number | null;
  absenceRate: number | null;
}

export interface DashboardTotals extends SummaryCounts {
  students: number;
  teachers: number;
  sections: number;
  courses: number;
  lectures: number;
  closedLectures: number;
  openLectures: number;
  attendanceRecords: number;
  activePresent: number;
}

export interface DashboardCourseComparison extends SummaryCounts {
  course: { id: string; code: string; name: string; stage: number } | null;
  lectures: number;
}

export interface DashboardSectionComparison extends SummaryCounts {
  section: { id: string; name: string; stage: number; studyPeriod: string };
  lectures: number;
}

export interface StageComparisonItem extends SummaryCounts {
  stage: number;
  label: string;
  students: number;
  sections: number;
  courses: number;
  closedLectures: number;
}

export interface TrendPoint {
  key: string;
  present: number;
  absent: number;
  lectures: number;
}

export interface ReportsDashboard {
  scope: {
    isAdmin: boolean;
    stages: number[];
    courseIds: string[];
    appliedFilters: ReportFilters & { stage?: string | null };
  };
  totals: DashboardTotals;
  trendDaily: TrendPoint[];
  trendWeekly: TrendPoint[];
  trendMonthly: TrendPoint[];
  courseComparison: DashboardCourseComparison[];
  sectionComparison: DashboardSectionComparison[];
  stages: StageComparisonItem[];
}

export interface ReportStudentItem extends SummaryCounts {
  id: string;
  studentCode: string;
  name: string;
  stage: number;
  stageLabel: string;
  studyPeriod: string;
  section: string | null;
  sectionId: string | null;
  sectionLabel: string | null;
  orderIndex?: number | null;
}

export interface ReportStudentsPage {
  items: ReportStudentItem[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
  totals: SummaryCounts & { students: number };
  lecturesInScope: number;
}

export interface ReportStudentLecture {
  lectureId: string;
  lectureName: string;
  lectureDate: string;
  closedAt: string | null;
  courseId: string | null;
  courseCode: string | null;
  courseName: string | null;
  stage: number | null;
  sections: string[];
  conductedBy: string | null;
  createdBy: string | null;
  studyPeriod: string;
  status: 'PRESENT' | 'ABSENT' | null;
  note: string | null;
  registeredAt: string | null;
}

export interface ReportStudentDetail {
  student: {
    id: string;
    studentCode: string;
    name: string;
    stage: number;
    stageLabel: string;
    studyPeriod: string;
    section: string | null;
    sectionLabel: string | null;
  };
  stats: SummaryCounts;
  lectures: ReportStudentLecture[];
  totalLectures: number;
}

export interface ReportCourseItem extends SummaryCounts {
  id: string;
  code: string;
  name: string;
  stage: number;
  closedLectures: number;
}

export interface ReportCoursesResponse {
  items: ReportCourseItem[];
  totals: SummaryCounts & { courses: number; closedLectures: number };
}

export interface ReportCourseStudent extends SummaryCounts {
  id: string;
  studentCode: string;
  name: string;
  stage: number;
  studyPeriod: string;
  section: string | null;
  sectionLabel: string | null;
}

export interface ReportCourseStudentsResponse {
  course: { id: string; code: string; name: string; stage: number; stageLabel: string };
  lecturesInScope: number;
  items: ReportCourseStudent[];
  totals: SummaryCounts & { students: number };
}

export interface ReportLecturerItem extends SummaryCounts {
  id: string;
  fullName: string;
  staffId: string;
  role: string;
  assignments: Array<{ id: string; code: string; name: string; stage: number }>;
  conductedLectures: number;
}

export interface ReportLecturersResponse {
  items: ReportLecturerItem[];
  totals: SummaryCounts & { lecturers: number; conductedLectures: number };
}

export interface ReportLecturerDetail {
  lecturer: { id: string; fullName: string; staffId: string; role: string; isActive: boolean };
  assignments: Array<{ id: string; code: string; name: string; stage: number }>;
  lectures: Array<{
    id: string;
    name: string;
    lectureDate: string;
    courseCode: string | null;
    courseName: string | null;
    stage: number | null;
    sections: string[];
    studyPeriod: string;
  } & SummaryCounts>;
  totals: SummaryCounts & { conductedLectures: number; studentsPresent: number; studentsAbsent: number };
}

export interface ReportSectionItem extends SummaryCounts {
  id: string;
  name: string;
  label: string | null;
  stage: number;
  stageLabel: string;
  studyPeriod: string;
  students: number;
  closedLectures: number;
}

export interface ReportSectionsResponse {
  items: ReportSectionItem[];
  totals: SummaryCounts & { sections: number; students: number; closedLectures: number };
}

export interface ReportStagesResponse {
  items: StageComparisonItem[];
}

export interface ReportAbsenteeItem extends SummaryCounts {
  id: string;
  studentCode: string;
  name: string;
  stage: number;
  stageLabel: string;
  studyPeriod: string;
  section: string | null;
  sectionLabel: string | null;
  absentCount: number;
  presentCount: number;
  status: 'EXCEEDED' | 'WARNING' | null;
}

export interface ReportAbsenteesResponse {
  threshold: number;
  thresholdSource: 'param' | 'setting' | 'default';
  exceeded: number;
  warning: number;
  items: ReportAbsenteeItem[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
}

export type ReportQuery = Record<string, string | number | undefined>;

const reportQuery = (filters: ReportFilters = {}): string => {
  const params = reportQueryParams(filters);
  const q = params.toString();
  return q ? `?${q}` : '';
};

const reportQueryParams = (filters: ReportFilters = {}) => {
  const params = new URLSearchParams();
  const set = (key: string, value: unknown) => {
    if (value === undefined || value === null) return;
    const v = String(value).trim();
    if (v !== '') params.append(key, v);
  };
  set('from', filters.from);
  set('to', filters.to);
  set('stage', filters.stage);
  set('sectionId', filters.sectionId);
  set('courseId', filters.courseId);
  set('lecturerId', filters.lecturerId);
  set('status', filters.status);
  set('search', filters.search);
  set('sort', filters.sort);
  set('page', filters.page);
  set('pageSize', filters.pageSize);
  set('threshold', filters.threshold);
  return params;
};

export const reportsApi = {
  options: () => apiFetch<ReportOptions>('/reports/options'),
  dashboard: (filters: ReportFilters = {}) =>
    apiFetch<ReportsDashboard>(`/reports/dashboard${reportQuery(filters)}`),
  students: (filters: ReportFilters = {}) =>
    apiFetch<ReportStudentsPage>(`/reports/students${reportQuery(filters)}`),
  studentDetail: (studentId: string, filters: ReportFilters = {}) =>
    apiFetch<ReportStudentDetail>(
      `/reports/students/${encodeURIComponent(studentId)}${reportQuery(filters)}`,
    ),
  courses: (filters: ReportFilters = {}) =>
    apiFetch<ReportCoursesResponse>(`/reports/courses${reportQuery(filters)}`),
  courseStudents: (courseId: string, filters: ReportFilters = {}) =>
    apiFetch<ReportCourseStudentsResponse>(
      `/reports/courses/${encodeURIComponent(courseId)}/students${reportQuery(filters)}`,
    ),
  lecturers: (filters: ReportFilters = {}) =>
    apiFetch<ReportLecturersResponse>(`/reports/lecturers${reportQuery(filters)}`),
  lecturerDetail: (lecturerId: string, filters: ReportFilters = {}) =>
    apiFetch<ReportLecturerDetail>(
      `/reports/lecturers/${encodeURIComponent(lecturerId)}${reportQuery(filters)}`,
    ),
  sections: (filters: ReportFilters = {}) =>
    apiFetch<ReportSectionsResponse>(`/reports/sections${reportQuery(filters)}`),
  stages: (filters: ReportFilters = {}) =>
    apiFetch<ReportStagesResponse>(`/reports/stages${reportQuery(filters)}`),
  absentees: (filters: ReportFilters = {}) =>
    apiFetch<ReportAbsenteesResponse>(`/reports/absentees${reportQuery(filters)}`),
};
