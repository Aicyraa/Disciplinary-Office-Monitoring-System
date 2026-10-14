import type { ClearanceTermView, StaffStudentRecord, StudentCaseView, StudentSanctionView } from '@shared/types';

/** Three minors of any kind become a Major (SPEC 4.2); the staff record shows how close a student is. */
export const MINOR_THRESHOLD = 3;

const ACTIVE_CASE_STATUSES: ReadonlyArray<StudentCaseView['status']> = ['reported', 'validated', 'for_sanction'];
const COUNTING_STATUSES: ReadonlyArray<StudentCaseView['status']> = ['validated', 'for_sanction', 'resolved'];

export function isActiveCase(item: Pick<StudentCaseView, 'status'>): boolean {
  return ACTIVE_CASE_STATUSES.includes(item.status);
}

/** Minors that count toward the next escalation: validated or later, not rejected, not already counted. */
export function countedMinors(cases: StudentCaseView[]): number {
  return cases.filter((item) => item.severity === 'Minor' && !item.isEscalated && COUNTING_STATUSES.includes(item.status)).length;
}

export interface StudentSummary {
  activeCases: number;
  resolvedCases: number;
  minorCount: number;
  sanctionsInProgress: number;
  sanctionsCleared: number;
  /** The newest clearance term, or null when none has been set up. */
  clearance: ClearanceTermView | null;
}

export function summarize(record: Pick<StaffStudentRecord, 'cases' | 'sanctions' | 'clearanceTerms'>): StudentSummary {
  const inProgress = (item: StudentSanctionView) => item.status !== 'completed';
  return {
    activeCases: record.cases.filter(isActiveCase).length,
    resolvedCases: record.cases.filter((item) => item.status === 'resolved').length,
    minorCount: Math.min(countedMinors(record.cases), MINOR_THRESHOLD),
    sanctionsInProgress: record.sanctions.filter(inProgress).length,
    sanctionsCleared: record.sanctions.filter((item) => !inProgress(item)).length,
    clearance: record.clearanceTerms[0] ?? null,
  };
}

/** The list filter of the Students page: free text over name, id, email and program. */
export function matchesStudent(
  row: { studentId: string; firstName: string; lastName: string; email: string; program: string },
  query: string,
): boolean {
  const needle = query.trim().toLowerCase();
  if (needle === '') return true;
  return [row.studentId, `${row.firstName} ${row.lastName}`, row.email, row.program].some((text) => text.toLowerCase().includes(needle));
}

/* The staff record pane (deck W30 to W32, src 2914 to 2944). */

export type RecordTab = 'active' | 'history' | 'san' | 'clr';

type RecordData = Pick<StaffStudentRecord, 'cases' | 'sanctions'>;

export interface RecordTile {
  key: RecordTab;
  label: string;
  value: number | string;
  sub: string;
  /** The sub line in red ("1 to verify"). */
  warn: boolean;
  /** Left accent bar: bad-ink, green, gold, primary. */
  accent: 'bad' | 'green' | 'gold' | 'primary';
}

const isClosed = (item: Pick<StudentCaseView, 'status'>): boolean => item.status === 'resolved' || item.status === 'rejected';

/** Active cases, Resolved cases (resolved or not verified), Sanctions, Clearance of the current term. */
export function recordTiles(record: RecordData, clearance: { done: number; total: number; term: string } | null): RecordTile[] {
  const toVerify = record.sanctions.filter((s) => s.status === 'pending_verification').length;
  const open = record.sanctions.filter((s) => s.status !== 'completed').length;
  const cleared = record.sanctions.length - open;
  const minors = Math.min(countedMinors(record.cases), MINOR_THRESHOLD);
  return [
    { key: 'active', label: 'Active cases', value: record.cases.filter(isActiveCase).length, sub: `Minor count ${minors} of ${MINOR_THRESHOLD}`, warn: false, accent: 'bad' },
    { key: 'history', label: 'Resolved cases', value: record.cases.filter(isClosed).length, sub: 'Kept on file', warn: false, accent: 'green' },
    { key: 'san', label: 'Sanctions', value: open, sub: toVerify ? `${toVerify} to verify` : `${cleared} cleared`, warn: toVerify > 0, accent: 'gold' },
    {
      key: 'clr',
      label: 'Clearance',
      value: clearance ? `${clearance.done}/${clearance.total}` : '—',
      sub: clearance ? clearance.term : 'Not set up',
      warn: false,
      accent: 'primary',
    },
  ];
}

export function defaultRecordTab(record: Pick<StaffStudentRecord, 'sanctions'>): RecordTab {
  return record.sanctions.some((s) => s.status === 'pending_verification') ? 'san' : 'active';
}

const SANCTION_WORDS: Record<StudentSanctionView['status'], string> = {
  assigned: 'In progress',
  pending_verification: 'Pending verification',
  returned: 'Returned',
  completed: 'Cleared',
};

const longDate = (iso: string): string =>
  new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(iso));
const shortDay = (day: string): string =>
  new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric' }).format(new Date(`${day}T00:00:00Z`));

export function recordCaseRow(
  item: StudentCaseView,
  sanctions: ReadonlyArray<Pick<StudentSanctionView, 'id' | 'caseId' | 'sanctionCode' | 'status'>>,
): { key: string; code: string; date: string; tag: string | null; line: string; href: string } {
  const latest = sanctions.filter((s) => s.caseId === item.id).sort((a, b) => b.id - a.id)[0];
  return {
    key: String(item.id),
    code: item.code,
    date: longDate(item.caseDate),
    tag: item.convertedFrom ? '3rd minor · Major' : item.isEscalated ? 'Escalated' : null,
    line: latest
      ? `Sanction ${latest.sanctionCode} · ${SANCTION_WORDS[latest.status]}`
      : item.dateResolved
        ? `Resolved ${longDate(item.dateResolved)}`
        : item.status === 'rejected'
          ? 'Not verified'
          : 'No sanction yet',
    href: `/cases/${item.id}?queue=all`,
  };
}

export function recordSanctionRow(sanction: Pick<StudentSanctionView, 'id' | 'sanctionCode' | 'dueDate' | 'type' | 'caseCode' | 'caseId'>): {
  key: string;
  code: string;
  due: string;
  title: string;
  caseCode: string;
  href: string;
} {
  return {
    key: String(sanction.id),
    code: sanction.sanctionCode,
    due: `Due ${shortDay(sanction.dueDate)}`,
    title: sanction.type,
    caseCode: sanction.caseCode,
    href: `/cases/${sanction.caseId}?queue=all`,
  };
}
