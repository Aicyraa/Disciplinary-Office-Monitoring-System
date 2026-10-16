import { useEffect, useRef, useState } from 'react';
import { createDebouncer, SEARCH_DEBOUNCE_MS } from '@/utils/debounce';

/** `value`, but only once it has stopped changing for `ms` (a search box asks the API once per pause, not per key). */
export function useDebouncedValue<T>(value: T, ms: number = SEARCH_DEBOUNCE_MS): T {
  const [settled, setSettled] = useState(value);
  const debouncer = useRef(createDebouncer<T>(setSettled, ms));
  useEffect(() => {
    debouncer.current.push(value);
  }, [value]);
  useEffect(() => () => debouncer.current.cancel(), []);
  return settled;
}
