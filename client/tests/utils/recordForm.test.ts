import { describe, expect, test } from 'vitest';
import { matchViolations, recordedToast, recordHelp, recordProblem, violationCounts } from '@/utils/recordForm';

const entries = [
  { id: 1, violation: 'Improper uniform', severity: 'Minor' as const, section: 'VI.D.1' },
  { id: 2, violation: 'No ID', severity: 'Minor' as const, section: 'VI.D.2' },
  { id: 3, violation: 'Cheating', severity: 'Major' as const, section: 'VI.E.3' },
];

describe('Record violation (deck src 2783 to 2819, UI-POLISH-SPEC 5.6)', () => {
  test('help line: the next thing to do, then the save rule', () => {
    expect(recordHelp({ studentFound: false, violationPicked: false })).toBe('Enter a valid student ID, e.g. 2025-1234567.');
    expect(recordHelp({ studentFound: true, violationPicked: false })).toBe('Pick a violation to save.');
    expect(recordHelp({ studentFound: true, violationPicked: true })).toBe('Staff reports are saved as validated.');
  });

  test('a blocked save names the first missing thing (error toast)', () => {
    expect(recordProblem({ studentFound: false, violationPicked: true })).toBe('Enter a valid student ID before saving.');
    expect(recordProblem({ studentFound: true, violationPicked: false })).toBe('Pick a violation before saving.');
    expect(recordProblem({ studentFound: true, violationPicked: true })).toBeNull();
  });

  test('search matches violation, section or class; the chips filter by class and count the search hits', () => {
    expect(matchViolations(entries, 'vi.d', '').map((e) => e.id)).toEqual([1, 2]);
    expect(matchViolations(entries, '', 'Major').map((e) => e.id)).toEqual([3]);
    expect(matchViolations(entries, 'minor', 'Minor').map((e) => e.id)).toEqual([1, 2]);
    expect(violationCounts(entries, 'i')).toEqual({ '': 3, Minor: 2, Major: 1 });
    expect(violationCounts(entries, 'cheat')).toEqual({ '': 1, Minor: 0, Major: 1 });
  });

  test('the saved toast uses the real case code (never the old C001 format)', () => {
    expect(recordedToast('SDO-2026-020', 'Maria Santos', false)).toBe('Case SDO-2026-020 recorded for Maria Santos.');
    expect(recordedToast('SDO-2026-020', 'Maria Santos', true)).toBe(
      'Case SDO-2026-020 recorded for Maria Santos. It is the 3rd minor and is treated as Major.',
    );
  });
});
