import { describe, expect, test } from 'vitest';
import type { StaffAppointmentView } from '@shared/types';
import {
  appointmentHistory,
  appointmentToasts,
  calendarMonth,
  formErrors,
  groupHeadsFor,
  lastUpdated,
  overlapMessage,
  reviewNote,
  reviewRows,
  startDateError,
  statusOptions,
  studentMeta,
  whenText,
} from '@/utils/appointments';

const TODAY = '2026-10-12'; // a Monday

const view = (over: Partial<StaffAppointmentView> = {}): StaffAppointmentView => ({
  id: 104,
  code: 'A-104',
  student: { id: '2023-1001230', name: 'Juan Dela Cruz', program: 'BSIT', yearLevel: 3 },
  startDate: '2026-10-12',
  endDate: '2026-10-17',
  purpose: 'Interview about case SDO-2026-012',
  notes: null,
  status: 'scheduled',
  cancelReason: null,
  bucket: 'upcoming',
  assignedBy: 'Andrea Reyes',
  dateCreated: '2026-10-07T02:00:00.000Z',
  history: [],
  ...over,
});

describe('list (deck src 3159 to 3174, UI-POLISH-SPEC 5.8)', () => {
  test('status options count the whole office', () => {
    expect(statusOptions({ scheduled: 2, rescheduled: 1, completed: 1, cancelled: 1 }).map((o) => o.label)).toEqual([
      'All statuses (5)',
      'Scheduled (2)',
      'Rescheduled (1)',
      'Completed (1)',
      'Cancelled (1)',
    ]);
  });

  test('group heads where the group changes, with the whole-list counts', () => {
    const heads = groupHeadsFor([view({ id: 1 }), view({ id: 2 }), view({ id: 3, bucket: 'history' })], { upcoming: 3, closed: 2 });
    expect([...heads.entries()]).toEqual([
      [1, { label: 'Upcoming', tone: 'info', count: 3 }],
      [3, { label: 'Past and closed', tone: 'neutral', count: 2 }],
    ]);
  });

  test('when text and the student line', () => {
    expect(whenText(view())).toBe('Mon, Oct 12 to Sat, Oct 17, 7:00 AM to 5:00 PM');
    expect(studentMeta(view())).toBe('BSIT · 3rd Year');
    expect(studentMeta(view({ student: { id: 'x', name: 'y', program: null, yearLevel: null } }))).toBe('');
  });
});

describe('detail', () => {
  test('history sentences from the event data, newest first', () => {
    const items = appointmentHistory(
      view({
        history: [
          { eventType: 'assigned', remarks: 'Interview', date: '2026-10-07T02:00:00.000Z', by: 'Andrea Reyes' },
          { eventType: 'rescheduled', remarks: 'Moved from Mon, Oct 12, 2026 to Tue, Oct 13, 2026.', date: '2026-10-08T02:00:00.000Z', by: 'Andrea Reyes' },
          { eventType: 'remarks_updated', remarks: 'Notes: Bring ID', date: '2026-10-09T02:00:00.000Z', by: 'Andrea Reyes' },
          { eventType: 'cancelled', remarks: 'Out of office', date: '2026-10-10T02:00:00.000Z', by: 'Andrea Reyes' },
        ],
      }),
    );
    expect(items.map((i) => i.text)).toEqual([
      'Cancelled: Out of office',
      'Reason or remarks updated',
      'Rescheduled from Mon, Oct 12, 2026 to Tue, Oct 13, 2026.',
      'Assigned: Interview',
    ]);
    expect(items[0]).toMatchObject({ date: 'Oct 10, 2026', by: 'Andrea Reyes' });
  });

  test('last updated is the newest event, else the creation time', () => {
    expect(lastUpdated(view())).toBe('Oct 7, 2026');
    expect(lastUpdated(view({ history: [{ eventType: 'completed', remarks: null, date: '2026-10-09T02:00:00.000Z', by: 'x' }] }))).toBe('Oct 9, 2026');
  });
});

