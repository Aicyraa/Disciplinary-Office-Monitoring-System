import { useState } from 'react';
import type { StaffCaseDetail } from '@shared/types';
import { ConfirmModal } from '@/components/feedback';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { toApiError } from '@/api/client';
import { casesApi } from '@/api/cases';
import { availableActions } from '@/utils/caseWorkspace';
import { AssignSanctionModal } from './AssignSanctionModal';

const msg = (error: unknown): string => toApiError(error).message;

const nameOf = (detail: StaffCaseDetail): string => detail.student?.name ?? detail.claimed?.name ?? 'the student';

type Done = (toast: string) => void;

/** For sanction: "Resolve case" (enabled once every sanction is verified) and "Assign another sanction". Proof lives in the Files tab. */
export function SanctionFooter({ detail, done }: { detail: StaffCaseDetail; done: Done }) {
  const [resolving, setResolving] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const canResolve = availableActions(detail).includes('resolve');
  const verified = detail.sanctions.filter((s) => s.status === 'completed').map((s) => s.sanctionCode).join(', ');
  const waiting = detail.sanctions.some((s) => s.status === 'pending_verification');

  return (
    <>
      {waiting ? (
        <p className="flex items-center gap-1.5 text-[13px] text-amber-ink">
          <Icon name="info" className="!text-lg" />
          Proof is waiting for you in the Files tab.
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button
          variant="success"
          size="lg"
          className="flex-[1_1_180px]"
          disabled={!canResolve}
          disabledReason="Resolve once the sanction is verified"
          onClick={() => setResolving(true)}
        >
          Resolve case
        </Button>
        <Button variant="secondary" size="lg" className="flex-[1_1_180px]" onClick={() => setAssigning(true)}>
          <Icon name="add" className="!text-lg" />
          Assign another sanction
        </Button>
      </div>
      {assigning ? <AssignSanctionModal detail={detail} onClose={() => setAssigning(false)} done={(toast) => { setAssigning(false); done(toast); }} /> : null}
      <ConfirmModal
        open={resolving}
        tone="ok"
        title={`Resolve ${detail.code}?`}
        description={`Sanction ${verified} is verified. The case closes and ${nameOf(detail)} gets an email.`}
        confirmLabel="Resolve case"
        cancelLabel="Keep open"
        onClose={() => setResolving(false)}
        onConfirm={async () => {
          try {
            await casesApi.resolveCase(detail.id);
          } catch (error) {
            throw new Error(msg(error));
          }
          setResolving(false);
          done(`${detail.code} resolved.`);
        }}
      />
    </>
  );
}
