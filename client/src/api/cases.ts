import type { EscalationConversion, StaffCaseDetail, StaffCaseListResponse, StaffSanctionQueueResponse } from '@shared/types';
import { get, post, patch } from './client';

export interface StaffCaseQuery {
  status?: string;
  class?: string;
  q?: string;
  sort?: 'newest' | 'oldest';
  /** `status`: stage first, as "All cases" in the deck. */
  group?: 'status';
  page?: number;
  /** Answer the page holding this case id (deep links). */
  focus?: number;
}

export const casesApi = {
  // Staff case workflow (SPEC 7)
  staffCases: (query: StaffCaseQuery) => {
    const params: Record<string, string | number> = {};
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== '') params[key] = value;
    }
    return get<StaffCaseListResponse>('/cases', params);
  },
  staffCase: (id: number) => get<{ case: StaffCaseDetail }>(`/cases/${id}`),
  sanctionQueue: (query: { filter?: 'active' | 'pending_verification' | 'overdue'; page?: number } = {}) => {
    const params: Record<string, string | number> = {};
    if (query.filter) params.filter = query.filter;
    if (query.page) params.page = query.page;
    return get<StaffSanctionQueueResponse>('/case-sanctions', params);
  },
  recordViolation: (studentId: string, handbookEntryId: number, remarks?: string) =>
    post<{ caseId: number; conversions: EscalationConversion[] }>('/cases', {
      studentId,
      handbookEntryId,
      ...(remarks ? { remarks } : {}),
    }),
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
};
