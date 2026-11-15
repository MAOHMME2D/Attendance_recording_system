import type { AuthenticatedUser } from '../../common/types/authenticated-user';

export interface ReportScope {
  /** true for HEAD_OF_DEPARTMENT / REGISTRAR / SYSTEM_OWNER. */
  isAdmin: boolean;
  /** Courses visible to the caller (all ids for admin, assigned otherwise). */
  courseIds: string[];
  /** Stages visible to the caller (all four for admin, assigned-otherwise). */
  stages: number[];
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
  page?: string;
  pageSize?: string;
  threshold?: string;
}

export interface LectureScopeRow {
  id: string;
  name: string;
  status: string;
  studyPeriod: string;
  startedAt: Date;
  closedAt: Date | null;
  course: { id: string; code: string; name: string; stage: number } | null;
  sections: Array<{ id: string; name: string; stage: number; studyPeriod: string }>;
  conductedBy: { id: string; fullName: string; staffId: string } | null;
  createdBy: { id: string; fullName: string; staffId: string } | null;
}

export type ReportUser = Pick<AuthenticatedUser, 'id' | 'role'>;
