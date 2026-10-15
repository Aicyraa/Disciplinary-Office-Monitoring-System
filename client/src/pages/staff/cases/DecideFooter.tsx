import { useState } from 'react';
import type { StaffCaseDetail } from '@shared/types';
import { ConfirmModal } from '@/components/feedback';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { toApiError } from '@/api/client';
import { casesApi } from '@/api/cases';
import { AssignSanctionModal } from './AssignSanctionModal';

const msg = (error: unknown): string => toApiError(error).message;

const nameOf = (detail: StaffCaseDetail): string => detail.student?.name ?? detail.claimed?.name ?? 'the student';

type Done = (toast: string) => void;

/** Validated: "Assign sanction" (opens the dialog) and "Resolve without sanction". */
export function DecideFooter({ detail, done }: { detail: StaffCaseDetail; done: Done }) {
  const [assigning, setAssigning] = useState(false);
  const [resolving, setResolving] = useState(false);

  return (
    <>
      <div className="flex flex-wrap gap-2.5">
        <Button size="lg" className="flex-[2_1_180px]" onClick={() => setAssigning(true)}>
          <Icon name="gavel" className="!text-lg" />
          Assign sanction
        </Button>
        <Button variant="neutral" size="lg" className="flex-[1_1_160px]" onClick={() => setResolving(true)}>
          Resolve without sanction
        </Button>
      </div>
      {assigning ? <AssignSanctionModal detail={detail} onClose={() => setAssigning(false)} done={(toast) => { setAssigning(false); done(toast); }} /> : null}
      <ConfirmModal
        open={resolving}
        tone="ok"
        title={`Resolve ${detail.code} without a sanction?`}
        description={`The case closes with no sanction. ${nameOf(detail)} is notified.`}
        reasonLabel="Reason (saved to case history)"
        reasonPlaceholder="e.g. First report, settled with a verbal reminder."
        confirmLabel="Resolve case"
        cancelLabel="Keep open"
        onClose={() => setResolving(false)}
        onConfirm={async (reason) => {
          try {
            await casesApi.resolveWithoutSanction(detail.id, reason);
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
