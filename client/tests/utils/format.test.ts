import { describe, expect, test } from 'vitest';
import {
  SANCTION_STEP_LABELS,
  caseStageIndex,
  formatDate,
  formatDateTime,
  formatTerm,
  pillTone,
  sanctionStepIndex,
  statusLabel,
} from '@/utils/format';

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

describe('statusLabel by kind (the words of the design deck, stored statuses unchanged)', () => {
  test.each([
    ['reported', 'Pending review'],
    ['validated', 'Validated'],
    ['for_sanction', 'Sanction in progress'],
    ['resolved', 'Resolved'],
    ['rejected', 'Not verified'],
  ])('case %s', (status, label) => {
    expect(statusLabel(status, 'case')).toBe(label);
  });

  test.each([
    ['assigned', 'In progress'],
    ['pending_verification', 'Pending verification'],
    ['returned', 'Returned'],
    ['completed', 'Cleared'],
  ])('sanction %s', (status, label) => {
    expect(statusLabel(status, 'sanction')).toBe(label);
  });

  test('the same word can mean two things: completed is Cleared for a sanction and Completed for an appointment', () => {
    expect(statusLabel('completed', 'sanction')).toBe('Cleared');
    expect(statusLabel('completed', 'appointment')).toBe('Completed');
  });

  test.each([
    ['scheduled', 'Scheduled'],
    ['rescheduled', 'Rescheduled'],
    ['cancelled', 'Cancelled'],
  ])('appointment %s', (status, label) => {
    expect(statusLabel(status, 'appointment')).toBe(label);
  });

  test('clearance pending reads In progress, cleared reads Cleared', () => {
    expect(statusLabel('pending', 'clearance')).toBe('In progress');
    expect(statusLabel('cleared', 'clearance')).toBe('Cleared');
  });

  test('without a kind the old generic wording stays', () => {
    expect(statusLabel('for_sanction')).toBe('For sanction');
  });
});

describe('sanction steps (Assigned, In progress, Complied, Verified)', () => {
  test('labels', () => {
    expect(SANCTION_STEP_LABELS).toEqual(['Assigned', 'In progress', 'Complied', 'Verified']);
  });

  test('an assigned or returned sanction is at In progress, proof sent is Complied, verified is Verified', () => {
    expect(sanctionStepIndex('assigned')).toBe(1);
    expect(sanctionStepIndex('returned')).toBe(1);
    expect(sanctionStepIndex('pending_verification')).toBe(2);
    expect(sanctionStepIndex('completed')).toBe(3);
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

  test('formatTerm names the term and the school year (a fixed list of three terms)', () => {
    expect(formatTerm(2026, 1)).toBe('1st Term 2026–2027');
    expect(formatTerm(2026, 2)).toBe('2nd Term 2026–2027');
    expect(formatTerm(2025, 3)).toBe('3rd Term 2025–2026');
  });
});

describe('caseStageIndex', () => {
  test('orders the four stages and is -1 for rejected', () => {
    expect(['reported', 'validated', 'for_sanction', 'resolved'].map(caseStageIndex)).toEqual([0, 1, 2, 3]);
    expect(caseStageIndex('rejected')).toBe(-1);
  });
});
