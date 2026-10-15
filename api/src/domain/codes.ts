/**
 * Display codes (UI-POLISH-SPEC decision 3). They are derived when shown and never stored:
 *   sanctions S-021, appointments A-104, violations V-001, handbook entries H-001: letter + hyphen + 3 digits;
 *   cases SDO-<year>-<number>, the number counts from 1 every year (year of `case_date` in Asia/Manila, ordered by id);
 *   gate submissions GI-<1000 + rank> (rank of the submission among all, by its first case).
 * The database keeps its numeric identity ids; only how an id reads changes.
 */
export function displayCode(prefix: 'V' | 'H' | 'S' | 'A', id: number): string {
  return `${prefix}-${String(id).padStart(3, '0')}`;
}

const pad3 = (n: number): string => String(n).padStart(3, '0');

export const formatCaseCode = (year: number, ordinal: number): string => `SDO-${year}-${pad3(ordinal)}`;

/** "SDO-2026-016" (any case, surrounding spaces) -> year and number; anything else -> null. */
export function parseCaseCode(text: string): { year: number; ordinal: number } | null {
  const match = /^SDO-(\d{4})-(\d{1,6})$/i.exec(text.trim());
  if (!match) return null;
  const ordinal = Number(match[2]);
  return ordinal >= 1 ? { year: Number(match[1]), ordinal } : null;
}

export const formatSubmissionCode = (rank: number): string => `GI-${1000 + rank}`;

/** "GI-1042" -> rank 42; anything else (or a number below 1001) -> null. */
export function parseSubmissionCode(text: string): number | null {
  const match = /^GI-(\d{4,7})$/i.exec(text.trim());
  if (!match) return null;
  const rank = Number(match[1]) - 1000;
  return rank >= 1 ? rank : null;
}

const MANILA_OFFSET_MS = 8 * 3_600_000;

/** The calendar year of an instant in Asia/Manila (UTC+8, no daylight saving). */
export function manilaYear(date: Date): number {
  return new Date(date.getTime() + MANILA_OFFSET_MS).getUTCFullYear();
}

/** The same rule the database query applies: number = position among that year's cases, by id. Pure, for fakes and tests. */
export function assignCaseCodes(cases: ReadonlyArray<{ id: number; caseDate: Date }>): Map<number, string> {
  const perYear = new Map<number, number>();
  const codes = new Map<number, string>();
  for (const item of [...cases].sort((a, b) => a.id - b.id)) {
    const year = manilaYear(item.caseDate);
    const next = (perYear.get(year) ?? 0) + 1;
    perYear.set(year, next);
    codes.set(item.id, formatCaseCode(year, next));
  }
  return codes;
}

/** What a case code reads when the id has no code row (a case that no longer exists). */
export const unknownCaseCode = (caseId: number): string => `SDO-0000-${pad3(caseId)}`;
