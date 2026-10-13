import { describe, expect, test } from 'vitest';
import { defaultSchoolYear, progressLabel } from '@/utils/clearance';

describe('progressLabel', () => {
  test('counts completed items', () => {
    expect(progressLabel([{ status: 'completed' }, { status: 'pending' }, { status: 'completed' }, { status: 'pending' }])).toBe(
      '2 of 4 done',
    );
  });
  test('an empty checklist says so', () => {
    expect(progressLabel([])).toBe('No requirements');
  });
  test('all done', () => {
    expect(progressLabel([{ status: 'completed' }])).toBe('1 of 1 done');
  });
});

describe('defaultSchoolYear (the form is pre-filled, staff can change it)', () => {
  test('is the calendar year of the Asia/Manila date', () => {
    expect(defaultSchoolYear('2026-10-12')).toBe(2026);
    expect(defaultSchoolYear('2027-01-03')).toBe(2027);
  });
});
