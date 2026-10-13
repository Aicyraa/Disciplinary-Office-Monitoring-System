import { describe, expect, test } from 'vitest';
import type { ClearanceRosterRow, StaffAppointmentView, StaffCaseRow, StaffSanctionQueueRow } from '@shared/types';
import {
  ageText,
  appointmentRow,
  clearanceRows,
  decisionRow,
  dayRange,
  reportRows,
  sanctionRows,
} from '@/utils/staffDashboard';

const TODAY = '2026-10-09';

const row = (over: Partial<StaffCaseRow>): StaffCaseRow => ({
  id: 1,
  code: 'SDO-2026-016',
  status: 'reported',
  severity: 'Minor',
  violation: 'No ID',
  section: 'VI.D.2',
  caseDate: '2026-10-08T10:00:00.000Z',
  source: 'gate',
  student: { id: '2023-1001230', name: 'Juan Dela Cruz' },
  claimed: null,
  submissionRef: 'ref-a',
  submissionCode: 'GI-1042',
  isEscalated: false,
  convertedFrom: null,
  sanction: null,
  dateResolved: null,
  ...over,
});

describe('ageText (src 2166)', () => {
  test('Today, 1 day, N days in Asia/Manila', () => {
    expect(ageText('2026-10-09T01:00:00.000Z', TODAY)).toBe('Today');
    expect(ageText('2026-10-08T01:00:00.000Z', TODAY)).toBe('1 day');
    expect(ageText('2026-09-01T01:00:00.000Z', TODAY)).toBe('38 days');
  });
});

describe('reportRows: one row per gate submission (D4, src 2824)', () => {
  test('the cases of one submission share a row: name · ID, GI code, every violation, age', () => {
    const rows = reportRows(
      [
        row({ id: 16, violation: 'No ID' }),
        row({ id: 17, code: 'SDO-2026-017', violation: 'Inappropriate attire' }),
        row({ id: 18, code: 'SDO-2026-018', submissionRef: 'ref-b', submissionCode: 'GI-1043', student: null, claimed: { studentId: '2023-1009990', name: 'Carlo Mendoza', program: null, year: null }, caseDate: '2026-10-09T00:30:00.000Z' }),
      ],
      TODAY,
    );
    expect(rows).toEqual([
      {
        key: 'ref-a',
        caseId: 16,
        title: 'Juan Dela Cruz · 2023-1001230',
        sub: 'GI-1042 · No ID, Inappropriate attire · 1 day',
        submissionRef: 'ref-a',
        unmatched: false,
        href: '/cases/16?queue=review',
      },
      {
        key: 'ref-b',
        caseId: 18,
        title: 'Carlo Mendoza · 2023-1009990',
        sub: 'GI-1043 · No ID · Today',
        submissionRef: 'ref-b',
        unmatched: true,
        href: '/cases/18?queue=review',
      },
    ]);
  });
});

describe('decisionRow (src 2831)', () => {
  test('name · code, violation · class · age, Major flag', () => {
    expect(decisionRow(row({ id: 12, code: 'SDO-2026-012', status: 'validated', severity: 'Major', violation: 'Vandalism', caseDate: '2026-09-01T01:00:00.000Z' }), TODAY)).toEqual({
      key: '12',
      title: 'Juan Dela Cruz · SDO-2026-012',
      sub: 'Vandalism · Major · 38 days',
      flag: 'Major',
      href: '/cases/12?queue=all',
    });
  });
});

describe('appointmentRow (src 2839)', () => {
  const appt = (over: Partial<StaffAppointmentView>): StaffAppointmentView => ({
    id: 4,
    code: 'A-104',
    student: { id: '2023-1001230', name: 'Juan Dela Cruz' },
    startDate: '2026-10-12',
    endDate: '2026-10-17',
    purpose: 'Hand in the signed letter.',
    notes: null,
    status: 'scheduled',
    cancelReason: null,
    bucket: 'upcoming',
    assignedBy: 'Andrea',
    dateCreated: '2026-10-07T00:00:00.000Z',
    history: [],
    ...over,
  });
  test('name · code, reason · window, no flag before it opens', () => {
    expect(appointmentRow(appt({}), TODAY)).toEqual({
      key: '4',
      title: 'Juan Dela Cruz · A-104',
      sub: 'Hand in the signed letter. · Mon, Oct 12 to Sat, Oct 17',
      flag: null,
      href: '/appointments/4',
    });
  });
  test('"Window open" once the window started; "Rescheduled" otherwise', () => {
    expect(appointmentRow(appt({ startDate: '2026-10-09' }), TODAY).flag).toBe('Window open');
    expect(appointmentRow(appt({ status: 'rescheduled' }), TODAY).flag).toBe('Rescheduled');
  });
  test('dayRange', () => {
    expect(dayRange('2026-10-10', '2026-10-16')).toBe('Sat, Oct 10 to Fri, Oct 16');
  });
});

describe('sanctionRows (src 2868)', () => {
  const s = (over: Partial<StaffSanctionQueueRow>): StaffSanctionQueueRow => ({
    id: 1,
    caseId: 11,
    caseCode: 'SDO-2026-011',
    sanctionCode: 'S-019',
    type: 'Community service',
    status: 'assigned',
    student: { id: '2023-1004560', name: 'Maria Santos' },
    dueDate: '2026-10-20',
    dateSubmitted: null,
    lateByDays: 0,
    overdue: false,
    ...over,
  });
  test('to verify first, then the rest; flags Overdue / Returned; Verify or Open', () => {
    const rows = sanctionRows([
      s({ id: 1, sanctionCode: 'S-021', status: 'assigned', overdue: true }),
      s({ id: 2, sanctionCode: 'S-019', status: 'pending_verification' }),
      s({ id: 3, sanctionCode: 'S-022', status: 'returned' }),
    ]);
    expect(rows.map((r) => [r.title, r.flag, r.action])).toEqual([
      ['Maria Santos · S-019', null, 'Verify'],
      ['Maria Santos · S-021', 'Overdue', 'Open'],
      ['Maria Santos · S-022', 'Returned', 'Open'],
    ]);
    expect(rows[0].sub).toBe('Community service · Due Oct 20');
    expect(rows[0].href).toBe('/cases/11?queue=sanction');
  });
});

describe('clearanceRows (src 2841, D3)', () => {
  const r = (over: Partial<ClearanceRosterRow>): ClearanceRosterRow => ({
    studentId: '2023-1001230',
    name: 'Juan Dela Cruz',
    program: 'BSIT',
    yearLevel: 3,
    clearance: { id: 1, status: 'pending', done: 1, total: 4 },
    ...over,
  });
  test('students not yet cleared, with progress or "Not set"', () => {
    const rows = clearanceRows(
      [r({}), r({ studentId: '2023-1004560', name: 'Maria Santos', clearance: null }), r({ studentId: 'x', clearance: { id: 2, status: 'cleared', done: 4, total: 4 } })],
      { academicYear: 2026, semester: 1 },
    );
    expect(rows).toEqual([
      { key: '2023-1001230', title: 'Juan Dela Cruz · 2023-1001230', sub: '1 of 4 requirements done', flag: null, href: '/clearance/2023-1001230?term=2026-1' },
      { key: '2023-1004560', title: 'Maria Santos · 2023-1004560', sub: 'Not set up for this term', flag: 'Not set', href: '/clearance/2023-1004560?term=2026-1' },
    ]);
  });
});
