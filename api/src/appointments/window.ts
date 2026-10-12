/**
 * Appointment window rules (SPEC 4.5, FEATURE-RULES 3.8). Pure calendar arithmetic on YYYY-MM-DD strings (UTC
 * math, so no time zone or daylight saving can shift a date). "Today" is supplied by the caller in Asia/Manila.
 * There is no holiday list in version 1: only Sundays are skipped.
 */

export const MAX_DAYS_AHEAD = 60;
/** The window covers the start day plus this many more working days. */
const EXTRA_WORKING_DAYS = 5;
const DAY_MS = 86_400_000;
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

const toMs = (date: string): number => Date.parse(`${date}T00:00:00Z`);
const fromMs = (ms: number): string => new Date(ms).toISOString().slice(0, 10);

/** True for a real calendar date written as YYYY-MM-DD. */
export function isRealDate(value: string): boolean {
  if (!DATE_ONLY.test(value)) return false;
  const ms = toMs(value);
  return !Number.isNaN(ms) && fromMs(ms) === value;
}

export function isSunday(date: string): boolean {
  return new Date(toMs(date)).getUTCDay() === 0;
}

export function addDays(date: string, days: number): string {
  return fromMs(toMs(date) + days * DAY_MS);
}

/** `end_date` = start + 5 more working days, Sundays skipped (6 working days in all, Mon to Sat). */
export function endDateFor(start: string): string {
  let current = start;
  let remaining = EXTRA_WORKING_DAYS;
  while (remaining > 0) {
    current = addDays(current, 1);
    if (!isSunday(current)) remaining -= 1;
  }
  return current;
}

export type StartDateCheck = { ok: true } | { ok: false; reason: 'format' | 'past' | 'too_far' | 'sunday' };

/** Today .. today + 60 days, and never a Sunday. */
export function checkStartDate(start: string, today: string): StartDateCheck {
  if (!isRealDate(start)) return { ok: false, reason: 'format' };
  if (start < today) return { ok: false, reason: 'past' };
  if (start > addDays(today, MAX_DAYS_AHEAD)) return { ok: false, reason: 'too_far' };
  if (isSunday(start)) return { ok: false, reason: 'sunday' };
  return { ok: true };
}

export interface DateWindow {
  startDate: string;
  endDate: string;
}

/** Inclusive on both ends, the same as `daterange(start, end, '[]')` in the database constraint. */
export function windowsOverlap(a: DateWindow, b: DateWindow): boolean {
  return a.startDate <= b.endDate && b.startDate <= a.endDate;
}
