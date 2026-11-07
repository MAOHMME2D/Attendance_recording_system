/**
 * Phase 1 role and permission model.
 *
 * Authorization is deny-by-default:
 *  - every HTTP route requires a valid staff session unless it is explicitly @Public()
 *  - every permission is granted explicitly to a role below
 *
 * Permissions are intentionally fine-grained so that TECHNICAL_LECTURER can only
 * conduct a lecture and scan QR cards, without administrative/report access.
 */

export const STAFF_ROLES = [
  'HEAD_OF_DEPARTMENT',
  'REGISTRAR',
  'LECTURER',
  'TECHNICAL_LECTURER',
  // Internal test/owner account. It is created only by the first-run setup
  // command and cannot be created, edited, disabled, or reset through the API.
  'SYSTEM_OWNER',
] as const;

export type StaffRole = (typeof STAFF_ROLES)[number];

/** Roles that may be created through the staff-management API. */
export const CREATABLE_STAFF_ROLES = [
  'HEAD_OF_DEPARTMENT',
  'REGISTRAR',
  'LECTURER',
  'TECHNICAL_LECTURER',
] as const;

export type CreatableStaffRole = (typeof CREATABLE_STAFF_ROLES)[number];

/**
 * A Registrar may only create/manage these roles. Head-of-department and other
 * Registrar accounts are deliberately excluded to prevent privilege escalation.
 */
export const REGISTRAR_MANAGED_ROLES: readonly StaffRole[] = [
  'LECTURER',
  'TECHNICAL_LECTURER',
];

export const SYSTEM_OWNER_ROLE: StaffRole = 'SYSTEM_OWNER';

export function isSystemOwnerRole(role: string): boolean {
  return role === SYSTEM_OWNER_ROLE;
}

export const PERMISSIONS = {
  LECTURE_CREATE: 'LECTURE_CREATE',
  LECTURE_CONDUCT: 'LECTURE_CONDUCT',
  LECTURE_VIEW_ALL: 'LECTURE_VIEW_ALL',
  LECTURE_DELETE: 'LECTURE_DELETE',
  REPORTS_VIEW: 'REPORTS_VIEW',
  ATTENDANCE_MANUAL: 'ATTENDANCE_MANUAL',
  STUDENTS_VIEW: 'STUDENTS_VIEW',
  STUDENT_OPTIONS: 'STUDENT_OPTIONS',
  STUDENTS_MANAGE: 'STUDENTS_MANAGE',
  SECTIONS_VIEW: 'SECTIONS_VIEW',
  SECTIONS_MANAGE: 'SECTIONS_MANAGE',
  COURSES_VIEW: 'COURSES_VIEW',
  COURSES_MANAGE: 'COURSES_MANAGE',
  ASSIGNMENTS_VIEW: 'ASSIGNMENTS_VIEW',
  ASSIGNMENTS_MANAGE: 'ASSIGNMENTS_MANAGE',
  STUDENT_FOLLOWUP_VIEW: 'STUDENT_FOLLOWUP_VIEW',
  QR_ISSUE: 'QR_ISSUE',
  ABSENCES_RESET: 'ABSENCES_RESET',
  AUDIT_VIEW: 'AUDIT_VIEW',
  MANAGE_STAFF: 'MANAGE_STAFF',
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

const ALL_PERMISSIONS = Object.values(PERMISSIONS);

/**
 * Role -> permission matrix.
 * HEAD_OF_DEPARTMENT keeps every permission (including staff management and
 * audit access). SYSTEM_OWNER is the isolated first-run test account and is
 * intentionally not manageable through the staff API.
 */
export const ROLE_PERMISSIONS: Record<StaffRole, readonly Permission[]> = {
  HEAD_OF_DEPARTMENT: ALL_PERMISSIONS,
  REGISTRAR: [
    PERMISSIONS.LECTURE_CREATE,
    PERMISSIONS.LECTURE_CONDUCT,
    PERMISSIONS.LECTURE_VIEW_ALL,
    PERMISSIONS.LECTURE_DELETE,
    PERMISSIONS.REPORTS_VIEW,
    PERMISSIONS.ATTENDANCE_MANUAL,
    PERMISSIONS.STUDENTS_VIEW,
    PERMISSIONS.STUDENT_OPTIONS,
    PERMISSIONS.STUDENTS_MANAGE,
    PERMISSIONS.SECTIONS_VIEW,
    PERMISSIONS.SECTIONS_MANAGE,
    PERMISSIONS.COURSES_VIEW,
    PERMISSIONS.COURSES_MANAGE,
    PERMISSIONS.ASSIGNMENTS_VIEW,
    PERMISSIONS.ASSIGNMENTS_MANAGE,
    PERMISSIONS.QR_ISSUE,
    PERMISSIONS.ABSENCES_RESET,
    // Registrar may manage lecturers/technical lecturers only; the role
    // restrictions are enforced server-side in StaffService.
    PERMISSIONS.MANAGE_STAFF,
  ],
  LECTURER: [
    PERMISSIONS.LECTURE_CREATE,
    PERMISSIONS.LECTURE_CONDUCT,
    PERMISSIONS.REPORTS_VIEW,
    PERMISSIONS.ATTENDANCE_MANUAL,
    PERMISSIONS.STUDENT_OPTIONS,
    PERMISSIONS.SECTIONS_VIEW,
    // Scoped to assigned courses in the service layer.
    PERMISSIONS.COURSES_VIEW,
    PERMISSIONS.STUDENT_FOLLOWUP_VIEW,
  ],
  // Technical lecturers conduct authorised lectures and scan cards only.
  TECHNICAL_LECTURER: [
    PERMISSIONS.LECTURE_CREATE,
    PERMISSIONS.LECTURE_CONDUCT,
    PERMISSIONS.SECTIONS_VIEW,
    PERMISSIONS.COURSES_VIEW,
    PERMISSIONS.STUDENT_FOLLOWUP_VIEW,
  ],
  // Isolated first-run test account. Never created through the staff API.
  SYSTEM_OWNER: ALL_PERMISSIONS,
};

export function isStaffRole(value: unknown): value is StaffRole {
  return typeof value === 'string' && (STAFF_ROLES as readonly string[]).includes(value);
}

export function permissionsForRole(role: string): Permission[] {
  if (!isStaffRole(role)) return [];
  return [...ROLE_PERMISSIONS[role]];
}

export function roleHasPermission(role: string, permission: Permission): boolean {
  if (!isStaffRole(role)) return false;
  return ROLE_PERMISSIONS[role].includes(permission);
}

export function isAdministrativeRole(role: string): boolean {
  return (
    role === 'HEAD_OF_DEPARTMENT' ||
    role === 'REGISTRAR' ||
    role === 'SYSTEM_OWNER'
  );
}

/** Arabic labels used by the UI and audit trail. */
export const ROLE_LABELS: Record<StaffRole, string> = {
  HEAD_OF_DEPARTMENT: 'رئيس القسم',
  REGISTRAR: 'المسجل',
  LECTURER: 'محاضر',
  TECHNICAL_LECTURER: 'محاضر تقني',
  SYSTEM_OWNER: 'مالك النظام (تجريبي)',
};
