import { useCallback, useEffect, useState } from 'react';
import { ApiError, toApiError } from './api';

export type ApiResource<T> =
  | { status: 'loading' }
  | { status: 'error'; error: ApiError }
  | { status: 'ready'; data: T };

/** Load data on mount and whenever `deps` change. `reload` refetches without changing `deps`. */
export function useApi<T>(load: () => Promise<T>, deps: readonly unknown[]): ApiResource<T> & { reload(): void } {
  const [resource, setResource] = useState<ApiResource<T>>({ status: 'loading' });
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setResource({ status: 'loading' });
    load().then(
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
    // `load` is recreated every render; callers pass the values it depends on as `deps`.
  }, [...deps, tick]);

  const reload = useCallback(() => setTick((value) => value + 1), []);
  return { ...resource, reload };
}
