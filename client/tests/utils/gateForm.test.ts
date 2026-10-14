import { describe, expect, test } from 'vitest';
import { MIN_FORM_AGE_MS, YEAR_LEVEL_OPTIONS, shortReference, waitBeforeSubmit, type GateFormValues } from '@/utils/gateForm';
import { stepProblem } from '@/validators/gateForm';

const values: GateFormValues = {
  studentId: '2025-1030808',
  name: 'Ana Cruz',
  program: 'BS Computer Science',
  year: '3',
  violationIds: [1],
};

describe('stepProblem', () => {
  test('step 1 (Details): the student id format, a name, a program and a year level', () => {
    expect(stepProblem(1, values)).toBeNull();
    expect(stepProblem(1, { ...values, studentId: '' })).toMatch(/student ID/i);
    expect(stepProblem(1, { ...values, studentId: '2025-123' })).toMatch(/2025-1234567/);
    expect(stepProblem(1, { ...values, name: ' ' })).toMatch(/name/i);
    expect(stepProblem(1, { ...values, name: 'A' })).toMatch(/name/i);
    expect(stepProblem(1, { ...values, program: '' })).toMatch(/program/i);
    expect(stepProblem(1, { ...values, year: '' })).toMatch(/year/i);
  });

  test('step 2 (Violations): at least one violation', () => {
    expect(stepProblem(2, values)).toBeNull();
    expect(stepProblem(2, { ...values, violationIds: [] })).toMatch(/violation/i);
  });

  test('step 3 (Review): everything is checked again', () => {
    expect(stepProblem(3, values)).toBeNull();
    expect(stepProblem(3, { ...values, program: '' })).toMatch(/program/i);
    expect(stepProblem(3, { ...values, violationIds: [] })).toMatch(/violation/i);
  });
});

describe('year levels', () => {
  test('1st to 5th year', () => {
    expect(YEAR_LEVEL_OPTIONS.map((option) => option.label)).toEqual(['1st year', '2nd year', '3rd year', '4th year', '5th year']);
    expect(YEAR_LEVEL_OPTIONS.map((option) => option.value)).toEqual(['1', '2', '3', '4', '5']);
  });
});

describe('shortReference', () => {
  test('the first 8 characters, upper case, the same form the emails use', () => {
    expect(shortReference('3f0c2c1e-8a47-4b8e-9d59-1f2a6b7c9d10')).toBe('3F0C2C1E');
  });
});

describe('waitBeforeSubmit', () => {
  test('waits out the 3 second minimum the API enforces, with a small margin', () => {
    expect(MIN_FORM_AGE_MS).toBe(3_000);
    expect(waitBeforeSubmit(0)).toBe(3_500);
    expect(waitBeforeSubmit(1_000)).toBe(2_500);
    expect(waitBeforeSubmit(3_500)).toBe(0);
    expect(waitBeforeSubmit(60_000)).toBe(0);
  });
});
