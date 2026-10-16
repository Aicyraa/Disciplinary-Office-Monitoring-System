import type { CaseStatus, StaffCaseRow } from '@shared/types';
import type { GroupTone } from '@/components/ui/GroupHead';
import { statusLabel } from './format';
import { ageText } from './staffDashboard';

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

/** The queue menu (deck src 2625). `key` is the `?queue=` value of the URL (UI-POLISH-SPEC 5.4b). */
export const QUEUES = [
  { key: 'review', status: 'reported', label: 'Needs review' },
  { key: 'decide', status: 'validated', label: 'Awaiting decision' },
  { key: 'sanction', status: 'for_sanction', label: 'Sanction in progress' },
  { key: 'resolved', status: 'resolved', label: 'Resolved' },
  { key: 'all', status: '', label: 'All cases' },
] as const satisfies ReadonlyArray<{ key: string; status: CaseStatus | ''; label: string }>;

export type Queue = (typeof QUEUES)[number];
export type QueueKey = Queue['key'];

export function queueFromParam(param: string | null): Queue {
  return QUEUES.find((queue) => queue.key === param) ?? QUEUES[4];
}

/** "Needs review (6)"; All cases counts every status, rejected included. */
export function queueOptions(counts: Record<CaseStatus, number> | null): Array<{ value: QueueKey; label: string }> {
  return QUEUES.map((queue) => {
    if (!counts) return { value: queue.key, label: queue.label };
    const n = queue.status === '' ? Object.values(counts).reduce((sum, value) => sum + value, 0) : counts[queue.status];
    return { value: queue.key, label: `${queue.label} (${n})` };
  });
}

const GROUP: Record<CaseStatus, { label: string; tone: GroupTone }> = {
  reported: { label: 'Needs review', tone: 'bad' },
  validated: { label: 'Awaiting decision', tone: 'warn' },
  for_sanction: { label: 'Sanction in progress', tone: 'gold' },
  resolved: { label: 'Resolved', tone: 'done' },
  rejected: { label: 'Not verified', tone: 'neutral' },
};

/** All cases only: a head before each row where the stage changes, counting the whole queue (src 2637). */
export function groupHeads(
  rows: ReadonlyArray<Pick<StaffCaseRow, 'id' | 'status'>>,
  counts: Record<CaseStatus, number>,
): Map<number, { label: string; tone: GroupTone; count: number }> {
  const heads = new Map<number, { label: string; tone: GroupTone; count: number }>();
  rows.forEach((row, index) => {
    if (index === 0 || rows[index - 1].status !== row.status) heads.set(row.id, { ...GROUP[row.status], count: counts[row.status] });
  });
  return heads;
}

const monthDay = (iso: string): string =>
  new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric' }).format(new Date(iso));

export interface CaseRowView {
  name: string;
  studentId: string;
  unmatched: boolean;
  tag: string | null;
  /** "S-019 · Pending verification", "Resolved Oct 9", "No sanction", "Open 1 day". */
  line3: string;
}

/** What one queue row shows (deck src 2635 to 2645). `today` is the Manila calendar day. */
export function caseRowView(row: StaffCaseRow, today: string): CaseRowView {
  const closed = row.status === 'resolved' || row.status === 'rejected';
  const age = ageText(row.caseDate, today);
  return {
    name: row.student?.name ?? row.claimed?.name ?? 'Unknown student',
    studentId: row.student?.id ?? row.claimed?.studentId ?? 'No ID',
    unmatched: row.student === null,
    tag: row.convertedFrom ? '3rd minor · Major' : row.isEscalated ? 'Escalated' : null,
    line3: row.sanction
      ? `${row.sanction.code} · ${statusLabel(row.sanction.status, 'sanction')}`
      : row.dateResolved
        ? `Resolved ${monthDay(row.dateResolved)}`
        : closed
          ? 'No sanction'
          : `Open ${age}`,
  };
}
