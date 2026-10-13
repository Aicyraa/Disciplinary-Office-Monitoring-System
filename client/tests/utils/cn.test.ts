import { expect, test } from 'vitest';
import { cn } from '@/utils/cn';

test('cn joins class names and drops falsy values', () => {
  expect(cn('a', false, null, undefined, 'b', { c: true, d: false })).toBe('a b c');
});

test('cn lets a later class override a conflicting earlier one', () => {
  expect(cn('px-4 bg-primary', 'px-2')).toBe('bg-primary px-2');
  expect(cn('text-muted', 'text-ink')).toBe('text-ink');
});

test('cn keeps a font size and a text colour together', () => {
  expect(cn('text-sm text-ink', 'text-lg')).toBe('text-ink text-lg');
});
