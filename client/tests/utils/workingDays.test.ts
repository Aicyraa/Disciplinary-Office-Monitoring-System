import { describe, expect, test } from 'vitest';
import { appointmentEndDate, startDateProblem } from '@/utils/workingDays';

describe('appointmentEndDate (a preview only; the API computes the real end date)', () => {
  test.each([
    ['2026-10-12', '2026-10-17'], // Mon -> Sat
    ['2026-10-13', '2026-10-19'], // Tue -> Mon, Sunday skipped
    ['2026-10-17', '2026-10-23'], // Sat -> Fri
    ['2026-12-29', '2027-01-04'], // year boundary
  ])('%s ends on %s', (start, end) => {
    expect(appointmentEndDate(start)).toBe(end);
  });

  test('is null for something that is not a date', () => {
    expect(appointmentEndDate('')).toBeNull();
    expect(appointmentEndDate('2026-02-30')).toBeNull();
  });
});

describe('startDateProblem', () => {
  const today = '2026-10-12';
  test('null when today..+60 days and not a Sunday', () => {
    expect(startDateProblem('2026-10-12', today)).toBeNull();
    expect(startDateProblem('2026-12-11', today)).toBeNull();
  });
  test('says why when it is not allowed', () => {
    expect(startDateProblem('', today)).toMatch(/choose/i);
    expect(startDateProblem('2026-10-11', today)).toMatch(/past/i);
    expect(startDateProblem('2026-12-12', today)).toMatch(/60 days/);
    expect(startDateProblem('2026-10-18', today)).toMatch(/Sunday/);
  });
});
