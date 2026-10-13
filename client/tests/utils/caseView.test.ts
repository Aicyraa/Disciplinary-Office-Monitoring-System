import { describe, expect, test } from 'vitest';
import type { StaffCaseRow } from '@shared/types';
import { groupCases, stageIndex, stageText, statusOption } from '@/utils/caseView';

const row = (id: number, status: StaffCaseRow['status']): StaffCaseRow =>
  ({ id, status, code: `SDO-2026-${String(id).padStart(3, '0')}` }) as StaffCaseRow;

describe('stageIndex / stageText', () => {
  test('the four stages in order, and a rejected report has none', () => {
    expect(['reported', 'validated', 'for_sanction', 'resolved'].map((s) => stageIndex(s as StaffCaseRow['status']))).toEqual([0, 1, 2, 3]);
    expect(stageIndex('rejected')).toBeNull();
  });

  test('text for the details table', () => {
    expect(stageText('reported')).toBe('Stage 1 of 4 · Reported');
    expect(stageText('for_sanction')).toBe('Stage 3 of 4 · Sanctioned');
    expect(stageText('rejected')).toBe('Not verified');
  });
});

describe('groupCases', () => {
  test('groups in queue order, keeps the given order inside a group and skips empty groups', () => {
    const groups = groupCases([row(5, 'resolved'), row(4, 'reported'), row(3, 'for_sanction'), row(2, 'reported')]);
    expect(groups.map((g) => [g.title, g.rows.map((r) => r.id)])).toEqual([
      ['Needs review', [4, 2]],
      ['Sanction in progress', [3]],
      ['Resolved', [5]],
    ]);
  });

  test('an empty page has no groups', () => {
    expect(groupCases([])).toEqual([]);
  });
});

describe('statusOption', () => {
  test('label with the count; the count is optional', () => {
    expect(statusOption('reported', 6)).toBe('Needs review (6)');
    expect(statusOption('rejected', undefined)).toBe('Not verified');
    expect(statusOption('validated', 0)).toBe('Validated (0)');
  });
});
