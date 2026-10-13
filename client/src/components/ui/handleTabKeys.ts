import type { KeyboardEvent } from 'react';
import { nextTabIndex } from '@/utils/tabKeys';

/** One option of a tab-like group (ChipGroup, SegmentedTabs). */
export type TabOption = { value: string; label: string; count?: number };

/**
 * Arrow / Home / End keys on a `role=tablist` select and focus the neighbouring tab (WAI-ARIA tabs pattern).
 * Attach to the tablist; the tabs are found by `role=tab`.
 */
export function handleTabKeys(
  event: KeyboardEvent<HTMLElement>,
  options: readonly TabOption[],
  value: string,
  onChange: (value: string) => void,
): void {
  const next = nextTabIndex(event.key, options.findIndex((option) => option.value === value), options.length);
  if (next === null) return;
  event.preventDefault();
  onChange(options[next].value);
  event.currentTarget.querySelectorAll<HTMLElement>('[role="tab"]')[next]?.focus();
}

/** Roving tabindex: the selected tab (or the first when nothing matches) is the one Tab stops on. */
export function tabStopIndex(options: readonly TabOption[], value: string): number {
  const index = options.findIndex((option) => option.value === value);
  return index < 0 ? 0 : index;
}
