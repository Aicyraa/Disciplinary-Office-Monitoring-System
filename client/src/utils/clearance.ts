/** "2 of 4 done" for a checklist. */
export function progressLabel(items: ReadonlyArray<{ status: 'pending' | 'completed' }>): string {
  if (items.length === 0) return 'No requirements';
  const done = items.filter((item) => item.status === 'completed').length;
  return `${done} of ${items.length} done`;
}

/** The school year the set-up form starts with: the calendar year of the Manila date (YYYY-MM-DD). Editable. */
export function defaultSchoolYear(manilaDate: string): number {
  return Number(manilaDate.slice(0, 4));
}
