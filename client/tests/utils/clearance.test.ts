import { describe, expect, test } from 'vitest';
import type { StaffClearanceView } from '@shared/types';
import { clearanceCopy, clearanceHistoryItems, clearanceStatus, parseTermParam, rosterProgress, termParam } from '@/utils/clearance';

describe('staff Clearance (deck W50 to W56, src 2874 to 2904)', () => {
  test('the term lives in ?term=YYYY-S', () => {
    expect(termParam({ academicYear: 2026, semester: 1 })).toBe('2026-1');
    expect(parseTermParam('2025-3')).toEqual({ academicYear: 2025, semester: 3 });
    expect(parseTermParam('2025-4')).toBeNull();
    expect(parseTermParam(null)).toBeNull();
  });

  test('roster progress: "1 / 4", green when complete, "Not set" in grey', () => {
    expect(rosterProgress({ id: 1, status: 'pending', done: 1, total: 4 })).toEqual({ text: '1 / 4', tone: 'ink' });
    expect(rosterProgress({ id: 1, status: 'cleared', done: 4, total: 4 })).toEqual({ text: '4 / 4', tone: 'done' });
    expect(rosterProgress(null)).toEqual({ text: 'Not set', tone: 'muted' });
  });

  test('status pill: In progress, Cleared or Not set', () => {
    expect(clearanceStatus(null)).toBe('Not set');
    expect(clearanceStatus({ status: 'pending' })).toBe('In progress');
    expect(clearanceStatus({ status: 'cleared' })).toBe('Cleared');
  });

  test('activity history sentences, newest first', () => {
    const view = {
      history: [
        { eventType: 'set_up', requirement: null, remarks: null, date: '2026-10-01T02:00:00.000Z', by: 'Andrea Reyes' },
        { eventType: 'marked_done', requirement: 'SDO signature', remarks: null, date: '2026-10-02T02:00:00.000Z', by: 'Andrea Reyes' },
        { eventType: 'reversed', requirement: 'All sanctions verified', remarks: 'Sanction S-015 was reopened.', date: '2026-10-03T02:00:00.000Z', by: 'Andrea Reyes' },
        { eventType: 'requirement_added', requirement: 'Return lab equipment', remarks: null, date: '2026-10-04T02:00:00.000Z', by: 'Andrea Reyes' },
        { eventType: 'requirement_removed', requirement: 'Library', remarks: null, date: '2026-10-05T02:00:00.000Z', by: 'Andrea Reyes' },
      ],
    } as Pick<StaffClearanceView, 'history'>;
    expect(clearanceHistoryItems(view).map((i) => i.text)).toEqual([
      'Removed requirement “Library”',
      'Added requirement “Return lab equipment”',
      'Reversed “All sanctions verified”: Sanction S-015 was reopened.',
      'Marked “SDO signature” done',
      'Clearance set up with the standard requirements',
    ]);
  });

  test('modal and toast copy (UI-POLISH-SPEC 6.1, 6.2)', () => {
    const copy = clearanceCopy('Juan Dela Cruz', '1st Term 2026–2027');
    expect(copy.setUp).toBe('Clearance set up for Juan Dela Cruz.');
    expect(copy.marked('SDO signature')).toBe('Marked “SDO signature” done for Juan Dela Cruz.');
    expect(copy.removeBody).toBe('It is removed from Juan Dela Cruz’s checklist for 1st Term 2026–2027. The change is saved to the log.');
    expect(copy.addBody).toBe('It is added to Juan Dela Cruz’s checklist for 1st Term 2026–2027.');
  });
});
