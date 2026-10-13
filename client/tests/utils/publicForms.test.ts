import { describe, expect, test } from 'vitest';
import { forcedPasswordError, loginProblem } from '@/utils/account';
import { YEAR_PILLS, categoryCounts, detailsErrors, filterGateViolations, violationsError } from '@/utils/gateForm';

describe('loginProblem (src 2548)', () => {
  test('empty fields', () => {
    expect(loginProblem('', '')).toBe('Enter your NU email and password.');
    expect(loginProblem('a@students.nu-fairview.edu.ph', '')).toBe('Enter your NU email and password.');
  });
  test('an address outside the NU domains', () => {
    expect(loginProblem('juan@gmail.com', 'secret12')).toBe('Use your NU email (ending in nu-fairview.edu.ph).');
  });
  test('student and staff domains pass (the API stays the authority)', () => {
    expect(loginProblem(' JDC@students.nu-fairview.edu.ph ', 'x')).toBeNull();
    expect(loginProblem('am@nu-fairview.edu.ph', 'x')).toBeNull();
  });
});

describe('forcedPasswordError (src 3420)', () => {
  test('rules first, then the match', () => {
    expect(forcedPasswordError('short', 'short')).toBe('Your new password doesn’t meet the rules below.');
    expect(forcedPasswordError('Fresh1234', 'Fresh1235')).toBe('The passwords don’t match.');
    expect(forcedPasswordError('Fresh1234', 'Fresh1234')).toBeNull();
  });
});

describe('gate form step 1: one message per field (deck W08, src 3336)', () => {
  const ok = { studentId: '2025-1234567', name: 'Ana Cruz', program: 'BSCS', year: '3', violationIds: [] };
  test('all good', () => {
    expect(detailsErrors(ok)).toEqual({});
  });
  test('every empty field gets its own message', () => {
    expect(detailsErrors({ ...ok, studentId: '', name: '', program: '', year: '' })).toEqual({
      studentId: 'Enter your student ID.',
      name: 'Enter your full name.',
      program: 'Choose your program.',
      year: 'Choose your year level.',
    });
  });
  test('the student ID format and a too-short name', () => {
    expect(detailsErrors({ ...ok, studentId: '2025-123', name: 'Al' })).toEqual({
      studentId: 'Use the format 2025-1234567.',
      name: 'Enter your full name.',
    });
  });
  test('year pills are 1st to 5th', () => {
    expect(YEAR_PILLS.map((pill) => pill.label)).toEqual(['1st', '2nd', '3rd', '4th', '5th']);
  });
});

describe('gate form step 2 (deck W09, W10)', () => {
  const list = [
    { id: 1, name: 'Improper uniform', section: 'VI.D.1', category: 'Minor' as const },
    { id: 2, name: 'No ID', section: 'VI.D.2', category: 'Minor' as const },
    { id: 9, name: 'Vandalism', section: 'VI.E.5', category: 'Major' as const },
  ];
  test('at least one violation', () => {
    expect(violationsError([])).toBe('Pick at least one violation.');
    expect(violationsError([1])).toBeNull();
  });
  test('search over name and section, then the category tab', () => {
    expect(filterGateViolations(list, 'vi.d', 'All').map((v) => v.id)).toEqual([1, 2]);
    expect(filterGateViolations(list, '', 'Major').map((v) => v.id)).toEqual([9]);
  });
  test('tab counts follow the search', () => {
    expect(categoryCounts(list, '')).toEqual({ All: 3, Minor: 2, Major: 1 });
    expect(categoryCounts(list, 'no')).toEqual({ All: 1, Minor: 1, Major: 0 });
  });
});
