import axios, { AxiosError } from 'axios';
import type {
  AuthUser,
  EscalationConversion,
  HandbookEntryView,
  SanctionAssignmentOptions,
  StaffCaseDetail,
  StaffCaseListResponse,
  StudentAppointmentView,
  StudentCaseDetailView,
  StudentCaseView,
  StudentClearanceResponse,
  StudentSanctionView,
} from '../../../shared/types';

const baseURL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

/** Session cookie auth: every request carries credentials. */
export const http = axios.create({ baseURL, withCredentials: true });

// Sign-in itself and the startup session probe answer 401 as part of normal use; everything else that
// answers 401 means the session ended mid-use (expired or account deactivated).
const AUTH_PATHS = ['/auth/login', '/auth/me'];
let onSessionEnded: (() => void) | null = null;

/** Registers the one callback that runs when a signed-in session is rejected by the API. */
export function setSessionEndedHandler(handler: (() => void) | null): void {
  onSessionEnded = handler;
}

http.interceptors.response.use(undefined, (error: unknown) => {
  if (error instanceof AxiosError && error.response?.status === 401) {
    const path = error.config?.url ?? '';
    if (!AUTH_PATHS.includes(path)) onSessionEnded?.();
  }
  return Promise.reject(error);
});

/** An API error reduced to what the UI needs. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string | null;

  constructor(status: number, message: string, code: string | null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

/** Plain-language fallback when the API sends a status without a message. */
export function defaultMessage(status: number): string {
  if (status === 401) return 'Your session has ended. Please sign in again.';
  if (status === 403) return 'You do not have access to this page.';
  if (status === 404) return 'We could not find what you were looking for.';
  if (status === 429) return 'Too many requests. Please wait a moment and try again.';
  return 'Something went wrong.';
}

export function toApiError(error: unknown): ApiError {
  if (error instanceof AxiosError) {
    const body = error.response?.data as { error?: string; message?: string } | undefined;
    if (error.response) {
      const { status } = error.response;
      return new ApiError(status, body?.message ?? defaultMessage(status), body?.error ?? null);
    }
    return new ApiError(0, 'Cannot reach the server. Check your connection and try again.', null);
  }
  return new ApiError(0, error instanceof Error ? error.message : 'Something went wrong.', null);
}

async function get<T>(path: string, params?: Record<string, string | number>): Promise<T> {
  try {
    return (await http.get<T>(path, { params })).data;
  } catch (error) {
    throw toApiError(error);
  }
}

async function post<T>(path: string, body?: unknown): Promise<T> {
  try {
    return (await http.post<T>(path, body)).data;
  } catch (error) {
    throw toApiError(error);
  }
}

async function del(path: string): Promise<void> {
  try {
    await http.delete(path);
  } catch (error) {
    throw toApiError(error);
  }
}

async function patch<T>(path: string, body?: unknown): Promise<T> {
  try {
    return (await http.patch<T>(path, body)).data;
  } catch (error) {
    throw toApiError(error);
  }
}

export interface StaffCaseQuery {
  status?: string;
  class?: string;
  q?: string;
  sort?: 'newest' | 'oldest';
  page?: number;
}

export const api = {
  login: (email: string, password: string) => post<{ user: AuthUser }>('/auth/login', { email, password }),
  logout: () => post<void>('/auth/logout'),
  me: () => get<{ user: AuthUser }>('/auth/me'),
  changePassword: (currentPassword: string, newPassword: string) =>
    post<{ user: AuthUser }>('/auth/change-password', { currentPassword, newPassword }),

  handbook: () => get<{ entries: HandbookEntryView[] }>('/handbook'),

  myCases: () => get<{ cases: StudentCaseView[] }>('/me/cases'),
  myCase: (id: number) => get<{ case: StudentCaseDetailView }>(`/me/cases/${id}`),
  mySanctions: () => get<{ sanctions: StudentSanctionView[] }>('/me/sanctions'),
  myAppointments: () => get<{ appointments: StudentAppointmentView[] }>('/me/appointments'),
  // Staff case workflow (SPEC 7)
  staffCases: (query: StaffCaseQuery) => {
    const params: Record<string, string | number> = {};
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== '') params[key] = value;
    }
    return get<StaffCaseListResponse>('/cases', params);
  },
  staffCase: (id: number) => get<{ case: StaffCaseDetail }>(`/cases/${id}`),
  recordViolation: (studentId: string, handbookEntryId: number) =>
    post<{ caseId: number; conversions: EscalationConversion[] }>('/cases', { studentId, handbookEntryId }),
  escalationPreview: (submissionRef: string) =>
    get<{ conversions: EscalationConversion[] }>(`/submissions/${submissionRef}/escalation-preview`),
  validateSubmission: (submissionRef: string) =>
    post<{ caseIds: number[]; conversions: EscalationConversion[] }>(`/submissions/${submissionRef}/validate`),
  rejectSubmission: (submissionRef: string, reason: string) =>
    post<{ caseIds: number[] }>(`/submissions/${submissionRef}/reject`, { reason }),
  linkStudent: (caseId: number, studentId: string) => patch<{ caseIds: number[] }>(`/cases/${caseId}/student`, { studentId }),
  resolveCase: (caseId: number) => post<{ ok: true }>(`/cases/${caseId}/resolve`),
  resolveWithoutSanction: (caseId: number, reason: string) =>
    post<{ ok: true }>(`/cases/${caseId}/resolve-without-sanction`, { reason }),
  addRemark: (caseId: number, remarks: string) => post<{ ok: true }>(`/cases/${caseId}/remarks`, { remarks }),

  // Sanctions and proof files (SPEC 4.3, 6.1)
  sanctionOptions: (caseId: number) => get<{ options: SanctionAssignmentOptions }>(`/cases/${caseId}/sanction-options`),
  assignSanction: (caseId: number, sanctionId: number, dueDate: string, staffNote: string) =>
    post<{ caseSanctionId: number }>(`/cases/${caseId}/sanctions`, { sanctionId, dueDate, staffNote }),
  recordCompliance: (caseSanctionId: number, note: string) =>
    post<{ ok: true }>(`/case-sanctions/${caseSanctionId}/record-compliance`, { note }),
  verifySanction: (caseSanctionId: number) => post<{ ok: true }>(`/case-sanctions/${caseSanctionId}/verify`),
  returnSanction: (caseSanctionId: number, reason: string) =>
    post<{ ok: true }>(`/case-sanctions/${caseSanctionId}/return`, { reason }),
  uploadProof: (caseSanctionId: number, files: File[], replaceFileId?: number) => {
    const form = new FormData();
    form.append('caseSanctionId', String(caseSanctionId));
    if (replaceFileId !== undefined) form.append('replaceFileId', String(replaceFileId));
    for (const file of files) form.append('files', file);
    return post<{ fileIds: number[] }>('/files', form);
  },
  deleteProofFile: (fileId: number) => del(`/files/${fileId}`),
  fileUrl: (fileId: number) => get<{ url: string; expiresInSeconds: number }>(`/files/${fileId}/url`),

  myClearance: (term?: { academicYear: number; semester: number }) =>
    get<StudentClearanceResponse>(
      '/me/clearance',
      term ? { academic_year: term.academicYear, semester: term.semester } : undefined,
    ),
};
