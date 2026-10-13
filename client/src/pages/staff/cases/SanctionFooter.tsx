import { useState } from 'react';
import type { StaffCaseDetail, StaffProofFileView, StaffSanctionView } from '@shared/types';
import { ConfirmModal } from '@/components/feedback';
import { FilePreview } from '@/components/feedback/FilePreview';
import { Button } from '@/components/ui/Button';
import { FileRow } from '@/components/ui/FileRow';
import { Icon } from '@/components/ui/Icon';
import { api, toApiError } from '@/api/client';
import { availableActions, sanctionFooter } from '@/utils/caseWorkspace';
import { fileMeta } from '@/utils/files';
import { DecideFooter } from './DecideFooter';

const msg = (error: unknown): string => toApiError(error).message;

const nameOf = (detail: StaffCaseDetail): string => detail.student?.name ?? detail.claimed?.name ?? 'the student';

type Done = (toast: string) => void;

/** One sanction's proof box: files with View and "Viewed", the hint, the note and Verify / Return (src 701 to 727). */
function ProofBlock({ detail, sanction, titled, done, failed, onViewed }: {
  detail: StaffCaseDetail;
  sanction: StaffSanctionView;
  titled: boolean;
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
      await api.verifySanction(sanction.id);
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
      size="lg"
      className="flex-[1_1_140px] disabled:bg-success-disabled disabled:text-white"
      disabled={!view.canVerify}
      disabledReason="Open each file before verifying"
      busy={busy}
      onClick={() => void verify()}
    >
      Verify sanction
    </Button>
  );
  const returnButton = (
    <Button variant="danger" size="lg" className="flex-[1_1_140px]" onClick={() => setReturning(true)}>
      Return to student
    </Button>
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-hidden rounded-xl border border-line bg-white">
        <div className="flex items-center gap-2.5 border-b border-line-soft bg-surface-2 px-3.5 py-3">
          <Icon name="attach_file" className="!text-xl text-primary" />
          <span className="min-w-0 flex-1 text-sm font-bold text-ink">
            Submitted proof{titled ? ` · ${sanction.sanctionCode} ${sanction.type}` : ''}
          </span>
          {view.proofSub ? <span className="text-xs text-muted">{view.proofSub}</span> : null}
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
              meta={fileMeta(file)}
              viewed={file.viewed}
              onView={() => setPreviewing(file)}
              className="-mb-px rounded-none border-0 border-b border-line-soft"
            />
          ))
        )}
      </div>
      {view.needView ? (
        <p className="flex items-center gap-1.5 text-[13px] text-amber-ink">
          <Icon name="info" className="!text-lg" />
          Open each file before you verify this sanction.
        </p>
      ) : null}
      {view.note ? <p className="rounded-[10px] bg-warn-soft px-3.5 py-2.5 text-[13px] text-pretty text-amber-ink">{view.note}</p> : null}
      {view.pending ? (
        <div className="flex flex-wrap gap-2">
          {verifyButton}
          {returnButton}
        </div>
      ) : null}

      {previewing ? (
        <FilePreview
          file={{ name: previewing.name, meta: fileMeta(previewing) }}
          loadUrl={async () => (await api.fileUrl(previewing.id)).url}
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
            await api.returnSanction(sanction.id, reason);
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

/** For sanction: the proof of each open sanction, then "Resolve case" (green, enabled once every sanction is verified). */
export function SanctionFooter({ detail, done, failed, onViewed }: { detail: StaffCaseDetail; done: Done; failed: (error: unknown) => void; onViewed: () => void }) {
  const [resolving, setResolving] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const canResolve = availableActions(detail).includes('resolve');
  // Open sanctions first, newest first; a verified one shows only when nothing else is open.
  const ordered = [...detail.sanctions].sort((a, b) => Number(a.status === 'completed') - Number(b.status === 'completed') || b.id - a.id);
  const shown = ordered.filter((s) => s.status !== 'completed');
  const blocks = shown.length > 0 ? shown : ordered.slice(0, 1);
  const verified = detail.sanctions.filter((s) => s.status === 'completed').map((s) => s.sanctionCode).join(', ');

  return (
    <>
      {blocks.map((sanction) => (
        <ProofBlock key={sanction.id} detail={detail} sanction={sanction} titled={detail.sanctions.length > 1} done={done} failed={failed} onViewed={onViewed} />
      ))}
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