describe('calendar (src 3233 to 3244)', () => {
  test('Sunday-first grid; Sundays, past days and days past 60 are unavailable; today is marked', () => {
    const month = calendarMonth(2026, 9, TODAY, '');
    expect(month.title).toBe('October 2026');
    expect(month.cells.slice(0, 4).map((c) => c.kind)).toEqual(['blank', 'blank', 'blank', 'blank']); // Oct 1 is a Thursday
    const day = (n: number) => month.cells.find((c) => c.day === n)!;
    expect(day(11).kind).toBe('unavailable'); // past and a Sunday
    expect(day(12)).toMatchObject({ kind: 'available', today: true });
    expect(day(18).kind).toBe('unavailable'); // Sunday
    expect(month.canPrev).toBe(false);
    expect(month.canNext).toBe(true);
  });

  test('the start date and its visit window (Sundays skipped)', () => {
    const month = calendarMonth(2026, 9, TODAY, '2026-10-14');
    const day = (n: number) => month.cells.find((c) => c.day === n)!;
    expect(day(14).kind).toBe('start');
    expect([15, 16, 17, 19, 20].map((n) => day(n).kind)).toEqual(['window', 'window', 'window', 'window', 'window']);
    expect(day(18).kind).toBe('unavailable');
    expect(day(21).kind).toBe('available');
  });

  test('the last month that holds a bookable day has no next', () => {
    expect(calendarMonth(2026, 11, TODAY, '').canNext).toBe(false);
  });
});

describe('form checks and copy (UI-POLISH-SPEC 5.8 field errors, 6.2)', () => {
  test('start date messages', () => {
    expect(startDateError('', TODAY)).toBe('Choose a start date.');
    expect(startDateError('2026-10-11', TODAY)).toBe('Choose today or a later date.');
    expect(startDateError('2026-12-12', TODAY)).toBe('Choose a start date before Dec 12, 2026.');
    expect(startDateError('2026-10-18', TODAY)).toBe('The office is closed on Sundays. Choose Monday to Saturday.');
    expect(startDateError('2026-10-13', TODAY)).toBeNull();
  });

  test('field errors: student, date, reason', () => {
    expect(formErrors({ studentFound: false, studentTyped: '', startDate: '', reason: '' }, TODAY)).toEqual({
      student: 'Enter the student ID.',
      date: 'Choose a start date.',
      reason: 'Enter the reason for the appointment.',
    });
    expect(formErrors({ studentFound: false, studentTyped: '2023-1009999', startDate: '2026-10-13', reason: 'Talk' }, TODAY)).toEqual({
      student: 'No student found with that ID.',
    });
    expect(formErrors({ studentFound: true, studentTyped: '2023-1001230', startDate: '2026-10-13', reason: 'Talk' }, TODAY)).toEqual({});
  });

  test('overlap message names the other appointment', () => {
    expect(overlapMessage('Juan Dela Cruz', view({ code: 'A-103', startDate: '2026-10-10', endDate: '2026-10-16' }))).toBe(
      'Juan Dela Cruz already has appointment A-103 (Sat, Oct 10 to Fri, Oct 16) in this period.',
    );
  });

  test('review rows, note and toasts for new, moved and edited appointments', () => {
    const rows = reviewRows({ name: 'Paolo Reyes', studentId: '2023-1007890', startDate: '2026-10-13', reason: ' Interview ', remarks: '', status: 'Scheduled' });
    expect(rows).toEqual([
      ['Student', 'Paolo Reyes'],
      ['Student ID', '2023-1007890'],
      ['Dates', 'Tue, Oct 13 to Mon, Oct 19'],
      ['Time', 'Any time during office hours, 7:00 AM to 5:00 PM'],
      ['Reason', 'Interview'],
      ['Remarks', 'None'],
      ['Status', 'Scheduled'],
    ]);
    expect(reviewNote('new', 'Paolo Reyes')).toBe('Saving assigns this appointment to Paolo Reyes. They get a portal notification and an email.');
    expect(reviewNote('moved', 'Paolo Reyes')).toBe('Saving moves the appointment and tells Paolo Reyes the new date.');
    expect(reviewNote('edited', 'Paolo Reyes')).toBe('Saving updates the appointment and notifies Paolo Reyes.');
    const toasts = appointmentToasts('A-104', 'Juan Dela Cruz');
    expect(toasts.assigned).toBe('A-104 assigned to Juan Dela Cruz. They were notified.');
    expect(toasts.moved('2026-10-13')).toBe('A-104 moved to Tue, Oct 13 to Mon, Oct 19. Juan Dela Cruz was notified.');
    expect(toasts.updated).toBe('A-104 updated. Juan Dela Cruz was notified.');
    expect(toasts.completed).toBe('A-104 completed. Juan Dela Cruz was notified.');
    expect(toasts.cancelled).toBe('A-104 cancelled. Juan Dela Cruz was notified.');
  });
});
