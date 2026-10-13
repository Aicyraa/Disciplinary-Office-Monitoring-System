import { describe, expect, test } from 'vitest';
import type { StudentSanctionView } from '@shared/types';
import {
  daysLeft,
  dueLabel,
  latestRemark,
  matchesSanctionFilter,
  matchesViolationFilter,
  nextStep,
  returnReason,
  violationTiles,
} from '@/utils/studentView';

describe('violations', () => {
  const cases = [
    { status: 'reported', severity: 'Minor' },
    { status: 'validated', severity: 'Minor' },
    { status: 'for_sanction', severity: 'Major' },
    { status: 'resolved', severity: 'Minor' },
    { status: 'rejected', severity: 'Minor' },
  ] as const;

  test('tiles count only active cases', () => {
    expect(violationTiles([...cases])).toEqual({ active: 3, minor: 2, major: 1 });
  });

  test('filters', () => {
    const ids = (filter: Parameters<typeof matchesViolationFilter>[1]) =>
      cases.filter((item) => matchesViolationFilter(item, filter)).map((item) => item.status);
    expect(ids('active')).toEqual(['reported', 'validated', 'for_sanction']);
    expect(ids('closed')).toEqual(['resolved', 'rejected']);
    expect(ids('validated')).toEqual(['validated']);
  });
});

describe('sanction filters', () => {
  const statuses = ['assigned', 'returned', 'pending_verification', 'completed'] as const;
  test('in progress covers assigned and returned', () => {
    expect(statuses.filter((status) => matchesSanctionFilter({ status }, 'in_progress'))).toEqual(['assigned', 'returned']);
    expect(statuses.filter((status) => matchesSanctionFilter({ status }, 'cleared'))).toEqual(['completed']);
    expect(statuses.filter((status) => matchesSanctionFilter({ status }, 'all'))).toHaveLength(4);
  });
});

describe('due dates', () => {
  test('daysLeft', () => {
    expect(daysLeft('2026-10-20', '2026-10-12')).toBe(8);
    expect(daysLeft('2026-10-12', '2026-10-12')).toBe(0);
    expect(daysLeft('2026-10-10', '2026-10-12')).toBe(-2);
  });

  test('dueLabel', () => {
    expect(dueLabel('2026-10-20', '2026-10-12', 'assigned')).toBe('8 days left');
    expect(dueLabel('2026-10-13', '2026-10-12', 'assigned')).toBe('1 day left');
    expect(dueLabel('2026-10-12', '2026-10-12', 'assigned')).toBe('Due today');
    expect(dueLabel('2026-10-10', '2026-10-12', 'returned')).toBe('2 days late');
    expect(dueLabel('2026-10-10', '2026-10-12', 'completed')).toBe('Verified');
  });
});

describe('next step', () => {
  const base = { sanctionCode: 'S-022', history: [] as StudentSanctionView['history'] };

  test('says what to do in each status', () => {
    expect(nextStep({ ...base, status: 'assigned' })).toContain('upload your proof');
    expect(nextStep({ ...base, status: 'pending_verification' })).toContain('will verify');
    expect(nextStep({ ...base, status: 'completed' })).toContain('verified');
  });

  test('a returned sanction repeats the office reason', () => {
    const returned = {
      ...base,
      status: 'returned' as const,
      history: [{ eventType: 'returned', remarks: 'The scan is blurry.', by: 'staff' as const, date: '2026-10-10T02:00:00Z' }],
    };
    expect(returnReason(returned)).toBe('The scan is blurry.');
    expect(nextStep(returned)).toBe('The office returned your proof: The scan is blurry. Upload it again below.');
    expect(returnReason({ ...returned, status: 'assigned' })).toBeNull();
  });
});

describe('latestRemark', () => {
  test('the newest remark, or null', () => {
    const timeline = [
      { eventType: 'remark', statusAfter: null, remarks: 'First', date: '2026-10-01T00:00:00Z' },
      { eventType: 'validated', statusAfter: 'validated', remarks: null, date: '2026-10-02T00:00:00Z' },
      { eventType: 'remark', statusAfter: null, remarks: 'Second', date: '2026-10-03T00:00:00Z' },
    ] as const;
    expect(latestRemark([...timeline])).toBe('Second');
    expect(latestRemark([])).toBeNull();
  });
});
