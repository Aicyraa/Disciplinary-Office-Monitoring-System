import { describe, expect, test } from 'vitest';
import { readSessionFlag, writeSessionFlag } from '@/utils/sessionFlag';

function memoryStore() {
  const data = new Map<string, string>();
  return { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => void data.set(key, value) };
}

describe('session flag', () => {
  test('is off until written, then on', () => {
    const store = memoryStore();
    expect(readSessionFlag('k', store)).toBe(false);
    writeSessionFlag('k', store);
    expect(readSessionFlag('k', store)).toBe(true);
    expect(readSessionFlag('other', store)).toBe(false);
  });

  test('never throws when storage is missing or blocked', () => {
    const blocked = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    };
    expect(readSessionFlag('k', null)).toBe(false);
    expect(() => writeSessionFlag('k', null)).not.toThrow();
    expect(readSessionFlag('k', blocked)).toBe(false);
    expect(() => writeSessionFlag('k', blocked)).not.toThrow();
  });
});
