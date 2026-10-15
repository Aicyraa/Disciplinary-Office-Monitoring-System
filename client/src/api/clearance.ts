import type { ClearanceRosterResponse, ClearanceTermsResponse, StaffClearanceView } from '@shared/types';
import { get, post, del } from './client';

export const clearanceApi = {
  // Staff clearance (SPEC 4.4, 7)
  /** UI-POLISH-SPEC D3: the current term and the terms that have clearances. */
  clearanceTerms: () => get<ClearanceTermsResponse>('/clearances/terms'),
  /** UI-POLISH-SPEC D3: every active student of a term with their clearance, or none. */
  clearanceRoster: (academicYear: number, semester: number, query: { q?: string; page?: number } = {}) => {
    const params: Record<string, string | number> = {};
    if (query.q) params.q = query.q;
    if (query.page) params.page = query.page;
    return get<ClearanceRosterResponse>(`/clearances/terms/${academicYear}/${semester}/students`, params);
  },
  staffClearance: (id: number) => get<{ clearance: StaffClearanceView }>(`/clearances/${id}`),
  setUpClearance: (input: { studentId: string; academicYear: number; semester: number }) =>
    post<{ clearanceId: number }>('/clearances', input),
  markRequirementDone: (clearanceId: number, requirementId: number, remarks: string) =>
    post<{ cleared: boolean }>(`/clearances/${clearanceId}/requirements/${requirementId}/complete`, { remarks }),
  reverseRequirement: (clearanceId: number, requirementId: number, reason: string) =>
    post<{ ok: true }>(`/clearances/${clearanceId}/requirements/${requirementId}/reverse`, { reason }),
  addRequirement: (clearanceId: number, label: string) =>
    post<{ requirementId: number }>(`/clearances/${clearanceId}/requirements`, { label }),
  removeRequirement: (clearanceId: number, requirementId: number) =>
    del<{ cleared: boolean }>(`/clearances/${clearanceId}/requirements/${requirementId}`),
};
