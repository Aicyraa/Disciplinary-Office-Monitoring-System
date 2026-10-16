import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { createDebouncer, SEARCH_DEBOUNCE_MS } from '@/utils/debounce';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

test('five quick characters make one search, with the full text', () => {
  const searches: string[] = [];
  const debouncer = createDebouncer<string>((q) => searches.push(q));
  for (const text of ['m', 'ma', 'mar', 'mari', 'maria']) {
    debouncer.push(text);
    vi.advanceTimersByTime(80);
  }
  expect(searches).toEqual([]);
  vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS);
  expect(searches).toEqual(['maria']);
});

test('a pause between words searches each time', () => {
  const searches: string[] = [];
  const debouncer = createDebouncer<string>((q) => searches.push(q), 100);
  debouncer.push('ana');
  vi.advanceTimersByTime(100);
  debouncer.push('ana cruz');
  vi.advanceTimersByTime(100);
  expect(searches).toEqual(['ana', 'ana cruz']);
});

test('cancel drops the waiting value', () => {
  const searches: string[] = [];
  const debouncer = createDebouncer<string>((q) => searches.push(q));
  debouncer.push('x');
  debouncer.cancel();
  vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS * 2);
  expect(searches).toEqual([]);
});
