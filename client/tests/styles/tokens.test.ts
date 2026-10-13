import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { expect, test } from 'vitest';

const css = readFileSync(fileURLToPath(new URL('../../src/index.css', import.meta.url)), 'utf8');

// UI-POLISH-SPEC 4.1 (plus the two extra values the deck's hover states need).
const TOKENS: Record<string, string> = {
  'primary-hover': '#2a3376',
  'primary-press': '#20285e',
  'primary-busy': '#4a5498',
  'primary-tint': '#f0f2fa',
  'surface-2': '#f7f9fa',
  'line-soft': '#eef1f4',
  'row-hover': '#eef1f9',
  'row-selected': '#e8ebf7',
  'info-soft': '#e8ebf7',
  'info-ink': '#2b347a',
  'danger-soft': '#fceeee',
  'danger-line': '#f1c9c9',
  'danger-ink': '#8e1f17',
  'danger-strong': '#c0392b',
  'bad-soft': '#f7e6e6',
  'bad-ink': '#9b2c2c',
  'warn-soft': '#fef6d8',
  'warn-ink': '#7a5a00',
  'amber-soft': '#fce9c6',
  'amber-ink': '#7a4600',
  'pending-soft': '#fdf3d3',
  'success-strong': '#2e8b57',
  'success-soft': '#e2f3e8',
  'success-line': '#cde9d7',
  'neutral-soft': '#eceef1',
  'neutral-ink': '#4a5260',
  'gold-line': '#ddbb4a',
  'gold-hover': '#e8c75a',
  'muted-2': '#7b8592',
  disabled: '#9aa6b2',
  'disabled-bg': '#eef1f4',
  'disabled-ink': '#6b7480',
  skeleton: '#e6eaee',
};

test.each(Object.entries(TOKENS))('index.css defines --color-%s as %s', (name, value) => {
  expect(css.toLowerCase()).toContain(`--color-${name}: ${value};`);
});

test('scrim is a translucent overlay token', () => {
  expect(css).toMatch(/--color-scrim:\s*rgba\(16,\s*22,\s*52,\s*0?\.5\);/);
});

test('every clickable thing gets a pointer cursor and disabled ones not-allowed (4.2b)', () => {
  expect(css).toMatch(/button:not\(:disabled\)/);
  expect(css).toMatch(/cursor:\s*pointer/);
  expect(css).toMatch(/cursor:\s*not-allowed/);
});
