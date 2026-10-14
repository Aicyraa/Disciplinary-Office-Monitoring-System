import { useState } from 'react';
import type { StaffCaseDetail } from '@shared/types';
import { ConfirmModal } from '@/components/feedback';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { api, toApiError } from '@/api/client';
import { availableActions } from '@/utils/caseWorkspace';
import { DecideFooter } from './DecideFooter';

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
      </div>
      <button
        type="button"
        onClick={() => setAssigning((value) => !value)}
        aria-expanded={assigning}
        className="inline-flex min-h-11 items-center gap-1.5 self-center rounded-full px-3.5 text-[13px] font-semibold text-primary outline-none hover:bg-primary-tint focus-visible:ring-[3px] focus-visible:ring-primary/25 rail:min-h-9"
      >
        <Icon name={assigning ? 'expand_less' : 'add'} className="!text-lg" />
        Assign another sanction
      </button>
      {assigning ? <DecideFooter detail={detail} done={done} allowResolve={false} /> : null}
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
            await api.resolveCase(detail.id);
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
