export type PagerItem = number | 'gap';

/** Number of pages for `total` items; never below 1 so an empty list still has a page. */
export function pageCount(total: number, pageSize: number): number {
  return Math.max(1, Math.ceil(total / pageSize));
}

export function clampPage(page: number, total: number): number {
  return Math.min(Math.max(1, page), Math.max(1, total));
}

/** The page (1-based) that holds the first matching item, or 1 when it is not in the list (UI-POLISH-SPEC 5.4c). */
export function pageHolding<T>(items: readonly T[], isMatch: (item: T) => boolean, pageSize: number): number {
  const index = items.findIndex(isMatch);
  return index < 0 ? 1 : Math.floor(index / pageSize) + 1;
}

/** Page buttons to draw: every page when few, otherwise first, last and a window around the current page. */
export function pagerItems(current: number, total: number): PagerItem[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  if (current <= 4) return [1, 2, 3, 4, 5, 'gap', total];
  if (current >= total - 3) return [1, 'gap', total - 4, total - 3, total - 2, total - 1, total];
  return [1, 'gap', current - 1, current, current + 1, 'gap', total];
}
