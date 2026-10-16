/** Wait after the last keystroke before a search asks the API (PERFORMANCE-SPEC F7). */
export const SEARCH_DEBOUNCE_MS = 250;

export interface Debouncer<T> {
  /** Replace any waiting value; `onSettle` gets the last one once `ms` pass with no new call. */
  push(value: T): void;
  cancel(): void;
}

export function createDebouncer<T>(onSettle: (value: T) => void, ms: number = SEARCH_DEBOUNCE_MS): Debouncer<T> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const cancel = () => {
    if (timer !== null) clearTimeout(timer);
    timer = null;
  };
  return {
    push(value) {
      cancel();
      timer = setTimeout(() => {
        timer = null;
        onSettle(value);
      }, ms);
    },
    cancel,
  };
}
