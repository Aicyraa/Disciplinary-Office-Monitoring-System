import type { CaseTimelineEntry, Severity, StudentCaseView, StudentSanctionView } from '@shared/types';
import { addDays } from './files';

const ACTIVE_CASE: ReadonlyArray<StudentCaseView['status']> = ['reported', 'validated', 'for_sanction'];

export type ViolationFilter = 'active' | 'reported' | 'validated' | 'for_sanction' | 'closed';

export function matchesViolationFilter(item: Pick<StudentCaseView, 'status'>, filter: ViolationFilter): boolean {
  if (filter === 'active') return ACTIVE_CASE.includes(item.status);
  if (filter === 'closed') return item.status === 'resolved' || item.status === 'rejected';
  return item.status === filter;
}

/** The three tiles above the list: active cases, and how many of them are Minor and Major. */
export function violationTiles(cases: Array<Pick<StudentCaseView, 'status' | 'severity'>>): { active: number; minor: number; major: number } {
  const active = cases.filter((item) => ACTIVE_CASE.includes(item.status));
  const count = (severity: Severity) => active.filter((item) => item.severity === severity).length;
  return { active: active.length, minor: count('Minor'), major: count('Major') };
}

export type SanctionFilter = 'all' | 'in_progress' | 'pending_verification' | 'cleared';

export function matchesSanctionFilter(item: Pick<StudentSanctionView, 'status'>, filter: SanctionFilter): boolean {
  switch (filter) {
    case 'all':
      return true;
    case 'in_progress':
      return item.status === 'assigned' || item.status === 'returned';
    case 'pending_verification':
      return item.status === 'pending_verification';
    case 'cleared':
      return item.status === 'completed';
  }
}

/** Whole days from today to the due date: positive is time left, 0 is today, negative is late. */
export function daysLeft(dueDate: string, today: string): number {
  const day = (iso: string) => Math.round(Date.parse(`${iso}T00:00:00Z`) / 86_400_000);
  return day(dueDate) - day(today);
}

export function dueLabel(dueDate: string, today: string, status: StudentSanctionView['status']): string {
  if (status === 'completed') return 'Verified';
  const left = daysLeft(dueDate, today);
  if (left > 1) return `${left} days left`;
  if (left === 1) return '1 day left';
  if (left === 0) return 'Due today';
  return `${-left} day${left === -1 ? '' : 's'} late`;
}

/** Why the office sent proof back: the reason on the latest `returned` entry of the sanction's history. */
export function returnReason(sanction: Pick<StudentSanctionView, 'history' | 'status'>): string | null {
  if (sanction.status !== 'returned') return null;
  const entry = [...sanction.history].reverse().find((item) => item.eventType === 'returned');
  return entry?.remarks ?? null;
}

/** The "Next step" callout of a sanction, in the student's words. */
export function nextStep(sanction: Pick<StudentSanctionView, 'status' | 'sanctionCode' | 'history'>): string {
  switch (sanction.status) {
    case 'assigned':
      return `Complete sanction ${sanction.sanctionCode}, then upload your proof below as a PDF or DOCX file.`;
    case 'returned': {
      const reason = returnReason(sanction);
      return `The office returned your proof${reason ? `: ${reason}` : '.'} Upload it again below.`;
    }
    case 'pending_verification':
      return 'Your proof was submitted. The office will verify it and tell you the result.';
    case 'completed':
      return `Sanction ${sanction.sanctionCode} is verified. Nothing more to do.`;
  }
}

/** The newest remark the office left on a case, for the Remarks row. */
export function latestRemark(timeline: CaseTimelineEntry[]): string | null {
  const entry = [...timeline].reverse().find((item) => item.eventType === 'remark' && item.remarks);
  return entry?.remarks ?? null;
}

export { addDays };
