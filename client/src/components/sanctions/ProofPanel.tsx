import { useRef, useState, type DragEvent, type KeyboardEvent } from 'react';
import { Link } from 'react-router-dom';
import type { StudentSanctionView } from '@shared/types';
import { api, toApiError } from '@/api/client';
import { ConfirmModal, useToast } from '@/components/feedback';
import { FilePreview, type PreviewFile } from '@/components/feedback/FilePreview';
import { Button } from '@/components/ui/Button';
import { FileRow } from '@/components/ui/FileRow';
import { Icon } from '@/components/ui/Icon';
import { cn } from '@/utils/cn';
import { ACCEPT_ATTRIBUTE, MAX_FILES, checkSelection, fileMeta, lastFileRemovalMessage, splitSelection } from '@/utils/files';
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
  const [dragging, setDragging] = useState(false);
  const pickRef = useRef<HTMLInputElement>(null);
  const replaceRef = useRef<HTMLInputElement>(null);
  const [replaceTarget, setReplaceTarget] = useState<number | null>(null);
  const [previewing, setPreviewing] = useState<{ file: PreviewFile; loadUrl: () => Promise<string> } | null>(null);
  const [removing, setRemoving] = useState<{ id: number; name: string } | null>(null);
  const panel = uploadPanel(sanction);
  const canEdit = sanction.canUpload && !busy;
  const canChange = sanction.canChangeFiles && !busy;

  async function run(work: () => Promise<void>, success: string) {
    setBusy(true);
    setPercent(null);
    setError(null);
    try {
      await work();
      toast.show(success, 'success');
      setSelected([]);
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

  const openPicker = () => {
    if (canEdit) pickRef.current?.click();
  };
  const onZoneKey = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      openPicker();
    }
  };
  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    if (canEdit) addFiles(Array.from(event.dataTransfer.files));
  };

  return (
    <div className="flex flex-col">
      {panel.returned ? (
        <p role="alert" className="mb-3.5 flex items-center gap-2 rounded-[10px] bg-bad-soft px-3.5 py-2.5 text-[13px] text-pretty text-bad-ink">
          <Icon name="undo" className="!text-lg" />
          {panel.returned}
        </p>
      ) : null}

      <input
        ref={pickRef}
        id={`proof-${sanction.id}`}
        type="file"
        multiple
        accept={ACCEPT_ATTRIBUTE}
        className="sr-only"
        tabIndex={-1}
        onChange={(event) => {
          const picked = Array.from(event.target.files ?? []);
          event.target.value = '';
          addFiles(picked);
        }}
      />
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
        <div
          role="button"
          tabIndex={0}
          aria-disabled={busy}
          aria-label="Choose files to upload"
          onClick={openPicker}
          onKeyDown={onZoneKey}
          onDragEnter={(event) => {
            event.preventDefault();
            if (canEdit) setDragging(true);
          }}
          onDragOver={(event) => event.preventDefault()}
          onDragLeave={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false);
          }}
          onDrop={onDrop}
          className={cn(
            'flex min-h-32 cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border-[1.5px] border-dashed px-4 py-[18px] text-center outline-none transition-colors hover:border-primary hover:bg-upload-hover focus-visible:ring-[3px] focus-visible:ring-primary/35',
            dragging ? 'border-primary bg-upload-hover' : 'border-upload-line bg-upload-bg',
            busy && 'cursor-not-allowed opacity-60',
          )}
        >
          <Icon name="cloud_upload" className="!text-[32px] text-primary" />
          <span className="text-[15px] font-bold text-ink">Choose files to upload</span>
          <span className="text-[13px] text-pretty text-muted">
            <span className="rail:hidden">Tap to choose</span>
            <span className="hidden rail:inline">Click to choose or drag files here</span> · PDF only, up to 10 MB each, {MAX_FILES} files max
          </span>
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="mt-2.5 flex items-center gap-1.5 text-[13px] font-semibold text-danger">
          <Icon name="error" className="!text-lg" />
          {error}
        </p>
      ) : null}

      {panel.open && handbookEntryId !== undefined ? (
        <Link
          to={`/handbook/${handbookEntryId}`}
          aria-label="View this offense in the Handbook"
          className="group relative mt-2.5 grid size-9 place-items-center self-start rounded-full text-primary outline-none hover:bg-primary-tint focus-visible:ring-[3px] focus-visible:ring-primary/25"
        >
          <Icon name="menu_book" className="!text-xl" />
          <span
            role="tooltip"
            className="pointer-events-none absolute top-1/2 left-full ml-2 -translate-y-1/2 rounded-lg bg-ink px-2.5 py-1.5 text-xs font-semibold whitespace-nowrap text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
          >
            View this offense in the Handbook
          </span>
        </Link>
      ) : null}

      {sanction.files.length + selected.length > 0 ? (
        <div className="mt-3.5 overflow-hidden rounded-[10px] border border-line-soft" aria-label="Proof files">
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
          {selected.map((file) => {
            const meta = `${fileMeta({ name: file.name, sizeBytes: file.size })} · Not submitted yet`;
            return (
              <FileRow
                key={`${file.name}-${file.size}`}
                name={file.name}
                meta={meta}
                onView={() => setPreviewing({ file: { name: file.name, meta }, loadUrl: async () => URL.createObjectURL(file) })}
                onRemove={busy ? undefined : () => setSelected((current) => current.filter((c) => c !== file))}
                className="-mb-px rounded-none border-0 border-b border-line-soft"
              />
            );
          })}
        </div>
      ) : null}

      <div className="flex flex-col gap-2 pt-3.5">
        {panel.open && sanction.canUpload ? (
          <Button
            size="xl"
            fullWidth
            busy={busy}
            busyLabel={`Uploading…${percent === null ? '' : ` ${percent}%`}`}
            disabled={selected.length === 0}
            onClick={submit}
          >
            {selected.length === 0 ? 'Add a file to submit' : panel.submitLabel}
          </Button>
        ) : null}
        {panel.note ? (
          <p role="status" className="flex items-center gap-2 text-[13px] text-pretty text-muted">
            <Icon name={panel.note.icon} className="!text-lg" />
            {panel.note.text}
          </p>
        ) : null}
      </div>

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
