import { describe, expect, test } from 'vitest';
import type { StudentCaseView, StudentSanctionView } from '@shared/types';
import { countedMinors, defaultRecordTab, matchesStudent, recordCaseRow, recordSanctionRow, recordTiles, summarize } from '@/utils/studentRecord';

const item = (over: Partial<StudentCaseView>): StudentCaseView => ({
  id: 1,
  code: 'SDO-2026-001',
  status: 'validated',
  caseDate: '2026-09-01T02:00:00.000Z',
  violation: 'Improper uniform',
  severity: 'Minor',
  section: 'H-001',
  handbookEntryId: 1,
  isEscalated: false,
  convertedFrom: null,
  resolvedWithoutSanction: false,
  dateResolved: null,
  ...over,
});

describe('countedMinors', () => {
  test('counts validated-or-later minors that are not rejected, not reported and not already escalated', () => {
    const cases = [
      item({ id: 1 }),
      item({ id: 2, status: 'for_sanction' }),
      item({ id: 3, status: 'reported' }),
      item({ id: 4, status: 'rejected' }),
      item({ id: 5, isEscalated: true }),
      item({ id: 6, severity: 'Major' }),
    ];
    expect(countedMinors(cases)).toBe(2);
  });
});

describe('summarize', () => {
  const sanction = (status: StudentSanctionView['status']) => ({ status }) as StudentSanctionView;

  test('active, resolved, minor count capped at the threshold, sanctions and the newest clearance term', () => {
    const summary = summarize({
      cases: [item({ id: 1 }), item({ id: 2 }), item({ id: 3, status: 'resolved' }), item({ id: 4, status: 'resolved' })],
      sanctions: [sanction('assigned'), sanction('pending_verification'), sanction('completed')],
      clearanceTerms: [{ academicYear: 2026, semester: 1, status: 'pending' }],
    });
    expect(summary).toEqual({
      activeCases: 2,
      resolvedCases: 2,
      minorCount: 3,
      sanctionsInProgress: 2,
      sanctionsCleared: 1,
      clearance: { academicYear: 2026, semester: 1, status: 'pending' },
    });
  });

  test('a student with nothing recorded', () => {
    expect(summarize({ cases: [], sanctions: [], clearanceTerms: [] })).toMatchObject({ activeCases: 0, minorCount: 0, clearance: null });
  });
});

describe('matchesStudent', () => {
  const row = { studentId: '2025-1030808', firstName: 'Ana', lastName: 'Cruz', email: 'ana.cruz@students.nu-fairview.edu.ph', program: 'BS Information Technology' };
  test('matches id, name, email and program, ignoring case', () => {
    for (const query of ['1030808', 'ana cruz', 'CRUZ@STUDENTS', 'information', '']) expect(matchesStudent(row, query)).toBe(true);
    expect(matchesStudent(row, 'nursing')).toBe(false);
  });
});

const san = (over: Partial<StudentSanctionView>): StudentSanctionView =>
  ({
    id: 1,
    caseId: 1,
    caseCode: 'SDO-2026-001',
    sanctionId: 21,
    sanctionCode: 'S-021',
    type: 'Community service',
    description: '',
    severity: 'Minor',
    status: 'assigned',
    dateAssigned: '2026-09-02T02:00:00.000Z',
    dueDate: '2026-10-20',
    dateSubmitted: null,
    dateCompleted: null,
    staffNote: null,
    complianceNote: null,
    history: [],
    files: [],
    lateByDays: 0,
    canUpload: true,
    canChangeFiles: true,
    ...over,
  }) as StudentSanctionView;

describe('staff student record (deck W30 to W32, src 2914 to 2944)', () => {
  const record = {
    cases: [
      item({ id: 1, status: 'for_sanction' }),
      item({ id: 2, status: 'resolved', dateResolved: '2026-10-09T02:00:00.000Z' }),
      item({ id: 3, status: 'rejected' }),
    ],
    sanctions: [san({ id: 1, caseId: 1, status: 'pending_verification' }), san({ id: 2, caseId: 2, sanctionCode: 'S-019', status: 'completed' })],
    clearanceTerms: [],
  };

  test('four tiles: active (minor count), resolved incl. not verified, sanctions (to verify in red), clearance', () => {
    const tiles = recordTiles(record, { done: 2, total: 4, term: '1st Term 2026-2027' });
    expect(tiles.map((t) => [t.key, t.label, t.value, t.sub, t.warn])).toEqual([
      ['active', 'Active cases', 1, 'Minor count 2 of 3', false],
      ['history', 'Resolved cases', 2, 'Kept on file', false],
      ['san', 'Sanctions', 1, '1 to verify', true],
      ['clr', 'Clearance', '2/4', '1st Term 2026-2027', false],
    ]);
    const quiet = recordTiles({ ...record, sanctions: [san({ status: 'completed' })] }, null);
    expect(quiet[2]).toMatchObject({ value: 0, sub: '1 cleared', warn: false });
    expect(quiet[3]).toMatchObject({ value: '—', sub: 'Not set up' });
  });

  test('opens on Sanctions when proof waits, else Active cases', () => {
    expect(defaultRecordTab(record)).toBe('san');
    expect(defaultRecordTab({ ...record, sanctions: [] })).toBe('active');
  });

  test('case rows: line from the sanction, resolve date, not verified or no sanction yet', () => {
    expect(recordCaseRow(record.cases[0], record.sanctions).line).toBe('Sanction S-021 · Pending verification');
    expect(recordCaseRow(record.cases[1], [])).toMatchObject({ line: 'Resolved Oct 9, 2026', href: '/cases/2?queue=all' });
    expect(recordCaseRow(record.cases[2], []).line).toBe('Not verified');
    expect(recordCaseRow(item({ id: 4 }), []).line).toBe('No sanction yet');
    expect(recordCaseRow(item({ id: 5, isEscalated: true }), []).tag).toBe('Escalated');
    expect(recordCaseRow(item({ id: 6, convertedFrom: 'No ID', severity: 'Major' }), []).tag).toBe('3rd minor · Major');
  });

  test('sanction rows: code, due date, title and the case they open', () => {
    expect(recordSanctionRow(record.sanctions[0])).toEqual({
      key: '1',
      code: 'S-021',
      due: 'Due Oct 20',
      title: 'Community service',
      caseCode: 'SDO-2026-001',
      href: '/cases/1?queue=all',
    });
  });
});
