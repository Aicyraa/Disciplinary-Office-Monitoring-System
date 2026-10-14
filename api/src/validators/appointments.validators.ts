import type { AppointmentStatus } from '@shared/types.js';
import { isRealDate } from '../domain/appointments/window.js';
import { invalid, valid, type Validated } from '../helpers/validation.js';
import type { AppointmentRange } from '../repositories/appointments/queries.js';
import { parseFocus, parsePage, parseSearchText, parseStudentId } from './common.validators.js';

const APPOINTMENT_STATUSES: readonly AppointmentStatus[] = ['scheduled', 'rescheduled', 'completed', 'cancelled'];

export interface AppointmentListInput {
  bucket: 'upcoming' | 'history' | 'all';
  q: string | undefined;
  status: AppointmentStatus | undefined;
  range: AppointmentRange | undefined;
  on: string | undefined;
  page: number;
  focus: number | undefined;
}

export function parseAppointmentListQuery(query: Record<string, unknown>): Validated<AppointmentListInput> {
  const { bucket, q, page, status, range, on, focus } = query;
  if (bucket !== undefined && bucket !== 'upcoming' && bucket !== 'history' && bucket !== 'all') {
    return invalid('bucket must be upcoming, history or all.');
  }
  const pageNumber = parsePage(page);
  if (!pageNumber.ok) return pageNumber;
  const text = parseSearchText(q);
  if (!text.ok) return text;
  if (status !== undefined && !APPOINTMENT_STATUSES.includes(status as AppointmentStatus)) {
    return invalid('Unknown status.');
  }
  if (range !== undefined && range !== 'today' && range !== 'week' && range !== 'past') {
    return invalid('range must be today, week or past.');
  }
  if (on !== undefined && !(typeof on === 'string' && isRealDate(on))) return invalid('on must be a date, YYYY-MM-DD.');
  const focusId = parseFocus(focus, 'focus must be an appointment id.');
  if (!focusId.ok) return focusId;
  return valid({
    bucket: bucket === 'history' || bucket === 'all' ? bucket : 'upcoming',
    q: text.value,
    status: status as AppointmentStatus | undefined,
    range: range as AppointmentRange | undefined,
    on: typeof on === 'string' ? on : undefined,
    page: pageNumber.value,
    focus: focusId.value,
  });
}

/** The only student id check at the boundary; start date, purpose and notes are judged by the service (SPEC 4.5). */
export const parseAppointmentStudentId = (raw: unknown): Validated<string> => parseStudentId(raw);
