import { describe, expect, test } from 'vitest';
import type { StudentCaseView, StudentSanctionView } from '@shared/types';
import { countedMinors, matchesStudent, summarize } from '@/utils/studentRecord';

const item = (over: Partial<StudentCaseView>): StudentCaseView => ({
  id: 1,
  code: 'SDO-2026-001',
  status: 'validated',
  caseDate: '2026-09-01T02:00:00.000Z',
  violation: 'Improper uniform',
  severity: 'Minor',
  section: 'H-001',
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
