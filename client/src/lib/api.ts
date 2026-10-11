import axios, { AxiosError } from 'axios';
import type {
  AuthUser,
  HandbookEntryView,
  StudentAppointmentView,
  StudentCaseDetailView,
  StudentCaseView,
  StudentClearanceResponse,
  StudentSanctionView,
} from '../../../shared/types';

const baseURL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

/** Session cookie auth: every request carries credentials. */
export const http = axios.create({ baseURL, withCredentials: true });

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

export function toApiError(error: unknown): ApiError {
  if (error instanceof AxiosError) {
    const body = error.response?.data as { error?: string; message?: string } | undefined;
    if (error.response) {
      return new ApiError(error.response.status, body?.message ?? 'Something went wrong.', body?.error ?? null);
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
  myClearance: (term?: { academicYear: number; semester: number }) =>
    get<StudentClearanceResponse>(
      '/me/clearance',
      term ? { academic_year: term.academicYear, semester: term.semester } : undefined,
    ),
};
