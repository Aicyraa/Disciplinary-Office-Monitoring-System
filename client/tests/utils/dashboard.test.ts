import { describe, expect, test } from 'vitest';
import type { StudentAppointmentView, StudentCaseView, StudentClearanceView, StudentSanctionView } from '@shared/types';
import {
  activeCases,
  appointmentSummary,
  caseCounts,
  clearanceProgress,
  clearanceSummary,
  nextAppointment,
  sanctionCounts,
  sanctionRow,
  sanctionsHint,
  violationRow,
  violationsHint,
} from '@/utils/dashboard';

const caseOf = (overrides: Partial<StudentCaseView>): StudentCaseView => ({
  id: 1,
  code: 'C001',
  status: 'validated',
  caseDate: '2026-10-01T02:00:00.000Z',
  violation: 'Improper uniform',
  severity: 'Minor',
  section: 'VI.D.1',
  handbookEntryId: 1,
  isEscalated: false,
  convertedFrom: null,
  resolvedWithoutSanction: false,
  dateResolved: null,
  ...overrides,
});

const sanctionOf = (status: StudentSanctionView['status']): Pick<StudentSanctionView, 'status'> => ({ status });

describe('caseCounts / activeCases', () => {
  const cases = [
    caseOf({ id: 1, status: 'reported', severity: 'Minor' }),
    caseOf({ id: 2, status: 'validated', severity: 'Minor' }),
    caseOf({ id: 3, status: 'for_sanction', severity: 'Major' }),
    caseOf({ id: 4, status: 'resolved' }),
    caseOf({ id: 5, status: 'rejected' }),
  ];

  test('active cases are the ones not resolved or rejected, newest first', () => {
    expect(activeCases(cases).map((c) => c.id)).toEqual([3, 2, 1]);
  });

  test('counts: pending review, validated, in sanction, and minor / major among the active ones', () => {
    expect(caseCounts(cases)).toEqual({ pendingReview: 1, validated: 1, sanctioned: 1, active: 3, minor: 2, major: 1 });
  });

  test('no cases', () => {
    expect(caseCounts([])).toEqual({ pendingReview: 0, validated: 0, sanctioned: 0, active: 0, minor: 0, major: 0 });
  });
});

describe('nextAppointment', () => {
  const appointment = (id: number, startDate: string, bucket: 'upcoming' | 'history'): StudentAppointmentView => ({
    id,
    code: `A-${String(id).padStart(3, '0')}`,
    startDate,
    endDate: startDate,
    purpose: 'x',
    notes: null,
    status: 'scheduled',
    cancelReason: null,
    bucket,
  });

  test('the upcoming appointment that starts first', () => {
    const list = [appointment(1, '2026-11-05', 'upcoming'), appointment(2, '2026-10-20', 'upcoming'), appointment(3, '2026-09-01', 'history')];
    expect(nextAppointment(list)?.id).toBe(2);
  });

  test('null when none is upcoming', () => {
    expect(nextAppointment([appointment(3, '2026-09-01', 'history')])).toBeNull();
    expect(nextAppointment([])).toBeNull();
  });
});

describe('sanctionCounts', () => {
  test('in progress covers assigned and returned; pending verification; cleared is completed', () => {
    const list = [
      sanctionOf('assigned'),
      sanctionOf('returned'),
      sanctionOf('pending_verification'),
      sanctionOf('completed'),
      sanctionOf('completed'),
    ];
    expect(sanctionCounts(list)).toEqual({ inProgress: 2, pendingVerification: 1, cleared: 2, active: 3, total: 5 });
  });
});

describe('clearanceProgress', () => {
  const clearance = (statuses: Array<'pending' | 'completed'>): Pick<StudentClearanceView, 'items'> => ({
    items: statuses.map((status, index) => ({
      requirementId: index + 1,
      label: `R${index + 1}`,
      status,
      remarks: null,
      dateCompleted: null,
    })),
  });

  test('done of total and a whole percent', () => {
    expect(clearanceProgress(clearance(['completed', 'pending', 'pending', 'pending']))).toEqual({ done: 1, total: 4, percent: 25 });
    expect(clearanceProgress(clearance(['completed', 'completed']))).toEqual({ done: 2, total: 2, percent: 100 });
  });

  test('nothing set up', () => {
    expect(clearanceProgress(null)).toEqual({ done: 0, total: 0, percent: 0 });
    expect(clearanceProgress(clearance([]))).toEqual({ done: 0, total: 0, percent: 0 });
  });
});

describe('student dashboard rows (src 3062 to 3067, UI-POLISH-SPEC 5.14 and 5.4b)', () => {
  test('violationsHint: "N minor · M major", "Nothing open" when empty', () => {
    expect(violationsHint(caseCounts([caseOf({ severity: 'Minor' }), caseOf({ id: 2, severity: 'Major' }), caseOf({ id: 3 })]))).toBe('2 minor · 1 major');
    expect(violationsHint(caseCounts([caseOf({ status: 'resolved' })]))).toBe('Nothing open');
  });

  test('violationRow: violation, "code · class · short date" in Manila, opens the case', () => {
    expect(violationRow(caseOf({ id: 21, code: 'SDO-2026-021', violation: 'Inappropriate attire', caseDate: '2026-10-08T17:00:00.000Z' }))).toEqual({
      key: '21',
      title: 'Inappropriate attire',
      sub: 'SDO-2026-021 · Minor · Oct 9',
      href: '/violations/21',
    });
  });

  test('sanctionsHint and sanctionRow: "N active · M of T cleared", "code · Due date", opens the sanction', () => {
    expect(sanctionsHint(sanctionCounts([sanctionOf('assigned'), sanctionOf('pending_verification'), sanctionOf('completed'), sanctionOf('completed')]))).toBe(
      '2 active · 2 of 4 cleared',
    );
    expect(sanctionRow({ id: 22, type: 'Community service', sanctionCode: 'S-022', dueDate: '2026-10-23' })).toEqual({
      key: '22',
      title: 'Community service',
      sub: 'S-022 · Due Oct 23',
      href: '/sanctions/22',
    });
  });

  test('appointmentSummary: range and link, "Nothing scheduled" when none', () => {
    expect(appointmentSummary({ id: 4, startDate: '2026-10-12', endDate: '2026-10-17' }, 1)).toEqual({
      sub: '1 upcoming',
      range: 'Mon, Oct 12 to Sat, Oct 17',
      href: '/appointments/4',
    });
    expect(appointmentSummary(null, 0)).toEqual({ sub: 'Nothing scheduled', range: '', href: '/appointments' });
  });

  test('clearanceSummary: "2/4" in progress, "Cleared" when cleared, null when not set up', () => {
    const items = (statuses: Array<'pending' | 'completed'>) =>
      statuses.map((status, index) => ({ requirementId: index + 1, label: `R${index + 1}`, status, remarks: null, dateCompleted: null }));
    expect(clearanceSummary({ status: 'pending', items: items(['completed', 'completed', 'pending', 'pending']) })).toEqual({
      value: '2/4',
      hint: '2 of 4 requirements done',
      percent: 50,
      cleared: false,
    });
    expect(clearanceSummary({ status: 'cleared', items: items(['completed', 'completed']) })).toEqual({
      value: 'Cleared',
      hint: '2 of 2 requirements done',
      percent: 100,
      cleared: true,
    });
    expect(clearanceSummary(null)).toBeNull();
  });
});
