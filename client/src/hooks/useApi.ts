import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError, toApiError } from '@/api/client';
import { isStale } from '@/utils/revalidate';

export type ApiResource<T> =
  | { status: 'loading' }
  | { status: 'error'; error: ApiError }
  | { status: 'ready'; data: T };

/**
 * Load data on mount and whenever `deps` change (the screen shows "loading" then).
 * `reload` refetches without changing `deps` and keeps the current data on screen until the new data arrives,
 * so components below it (and their local state, such as a success message) stay mounted.
 * Only the most recent request may update the screen: a slow earlier response is ignored.
 *
 * Near-live data: when the tab becomes visible or the window regains focus and the data is older than
 * `STALE_AFTER_MS`, it is refetched quietly. The screen keeps the old data meanwhile, and a failed quiet
 * refresh keeps it too (only a manual `reload` or a `deps` change can show the error state).
 * Pass `{ revalidateOnFocus: false }` for a screen that holds an unsaved form over its data.
 */
export function useApi<T>(
  load: () => Promise<T>,
  deps: readonly unknown[],
  options: { revalidateOnFocus?: boolean } = {},
): ApiResource<T> & { reload(): void } {
  const revalidateOnFocus = options.revalidateOnFocus ?? true;
  const [resource, setResource] = useState<ApiResource<T>>({ status: 'loading' });
  const [tick, setTick] = useState(0);
  // `load` is recreated every render; the effects read the latest one through this ref and are driven by
  // `deps` and `tick` only.
  const loadRef = useRef(load);
  loadRef.current = load;
  const latestRequest = useRef(0);
  const loadedAt = useRef<number | null>(null);
  const quietRefresh = useRef(false);

  const fetchInto = useCallback((isCancelled: () => boolean, quiet = false) => {
    const requestId = ++latestRequest.current;
    const current = () => !isCancelled() && requestId === latestRequest.current;
    loadRef.current().then(
      (data) => {
        if (!current()) return;
        loadedAt.current = Date.now();
        setResource({ status: 'ready', data });
      },
      (error: unknown) => {
        if (current() && !quiet) setResource({ status: 'error', error: toApiError(error) });
      },
    );
  }, []);

  useEffect(() => {
    let cancelled = false;
    loadedAt.current = null;
    setResource({ status: 'loading' });
    fetchInto(() => cancelled);
    return () => {
      cancelled = true;
    };
  }, deps);

  useEffect(() => {
    if (tick === 0) return;
    let cancelled = false;
    const quiet = quietRefresh.current;
    quietRefresh.current = false;
    // Keep ready data visible while refetching; an error or loading state is replaced by loading.
    setResource((current) => (current.status === 'ready' ? current : { status: 'loading' }));
    fetchInto(() => cancelled, quiet);
    return () => {
      cancelled = true;
    };
  }, [tick]);

  const reload = useCallback(() => setTick((value) => value + 1), []);

  useEffect(() => {
    if (!revalidateOnFocus) return;
    const revalidate = () => {
      if (document.visibilityState !== 'visible' || !isStale(loadedAt.current, Date.now())) return;
      quietRefresh.current = true;
      setTick((value) => value + 1);
    };
    document.addEventListener('visibilitychange', revalidate);
    window.addEventListener('focus', revalidate);
    return () => {
      document.removeEventListener('visibilitychange', revalidate);
      window.removeEventListener('focus', revalidate);
    };
  }, [revalidateOnFocus]);

  return { ...resource, reload };
}
