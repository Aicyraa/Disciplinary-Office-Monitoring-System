import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError, toApiError } from '@/api/client';

export type ApiResource<T> =
  | { status: 'loading' }
  | { status: 'error'; error: ApiError }
  | { status: 'ready'; data: T };

/**
 * Load data on mount and whenever `deps` change (the screen shows "loading" then).
 * `reload` refetches without changing `deps` and keeps the current data on screen until the new data arrives,
 * so components below it (and their local state, such as a success message) stay mounted.
 * Only the most recent request may update the screen: a slow earlier response is ignored.
 */
export function useApi<T>(load: () => Promise<T>, deps: readonly unknown[]): ApiResource<T> & { reload(): void } {
  const [resource, setResource] = useState<ApiResource<T>>({ status: 'loading' });
  const [tick, setTick] = useState(0);
  // `load` is recreated every render; the effects read the latest one through this ref and are driven by
  // `deps` and `tick` only.
  const loadRef = useRef(load);
  loadRef.current = load;
  const latestRequest = useRef(0);

  const fetchInto = useCallback((isCancelled: () => boolean) => {
    const requestId = ++latestRequest.current;
    const current = () => !isCancelled() && requestId === latestRequest.current;
    loadRef.current().then(
      (data) => {
        if (current()) setResource({ status: 'ready', data });
      },
      (error: unknown) => {
        if (current()) setResource({ status: 'error', error: toApiError(error) });
      },
    );
  }, []);

  useEffect(() => {
    let cancelled = false;
    setResource({ status: 'loading' });
    fetchInto(() => cancelled);
    return () => {
      cancelled = true;
    };
  }, deps);

  useEffect(() => {
    if (tick === 0) return;
    let cancelled = false;
    // Keep ready data visible while refetching; an error or loading state is replaced by loading.
    setResource((current) => (current.status === 'ready' ? current : { status: 'loading' }));
    fetchInto(() => cancelled);
    return () => {
      cancelled = true;
    };
  }, [tick]);

  const reload = useCallback(() => setTick((value) => value + 1), []);
  return { ...resource, reload };
}
