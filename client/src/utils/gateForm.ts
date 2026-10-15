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

/** Year level as five pill buttons (deck W07). */
export const YEAR_PILLS = YEAR_LEVEL_OPTIONS.map((option) => ({ value: option.value, label: option.label.replace(' year', '') }));

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
