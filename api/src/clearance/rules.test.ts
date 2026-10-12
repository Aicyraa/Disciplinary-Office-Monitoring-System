import { describe, expect, test } from 'vitest';
import { checkTerm, nextClearanceStatus, termLabel } from './rules.js';

const item = (status: 'pending' | 'completed') => ({ status });

describe('nextClearanceStatus (SPEC 4.4: cleared when every item is done; manual, never computed from cases)', () => {
  test('all completed is cleared', () => {
    expect(nextClearanceStatus([item('completed'), item('completed')])).toBe('cleared');
  });
  test('one pending keeps it pending', () => {
    expect(nextClearanceStatus([item('completed'), item('pending')])).toBe('pending');
  });
  test('no items is never cleared', () => {
    expect(nextClearanceStatus([])).toBe('pending');
  });
});

describe('checkTerm', () => {
  test('a four digit school year and a semester from 1 to 3', () => {
    expect(checkTerm(2026, 1)).toBe(true);
    expect(checkTerm(2026, 3)).toBe(true);
  });
  test.each([
    [2026, 0],
    [2026, 4],
    [2026, 1.5],
    [99, 1],
    [20260, 1],
    [Number.NaN, 1],
    ['2026', 1],
    [2026, '1'],
  ])('rejects %s / %s', (year, semester) => {
    expect(checkTerm(year, semester)).toBe(false);
  });
});

describe('termLabel', () => {
  test('writes the school year and the semester', () => {
    expect(termLabel(2026, 2)).toBe('2026-2027, Semester 2');
  });
});
