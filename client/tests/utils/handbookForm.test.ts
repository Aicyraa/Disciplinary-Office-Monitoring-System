import { describe, expect, test } from 'vitest';
import type { HandbookEntryView } from '@shared/types';
import { formErrors, isDirty, offenseLabel, offenseSlots, toPicks, toSanctionList, type ViolationFormValues } from '@/utils/handbookForm';

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

describe('form checks (deck src 3110 to 3116, UI-POLISH-SPEC 5.11)', () => {
  const valid: ViolationFormValues = {
    violationType: 'Loitering',
    severity: 'Minor',
    section: 'VI.D.9',
    description: 'Staying in a restricted area.',
    picks: { 1: [1] },
  };
  const others = [{ id: 7, violation: 'Improper uniform' }];

  test('no errors for a complete form', () => {
    expect(formErrors(valid, others, null)).toEqual({});
  });

  test('inline messages for each field', () => {
    expect(formErrors({ ...valid, violationType: ' ', section: '', description: ' ' }, others, null)).toEqual({
      name: 'Enter the violation name.',
      section: 'Enter the handbook section.',
      description: 'Enter what the handbook says.',
    });
  });

  test('a name already in the handbook (any case) is refused, except the entry itself', () => {
    expect(formErrors({ ...valid, violationType: 'improper UNIFORM' }, others, null).name).toBe('This violation is already in the handbook.');
    expect(formErrors({ ...valid, violationType: 'Improper uniform' }, others, 7)).toEqual({});
  });
});

describe('selects per offense (D13)', () => {
  test('empty selects and repeats are dropped from what is sent', () => {
    expect(toSanctionList({ 1: [0, 2, 2], 2: [0] })).toEqual([{ offenseNumber: 1, sanctionId: 2 }]);
  });

  test('dirty compares what would be sent, not empty selects', () => {
    const base: ViolationFormValues = { violationType: 'A', severity: 'Minor', section: 'S', description: 'D', picks: { 1: [1] } };
    expect(isDirty({ ...base, picks: { 1: [1, 0] } }, base)).toBe(false);
    expect(isDirty({ ...base, picks: { 1: [1], 2: [3] } }, base)).toBe(true);
    expect(isDirty({ ...base, section: 'T' }, base)).toBe(true);
  });

  test('offense labels', () => {
    expect([1, 2, 3, 4].map(offenseLabel)).toEqual(['1st offense', '2nd offense', '3rd offense', '4th offense']);
  });
});
