import { describe, expect, test } from 'vitest';
import { isStale, shouldPoll, STALE_AFTER_MS } from '@/utils/revalidate';

describe('isStale', () => {
  test('never loaded: not stale (the first load is already in flight)', () => {
    expect(isStale(null, 1_000_000)).toBe(false);
  });

  test('fresh data is left alone, old data is refreshed', () => {
    expect(isStale(1_000, 1_000 + STALE_AFTER_MS - 1)).toBe(false);
    expect(isStale(1_000, 1_000 + STALE_AFTER_MS)).toBe(true);
  });

  test('the threshold can be overridden', () => {
    expect(isStale(0, 5_000, 5_000)).toBe(true);
    expect(isStale(0, 4_999, 5_000)).toBe(false);
  });
});

describe('shouldPoll', () => {
  test('only a visible tab polls', () => {
    expect(shouldPoll('visible')).toBe(true);
    expect(shouldPoll('hidden')).toBe(false);
  });
});
