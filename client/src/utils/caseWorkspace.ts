import type { StaffCaseDetail, StaffSanctionView } from '@shared/types';
import type { HistoryItem } from '@/components/ui/HistoryList';

/** The case pane of staff Cases (deck W17 to W29, src 2646 to 2782). Pure, so the rules are tested without a DOM. */

export type CaseAction = 'validate' | 'reject' | 'link_student' | 'assign_sanction' | 'resolve' | 'resolve_without_sanction';

/**
 * Which workflow buttons make sense for a case (SPEC 4.1). The API enforces the same rules; this only keeps
 * the screen from offering what the API would refuse.
 */
export function availableActions(
  detail: Pick<StaffCaseDetail, 'status' | 'student' | 'submissionRef' | 'sanctions'>,
): CaseAction[] {
  switch (detail.status) {
    case 'reported':
      if (detail.submissionRef === null) return [];
      return detail.student ? ['validate', 'reject'] : ['link_student', 'reject'];
    case 'validated':
      return ['assign_sanction', 'resolve_without_sanction'];
    case 'for_sanction':
      return detail.sanctions.length > 0 && detail.sanctions.every((s) => s.status === 'completed')
        ? ['assign_sanction', 'resolve']
        : ['assign_sanction'];
    default:
      return [];
  }
}

export const codeOf = (detail: Pick<StaffCaseDetail, 'caseCodes'>, id: number): string => detail.caseCodes[String(id)] ?? `#${id}`;

/** "Gate report GI-1042" or "Staff report", after the case code. */
export function sourceText(detail: Pick<StaffCaseDetail, 'source' | 'submissionCode'>): string {
  if (detail.source !== 'gate') return 'Staff report';
  return detail.submissionCode ? `Gate report ${detail.submissionCode}` : 'Gate report';
}

/** The amber note above the tabs on an escalated minor or a converted Major (src 2760). */
export function escalationNote(
  detail: Pick<StaffCaseDetail, 'isEscalated' | 'countedTowardCaseId' | 'convertedFrom' | 'createdFromCaseIds' | 'caseCodes'>,
): string | null {
  if (detail.convertedFrom) {
    const linked = detail.createdFromCaseIds.map((id) => codeOf(detail, id)).join(', ');
    return `Treated as Major as the 3rd minor violation (Sec. VI.E.20).${linked ? ` Linked cases: ${linked}.` : ''}`;
  }
  if (detail.isEscalated && detail.countedTowardCaseId !== null) {
    return `Flagged as escalated. This minor counted toward ${codeOf(detail, detail.countedTowardCaseId)}. Handbook severity stays Minor.`;
  }
  return null;
}

const longDate = (iso: string): string =>
  new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(iso));

const trimDot = (text: string): string => text.replace(/\.$/, '');

/** One sentence per timeline event, from what the event stored (staff History and the student Timeline). */
export function caseEventSentence(
  entry: Pick<StaffCaseDetail['timeline'][number], 'eventType' | 'remarks'>,
  detail: Pick<StaffCaseDetail, 'submissionCode'>,
): string {
  const gi = detail.submissionCode ?? 'the gate report';
  const remarks = entry.remarks?.trim() ?? '';
  switch (entry.eventType) {
    case 'reported':
      return detail.submissionCode ? `Reported through gate intake ${detail.submissionCode}` : 'Reported';
    case 'validated':
      return remarks ? trimDot(remarks) : `Report ${gi} validated. Identity checked by staff.`;
    case 'rejected':
      return remarks ? `Submission not verified: ${remarks}` : 'Submission not verified';
    case 'remark':
      return `Remarks updated: ${remarks}`;
    case 'sanction_assigned':
      return remarks ? `Sanction assigned: ${remarks}` : 'Sanction assigned';
    case 'resolved':
      return remarks ? `Case resolved with no sanction: ${remarks}` : 'Case resolved';
    default:
      return remarks || entry.eventType.replace(/_/g, ' ');
  }
}

/** The History tab: newest first; "System" (gate, escalation job) shows no actor. */
export function historyItems(detail: Pick<StaffCaseDetail, 'timeline' | 'submissionCode'>): HistoryItem[] {
  return detail.timeline
    .map((entry, index) => ({
      id: index,
      date: longDate(entry.date),
      text: caseEventSentence(entry, detail),
      by: entry.by === 'System' ? undefined : entry.by,
    }))
    .reverse();
}

/** The current "Remarks for the student": the newest remark event. */
export function latestRemark(detail: Pick<StaffCaseDetail, 'timeline'>): string | null {
  const latest = [...detail.timeline].reverse().find((entry) => entry.eventType === 'remark' && entry.remarks);
  return latest?.remarks ?? null;
}

/** What the sanctioned footer shows for one sanction (src 2706 to 2714). */
export function sanctionFooter(sanction: Pick<StaffSanctionView, 'status' | 'files' | 'staffNote'>): {
  pending: boolean;
  proofSub: string;
  needView: boolean;
  canVerify: boolean;
  noFilesText: string | null;
  note: string | null;
} {
  const viewed = sanction.files.filter((file) => file.viewed).length;
  const total = sanction.files.length;
  const allViewed = total > 0 && viewed === total;
  const pending = sanction.status === 'pending_verification';
  const open = sanction.status === 'assigned' || sanction.status === 'returned';
  return {
    pending,
    proofSub: total ? `${viewed} of ${total} viewed` : '',
    needView: pending && !allViewed && total > 0,
    canVerify: allViewed,
    noFilesText: total ? null : open ? 'Waiting for the student to upload proof.' : 'No files were uploaded.',
    note:
      sanction.staffNote && sanction.status !== 'completed'
        ? `${sanction.status === 'returned' ? 'Returned' : 'Instructions'}: ${sanction.staffNote}`
        : null,
  };
}
