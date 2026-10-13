/** The API refuses a form submitted sooner than this after it opened (SPEC 4.10). */
export const MIN_FORM_AGE_MS = 3_000;
const MARGIN_MS = 500;

export interface GateFormValues {
  studentId: string;
  name: string;
  program: string;
  /** '1' to '5'. */
  year: string;
  violationIds: number[];
}

export const YEAR_LEVEL_OPTIONS = [
  { value: '1', label: '1st year' },
  { value: '2', label: '2nd year' },
  { value: '3', label: '3rd year' },
  { value: '4', label: '4th year' },
  { value: '5', label: '5th year' },
] as const;

/**
 * A sentence for what is missing on a step, or null. The API checks everything again.
 * Steps follow the design deck: 1 Details (ID, name, program, year level), 2 Violations, 3 Review (all of it).
 */
export function stepProblem(step: 1 | 2 | 3, values: GateFormValues): string | null {
  const details = (): string | null => {
    const id = values.studentId.trim();
    if (id === '') return 'Enter the student ID.';
    if (!/^\d{4}-\d{7}$/.test(id)) return 'Use the student ID format 2025-1234567.';
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

/** Year level as five pill buttons (deck W07). */
export const YEAR_PILLS = YEAR_LEVEL_OPTIONS.map((option) => ({ value: option.value, label: option.label.replace(' year', '') }));

export type DetailsErrors = Partial<Record<'studentId' | 'name' | 'program' | 'year', string>>;

/** Step 1 shows one message under each field that needs it (deck W08, src 3336). */
export function detailsErrors(values: GateFormValues): DetailsErrors {
  const errors: DetailsErrors = {};
  const id = values.studentId.trim();
  if (id === '') errors.studentId = 'Enter your student ID.';
  else if (!/^\d{4}-\d{7}$/.test(id)) errors.studentId = 'Use the format 2025-1234567.';
  if (values.name.trim().length < 3) errors.name = 'Enter your full name.';
  if (values.program.trim() === '') errors.program = 'Choose your program.';
  if (!/^[1-5]$/.test(values.year)) errors.year = 'Choose your year level.';
  return errors;
}

export function violationsError(ids: number[]): string | null {
  return ids.length > 0 ? null : 'Pick at least one violation.';
}

export type GateCategory = 'All' | 'Minor' | 'Major';
export interface GateViolation {
  id: number;
  name: string;
  section: string;
  category: 'Minor' | 'Major';
}

const matches = (violation: GateViolation, query: string): boolean => {
  const needle = query.trim().toLowerCase();
  return needle === '' || `${violation.name} ${violation.section}`.toLowerCase().includes(needle);
};

/** Step 2 list: the search over name and section, then the All / Minor / Major tab. */
export function filterGateViolations(list: GateViolation[], query: string, category: GateCategory): GateViolation[] {
  return list.filter((violation) => matches(violation, query) && (category === 'All' || violation.category === category));
}

/** The counts on the All / Minor / Major tabs, after the search. */
export function categoryCounts(list: GateViolation[], query: string): Record<GateCategory, number> {
  const found = list.filter((violation) => matches(violation, query));
  return {
    All: found.length,
    Minor: found.filter((violation) => violation.category === 'Minor').length,
    Major: found.filter((violation) => violation.category === 'Major').length,
  };
}

/** The reference people see and quote: the first 8 characters of the submission uuid, in capitals. */
export const shortReference = (reference: string): string => reference.slice(0, 8).toUpperCase();

/** How long to wait before sending so the form is old enough for the API's minimum (never negative). */
export function waitBeforeSubmit(formAgeMs: number): number {
  return Math.max(0, MIN_FORM_AGE_MS + MARGIN_MS - formAgeMs);
}
