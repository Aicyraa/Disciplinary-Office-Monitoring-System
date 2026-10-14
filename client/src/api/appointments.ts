import type { StaffAppointmentListResponse, StaffAppointmentView } from '@shared/types';
import { get, post, patch } from './client';

export const appointmentsApi = {
  // Staff appointments (SPEC 4.5, 7)
  staffAppointments: (query: {
    bucket?: 'upcoming' | 'history' | 'all';
    q?: string;
    status?: string;
    range?: string;
    on?: string;
    page?: number;
    focus?: number;
  }) => {
    const params: Record<string, string | number> = {};
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== '' && !(key === 'page' && value === 1)) params[key] = value;
    }
    return get<StaffAppointmentListResponse>('/appointments', params);
  },
  staffAppointment: (id: number) => get<{ appointment: StaffAppointmentView }>(`/appointments/${id}`),
  createAppointment: (input: { studentId: string; startDate: string; purpose: string; notes: string }) =>
    post<{ appointmentId: number }>('/appointments', input),
  updateAppointment: (appointmentId: number, input: { startDate?: string; purpose?: string; notes?: string }) =>
    patch<{ ok: true }>(`/appointments/${appointmentId}`, input),
  completeAppointment: (appointmentId: number) => post<{ ok: true }>(`/appointments/${appointmentId}/complete`),
  cancelAppointment: (appointmentId: number, reason: string) =>
    post<{ ok: true }>(`/appointments/${appointmentId}/cancel`, { reason }),
};
