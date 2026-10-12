import axios, { AxiosError } from 'axios';
import { resolveApiBaseUrl } from './apiBase';
import type {
  ApiErrorCode,
  ApiFailure,
  AccountRole,
  ApiSuccess,
  AuthUser,
  NotificationListResponse,
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
} from '@shared/types';

// One origin pair: the app at http://localhost:<CLIENT_PORT>, the API at http://localhost:<SERVER_PORT>.
// `__API_PORT__` is the root .env SERVER_PORT, injected by vite.config.ts; tests have no such define.
const baseURL = resolveApiBaseUrl({
  configured: import.meta.env.VITE_API_URL,
  port: typeof __API_PORT__ === 'undefined' ? '3000' : __API_PORT__,
});

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

/**
 * An API failure reduced to what the UI needs. `code` is the shared ApiErrorCode; it is null when there was no
 * usable error body (no response at all, or a response that is not the shared envelope).
 */
export class ApiError extends Error {
  readonly status: number;
  readonly code: ApiErrorCode | null;

  constructor(status: number, message: string, code: ApiErrorCode | null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

/**
 * No response at all: the API is down, the address is wrong, or the browser blocked the call (CORS looks the
 * same as an outage to the page). In development the message says where the request went and the usual causes.
 */
export function networkErrorMessage(): string {
  const base = 'Cannot reach the server. Check your connection and try again.';
  if (!import.meta.env.DEV) return base;
  return `${base} (Development: requests go to ${baseURL}. Is the API running, and is this page open at http://localhost, not 127.0.0.1?)`;
}

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

/** True for a body that is exactly the shared success envelope. */
function isSuccess<T>(body: unknown): body is ApiSuccess<T> {
  return isObject(body) && body.ok === true && 'data' in body;
}

/** The failure envelope's `error`, or null when the body is anything else. */
function failureOf(body: unknown): ApiFailure['error'] | null {
  if (!isObject(body) || body.ok !== false || !isObject(body.error)) return null;
  const { code, message } = body.error;
  return typeof code === 'string' && typeof message === 'string' ? { code: code as ApiErrorCode, message } : null;
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
  if (error instanceof ApiError) return error;
  if (error instanceof AxiosError) {
    if (error.response) {
      const { status, data } = error.response;
      const failure = failureOf(data);
      if (failure) return new ApiError(status, failure.message, failure.code);
      return new ApiError(status, defaultMessage(status), null);
    }
    return new ApiError(0, networkErrorMessage(), null);
  }
  return new ApiError(0, error instanceof Error ? error.message : 'Something went wrong.', null);
}

/**
 * The single place a response is read. Success is `ApiSuccess<T>` and returns `data`; failure is `ApiFailure`
 * and throws an ApiError; anything else (a proxy error page, a wrong server) is a failure too.
 */
async function request<T>(send: () => Promise<{ status: number; data: unknown }>): Promise<T> {
  let status: number;
  let body: unknown;
  try {
    ({ status, data: body } = await send());
  } catch (error) {
    throw toApiError(error);
  }
  if (isSuccess<T>(body)) return body.data;
  const failure = failureOf(body);
  if (failure) throw new ApiError(status, failure.message, failure.code);
  throw new ApiError(status, 'The server sent a response this app does not understand.', null);
}

const get = <T>(path: string, params?: Record<string, string | number>) => request<T>(() => http.get(path, { params }));
const post = <T>(path: string, body?: unknown) => request<T>(() => http.post(path, body));
const patch = <T>(path: string, body?: unknown) => request<T>(() => http.patch(path, body));
const del = <T = null>(path: string) => request<T>(() => http.delete(path));

const inboxBase = (role: AccountRole): string => (role === 'staff' ? '/notifications' : '/me/notifications');

export interface StaffCaseQuery {
  status?: string;
  class?: string;
  q?: string;
  sort?: 'newest' | 'oldest';
  page?: number;
}

export const api = {
  login: (email: string, password: string) => post<{ user: AuthUser }>('/auth/login', { email, password }),
  logout: () => post<null>('/auth/logout'),
  me: () => get<{ user: AuthUser }>('/auth/me'),
  changePassword: (currentPassword: string, newPassword: string) =>
    post<{ user: AuthUser }>('/auth/change-password', { currentPassword, newPassword }),

  handbook: () => get<{ entries: HandbookEntryView[] }>('/handbook'),

  myCases: () => get<{ cases: StudentCaseView[] }>('/me/cases'),
  myCase: (id: number) => get<{ case: StudentCaseDetailView }>(`/me/cases/${id}`),
  mySanctions: () => get<{ sanctions: StudentSanctionView[] }>('/me/sanctions'),
  myAppointments: () => get<{ appointments: StudentAppointmentView[] }>('/me/appointments'),
  // Notifications (SPEC 7): students read `/me/notifications`; staff share one inbox at `/notifications`.
  notifications: (role: AccountRole, query: { limit?: number; unread?: boolean } = {}) => {
    const params: Record<string, string | number> = {};
    if (query.limit !== undefined) params.limit = query.limit;
    if (query.unread !== undefined) params.unread = String(query.unread);
    return get<NotificationListResponse>(inboxBase(role), params);
  },
  markNotificationRead: (role: AccountRole, id: number) =>
    post<{ unreadCount: number }>(`${inboxBase(role)}/${id}/read`),
  markAllNotificationsRead: (role: AccountRole) => post<{ unreadCount: number }>(`${inboxBase(role)}/read-all`),

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
