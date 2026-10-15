import type { HandbookEntryView, Severity } from '@shared/types';

/** The staff form for one violation. `picks` maps an offense number to the chosen sanction ids. */
export interface ViolationFormValues {
  violationType: string;
  severity: Severity;
  section: string;
  description: string;
  picks: Record<number, number[]>;
}

export const MIN_OFFENSE_SLOTS = 3;
export const MAX_OFFENSE_NUMBER = 5;

export function toPicks(entry: Pick<HandbookEntryView, 'sanctions'>): Record<number, number[]> {
  const picks: Record<number, number[]> = {};
  for (const sanction of entry.sanctions) {
    (picks[sanction.offenseNumber] ??= []).push(sanction.sanctionId);
  }
  return picks;
}

/** The API's list of `{offenseNumber, sanctionId}`: empty selects (0) and repeats left out. */
export function toSanctionList(picks: Record<number, number[]>): Array<{ offenseNumber: number; sanctionId: number }> {
  return Object.entries(picks)
    .map(([offense, ids]) => [Number(offense), [...new Set(ids.filter((id) => id > 0))]] as const)
    .sort(([a], [b]) => a - b)
    .flatMap(([offenseNumber, ids]) => ids.map((sanctionId) => ({ offenseNumber, sanctionId })));
}

/** Offense numbers the form shows: 1 to 3 always, more when an entry already uses them, at most 5. */
export function offenseSlots(picks: Record<number, number[]>): number[] {
  const highest = Math.min(MAX_OFFENSE_NUMBER, Math.max(MIN_OFFENSE_SLOTS, ...Object.keys(picks).map(Number)));
  return Array.from({ length: highest }, (_, index) => index + 1);
}

export type ViolationFormErrors = { name?: string; section?: string; description?: string };

/** Inline messages of the deck (src 3112 to 3115). The API checks everything again. */
export function formErrors(
  values: ViolationFormValues,
  others: ReadonlyArray<{ id: number; violation: string }>,
  selfId: number | null,
): ViolationFormErrors {
  const errors: ViolationFormErrors = {};
  const name = values.violationType.trim();
  if (!name) errors.name = 'Enter the violation name.';
  else if (others.some((other) => other.id !== selfId && other.violation.trim().toLowerCase() === name.toLowerCase())) {
    errors.name = 'This violation is already in the handbook.';
  }
  if (!values.section.trim()) errors.section = 'Enter the handbook section.';
  if (!values.description.trim()) errors.description = 'Enter what the handbook says.';
  return errors;
}

/** Changed compared with what was loaded; empty selects do not count. */
export function isDirty(values: ViolationFormValues, initial: ViolationFormValues): boolean {
  const shape = (v: ViolationFormValues) =>
    JSON.stringify([v.violationType, v.severity, v.section, v.description, toSanctionList(v.picks)]);
  return shape(values) !== shape(initial);
}

const ORDINALS = ['1st', '2nd', '3rd'];
export const offenseLabel = (offense: number): string => `${ORDINALS[offense - 1] ?? `${offense}th`} offense`;
