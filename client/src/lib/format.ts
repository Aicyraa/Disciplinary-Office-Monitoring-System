const MANILA = 'Asia/Manila';

/** Timestamps arrive as UTC ISO strings; display in Asia/Manila (SPEC decision). */
export function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat('en-PH', {
    timeZone: MANILA,
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(iso));
}

/** Accepts a full ISO timestamp or a date-only `YYYY-MM-DD` string. */
export function formatDate(value: string): string {
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value);
  // A date-only value is a calendar day: pin it to UTC so no time zone shifts it.
  return new Intl.DateTimeFormat('en-PH', {
    timeZone: dateOnly ? 'UTC' : MANILA,
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(new Date(dateOnly ? `${value}T00:00:00Z` : value));
}

export function formatTerm(academicYear: number, semester: number): string {
  return `${academicYear}-${academicYear + 1}, Semester ${semester}`;
}

export type PillTone = { bg: string; fg: string };

const PENDING: PillTone = { bg: '#FDF3D3', fg: '#7A5A00' };
const INFO: PillTone = { bg: '#E8EBF7', fg: '#2B347A' };
const ACTION: PillTone = { bg: '#FCE9C6', fg: '#7A4600' };
const DONE: PillTone = { bg: '#E2F3E8', fg: '#1E6B3E' };
const BAD: PillTone = { bg: '#F7E6E6', fg: '#9B2C2C' };
const NEUTRAL: PillTone = { bg: '#ECEEF1', fg: '#4A5260' };

/**
 * Status pill colors, exactly SPEC 9. `assigned` and `scheduled` are not listed in the spec; they reuse the
 * pending and validated tones (recorded as an assumption in CONTEXT.md).
 */
const TONES: Record<string, PillTone> = {
  pending: PENDING,
  reported: PENDING,
  assigned: PENDING,
  validated: INFO,
  Minor: INFO,
  scheduled: INFO,
  for_sanction: ACTION,
  pending_verification: ACTION,
  rescheduled: ACTION,
  resolved: DONE,
  completed: DONE,
  cleared: DONE,
  Major: BAD,
  returned: BAD,
  rejected: NEUTRAL,
  cancelled: NEUTRAL,
  expired: NEUTRAL,
};

const LABELS: Record<string, string> = {
  rejected: 'Not verified',
  for_sanction: 'For sanction',
  pending_verification: 'Pending verification',
};

export function pillTone(status: string): PillTone {
  return TONES[status] ?? NEUTRAL;
}

export function statusLabel(status: string): string {
  if (LABELS[status]) return LABELS[status];
  const words = status.replace(/_/g, ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** The four stages a case moves through in the student stepper (rejected is shown as its own state). */
export const CASE_STAGES = ['reported', 'validated', 'for_sanction', 'resolved'] as const;

export function caseStageIndex(status: string): number {
  return CASE_STAGES.indexOf(status as (typeof CASE_STAGES)[number]);
}

/** The four steps of a sanction in the student tracker. */
export const SANCTION_STEPS = ['assigned', 'pending_verification', 'returned', 'completed'] as const;
