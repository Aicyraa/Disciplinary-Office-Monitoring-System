import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError, toApiError } from './api';

export type ApiResource<T> =
  | { status: 'loading' }
  | { status: 'error'; error: ApiError }
  | { status: 'ready'; data: T };

/**
 * Load data on mount and whenever `deps` change (the screen shows "loading" then).
 * `reload` refetches without changing `deps` and keeps the current data on screen until the new data arrives,
 * so components below it (and their local state, such as a success message) stay mounted.
 */
export function useApi<T>(load: () => Promise<T>, deps: readonly unknown[]): ApiResource<T> & { reload(): void } {
  const [resource, setResource] = useState<ApiResource<T>>({ status: 'loading' });
  const [tick, setTick] = useState(0);
  // `load` is recreated every render; the effects read the latest one through this ref and are driven by
  // `deps` and `tick` only.
  const loadRef = useRef(load);
  loadRef.current = load;

  useEffect(() => {
    let cancelled = false;
    setResource({ status: 'loading' });
    loadRef.current().then(
      (data) => {
        if (!cancelled) setResource({ status: 'ready', data });
      },
      (error: unknown) => {
        if (!cancelled) setResource({ status: 'error', error: toApiError(error) });
      },
    );
    return () => {
      cancelled = true;
    };
  }, deps);

  useEffect(() => {
    if (tick === 0) return;
    let cancelled = false;
    // Keep ready data visible while refetching; an error or loading state is replaced by loading.
    setResource((current) => (current.status === 'ready' ? current : { status: 'loading' }));
    loadRef.current().then(
      (data) => {
        if (!cancelled) setResource({ status: 'ready', data });
      },
      (error: unknown) => {
        if (!cancelled) setResource({ status: 'error', error: toApiError(error) });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [tick]);

  const reload = useCallback(() => setTick((value) => value + 1), []);
  return { ...resource, reload };
}
