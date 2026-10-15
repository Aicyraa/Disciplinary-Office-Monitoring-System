import type { HandbookEntryView } from '@shared/types';
import { get, post, patch } from './client';

export const handbookApi = {
  handbook: () => get<{ entries: HandbookEntryView[] }>('/handbook'),
  // Handbook admin and sanction templates (SPEC 4.9, 6.1)
  createViolation: (input: {
    violationType: string;
    severity: string;
    section: string;
    description: string;
    sanctions: Array<{ offenseNumber: number; sanctionId: number }>;
  }) => post<{ handbookEntryId: number }>('/handbook', input),
  updateViolation: (
    handbookEntryId: number,
    input: {
      violationType?: string;
      severity?: string;
      section?: string;
      description?: string;
      sanctions?: Array<{ offenseNumber: number; sanctionId: number }>;
    },
  ) => patch<{ ok: true }>(`/handbook/${handbookEntryId}`, input),
};
