import { describe, expect, test } from 'vitest';
import type { CaseStatus, StaffCaseRow } from '@shared/types';
import { caseRowView, groupHeads, queueFromParam, queueOptions, QUEUES, stageIndex, stageText } from '@/utils/caseView';

const TODAY = '2026-10-09';

const row = (over: Partial<StaffCaseRow> = {}): StaffCaseRow => ({
  id: 16,
  code: 'SDO-2026-016',
  status: 'reported',
  severity: 'Minor',
  violation: 'No ID',
  section: 'VI.D.2',
  caseDate: '2026-10-08T02:00:00.000Z',
  source: 'gate',
  student: { id: '2023-1001230', name: 'Juan Dela Cruz' },
  claimed: null,
  submissionRef: null,
  submissionCode: null,
  isEscalated: false,
  convertedFrom: null,
  sanction: null,
  dateResolved: null,
  ...over,
});

describe('stageIndex / stageText', () => {
  test('the four stages in order, and a rejected report has none', () => {
    expect(['reported', 'validated', 'for_sanction', 'resolved'].map((s) => stageIndex(s as CaseStatus))).toEqual([0, 1, 2, 3]);
    expect(stageIndex('rejected')).toBeNull();
  });

  test('text for the details table', () => {
    expect(stageText('reported')).toBe('Stage 1 of 4 · Reported');
    expect(stageText('for_sanction')).toBe('Stage 3 of 4 · Sanctioned');
    expect(stageText('rejected')).toBe('Not verified');
  });
});

describe('queues (deck src 2625)', () => {
  test('five queues in deck order; the URL key picks one, Needs review by default', () => {
    expect(QUEUES.map((q) => q.label)).toEqual(['Needs review', 'Awaiting decision', 'Sanction in progress', 'Resolved', 'All cases']);
    expect(queueFromParam('decide').status).toBe('validated');
    expect(queueFromParam('all').status).toBe('');
    expect(queueFromParam(null).key).toBe('all');
    expect(queueFromParam('bogus').key).toBe('all');
  });

  test('option labels carry the counts; All cases is the sum', () => {
    const counts = { reported: 6, validated: 1, for_sanction: 2, resolved: 3, rejected: 1 };
    expect(queueOptions(counts).map((o) => o.label)).toEqual([
      'Needs review (6)',
      'Awaiting decision (1)',
      'Sanction in progress (2)',
      'Resolved (3)',
      'All cases (13)',
    ]);
    expect(queueOptions(null)[0].label).toBe('Needs review');
  });
});

describe('caseRowView (src 2635 to 2645)', () => {
  test('HIGH: reported for a day or more, or Major; never when closed', () => {
    expect(caseRowView(row(), TODAY).high).toBe(true);
    expect(caseRowView(row({ caseDate: '2026-10-09T01:00:00.000Z' }), TODAY).high).toBe(false);
    expect(caseRowView(row({ status: 'validated', severity: 'Major', caseDate: '2026-10-09T01:00:00.000Z' }), TODAY).high).toBe(true);
    expect(caseRowView(row({ status: 'resolved', severity: 'Major' }), TODAY).high).toBe(false);
    expect(caseRowView(row({ status: 'validated' }), TODAY).high).toBe(false);
  });

  test('tag: "3rd minor · Major" on a converted case, "Escalated" on a counted minor', () => {
    expect(caseRowView(row({ convertedFrom: 'No ID', severity: 'Major' }), TODAY).tag).toBe('3rd minor · Major');
    expect(caseRowView(row({ isEscalated: true }), TODAY).tag).toBe('Escalated');
    expect(caseRowView(row(), TODAY).tag).toBeNull();
  });

  test('line 3: sanction, resolve date, no sanction, or how long it has been open', () => {
    expect(caseRowView(row({ status: 'for_sanction', sanction: { code: 'S-019', status: 'pending_verification' } }), TODAY).line3).toBe(
      'S-019 · Pending verification',
    );
    expect(caseRowView(row({ status: 'resolved', dateResolved: '2026-10-09T01:00:00.000Z' }), TODAY).line3).toBe('Resolved Oct 9');
    expect(caseRowView(row({ status: 'rejected' }), TODAY).line3).toBe('No sanction');
    expect(caseRowView(row(), TODAY).line3).toBe('Open 1 day');
    expect(caseRowView(row({ caseDate: '2026-10-09T01:00:00.000Z' }), TODAY).line3).toBe('Open Today');
  });

  test('name and ID: the matched student, else what the guard typed', () => {
    expect(caseRowView(row(), TODAY)).toMatchObject({ name: 'Juan Dela Cruz', studentId: '2023-1001230', unmatched: false });
    const typed = caseRowView(row({ student: null, claimed: { studentId: '2023-1009990', name: 'Carlo Mendoza', program: null, year: null } }), TODAY);
    expect(typed).toMatchObject({ name: 'Carlo Mendoza', studentId: '2023-1009990', unmatched: true });
  });
});

describe('groupHeads (All cases only)', () => {
  const counts = { reported: 6, validated: 1, for_sanction: 2, resolved: 3, rejected: 1 };
  test('a head where the stage changes, with the dot tone and the whole-queue count', () => {
    const heads = groupHeads([row({ id: 1 }), row({ id: 2 }), row({ id: 3, status: 'validated' }), row({ id: 4, status: 'rejected' })], counts);
    expect([...heads.entries()]).toEqual([
      [1, { label: 'Needs review', tone: 'bad', count: 6 }],
      [3, { label: 'Awaiting decision', tone: 'warn', count: 1 }],
      [4, { label: 'Not verified', tone: 'neutral', count: 1 }],
    ]);
  });
});
