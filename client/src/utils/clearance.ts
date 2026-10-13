import type { ClearanceRosterRow, StaffClearanceView, TermRef } from '@shared/types';
import type { HistoryItem } from '@/components/ui/HistoryList';

/** Staff Clearance (deck W50 to W56, src 2874 to 2904). The API owns every rule. */

/** `?term=2026-1`. */
export const termParam = (term: TermRef): string => `${term.academicYear}-${term.semester}`;

export function parseTermParam(value: string | null): TermRef | null {
  const match = /^(\d{4})-([123])$/.exec(value ?? '');
  return match ? { academicYear: Number(match[1]), semester: Number(match[2]) } : null;
}

/** The right side of a roster row: "1 / 4" (green when complete) or "Not set" (grey). */
export function rosterProgress(clearance: ClearanceRosterRow['clearance']): { text: string; tone: 'ink' | 'done' | 'muted' } {
  if (!clearance) return { text: 'Not set', tone: 'muted' };
  return { text: `${clearance.done} / ${clearance.total}`, tone: clearance.total > 0 && clearance.done === clearance.total ? 'done' : 'ink' };
}

export function clearanceStatus(clearance: Pick<StaffClearanceView, 'status'> | null): 'Not set' | 'In progress' | 'Cleared' {
  if (!clearance) return 'Not set';
  return clearance.status === 'cleared' ? 'Cleared' : 'In progress';
}

const longDate = (iso: string): string =>
  new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(iso));

function sentence(entry: StaffClearanceView['history'][number]): string {
  const item = `“${entry.requirement ?? 'requirement'}”`;
  switch (entry.eventType) {
    case 'set_up':
      return 'Clearance set up with the standard requirements';
    case 'marked_done':
      return `Marked ${item} done`;
    case 'reversed':
      return entry.remarks ? `Reversed ${item}: ${entry.remarks}` : `Reversed ${item}`;
    case 'requirement_added':
      return `Added requirement ${item}`;
    case 'requirement_removed':
      return `Removed requirement ${item}`;
  }
}

export function clearanceHistoryItems(view: Pick<StaffClearanceView, 'history'>): HistoryItem[] {
  return view.history.map((entry, index) => ({ id: index, date: longDate(entry.date), text: sentence(entry), by: entry.by })).reverse();
}

export function clearanceCopy(name: string, term: string) {
  return {
    setUp: `Clearance set up for ${name}.`,
    marked: (label: string) => `Marked “${label}” done for ${name}.`,
    reversed: (label: string) => `Reversed “${label}”.`,
    removed: (label: string) => `Removed “${label}”.`,
    added: 'Requirement added.',
    removeBody: `It is removed from ${name}’s checklist for ${term}. The change is saved to the log.`,
    addBody: `It is added to ${name}’s checklist for ${term}.`,
  };
}
