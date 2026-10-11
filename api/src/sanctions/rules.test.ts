import { describe, expect, test } from 'vitest';
import { allowedSanctions, lateByDays, offenseNumber, type HandbookSanctionRow, type OffenseCase } from './rules.js';

const day = (n: number) => new Date(Date.UTC(2026, 8, n, 2));

let nextId = 1;
const make = (overrides: Partial<OffenseCase> = {}): OffenseCase => ({
  caseId: nextId++,
  caseDate: day(1),
  status: 'validated',
  handbookEntryId: 10,
  ...overrides,
});

describe('offenseNumber (SPEC 4.3, decision 14)', () => {
  test('is 1 when there is no earlier case for the violation', () => {
    const target = make({ caseDate: day(5) });
    expect(offenseNumber(target, [target])).toBe(1);
  });

  test('counts earlier validated, for_sanction and resolved cases for the same violation', () => {
    const first = make({ caseDate: day(1), status: 'resolved' });
    const second = make({ caseDate: day(2), status: 'for_sanction' });
    const target = make({ caseDate: day(3) });
    expect(offenseNumber(target, [first, second, target])).toBe(3);
  });

  test('does not count reported or rejected cases, other violations, or later cases', () => {
    const reported = make({ caseDate: day(1), status: 'reported' });
    const rejected = make({ caseDate: day(1), status: 'rejected' });
    const other = make({ caseDate: day(1), handbookEntryId: 11 });
    const target = make({ caseDate: day(3) });
    const later = make({ caseDate: day(9) });
    expect(offenseNumber(target, [reported, rejected, other, target, later])).toBe(1);
  });

  test('ties on case_date are broken by case id', () => {
    const a = make({ caseDate: day(2) });
    const b = make({ caseDate: day(2) });
    expect(offenseNumber(a, [a, b])).toBe(1);
    expect(offenseNumber(b, [a, b])).toBe(2);
  });

  test('a converted Major counts against H068, not the original violation', () => {
    // Two earlier minors were escalated; the converted case now has handbook entry 68.
    const minorA = make({ caseDate: day(1), handbookEntryId: 10 });
    const minorB = make({ caseDate: day(2), handbookEntryId: 11 });
    const converted = make({ caseDate: day(3), handbookEntryId: 68 });
    expect(offenseNumber(converted, [minorA, minorB, converted])).toBe(1);
    // A second conversion later is the 2nd offense for H068.
    const secondConverted = make({ caseDate: day(8), handbookEntryId: 68 });
    expect(offenseNumber(secondConverted, [minorA, minorB, converted, secondConverted])).toBe(2);
  });
});

describe('allowedSanctions', () => {
  const rows: HandbookSanctionRow[] = [
    { offenseNumber: 1, sanctionId: 1, sanctionType: 'Violation Slip' },
    { offenseNumber: 1, sanctionId: 2, sanctionType: 'CATEGORY - 1' },
    { offenseNumber: 2, sanctionId: 3, sanctionType: 'CATEGORY - 2' },
  ];

  test('returns the sanctions defined for that offense number', () => {
    expect(allowedSanctions(rows, 1)).toEqual({ offenseUsed: 1, sanctions: [rows[0], rows[1]] });
    expect(allowedSanctions(rows, 2)).toEqual({ offenseUsed: 2, sanctions: [rows[2]] });
  });

  test('falls back to the highest defined offense number when the exact one is not defined', () => {
    expect(allowedSanctions(rows, 5)).toEqual({ offenseUsed: 2, sanctions: [rows[2]] });
  });

  test('is empty when the violation has no handbook sanctions', () => {
    expect(allowedSanctions([], 1)).toEqual({ offenseUsed: null, sanctions: [] });
  });
});

describe('lateByDays (derived, never stored)', () => {
  test('is 0 on or before the due date', () => {
    expect(lateByDays({ dueDate: '2026-10-20', status: 'assigned', today: '2026-10-20' })).toBe(0);
    expect(lateByDays({ dueDate: '2026-10-20', status: 'assigned', today: '2026-10-10' })).toBe(0);
  });

  test('counts calendar days past the due date while not completed', () => {
    expect(lateByDays({ dueDate: '2026-10-20', status: 'returned', today: '2026-10-23' })).toBe(3);
    expect(lateByDays({ dueDate: '2026-10-31', status: 'pending_verification', today: '2026-11-02' })).toBe(2);
  });

  test('for a completed sanction it measures the completion date, not today', () => {
    expect(
      lateByDays({ dueDate: '2026-10-20', status: 'completed', today: '2026-12-01', completedOn: '2026-10-22' }),
    ).toBe(2);
    expect(
      lateByDays({ dueDate: '2026-10-20', status: 'completed', today: '2026-12-01', completedOn: '2026-10-19' }),
    ).toBe(0);
  });
});
