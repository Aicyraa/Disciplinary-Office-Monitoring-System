import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import type { StudentSanctionView } from '@shared/types';
import { api, toApiError } from '@/api/client';
import { ConfirmModal, useToast } from '@/components/feedback';
import { FilePreview, type PreviewFile } from '@/components/feedback/FilePreview';
import { StatusPill } from '@/components/ui';
import { Button } from '@/components/ui/Button';
import { FileRow } from '@/components/ui/FileRow';
import { ProofUploadDialog } from '@/components/sanctions/ProofUploadDialog';
import { Icon } from '@/components/ui/Icon';
import { ACCEPT_ATTRIBUTE, checkSelection, fileMeta, lastFileRemovalMessage, splitSelection } from '@/utils/files';
import { uploadPanel } from '@/utils/studentView';

/**
 * Proof of completion for one sanction (deck src 1187 to 1224, SPEC 4.3, 6.1). What is offered follows the API's
 * `canUpload` and `canChangeFiles`; the API enforces the same rules again. Files are PDF only (D7).
 */
export function ProofPanel({
  sanction,
  handbookEntryId,
  onChanged,
}: {
  sanction: StudentSanctionView;
  /** The case's handbook entry, for "View this offense in the Handbook" (its templates are listed there). */
  handbookEntryId?: number;
  onChanged: () => void;
}) {
  const toast = useToast();
  const [selected, setSelected] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [percent, setPercent] = useState<number | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const replaceRef = useRef<HTMLInputElement>(null);
  const [replaceTarget, setReplaceTarget] = useState<number | null>(null);
  const [previewing, setPreviewing] = useState<{ file: PreviewFile; loadUrl: () => Promise<string> } | null>(null);
  const [removing, setRemoving] = useState<{ id: number; name: string } | null>(null);
  const panel = uploadPanel(sanction);
  const canChange = sanction.canChangeFiles && !busy;

  async function run(work: () => Promise<void>, success: string) {
    setBusy(true);
    setPercent(null);
    setError(null);
    try {
      await work();
      toast.show(success, 'success');
      setSelected([]);
      setDialogOpen(false);
      onChanged();
    } catch (caught) {
      setError(toApiError(caught).message);
      onChanged();
    } finally {
      setBusy(false);
      setPercent(null);
      setReplaceTarget(null);
    }
  }

  /** Picking or dropping adds to the list; a wrong file is refused with a message and the others stay. */
  function addFiles(picked: File[]) {
    if (picked.length === 0) return;
    const fresh = picked.filter((file) => !selected.some((c) => c.name === file.name && c.size === file.size));
    const { accepted, error: problem } = splitSelection(fresh, sanction.files.length + selected.length);
    setSelected((current) => [...current, ...accepted]);
    setError(problem);
  }

  function submit() {
    const problem = checkSelection(selected, sanction.files.length);
    if (problem) {
      setError(problem);
      return;
    }
    void run(() => api.uploadProof(sanction.id, selected, undefined, setPercent).then(() => undefined), `Proof submitted for ${sanction.sanctionCode}.`);
  }

  function askRemove(file: { id: number; name: string }) {
    const blocked = lastFileRemovalMessage(sanction.status, sanction.files.length);
    if (blocked) setError(blocked);
    else setRemoving(file);
  }

  function closeDialog() {
    setDialogOpen(false);
    setSelected([]);
    setError(null);
  }

  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-line">
      <div className="flex items-center gap-3 border-b border-line-soft bg-surface-2 px-4 py-3.5">
        <span aria-hidden="true" className="grid size-9 shrink-0 place-items-center rounded-[10px] bg-info-soft text-primary">
          <Icon name="upload_file" className="!text-xl" />
        </span>
        <span className="min-w-0 flex-1 leading-snug">
          <span className="block text-[15px] font-bold text-ink">{panel.title}</span>
          <span className="block truncate text-xs text-muted">{panel.sub}</span>
        </span>
        <StatusPill status={sanction.status} kind="sanction" />
      </div>

      {panel.returned ? (
        <p role="alert" className="mx-4 mt-3.5 flex items-center gap-2 rounded-[10px] bg-bad-soft px-3.5 py-2.5 text-[13px] text-pretty text-bad-ink">
          <Icon name="undo" className="!text-lg" />
          {panel.returned}
        </p>
      ) : null}

      {/* One hidden input serves every Replace button. */}
      <input
        ref={replaceRef}
        type="file"
        accept={ACCEPT_ATTRIBUTE}
        className="sr-only"
        aria-label="Choose the replacement file"
        tabIndex={-1}
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = '';
          if (!file || replaceTarget === null) return;
          const problem = checkSelection([file], 0);
          if (problem) {
            setError(problem);
            toast.show(problem.includes('10 MB') ? 'Replacement failed. The file is over 10 MB.' : 'Replacement failed. Use a PDF file.', 'error');
            return;
          }
          const old = sanction.files.find((f) => f.id === replaceTarget)?.name ?? 'the file';
          void run(() => api.uploadProof(sanction.id, [file], replaceTarget, setPercent).then(() => undefined), `Replaced ${old} with ${file.name}.`);
        }}
      />

      {panel.open && sanction.canUpload ? (
        <div className="mx-4 mt-3.5 flex flex-col gap-1.5">
          <Button size="xl" fullWidth onClick={() => setDialogOpen(true)} disabled={busy}>
            <Icon name="upload_file" className="!text-xl" />
            {sanction.status === 'returned' ? 'Upload new proof' : 'Upload proof'}
          </Button>
          <p className="text-center text-xs text-muted">PDF only, up to 10 MB each. Opens a window to choose your files.</p>
        </div>
      ) : null}

      {error && !dialogOpen ? (
        <p role="alert" className="mx-4 mt-2.5 flex items-center gap-1.5 text-[13px] font-semibold text-danger">
          <Icon name="error" className="!text-lg" />
          {error}
        </p>
      ) : null}

      {panel.open && handbookEntryId !== undefined ? (
        <Link
          to={`/handbook/${handbookEntryId}`}
          className="mx-3 mt-2.5 inline-flex min-h-9 items-center gap-1.5 self-start rounded-lg px-2 text-[13px] font-semibold text-primary outline-none hover:bg-primary-tint focus-visible:ring-[3px] focus-visible:ring-primary/25"
        >
          <Icon name="menu_book" className="!text-lg" />
          View this offense in the Handbook
        </Link>
      ) : null}

      {sanction.files.length > 0 ? (
        <div className="mx-4 mt-3.5 overflow-hidden rounded-[10px] border border-line-soft" aria-label="Proof files">
          {sanction.files.map((file) => (
            <FileRow
              key={file.id}
              name={file.name}
              meta={fileMeta(file)}
              onView={() => setPreviewing({ file: { name: file.name, meta: fileMeta(file) }, loadUrl: async () => (await api.fileUrl(file.id)).url })}
              onReplace={
                canChange
                  ? () => {
                      setReplaceTarget(file.id);
                      replaceRef.current?.click();
                    }
                  : undefined
              }
              onRemove={canChange ? () => askRemove(file) : undefined}
              className="-mb-px rounded-none border-0 border-b border-line-soft"
            />
          ))}
        </div>
      ) : null}

      <div className="flex flex-col gap-2 px-4 pt-3.5 pb-4">
        {panel.note ? (
          <p role="status" className="flex items-center gap-2 text-[13px] text-pretty text-muted">
            <Icon name={panel.note.icon} className="!text-lg" />
            {panel.note.text}
          </p>
        ) : null}
      </div>

      <ProofUploadDialog
        open={dialogOpen && panel.open && sanction.canUpload}
        inputId={`proof-${sanction.id}`}
        title={panel.title}
        subtitle={panel.sub}
        submitLabel={panel.submitLabel}
        selected={selected}
        existingCount={sanction.files.length}
        error={error}
        busy={busy}
        percent={percent}
        onPick={addFiles}
        onRemove={(file) => setSelected((current) => current.filter((c) => c !== file))}
        onPreview={(file) =>
          setPreviewing({
            file: { name: file.name, meta: `${fileMeta({ name: file.name, sizeBytes: file.size })} · Not submitted yet` },
            loadUrl: async () => URL.createObjectURL(file),
          })
        }
        onSubmit={submit}
        onClose={closeDialog}
      />
      {previewing ? <FilePreview file={previewing.file} loadUrl={previewing.loadUrl} onClose={() => setPreviewing(null)} /> : null}
      <ConfirmModal
        open={removing !== null}
        tone="danger"
        title={`Remove “${removing?.name ?? ''}”?`}
        description={`The SDO will no longer see this file for sanction ${sanction.sanctionCode}. Your other files stay submitted.`}
        confirmLabel="Remove file"
        cancelLabel="Keep it"
        onClose={() => setRemoving(null)}
        onConfirm={async () => {
          const target = removing;
          if (!target) return;
          try {
            await api.deleteProofFile(target.id);
          } catch (caught) {
            throw new Error(toApiError(caught).message);
          }
          setRemoving(null);
          toast.show(`Removed ${target.name}.`, 'success');
          onChanged();
        }}
      />
    </div>
  );
}
