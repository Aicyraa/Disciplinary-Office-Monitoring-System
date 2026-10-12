import { describe, expect, test } from 'vitest';
import { MAX_DAYS_AHEAD, checkStartDate, endDateFor, isSunday, windowsOverlap } from './window.js';

// 2026-10-12 is a Monday.
describe('isSunday', () => {
  test('finds Sundays by calendar date', () => {
    expect(isSunday('2026-10-11')).toBe(true);
    expect(isSunday('2026-10-12')).toBe(false);
    expect(isSunday('2026-10-17')).toBe(false); // Saturday: a working day
  });
});

describe('endDateFor (start + 5 more working days, Sundays skipped)', () => {
  test.each([
    ['2026-10-12', '2026-10-17'], // Mon -> Sat (6 working days)
    ['2026-10-13', '2026-10-19'], // Tue -> Mon (Sunday skipped)
    ['2026-10-14', '2026-10-20'], // Wed -> Tue
    ['2026-10-15', '2026-10-21'], // Thu -> Wed
    ['2026-10-16', '2026-10-22'], // Fri -> Thu
    ['2026-10-17', '2026-10-23'], // Sat -> Fri
  ])('%s ends on %s', (start, end) => {
    expect(endDateFor(start)).toBe(end);
  });

  test('crosses a month and a year boundary', () => {
    expect(endDateFor('2026-12-29')).toBe('2027-01-04'); // Tue Dec 29 -> Mon Jan 4 (Sunday Jan 3 skipped)
    expect(endDateFor('2026-10-28')).toBe('2026-11-03'); // Wed -> Tue (Sunday Nov 1 skipped)
  });

  test('the window is always 6 working days and never ends on a Sunday', () => {
    for (let day = 0; day < 60; day += 1) {
      const start = new Date(Date.UTC(2026, 9, 12 + day)).toISOString().slice(0, 10);
      if (isSunday(start)) continue;
      const end = endDateFor(start);
      expect(isSunday(end)).toBe(false);
      let working = 0;
      for (let t = Date.parse(`${start}T00:00:00Z`); t <= Date.parse(`${end}T00:00:00Z`); t += 86_400_000) {
        if (new Date(t).getUTCDay() !== 0) working += 1;
      }
      expect(working).toBe(6);
    }
  });
});

describe('checkStartDate', () => {
  const today = '2026-10-12';

  test('today up to +60 days is allowed', () => {
    expect(checkStartDate('2026-10-12', today)).toEqual({ ok: true });
    expect(checkStartDate('2026-12-11', today)).toEqual({ ok: true }); // +60 days, a Friday
  });

  test('yesterday is refused', () => {
    expect(checkStartDate('2026-10-11', today)).toMatchObject({ ok: false, reason: 'past' });
  });

  test('more than 60 days ahead is refused', () => {
    expect(MAX_DAYS_AHEAD).toBe(60);
    expect(checkStartDate('2026-12-12', today)).toMatchObject({ ok: false, reason: 'too_far' });
  });

  test('a Sunday is refused', () => {
    expect(checkStartDate('2026-10-18', today)).toMatchObject({ ok: false, reason: 'sunday' });
  });

  test.each(['2026-10-32', '2026-02-30', '12/10/2026', '', 'tomorrow', '2026-1-5'])('%s is not a real date', (value) => {
    expect(checkStartDate(value, today)).toMatchObject({ ok: false, reason: 'format' });
  });
});

describe('windowsOverlap (inclusive on both ends, like the database constraint)', () => {
  const a = { startDate: '2026-10-12', endDate: '2026-10-17' };
  test('shared day overlaps', () => {
    expect(windowsOverlap(a, { startDate: '2026-10-17', endDate: '2026-10-23' })).toBe(true);
    expect(windowsOverlap(a, { startDate: '2026-10-08', endDate: '2026-10-12' })).toBe(true);
  });
  test('containment overlaps', () => {
    expect(windowsOverlap(a, { startDate: '2026-10-13', endDate: '2026-10-14' })).toBe(true);
  });
  test('adjacent but separate windows do not overlap', () => {
    expect(windowsOverlap(a, { startDate: '2026-10-18', endDate: '2026-10-24' })).toBe(false);
    expect(windowsOverlap(a, { startDate: '2026-10-05', endDate: '2026-10-11' })).toBe(false);
  });
});
