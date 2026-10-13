import type { CaseStatus, StaffCaseRow } from '@shared/types';
import { statusLabel } from './format';

/** The four-stage tracker of the case pane (deck W17): Reported, Validated, Sanctioned, Resolved. */
export const CASE_STAGES = ['Reported', 'Validated', 'Sanctioned', 'Resolved'] as const;

/** Index of the current stage, or null for a rejected report (the tracker is then replaced by a notice). */
export function stageIndex(status: CaseStatus): number | null {
  switch (status) {
    case 'reported':
      return 0;
    case 'validated':
      return 1;
    case 'for_sanction':
      return 2;
    case 'resolved':
      return 3;
    case 'rejected':
      return null;
  }
}

export function stageText(status: CaseStatus): string {
  const index = stageIndex(status);
  return index === null ? 'Not verified' : `Stage ${index + 1} of ${CASE_STAGES.length} · ${CASE_STAGES[index]}`;
}

/** Queue order: what needs the officer first. */
const GROUP_ORDER: CaseStatus[] = ['reported', 'validated', 'for_sanction', 'resolved', 'rejected'];

const GROUP_TITLES: Record<CaseStatus, string> = {
  reported: 'Needs review',
  validated: 'Awaiting sanction',
  for_sanction: 'Sanction in progress',
  resolved: 'Resolved',
  rejected: 'Not verified',
};

export interface CaseGroup {
  status: CaseStatus;
  title: string;
  rows: StaffCaseRow[];
}

/** Groups one page of the queue by status, in queue order, keeping the server's sort inside a group. */
export function groupCases(rows: StaffCaseRow[]): CaseGroup[] {
  return GROUP_ORDER.flatMap((status) => {
    const inGroup = rows.filter((row) => row.status === status);
    return inGroup.length === 0 ? [] : [{ status, title: GROUP_TITLES[status], rows: inGroup }];
  });
}

/** `Needs review (6)` style option labels of the status menu. */
export function statusOption(status: CaseStatus, count: number | undefined): string {
  const label = status === 'reported' ? GROUP_TITLES.reported : statusLabel(status, 'case');
  return count === undefined ? label : `${label} (${count})`;
}

export const STATUS_ORDER = GROUP_ORDER;
