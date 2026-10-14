import type { CaseTimelineEntry, Severity, StudentCaseDetailView, StudentCaseView, StudentSanctionView } from '@shared/types';
import type { HistoryItem } from '@/components/ui/HistoryList';

/** Student My violations and My sanctions (deck W62 to W67, src 2950 to 3017). The API decides every rule. */

const ACTIVE_CASE: ReadonlyArray<StudentCaseView['status']> = ['reported', 'validated', 'for_sanction'];

/** Active cases only (D14); "Show resolved cases" swaps in the resolved and not-verified ones. */
export function violationBase<T extends Pick<StudentCaseView, 'status'>>(cases: readonly T[], showResolved: boolean): T[] {
  return cases.filter((item) => ACTIVE_CASE.includes(item.status) !== showResolved);
}

export type ClassKey = 'all' | Severity;

export function classTiles(base: ReadonlyArray<Pick<StudentCaseView, 'severity'>>, resolved: boolean): Array<{ key: ClassKey; label: string; count: number }> {
  return [
    { key: 'all', label: resolved ? 'All resolved cases' : 'All active cases', count: base.length },
    { key: 'Minor', label: 'Minor', count: base.filter((item) => item.severity === 'Minor').length },
    { key: 'Major', label: 'Major', count: base.filter((item) => item.severity === 'Major').length },
  ];
}

export type CaseStatusKey = 'all' | 'reported' | 'validated' | 'for_sanction';

export function statusChips(base: ReadonlyArray<Pick<StudentCaseView, 'status'>>): Array<{ value: CaseStatusKey; label: string; count: number }> {
  const options: Array<[CaseStatusKey, string]> = [
    ['all', 'All'],
    ['reported', 'Pending review'],
    ['validated', 'Validated'],
    ['for_sanction', 'Sanction in progress'],
  ];
  return options.map(([value, label]) => ({ value, label, count: value === 'all' ? base.length : base.filter((item) => item.status === value).length }));
}

export function caseTag(item: Pick<StudentCaseView, 'convertedFrom' | 'isEscalated'>): string | null {
  if (item.convertedFrom) return 'Treated as Major';
  if (item.isEscalated) return 'Escalated';
  return null;
}

export function escalationText(detail: Pick<StudentCaseDetailView, 'linkedCaseCodes' | 'countedTowardCode'>): string | null {
  if (detail.linkedCaseCodes.length > 0) {
    return `This was your 3rd minor violation, so it is treated as a Major offense (Sec. VI.E.20). The handbook still lists it as Minor. Linked cases: ${detail.linkedCaseCodes.join(', ')}.`;
  }
  if (detail.countedTowardCode) return `This minor violation counted toward ${detail.countedTowardCode}, which is treated as Major.`;
  return null;
}

/** The case's "Next step" box: only while the student has proof to send; the upload itself lives in My Sanctions. */
export function caseNextStep(sanction: Pick<StudentSanctionView, 'status' | 'sanctionCode'> | undefined): string | null {
  if (!sanction || (sanction.status !== 'assigned' && sanction.status !== 'returned')) return null;
  return `Complete sanction ${sanction.sanctionCode}, then upload your proof in My Sanctions.`;
}

const clock = (iso: string): string =>
  new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(iso));
const shortDate = (iso: string): string =>
  new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric' }).format(new Date(iso));

export interface UploadPanelModel {
  open: boolean;
  title: string;
  sub: string;
  returned: string | null;
  submitLabel: string;
  note: { icon: 'info' | 'lock'; text: string } | null;
}

/** What the proof box says for one sanction (src 2442 to 2459), from what the API allows. */
export function uploadPanel(
  sanction: Pick<StudentSanctionView, 'status' | 'sanctionCode' | 'type' | 'staffNote' | 'canUpload' | 'canChangeFiles' | 'dateSubmitted'>,
): UploadPanelModel {
  const open = sanction.status === 'assigned' || sanction.status === 'returned';
  const verified = sanction.status === 'completed';
  let note: UploadPanelModel['note'] = null;
  if (verified) note = { icon: 'lock', text: 'This sanction is verified. Uploads are closed.' };
  else if (!open && sanction.canChangeFiles) note = { icon: 'info', text: 'You can replace or remove files until the SDO verifies them.' };
  else if (!open) {
    note = { icon: 'lock', text: `Submitted${sanction.dateSubmitted ? ` ${clock(sanction.dateSubmitted)}` : ''}. You can upload again only if the SDO returns it.` };
  }
  return {
    open,
    title: open ? 'Upload proof of completion' : 'Submitted proof',
    sub: open
      ? `Sanction ${sanction.sanctionCode} · ${sanction.type}`
      : verified
        ? 'Verified by the SDO.'
        : `Sanction ${sanction.sanctionCode} · The SDO is reviewing your files.`,
    returned: sanction.status === 'returned' && sanction.staffNote ? `Returned by the SDO: ${sanction.staffNote}` : null,
    submitLabel: sanction.status === 'returned' ? 'Resubmit for verification' : 'Submit for verification',
    note,
  };
}

