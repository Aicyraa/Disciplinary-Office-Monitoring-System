import { expect, test } from 'vitest';
import { clampPage, pageCount, pageHolding, pagerItems } from '@/utils/pager';

test('pageCount rounds up and is never below 1', () => {
  expect(pageCount(0, 6)).toBe(1);
  expect(pageCount(6, 6)).toBe(1);
  expect(pageCount(7, 6)).toBe(2);
  expect(pageCount(13, 6)).toBe(3);
});

test('clampPage keeps a page inside 1..total', () => {
  expect(clampPage(0, 3)).toBe(1);
  expect(clampPage(2, 3)).toBe(2);
  expect(clampPage(9, 3)).toBe(3);
});

test('pageHolding returns the page that contains the matching item (5.4c deep links)', () => {
  const ids = [10, 11, 12, 13, 14, 15, 16, 17, 18];
  expect(pageHolding(ids, (id) => id === 10, 6)).toBe(1);
  expect(pageHolding(ids, (id) => id === 15, 6)).toBe(1);
  expect(pageHolding(ids, (id) => id === 16, 6)).toBe(2);
});

test('pageHolding falls back to page 1 when the item is not in the list', () => {
  expect(pageHolding([1, 2, 3], (id) => id === 99, 2)).toBe(1);
});

test('pagerItems lists every page when they fit', () => {
  expect(pagerItems(1, 3)).toEqual([1, 2, 3]);
});

test('pagerItems collapses a long range with gaps and keeps the current page, first and last', () => {
  expect(pagerItems(1, 20)).toEqual([1, 2, 3, 4, 5, 'gap', 20]);
  expect(pagerItems(10, 20)).toEqual([1, 'gap', 9, 10, 11, 'gap', 20]);
  expect(pagerItems(20, 20)).toEqual([1, 'gap', 16, 17, 18, 19, 20]);
});
