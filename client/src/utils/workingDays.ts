/**
 * Preview of the appointment window rules (SPEC 4.5) so the form can show the end date and refuse an obvious
 * mistake before a round trip. The API is the authority: it recomputes the end date and re-checks every rule.
 * Pure calendar arithmetic on YYYY-MM-DD strings (UTC), no holidays: only Sundays are skipped.
 */
const DAY_MS = 86_400_000;
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
export const MAX_DAYS_AHEAD = 60;

const toMs = (date: string): number => Date.parse(`${date}T00:00:00Z`);
const fromMs = (ms: number): string => new Date(ms).toISOString().slice(0, 10);

function isRealDate(value: string): boolean {
  return DATE_ONLY.test(value) && !Number.isNaN(toMs(value)) && fromMs(toMs(value)) === value;
}
const isSunday = (date: string): boolean => new Date(toMs(date)).getUTCDay() === 0;

/** Start + 5 more working days (Sundays skipped), or null when `start` is not a real date. */
export function appointmentEndDate(start: string): string | null {
  if (!isRealDate(start)) return null;
  let current = toMs(start);
  let remaining = 5;
  while (remaining > 0) {
    current += DAY_MS;
    if (new Date(current).getUTCDay() !== 0) remaining -= 1;
  }
  return fromMs(current);
}

/** A sentence saying why the start date cannot be used, or null when it can. */
export function startDateProblem(start: string, today: string): string | null {
  if (!isRealDate(start)) return 'Choose a start date.';
  if (start < today) return 'The start date cannot be in the past.';
  if (start > fromMs(toMs(today) + MAX_DAYS_AHEAD * DAY_MS)) return 'The start date can be at most 60 days from today.';
  if (isSunday(start)) return 'The start date cannot be a Sunday.';
  return null;
}
