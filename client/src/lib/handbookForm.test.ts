import { describe, expect, test } from 'vitest';
import type { HandbookEntryView } from '@shared/types';
import { formProblem, offenseSlots, toPicks, toSanctionList, type ViolationFormValues } from './handbookForm';

const entry = (sanctions: Array<[number, number]>): HandbookEntryView => ({
  id: 1,
  code: 'H001',
  violationId: 1,
  violationCode: 'V001',
  violation: 'Improper uniform',
  severity: 'Minor',
  section: 'VI.D.1',
  description: 'Not wearing the uniform.',
  sanctions: sanctions.map(([offenseNumber, sanctionId]) => ({
    offenseNumber,
    sanctionId,
    sanctionCode: `S00${sanctionId}`,
    type: `Sanction ${sanctionId}`,
    description: '',
  })),
});

describe('toPicks / toSanctionList', () => {
  test('round trip: offense number to the chosen sanction ids and back', () => {
    const picks = toPicks(entry([[1, 1], [2, 2], [2, 3]]));
    expect(picks).toEqual({ 1: [1], 2: [2, 3] });
    expect(toSanctionList(picks)).toEqual([
      { offenseNumber: 1, sanctionId: 1 },
      { offenseNumber: 2, sanctionId: 2 },
      { offenseNumber: 2, sanctionId: 3 },
    ]);
  });

  test('an offense with nothing picked is left out', () => {
    expect(toSanctionList({ 1: [], 2: [4] })).toEqual([{ offenseNumber: 2, sanctionId: 4 }]);
  });
});

describe('offenseSlots', () => {
  test('at least 3 offenses are shown, more when the entry already uses them, never over 5', () => {
    expect(offenseSlots({})).toEqual([1, 2, 3]);
    expect(offenseSlots({ 4: [1] })).toEqual([1, 2, 3, 4]);
    expect(offenseSlots({ 9: [1] })).toEqual([1, 2, 3, 4, 5]);
  });
});

describe('formProblem', () => {
  const valid: ViolationFormValues = {
    violationType: 'Loitering',
    severity: 'Minor',
    section: 'VI.D.9',
    description: 'Staying in a restricted area.',
    picks: { 1: [1] },
  };

  test('null for a complete form', () => {
    expect(formProblem(valid)).toBeNull();
  });

  test.each([
    ['name', { violationType: '  ' }, /name/i],
    ['section', { section: '' }, /section/i],
    ['description', { description: ' ' }, /description/i],
  ])('asks for the %s', (_field, override, message) => {
    expect(formProblem({ ...valid, ...override })).toMatch(message);
  });
});
