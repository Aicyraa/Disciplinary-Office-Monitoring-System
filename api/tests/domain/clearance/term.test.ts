import { describe, expect, test } from 'vitest';
import { currentTerm, termList } from '../../../src/domain/clearance/term.js';

describe('currentTerm (assumed calendar, Asia/Manila)', () => {
  test.each([
    ['2026-08-03T00:00:00Z', 2026, 1],
    ['2026-11-30T15:59:00Z', 2026, 1], // still Nov 30 in Manila
    ['2026-11-30T16:00:00Z', 2026, 2], // Dec 1 in Manila
    ['2026-12-15T00:00:00Z', 2026, 2],
    ['2027-03-31T00:00:00Z', 2026, 2],
    ['2027-04-01T00:00:00Z', 2026, 3],
    ['2027-07-31T00:00:00Z', 2026, 3],
  ])('%s -> %i term %i', (iso, academicYear, semester) => {
    expect(currentTerm(new Date(iso))).toEqual({ academicYear, semester });
  });
});

describe('termList', () => {
  test('newest first, current always present, no repeats', () => {
    expect(
      termList({ academicYear: 2026, semester: 1 }, [
        { academicYear: 2025, semester: 3 },
        { academicYear: 2026, semester: 1 },
      ]),
    ).toEqual([
      { academicYear: 2026, semester: 1 },
      { academicYear: 2025, semester: 3 },
    ]);
  });
});
