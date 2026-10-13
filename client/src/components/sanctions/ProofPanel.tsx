import { useRef, useState, type DragEvent, type KeyboardEvent } from 'react';
import type { StudentSanctionView } from '@shared/types';
import { api, toApiError } from '@/api/client';
import { ACCEPT_ATTRIBUTE, MAX_FILES, checkSelection, fileMeta, lastFileRemovalMessage, splitSelection, uploadButtonLabel } from '@/utils/files';
import { Icon } from '@/components/ui/Icon';
import { FileRow } from '@/components/ui/FileRow';
import { ConfirmModal, useToast } from '@/components/feedback';
import { FilePreview, type PreviewFile } from '@/components/feedback/FilePreview';

type Notice = { tone: 'success' | 'error'; text: string };

/**
 * Proof upload for one sanction (SPEC 4.3, 6.1). What is offered comes from the API's `canUpload` and
 * `canChangeFiles`; the API enforces the same rules again, so this is only a convenience.
 */
export function ProofPanel({ sanction, onChanged }: { sanction: StudentSanctionView; onChanged: () => void }) {
  const [selected, setSelected] = useState<File[]>([]);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [busy, setBusy] = useState(false);
  const [percent, setPercent] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);
  const pickRef = useRef<HTMLInputElement>(null);
  const replaceRef = useRef<HTMLInputElement>(null);
  const [replaceTarget, setReplaceTarget] = useState<number | null>(null);
  const [previewing, setPreviewing] = useState<{ file: PreviewFile; loadUrl: () => Promise<string> } | null>(null);
  const [removing, setRemoving] = useState<{ id: number; name: string } | null>(null);
  const toast = useToast();

  if (sanction.status === 'completed' && sanction.files.length === 0) return null;

  async function run(work: () => Promise<void>, success: string) {
    setBusy(true);
    setPercent(null);
    setNotice(null);
    try {
      await work();
      toast.show(success, 'success');
      setSelected([]);
      if (pickRef.current) pickRef.current.value = '';
      onChanged();
    } catch (error) {
      setNotice({ tone: 'error', text: toApiError(error).message });
      onChanged();
    } finally {
      setBusy(false);
      setPercent(null);
      setReplaceTarget(null);
    }
  }

  /** Uploaded files open in the preview modal through the API's short-lived link; never in a new tab. */
  function viewUploaded(file: StudentSanctionView['files'][number]) {
    setPreviewing({ file: { name: file.name, meta: fileMeta(file) }, loadUrl: async () => (await api.fileUrl(file.id)).url });
  }

  /** A chosen file not sent yet previews from the browser's own copy. */
  function viewChosen(file: File) {
    setPreviewing({
      file: { name: file.name, meta: fileMeta({ name: file.name, sizeBytes: file.size }) },
      loadUrl: async () => URL.createObjectURL(file),
    });
  }

  function askRemove(file: { id: number; name: string }) {
    // Deck src 2473: the last submitted file can only be replaced.
    const blocked = lastFileRemovalMessage(sanction.status, sanction.files.length);
    if (blocked) {
      setNotice({ tone: 'error', text: blocked });
      return;
    }
    setRemoving(file);
  }

  /** Picking or dropping again adds to the list (the same file twice is ignored); a wrong file is refused, the others stay. */
  function addFiles(picked: File[]) {
    if (picked.length === 0) return;
    const fresh = picked.filter((file) => !selected.some((c) => c.name === file.name && c.size === file.size));
    const { accepted, error } = splitSelection(fresh, sanction.files.length + selected.length);
    setSelected((current) => [...current, ...accepted]);
    setNotice(error ? { tone: 'error', text: error } : null);
  }

  function submit() {
    const problem = checkSelection(selected, sanction.files.length);
    if (problem) {
      setNotice({ tone: 'error', text: problem });
      return;
    }
    void run(
      () => api.uploadProof(sanction.id, selected, undefined, setPercent).then(() => undefined),
      `Proof submitted for ${sanction.sanctionCode}.`,
    );
  }

  const openPicker = () => {
    if (!busy) pickRef.current?.click();
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
    if (!busy) addFiles(Array.from(event.dataTransfer.files));
  };

  const title = sanction.status === 'returned' ? 'Upload a corrected file' : 'Upload your proof';

  return (
    <div className="mt-3 rounded-md bg-page p-3">
      <h3 className="text-sm font-semibold text-ink">Proof of completion</h3>

      {sanction.files.length > 0 ? (
        <div className="mt-2 flex flex-col gap-2">
          {sanction.files.map((file) => (
            <FileRow
              key={file.id}
              name={file.name}
              meta={fileMeta(file)}
              onView={() => viewUploaded(file)}
              onReplace={
                sanction.canChangeFiles && !busy
                  ? () => {
                      setReplaceTarget(file.id);
                      replaceRef.current?.click();
                    }
                  : undefined
              }
              onRemove={sanction.canChangeFiles && !busy ? () => askRemove(file) : undefined}
            />
          ))}
        </div>
      ) : (
        <p className="mt-1 text-sm text-muted">No file uploaded yet.</p>
      )}

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
            setNotice({ tone: 'error', text: problem });
            toast.show('Replacement failed. Use a PDF file.', 'error');
            return;
          }
          const old = sanction.files.find((f) => f.id === replaceTarget)?.name ?? 'the file';
          void run(
            () => api.uploadProof(sanction.id, [file], replaceTarget, setPercent).then(() => undefined),
            `Replaced ${old} with ${file.name}.`,
          );
        }}
      />

      {sanction.canUpload ? (
        <div className="mt-3 overflow-hidden rounded-lg border border-line bg-white">
          <div className="flex items-center gap-3 border-b border-line bg-page px-3 py-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
              <Icon name="upload_file" />
            </span>
            <div className="min-w-0">
              <label htmlFor={`proof-${sanction.id}`} className="block text-sm font-semibold text-ink">
                {title}
              </label>
              <p className="truncate text-xs text-muted">
                {sanction.sanctionCode} · {sanction.type}
              </p>
            </div>
          </div>

          <div className="p-3">
            <input
              id={`proof-${sanction.id}`}
              ref={pickRef}
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

            <div
              role="button"
              tabIndex={0}
              aria-disabled={busy}
              aria-label="Choose files to upload"
              onClick={openPicker}
              onKeyDown={onZoneKey}
              onDragEnter={(event) => {
                event.preventDefault();
                if (!busy) setDragging(true);
              }}
              onDragOver={(event) => event.preventDefault()}
              onDragLeave={(event) => {
                // Moving over a child element fires dragleave on the container too: only clear when truly leaving.
                if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false);
              }}
              onDrop={onDrop}
              className={`flex cursor-pointer flex-col items-center rounded-lg border-2 border-dashed px-4 py-6 text-center transition-colors hover:border-primary hover:bg-upload-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
                dragging ? 'border-primary bg-upload-hover' : 'border-upload-line bg-upload-bg'
              } ${busy ? 'cursor-not-allowed opacity-60' : ''}`}
            >
              <Icon name="cloud_upload" className="text-4xl text-primary" />
              <p className="mt-1 text-sm font-semibold text-ink">Choose files to upload</p>
              <p className="mt-1 text-xs text-muted">Click to choose or drag files here · PDF only, up to 10 MB each, {MAX_FILES} files max</p>
            </div>

            {selected.length > 0 ? (
              <div className="mt-3 flex flex-col gap-2" aria-label="Files ready to upload">
                {selected.map((file) => (
                  <FileRow
                    key={`${file.name}-${file.size}`}
                    name={file.name}
                    meta={fileMeta({ name: file.name, sizeBytes: file.size })}
                    onView={() => viewChosen(file)}
                    onRemove={busy ? undefined : () => setSelected((current) => current.filter((c) => c !== file))}
                  />
                ))}
              </div>
            ) : null}

            {busy ? (
              <div
                role="progressbar"
                aria-label="Upload progress"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={percent ?? undefined}
                className="mt-3 h-2 overflow-hidden rounded-full bg-line"
              >
                <div
                  className={`h-full rounded-full bg-primary transition-[width] ${percent === null ? 'w-1/3 animate-pulse' : ''}`}
                  style={percent === null ? undefined : { width: `${percent}%` }}
                />
              </div>
            ) : null}

            <button
              type="button"
              disabled={busy || selected.length === 0}
              onClick={submit}
              className="mt-3 inline-flex w-full items-center justify-center rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-active disabled:cursor-not-allowed disabled:bg-line disabled:text-muted"
            >
              {uploadButtonLabel({ count: selected.length, busy, percent })}
            </button>
          </div>
        </div>
      ) : null}

      {sanction.status === 'pending_verification' && !sanction.canChangeFiles ? (
        <p className="mt-2 text-xs text-muted">The office is reviewing this proof, so it can no longer be changed.</p>
      ) : null}

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
          } catch (error) {
            throw new Error(toApiError(error).message);
          }
          setRemoving(null);
          toast.show(`Removed ${target.name}.`, 'success');
          onChanged();
        }}
      />

      {notice ? (
        <p
          role={notice.tone === 'error' ? 'alert' : 'status'}
          className={`mt-2 text-sm font-medium ${notice.tone === 'error' ? 'text-danger' : 'text-success'}`}
        >
          {notice.text}
        </p>
      ) : null}
    </div>
  );
}
