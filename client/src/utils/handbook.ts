import type { HandbookEntryView, SanctionTemplateView, Severity } from '@shared/types';
import { offenseLabel } from './handbookForm';
import { templateState } from './templates';

/** The Student Handbook (deck W80, W81; src 3087 to 3097). */

export const HANDBOOK_PER_PAGE = 6;

export type HandbookClass = 'all' | Severity;

export function firstSanctionText(entry: Pick<HandbookEntryView, 'sanctions'>): string {
  const first = [...entry.sanctions].sort((a, b) => a.offenseNumber - b.offenseNumber)[0];
  return first ? `${first.type} (${offenseLabel(first.offenseNumber).replace(' offense', '')})` : 'No sanction listed';
}

export function filterHandbook<T extends HandbookEntryView>(entries: readonly T[], query: string, cls: HandbookClass): T[] {
  const needle = query.trim().toLowerCase();
  return entries.filter(
    (entry) =>
      (cls === 'all' || entry.severity === cls) &&
      (!needle || [entry.violation, entry.section, ...entry.sanctions.map((s) => s.type)].join(' ').toLowerCase().includes(needle)),
  );
}

export function handbookTiles(entries: ReadonlyArray<Pick<HandbookEntryView, 'severity'>>): Array<{ key: HandbookClass; label: string; count: number }> {
  return [
    { key: 'all', label: 'All offenses', count: entries.length },
    { key: 'Minor', label: 'Minor offenses', count: entries.filter((e) => e.severity === 'Minor').length },
    { key: 'Major', label: 'Major offenses', count: entries.filter((e) => e.severity === 'Major').length },
  ];
}

/** "1st offense: Violation slip", one line per offense, several sanctions joined. */
export function ladder(entry: Pick<HandbookEntryView, 'sanctions'>): Array<{ label: string; text: string }> {
  const offenses = [...new Set(entry.sanctions.map((s) => s.offenseNumber))].sort((a, b) => a - b);
  return offenses.map((offense) => ({
    label: offenseLabel(offense),
    text: entry.sanctions
      .filter((s) => s.offenseNumber === offense)
      .map((s) => s.type)
      .join(', '),
  }));
}

/** The templates a student can use for this entry: a file or written requirements, in ladder order. */
export function postedTemplates(entry: Pick<HandbookEntryView, 'sanctions'>, templates: readonly SanctionTemplateView[]): SanctionTemplateView[] {
  const order = [...new Set([...entry.sanctions].sort((a, b) => a.offenseNumber - b.offenseNumber).map((s) => s.sanctionId))];
  return order.flatMap((id) => {
    const template = templates.find((t) => t.sanctionId === id);
    return template && templateState(template).posted ? [template] : [];
  });
}
