import type { GateFormValues } from '@/utils/gateForm';
import { isStudentId } from './studentId';

/**
 * A sentence for what is missing on a step, or null. The API checks everything again.
 * Steps follow the design deck: 1 Details (ID, name, program, year level), 2 Violations, 3 Review (all of it).
 */
export function stepProblem(step: 1 | 2 | 3, values: GateFormValues): string | null {
  const details = (): string | null => {
    const id = values.studentId.trim();
    if (id === '') return 'Enter the student ID.';
    if (!isStudentId(id)) return 'Use the student ID format 2025-1234567.';
    if (values.name.trim().length < 2) return 'Enter the student name.';
    if (values.program.trim() === '') return 'Choose the program.';
    if (!/^[1-5]$/.test(values.year)) return 'Choose the year level.';
    return null;
  };
  const violations = (): string | null => (values.violationIds.length > 0 ? null : 'Choose at least one violation.');
  if (step === 1) return details();
  if (step === 2) return violations();
  return details() ?? violations();
}

export type DetailsErrors = Partial<Record<'studentId' | 'name' | 'program' | 'year', string>>;

/** Step 1 shows one message under each field that needs it (deck W08, src 3336). */
export function detailsErrors(values: GateFormValues): DetailsErrors {
  const errors: DetailsErrors = {};
  const id = values.studentId.trim();
  if (id === '') errors.studentId = 'Enter your student ID.';
  else if (!isStudentId(id)) errors.studentId = 'Use the format 2025-1234567.';
  if (values.name.trim().length < 3) errors.name = 'Enter your full name.';
  if (values.program.trim() === '') errors.program = 'Choose your program.';
  if (!/^[1-5]$/.test(values.year)) errors.year = 'Choose your year level.';
  return errors;
}

export function violationsError(ids: number[]): string | null {
  return ids.length > 0 ? null : 'Pick at least one violation.';
}
