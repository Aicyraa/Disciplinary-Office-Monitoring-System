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

/** "10:40 AM" in Asia/Manila (the office clock), for "Last checked". */
export function formatClock(date: Date): string {
  return new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Asia/Manila' }).format(date);
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

const MINOR_WORDS = new Set(['a', 'an', 'and', 'as', 'at', 'by', 'for', 'in', 'of', 'on', 'or', 'the', 'to', 'with']);

/**
 * A violation name as every screen shows it: "Unwelcome sexual advances" -> "Unwelcome Sexual Advances".
 * Display only; the stored name is unchanged. Short joining words stay lower case unless they lead, words that
 * already carry a capital (ID, IED, Anti-Hazing) are kept, and each part of a hyphenated word is capitalised.
 */
export function violationTitle(name: string): string {
  let first = true;
  return name.replace(/[^\s/]+/g, (word) => {
    const leading = first;
    first = false;
    if (/[A-Z]/.test(word.slice(1))) return word;
    if (!leading && MINOR_WORDS.has(word.toLowerCase())) return word.toLowerCase();
    return word.replace(/(^|-)([a-z])/g, (_match, dash: string, letter: string) => dash + letter.toUpperCase());
  });
}

const TERM_ORDINALS = ['1st', '2nd', '3rd'] as const;

/** A term is one of three fixed terms of a school year: "1st Term 2026–2027" (en dash, as the deck). */
export function formatTerm(academicYear: number, semester: number): string {
  const ordinal = TERM_ORDINALS[semester - 1] ?? `${semester}th`;
  return `${ordinal} Term ${academicYear}–${academicYear + 1}`;
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

/** What a status is the status of. The same stored word can mean different things (`completed`). */
export type StatusKind = 'case' | 'sanction' | 'appointment' | 'clearance';

/** The words of the design deck. The stored statuses never change; only what the person reads does. */
const KIND_LABELS: Record<StatusKind, Record<string, string>> = {
  case: {
    reported: 'Pending review',
    validated: 'Validated',
    for_sanction: 'Sanction in progress',
    resolved: 'Resolved',
    rejected: 'Not verified',
  },
  sanction: {
    assigned: 'In progress',
    pending_verification: 'Pending verification',
    returned: 'Returned',
    completed: 'Cleared',
  },
  appointment: {
    scheduled: 'Scheduled',
    rescheduled: 'Rescheduled',
    completed: 'Completed',
    cancelled: 'Cancelled',
  },
  clearance: {
    pending: 'In progress',
    cleared: 'Cleared',
  },
};

export function statusLabel(status: string, kind?: StatusKind): string {
  const byKind = kind ? KIND_LABELS[kind][status] : undefined;
  if (byKind) return byKind;
  if (LABELS[status]) return LABELS[status];
  const words = status.replace(/_/g, ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** The four stages a case moves through in the student stepper (rejected is shown as its own state). */
export const CASE_STAGES = ['reported', 'validated', 'for_sanction', 'resolved'] as const;

export function caseStageIndex(status: string): number {
  return CASE_STAGES.indexOf(status as (typeof CASE_STAGES)[number]);
}

/** The four steps of a sanction in the tracker (design deck): Assigned, In progress, Complied, Verified. */
export const SANCTION_STEP_LABELS = ['Assigned', 'In progress', 'Complied', 'Verified'] as const;

/**
 * Where a sanction is on that tracker. A sanction the student is working on (`assigned`, or `returned` to fix) is at
 * "In progress"; proof sent is "Complied"; verified by staff is "Verified".
 */
export function sanctionStepIndex(status: string): number {
  if (status === 'completed') return 3;
  if (status === 'pending_verification') return 2;
  return 1;
}
