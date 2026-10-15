/** How old loaded data may get before coming back to the tab refreshes it (near-live data, no push). */
export const STALE_AFTER_MS = 30_000;

/** How often the unread badge is polled while the tab is visible. */
export const BADGE_POLL_MS = 60_000;

/**
 * A page that was hidden or unfocused refreshes when it returns, but only if its data is older than
 * `staleAfterMs`. Quick tab flips do not cost a request. `loadedAt` is null before the first successful load.
 */
export function isStale(loadedAt: number | null, now: number, staleAfterMs: number = STALE_AFTER_MS): boolean {
  return loadedAt !== null && now - loadedAt >= staleAfterMs;
}

/** Polling runs only while the tab is visible, so an idle background tab never wakes the database. */
export function shouldPoll(visibility: DocumentVisibilityState): boolean {
  return visibility === 'visible';
}
