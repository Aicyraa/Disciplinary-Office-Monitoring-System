import type { HandbookEntryView, Severity } from '@shared/types';

/** Staff Record violation (deck W33 to W35, src 2783 to 2819). The API owns every rule; these only guide. */

type Progress = { studentFound: boolean; violationPicked: boolean };

export function recordHelp({ studentFound, violationPicked }: Progress): string {
  if (!studentFound) return 'Enter a valid student ID, e.g. 2025-1234567.';
  if (!violationPicked) return 'Pick a violation to save.';
  return 'Staff reports are saved as validated.';
}

/** The error toast of a blocked "Save case", or null when the form can be sent. */
export function recordProblem({ studentFound, violationPicked }: Progress): string | null {
  if (!studentFound) return 'Enter a valid student ID before saving.';
  if (!violationPicked) return 'Pick a violation before saving.';
  return null;
}

type Entry = Pick<HandbookEntryView, 'id' | 'violation' | 'severity' | 'section'>;
export type ClassFilter = Severity | '';

const matches = (entry: Entry, needle: string): boolean =>
  !needle || `${entry.violation} ${entry.section} ${entry.severity}`.toLowerCase().includes(needle);

export function matchViolations<T extends Entry>(entries: readonly T[], query: string, cls: ClassFilter): T[] {
  const needle = query.trim().toLowerCase();
  return entries.filter((entry) => matches(entry, needle) && (cls === '' || entry.severity === cls));
}

/** Counts on the All / Minor / Major chips: how many search hits each would show. */
export function violationCounts(entries: readonly Entry[], query: string): Record<ClassFilter, number> {
  const hits = matchViolations(entries, query, '');
  return { '': hits.length, Minor: hits.filter((e) => e.severity === 'Minor').length, Major: hits.filter((e) => e.severity === 'Major').length };
}

export function recordedToast(code: string, name: string, converted: boolean): string {
  return `Case ${code} recorded for ${name}.${converted ? ' It is the 3rd minor and is treated as Major.' : ''}`;
}
