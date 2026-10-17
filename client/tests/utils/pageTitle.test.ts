import { describe, expect, test } from 'vitest';
import { breadcrumb } from '@/utils/nav';
import { pageTitle } from '@/utils/pageTitle';

describe('pageTitle', () => {
  test('puts the heading before the portal name', () => {
    expect(pageTitle('My Violations')).toBe('My Violations · SDO Portal');
  });

  test('falls back to the portal name alone', () => {
    expect(pageTitle('  ')).toBe('SDO Portal');
  });

  test('matches the heading each role sees, detail pages included', () => {
    expect(pageTitle(breadcrumb('student', '/violations/12')[1] ?? '')).toBe('My Violations · SDO Portal');
    expect(pageTitle(breadcrumb('staff', '/cases/7')[1] ?? '')).toBe('Cases · SDO Portal');
    expect(pageTitle(breadcrumb('staff', '/handbook')[1] ?? '')).toBe('Violations · SDO Portal');
    expect(pageTitle(breadcrumb('student', '/handbook')[1] ?? '')).toBe('Student Handbook · SDO Portal');
  });
});
