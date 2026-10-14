import { get, request, http } from './client';

export const gateApi = {
  // Public gate form (SPEC 4.10): no session.
  gateToken: () => get<{ token: string }>('/public/gate-form-token'),
  gateOptions: () =>
    get<{ violations: Array<{ id: number; name: string; section: string; category: 'Minor' | 'Major' }>; programs: string[] }>(
      '/public/gate-form-options',
    ),
  submitGateReport: (input: {
    token: string;
    studentId: string;
    name: string;
    program: string;
    year: string;
    violationIds: number[];
  }) =>
    request<{ reference: string; code: string; duplicate: boolean; submittedAt: string }>(() => http.post('/public/gate-reports', input)),
};
