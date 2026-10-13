import { expect, test } from 'vitest';
import { nextTabIndex } from '@/utils/tabKeys';

test('arrow keys move one tab and wrap around', () => {
  expect(nextTabIndex('ArrowRight', 0, 4)).toBe(1);
  expect(nextTabIndex('ArrowRight', 3, 4)).toBe(0);
  expect(nextTabIndex('ArrowLeft', 2, 4)).toBe(1);
  expect(nextTabIndex('ArrowLeft', 0, 4)).toBe(3);
  expect(nextTabIndex('ArrowDown', 0, 2)).toBe(1);
  expect(nextTabIndex('ArrowUp', 0, 2)).toBe(1);
});

test('Home and End jump to the first and last tab', () => {
  expect(nextTabIndex('Home', 2, 4)).toBe(0);
  expect(nextTabIndex('End', 1, 4)).toBe(3);
});

test('other keys and empty lists are ignored', () => {
  expect(nextTabIndex('a', 0, 4)).toBeNull();
  expect(nextTabIndex('Enter', 0, 4)).toBeNull();
  expect(nextTabIndex('ArrowRight', 0, 0)).toBeNull();
});
