import { describe, expect, test } from 'vitest';
import type { AppointmentRecord } from './repo.js';
import { appointmentBucket, manilaToday } from './views.js';

describe('manilaToday', () => {
  test('rolls over at Manila midnight, not UTC midnight', () => {
    expect(manilaToday(new Date('2026-10-11T15:59:59Z'))).toBe('2026-10-11');
    expect(manilaToday(new Date('2026-10-11T16:00:00Z'))).toBe('2026-10-12');
  });
});

describe('appointmentBucket', () => {
  const base: AppointmentRecord = {
    appointmentId: 1,
    startDate: new Date('2026-10-05T00:00:00Z'),
    endDate: new Date('2026-10-12T00:00:00Z'),
    purpose: 'x',
    notes: null,
    status: 'scheduled',
    cancelReason: null,
  };

  test('window ending today is still upcoming', () => {
    expect(appointmentBucket(base, '2026-10-12')).toBe('upcoming');
  });

  test('window that ended yesterday is history', () => {
    expect(appointmentBucket(base, '2026-10-13')).toBe('history');
  });

  test.each(['completed', 'cancelled'] as const)('%s is always history', (status) => {
    expect(appointmentBucket({ ...base, status }, '2026-10-01')).toBe('history');
  });

  test('rescheduled counts as live', () => {
    expect(appointmentBucket({ ...base, status: 'rescheduled' }, '2026-10-01')).toBe('upcoming');
  });
});
