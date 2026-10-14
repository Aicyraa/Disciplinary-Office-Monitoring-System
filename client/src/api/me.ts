import type { ClearanceSlipView, StudentAppointmentView, StudentCaseDetailView, StudentCaseView, StudentClearanceResponse, StudentProfileView, StudentSanctionView } from '@shared/types';
import { get } from './client';

export const meApi = {
  myClearanceSlip: (academicYear: number, semester: number) =>
    get<{ slip: ClearanceSlipView }>('/me/clearance/slip', { academic_year: academicYear, semester }),
  myProfile: () => get<{ profile: StudentProfileView }>('/me/profile'),
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
