import { useState } from 'react';
import type { StaffCaseDetail } from '@shared/types';
import { ConfirmModal } from '@/components/feedback';
import { Button } from '@/components/ui/Button';
import { StudentLookup } from '@/components/ui/StudentLookup';
import { api, toApiError } from '@/api/client';
import { useApi } from '@/hooks/useApi';
import { useStudentLookup } from '@/hooks/useStudentLookup';
import { STUDENT_ID_PATTERN } from '@/validators/studentId';
import { availableActions, codeOf } from '@/utils/caseWorkspace';

const msg = (error: unknown): string => toApiError(error).message;

type Done = (toast: string) => void;

/** Reported: "Validate report (2 violations)" + Reject; an unmatched report links the right student first (D12). */
export function ReviewFooter({ detail, done, failed }: { detail: StaffCaseDetail; done: Done; failed: (error: unknown) => void }) {
  const [busy, setBusy] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [linkId, setLinkId] = useState('');
  const [linkError, setLinkError] = useState<string | undefined>();
  const [linking, setLinking] = useState(false);
  const { lookup } = useStudentLookup(linkId);
  const actions = availableActions(detail);
  const ref = detail.submissionRef;
  const gi = detail.submissionCode ?? detail.code;
  const count = detail.siblingCaseIds.length + 1;
  const label = `Validate report (${count} violation${count === 1 ? '' : 's'})`;
  const preview = useApi(
    () => (ref && actions.includes('validate') ? api.escalationPreview(ref) : Promise.resolve({ conversions: [] })),
    [ref, detail.status, detail.student?.id],
  );
  const conversions = preview.status === 'ready' ? preview.data.conversions : [];

  async function validate() {
    if (!ref) return;
    setBusy(true);
    try {
      const result = await api.validateSubmission(ref);
      const majors = result.conversions.map((c) => codeOf(detail, c.majorCaseId)).join(', ');
      done(`${gi} validated.${majors ? ` ${majors} is now treated as Major.` : ''}`);
    } catch (error) {
      failed(error);
    } finally {
      setBusy(false);
    }
  }

  async function link() {
    if (!STUDENT_ID_PATTERN.test(linkId.trim())) {
      setLinkError('Enter a valid student ID, e.g. 2025-1234567.');
      return;
    }
    setLinkError(undefined);
    setLinking(true);
    try {
      await api.linkStudent(detail.id, linkId.trim());
      setLinkId('');
      done('Student linked.');
    } catch (error) {
      setLinkError(msg(error));
    } finally {
      setLinking(false);
    }
  }

  return (
    <>
      {conversions.length > 0 ? (
        <p role="note" className="rounded-[10px] bg-amber-soft px-3.5 py-2.5 text-[13px] text-pretty text-amber-ink">
          {conversions.map((c) => `${codeOf(detail, c.majorCaseId)} becomes the 3rd minor and will be treated as Major.`).join(' ')}
        </p>
      ) : null}
      {actions.includes('link_student') ? (
        <div className="flex flex-col gap-2">
          <p className="text-[13px] text-muted">The ID on this report has no matching student record. Enter the right ID to validate it.</p>
          <div className="flex flex-wrap items-start gap-2">
            <div className="min-w-0 flex-[1_1_220px]">
              <StudentLookup label="Student ID" placeholder="e.g. 2025-1234567" value={linkId} onChange={setLinkId} lookup={lookup} error={linkError} />
            </div>
            <Button variant="secondary" size="lg" className="mt-[26px]" busy={linking} onClick={() => void link()}>
              Link student
            </Button>
          </div>
        </div>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button
          size="lg"
          className="flex-[1_1_220px]"
          disabled={!actions.includes('validate')}
          disabledReason="Can’t validate without a matching student record."
          busy={busy}
          onClick={() => void validate()}
        >
          {label}
        </Button>
        <Button variant="danger" size="lg" className="flex-[0_1_140px]" onClick={() => setRejecting(true)}>
          Reject
        </Button>
      </div>
      <ConfirmModal
        open={rejecting && Boolean(ref)}
        tone="danger"
        title={`Reject ${gi}?`}
        description="Every violation in this submission is marked not verified. The student gets a short notice."
        reasonLabel="Reason (saved to case history)"
        reasonPlaceholder="e.g. The ID entered did not match the student at the gate."
        confirmLabel="Reject submission"
        cancelLabel="Keep reviewing"
        onClose={() => setRejecting(false)}
        onConfirm={async (reason) => {
          try {
            await api.rejectSubmission(ref as string, reason);
          } catch (error) {
            throw new Error(msg(error));
          }
          setRejecting(false);
          done(`${gi} marked not verified.`);
        }}
      />
    </>
  );
}
