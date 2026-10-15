import { describe, expect, test } from 'vitest';
import { YEAR_LEVELS, parseReport } from '../../../src/domain/gate/validate.js';

const valid = {
  studentId: '2025-1030808',
  name: 'Ana Cruz',
  program: 'BS Computer Science',
  year: 3,
  violationIds: [1, 5],
};

describe('parseReport', () => {
  test('accepts a complete report and normalises it', () => {
    expect(parseReport({ ...valid, studentId: ' 2025-1030808 ', name: '  Ana   Cruz ' })).toEqual({
      ok: true,
      value: { studentId: '2025-1030808', name: 'Ana Cruz', program: 'BS Computer Science', year: '3rd year', violationIds: [1, 5] },
    });
  });

  test('year levels 1 to 5, as a number or digit text', () => {
    expect(YEAR_LEVELS).toEqual(['1st year', '2nd year', '3rd year', '4th year', '5th year']);
    for (let year = 1; year <= 5; year += 1) {
      expect(parseReport({ ...valid, year })).toMatchObject({ ok: true });
      expect(parseReport({ ...valid, year: String(year) })).toMatchObject({ ok: true });
    }
    for (const year of [0, 6, 2.5, -1, '', 'third', null, undefined]) {
      expect(parseReport({ ...valid, year })).toEqual({ ok: false });
    }
  });

  test.each([
    ['no student id', { studentId: '' }],
    ['a malformed student id', { studentId: '2025-123' }],
    ['an id with letters', { studentId: '2025-ABCDEFG' }],
    ['a one-letter name', { name: 'A' }],
    ['a name over 100 characters', { name: 'x'.repeat(101) }],
    ['a name with a control character', { name: 'Ana\u0000 Cruz' }],
    ['a name that is not text', { name: 42 }],
    ['no program', { program: '' }],
    ['a program over 120 characters', { program: 'x'.repeat(121) }],
    ['no violations', { violationIds: [] }],
    ['more than 20 violations', { violationIds: Array.from({ length: 21 }, (_, i) => i + 1) }],
    ['a repeated violation', { violationIds: [1, 1] }],
    ['a non-integer violation id', { violationIds: [1.5] }],
    ['a text violation id', { violationIds: ['1'] }],
    ['violations that are not a list', { violationIds: 'all' }],
  ])('refuses %s', (_label, override) => {
    expect(parseReport({ ...valid, ...override })).toEqual({ ok: false });
  });

  test('refuses a body that is not an object', () => {
    for (const body of [null, undefined, 'x', 5, []]) expect(parseReport(body)).toEqual({ ok: false });
  });
});
