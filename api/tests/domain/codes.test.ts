import { describe, expect, test } from 'vitest';
import {
  assignCaseCodes,
  displayCode,
  formatCaseCode,
  formatSubmissionCode,
  manilaYear,
  parseCaseCode,
  parseSubmissionCode,
} from '../../src/domain/codes.js';

describe('displayCode (letter, hyphen, 3 digits)', () => {
  test('sanctions, appointments, violations and handbook entries', () => {
    expect(displayCode('S', 21)).toBe('S-021');
    expect(displayCode('A', 104)).toBe('A-104');
    expect(displayCode('V', 7)).toBe('V-007');
    expect(displayCode('H', 68)).toBe('H-068');
  });

  test('ids above 999 simply grow', () => {
    expect(displayCode('S', 1000)).toBe('S-1000');
  });
});

describe('case codes: SDO-<year>-<number>, the number restarts every year', () => {
  test('format and parse', () => {
    expect(formatCaseCode(2026, 16)).toBe('SDO-2026-016');
    expect(formatCaseCode(2026, 1234)).toBe('SDO-2026-1234');
    expect(parseCaseCode('SDO-2026-016')).toEqual({ year: 2026, ordinal: 16 });
    expect(parseCaseCode(' sdo-2026-16 ')).toEqual({ year: 2026, ordinal: 16 });
  });

  test.each(['C016', '016', 'SDO-26-016', 'SDO-2026-', 'SDO-2026-0', 'GI-1042', '', 'SDO-2026-016-1'])('%s is not a case code', (text) => {
    expect(parseCaseCode(text)).toBeNull();
  });

  test('the year is the Asia/Manila year of the case date', () => {
    expect(manilaYear(new Date('2026-12-31T15:59:59Z'))).toBe(2026); // 23:59 Manila
    expect(manilaYear(new Date('2026-12-31T16:00:00Z'))).toBe(2027); // 00:00 Manila, Jan 1
  });

  test('numbers count from 1 in every year, ordered by id', () => {
    const cases = [
      { id: 5, caseDate: new Date('2025-11-12T02:00:00Z') },
      { id: 9, caseDate: new Date('2026-01-05T02:00:00Z') },
      { id: 10, caseDate: new Date('2025-12-30T02:00:00Z') },
      { id: 11, caseDate: new Date('2026-02-01T02:00:00Z') },
      { id: 12, caseDate: new Date('2026-02-02T02:00:00Z') },
    ];
    const codes = assignCaseCodes(cases);
    expect(codes.get(5)).toBe('SDO-2025-001');
    expect(codes.get(10)).toBe('SDO-2025-002');
    expect(codes.get(9)).toBe('SDO-2026-001');
    expect(codes.get(11)).toBe('SDO-2026-002');
    expect(codes.get(12)).toBe('SDO-2026-003');
  });
});

describe('gate submission codes: GI-<1000 + rank>', () => {
  test('format and parse', () => {
    expect(formatSubmissionCode(1)).toBe('GI-1001');
    expect(formatSubmissionCode(42)).toBe('GI-1042');
    expect(parseSubmissionCode('gi-1042')).toBe(42);
    expect(parseSubmissionCode('GI-999')).toBeNull();
    expect(parseSubmissionCode('SDO-2026-016')).toBeNull();
  });
});
