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

/** The API's list of `{offenseNumber, sanctionId}`, without empty offenses. */
export function toSanctionList(picks: Record<number, number[]>): Array<{ offenseNumber: number; sanctionId: number }> {
  return Object.entries(picks)
    .map(([offense, ids]) => [Number(offense), ids] as const)
    .sort(([a], [b]) => a - b)
    .flatMap(([offenseNumber, ids]) => ids.map((sanctionId) => ({ offenseNumber, sanctionId })));
}

/** Offense numbers the form shows: 1 to 3 always, more when an entry already uses them, at most 5. */
export function offenseSlots(picks: Record<number, number[]>): number[] {
  const highest = Math.min(MAX_OFFENSE_NUMBER, Math.max(MIN_OFFENSE_SLOTS, ...Object.keys(picks).map(Number)));
  return Array.from({ length: highest }, (_, index) => index + 1);
}

/** A sentence for the first missing field, or null. The API checks everything again. */
export function formProblem(values: ViolationFormValues): string | null {
  if (values.violationType.trim() === '') return 'Enter the violation name.';
  if (values.section.trim() === '') return 'Enter the handbook section, for example VI.D.1.';
  if (values.description.trim() === '') return 'Enter the description.';
  return null;
}
