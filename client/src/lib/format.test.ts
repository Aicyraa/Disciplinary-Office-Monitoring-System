import { describe, expect, test } from 'vitest';
import { caseStageIndex, formatDate, formatDateTime, formatTerm, pillTone, statusLabel } from './format';

describe('pillTone (SPEC 9 colors)', () => {
  test.each([
    ['pending', '#FDF3D3', '#7A5A00'],
    ['reported', '#FDF3D3', '#7A5A00'],
    ['validated', '#E8EBF7', '#2B347A'],
    ['Minor', '#E8EBF7', '#2B347A'],
    ['for_sanction', '#FCE9C6', '#7A4600'],
    ['pending_verification', '#FCE9C6', '#7A4600'],
    ['rescheduled', '#FCE9C6', '#7A4600'],
    ['resolved', '#E2F3E8', '#1E6B3E'],
    ['completed', '#E2F3E8', '#1E6B3E'],
    ['cleared', '#E2F3E8', '#1E6B3E'],
    ['Major', '#F7E6E6', '#9B2C2C'],
    ['returned', '#F7E6E6', '#9B2C2C'],
    ['rejected', '#ECEEF1', '#4A5260'],
    ['cancelled', '#ECEEF1', '#4A5260'],
  ])('%s', (status, bg, fg) => {
    expect(pillTone(status)).toEqual({ bg, fg });
  });

  test('an unknown status falls back to the neutral tone', () => {
    expect(pillTone('something_new')).toEqual({ bg: '#ECEEF1', fg: '#4A5260' });
  });
});

describe('statusLabel', () => {
  test('shows rejected as "Not verified"', () => {
    expect(statusLabel('rejected')).toBe('Not verified');
  });

  test('turns snake_case into a sentence', () => {
    expect(statusLabel('pending_verification')).toBe('Pending verification');
    expect(statusLabel('sanction_assigned')).toBe('Sanction assigned');
  });
});

describe('dates (Asia/Manila)', () => {
  test('a date-only value is a calendar day and never shifts', () => {
    expect(formatDate('2026-09-20')).toBe('Sep 20, 2026');
  });

  test('a UTC timestamp late on the 11th is the 12th in Manila', () => {
    expect(formatDate('2026-10-11T20:00:00.000Z')).toBe('Oct 12, 2026');
    expect(formatDateTime('2026-10-11T20:00:00.000Z')).toContain('Oct 12, 2026');
  });

  test('formatTerm shows the academic year span', () => {
    expect(formatTerm(2026, 1)).toBe('2026-2027, Semester 1');
  });
});

describe('caseStageIndex', () => {
  test('orders the four stages and is -1 for rejected', () => {
    expect(['reported', 'validated', 'for_sanction', 'resolved'].map(caseStageIndex)).toEqual([0, 1, 2, 3]);
    expect(caseStageIndex('rejected')).toBe(-1);
  });
});
