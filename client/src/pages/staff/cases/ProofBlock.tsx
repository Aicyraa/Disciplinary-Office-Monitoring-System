import { useState } from 'react';
import type { StaffCaseDetail, StaffProofFileView, StaffSanctionView } from '@shared/types';
import { ConfirmModal } from '@/components/feedback';
import { FilePreview } from '@/components/feedback/FilePreview';
import { StatusPill } from '@/components/ui';
import { Button } from '@/components/ui/Button';
import { FileRow } from '@/components/ui/FileRow';
import { Icon } from '@/components/ui/Icon';
import { toApiError } from '@/api/client';
import { sanctionsApi } from '@/api/sanctions';
import { sanctionFooter } from '@/utils/caseWorkspace';
import { fileMeta } from '@/utils/files';

const msg = (error: unknown): string => toApiError(error).message;
const nameOf = (detail: StaffCaseDetail): string => detail.student?.name ?? detail.claimed?.name ?? 'the student';
type Done = (toast: string) => void;

/** One sanction in the case's Files tab: status, files with View and "Viewed", the hint, the note and Verify / Return. */
export function ProofBlock({ detail, sanction, done, failed, onViewed }: {
  detail: StaffCaseDetail;
  sanction: StaffSanctionView;
  done: Done;
  failed: (error: unknown) => void;
  onViewed: () => void;
}) {
  const [previewing, setPreviewing] = useState<StaffProofFileView | null>(null);
  const [returning, setReturning] = useState(false);
  const [busy, setBusy] = useState(false);
  const view = sanctionFooter(sanction);

  async function verify() {
    setBusy(true);
    try {
      await sanctionsApi.verifySanction(sanction.id);
      setPreviewing(null);
      done(`${sanction.sanctionCode} verified.`);
    } catch (error) {
      failed(error);
    } finally {
      setBusy(false);
    }
  }

  const verifyButton = (
    <Button
      variant="success"
      size="md"
      className="flex-1 disabled:bg-success-disabled disabled:text-white"
      disabled={!view.canVerify}
      disabledReason="Open each file before verifying"
      busy={busy}
      onClick={() => void verify()}
    >
      Verify sanction
    </Button>
  );
  const returnButton = (
    <Button variant="danger" size="md" className="flex-1" onClick={() => setReturning(true)}>
      Return to student
    </Button>
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-hidden rounded-xl border border-line bg-white">
        <div className="flex items-center gap-2.5 border-b border-line-soft bg-surface-2 px-3.5 py-3">
          <Icon name="attach_file" className="!text-xl text-primary" />
          <span className="min-w-0 flex-1 text-sm font-bold text-ink">
            {sanction.sanctionCode} · {sanction.type}
          </span>
          <StatusPill status={sanction.status} kind="sanction" />
        </div>
        {view.noFilesText ? (
          <p className="flex items-center justify-center gap-1.5 px-3.5 py-[18px] text-center text-[13px] text-muted">
            <Icon name="hourglass_top" className="!text-lg" />
            {view.noFilesText}
          </p>
        ) : (
          sanction.files.map((file) => (
            <FileRow
              key={file.id}
              name={file.name}
              meta={fileMeta(file, 'Uploaded', false)}
              onView={() => setPreviewing(file)}
              className="-mb-px rounded-none border-0 border-b border-line-soft"
            />
          ))
        )}
        {view.pending ? (
          <div className="flex gap-2.5 border-t border-line-soft bg-surface-2 px-3.5 py-3">
            {verifyButton}
            {returnButton}
          </div>
        ) : null}
      </div>
      {view.needView ? (
        <p className="flex items-center gap-1.5 text-[13px] text-amber-ink">
          <Icon name="info" className="!text-lg" />
          Open each file before you verify this sanction.
        </p>
      ) : null}

      {previewing ? (
        <FilePreview
          file={{ name: previewing.name, meta: fileMeta(previewing, 'Uploaded', false) }}
          loadUrl={async () => (await sanctionsApi.fileUrl(previewing.id)).url}
          onLoaded={onViewed}
          onClose={() => setPreviewing(null)}
          footer={
            view.pending ? (
              <>
                <span className="min-w-0 flex-[1_1_200px] text-[13px] text-muted">
                  {view.canVerify ? 'All files viewed. You can verify this sanction.' : 'Open the other files before you verify.'}
                </span>
                {returnButton}
                {verifyButton}
              </>
            ) : undefined
          }
        />
      ) : null}
      <ConfirmModal
        open={returning}
        tone="danger"
        title={`Return ${sanction.sanctionCode} to the student?`}
        description="The sanction goes back to the student. Tell them what is missing."
        reasonLabel="What the student needs to fix"
        reasonPlaceholder="e.g. The service log is missing the supervisor’s signature."
        confirmLabel="Return sanction"
        onClose={() => setReturning(false)}
        onConfirm={async (reason) => {
          try {
            await sanctionsApi.returnSanction(sanction.id, reason);
          } catch (error) {
            throw new Error(msg(error));
          }
          setReturning(false);
          setPreviewing(null);
          done(`${sanction.sanctionCode} returned to ${nameOf(detail)}.`);
        }}
      />
    </div>
  );
}