export type SanctionChip = 'all' | 'in_progress' | 'pending_verification' | 'cleared';

export function matchesSanctionChip(item: Pick<StudentSanctionView, 'status'>, chip: SanctionChip): boolean {
  if (chip === 'all') return true;
  if (chip === 'in_progress') return item.status === 'assigned' || item.status === 'returned';
  if (chip === 'pending_verification') return item.status === 'pending_verification';
  return item.status === 'completed';
}

export function sanctionChips(list: ReadonlyArray<Pick<StudentSanctionView, 'status'>>): Array<{ value: SanctionChip; label: string; count: number }> {
  const options: Array<[SanctionChip, string]> = [
    ['all', 'All'],
    ['in_progress', 'In progress'],
    ['pending_verification', 'Pending verification'],
    ['cleared', 'Cleared'],
  ];
  return options.map(([value, label]) => ({ value, label, count: list.filter((item) => matchesSanctionChip(item, value)).length }));
}

const longDay = (day: string): string =>
  new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', month: 'long', day: 'numeric', year: 'numeric' }).format(new Date(`${day}T00:00:00Z`));

/** Whole days from today to the due date: positive is time left, 0 is today, negative is late. */
export function daysLeft(dueDate: string, today: string): number {
  const day = (iso: string) => Math.round(Date.parse(`${iso}T00:00:00Z`) / 86_400_000);
  return day(dueDate) - day(today);
}

/** The line inside the tracker card (src 3011 to 3013). */
export function dueLine(sanction: Pick<StudentSanctionView, 'dueDate' | 'status'>, today: string): { text: string; tone: 'info' | 'bad' | 'done' } {
  if (sanction.status === 'completed') return { text: 'Verified', tone: 'done' };
  const left = daysLeft(sanction.dueDate, today);
  const tail = left > 0 ? `${left} day${left === 1 ? '' : 's'} left` : left === 0 ? 'Due today' : `Overdue by ${-left} day${left === -1 ? '' : 's'}`;
  return { text: `Due ${longDay(sanction.dueDate)} · ${tail}`, tone: left > 0 ? 'info' : 'bad' };
}

export function sanctionNextStep(sanction: Pick<StudentSanctionView, 'status'>): string | null {
  switch (sanction.status) {
    case 'assigned':
      return 'Complete this sanction, then upload your proof (PDF) here. The SDO reviews it and updates the status.';
    case 'returned':
      return 'The SDO returned this sanction. Fix what they asked for and upload your proof (PDF) here again.';
    case 'pending_verification':
      return 'The SDO is reviewing the proof you uploaded. Nothing to do right now.';
    case 'completed':
      return null;
  }
}

export function proofSummary(sanction: Pick<StudentSanctionView, 'files'>): string {
  const count = sanction.files.length;
  if (count === 0) return 'Not submitted yet';
  return `${count} file${count === 1 ? '' : 's'} submitted · ${shortDate(sanction.files[0].dateUploaded)}`;
}

const longDate = (iso: string): string =>
  new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(iso));

function sanctionSentence(entry: StudentSanctionView['history'][number]): string {
  const remarks = entry.remarks?.trim();
  switch (entry.eventType) {
    case 'assigned':
      return 'Sanction assigned';
    case 'proof_uploaded':
      return 'Proof uploaded';
    case 'proof_replaced':
      return remarks ? `Proof file replaced: ${remarks}` : 'Proof file replaced';
    case 'proof_removed':
      return remarks ? `Proof file removed: ${remarks}` : 'Proof file removed';
    case 'returned':
      return remarks ? `Returned by the SDO: ${remarks}` : 'Returned by the SDO';
    case 'verified':
      return 'Verified by the SDO';
    default:
      return remarks || entry.eventType.replace(/_/g, ' ');
  }
}

export function sanctionHistoryItems(sanction: Pick<StudentSanctionView, 'history'>): HistoryItem[] {
  return sanction.history
    .map((entry, index) => ({ id: index, date: longDate(entry.date), text: sanctionSentence(entry), by: entry.by === 'staff' ? 'SDO staff' : 'You' }))
    .reverse();
}

/** The newest remark the office left on a case, for the Remarks row. */
export function latestRemark(timeline: CaseTimelineEntry[]): string | null {
  const entry = [...timeline].reverse().find((item) => item.eventType === 'remark' && item.remarks);
  return entry?.remarks ?? null;
}
