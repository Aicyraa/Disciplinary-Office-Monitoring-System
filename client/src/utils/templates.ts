import type { HandbookEntryView, SanctionTemplateView, Severity } from '@shared/types';

/** Staff Sanction templates (deck W47 to W49, src 3130 to 3156). */

export type TemplateFilter = 'all' | Severity | 'posted' | 'missing';

/** "Posted" means a file or written requirements (src 3132); a title alone is not something a student can use. */
export function templateState(t: Pick<SanctionTemplateView, 'files' | 'requirements'>): {
  text: string;
  icon: 'task' | 'checklist' | 'draft';
  tone: 'done' | 'info' | 'none';
  posted: boolean;
} {
  const hasFile = t.files.length > 0;
  const hasReq = Boolean(t.requirements?.trim());
  if (hasFile) return { text: `Template posted${hasReq ? ' · with requirements' : ''}`, icon: 'task', tone: 'done', posted: true };
  if (hasReq) return { text: 'Requirements only', icon: 'checklist', tone: 'info', posted: true };
  return { text: 'Nothing posted yet', icon: 'draft', tone: 'none', posted: false };
}

/** Sanctions carry no category of their own: it is the category of the violations whose ladder lists them. */
export function sanctionCategories(sanctionId: number, entries: ReadonlyArray<Pick<HandbookEntryView, 'severity' | 'sanctions'>>): Severity[] {
  const found = new Set(entries.filter((e) => e.sanctions.some((s) => s.sanctionId === sanctionId)).map((e) => e.severity));
  return (['Minor', 'Major'] as const).filter((c) => found.has(c));
}

export function categoryMeta(categories: readonly Severity[]): string {
  if (categories.length === 0) return 'Not listed for any violation yet';
  if (categories.length === 2) return 'Minor and major offense sanction';
  return `${categories[0]} offense sanction`;
}

const matches = (t: SanctionTemplateView, entries: ReadonlyArray<Pick<HandbookEntryView, 'severity' | 'sanctions'>>, filter: TemplateFilter): boolean => {
  if (filter === 'all') return true;
  if (filter === 'posted') return templateState(t).posted;
  if (filter === 'missing') return !templateState(t).posted;
  return sanctionCategories(t.sanctionId, entries).includes(filter);
};

export function filterTemplatesBy(
  templates: readonly SanctionTemplateView[],
  entries: ReadonlyArray<Pick<HandbookEntryView, 'severity' | 'sanctions'>>,
  filter: TemplateFilter,
): SanctionTemplateView[] {
  return templates.filter((t) => matches(t, entries, filter));
}

export function templateFilters(
  templates: readonly SanctionTemplateView[],
  entries: ReadonlyArray<Pick<HandbookEntryView, 'severity' | 'sanctions'>>,
): Array<{ value: TemplateFilter; label: string; count: number }> {
  const options: Array<[TemplateFilter, string]> = [
    ['all', 'All'],
    ['Minor', 'Minor'],
    ['Major', 'Major'],
    ['posted', 'Posted'],
    ['missing', 'Not posted'],
  ];
  return options.map(([value, label]) => ({ value, label, count: filterTemplatesBy(templates, entries, value).length }));
}

export function templateToasts(name: string) {
  return {
    uploaded: `Template uploaded for ${name}.`,
    replaced: `Template replaced for ${name}.`,
    removed: 'Template file removed.',
    saved: `Saved the template details for ${name}.`,
  };
}
