import { useRef, useState, type DragEvent, type KeyboardEvent } from 'react';
import type { StudentSanctionView } from '@shared/types';
import { api, toApiError } from '../lib/api';
import { ACCEPTED_EXTENSIONS, MAX_FILES, checkSelection, formatSize, uploadButtonLabel } from '../lib/files';
import { Icon } from './ui';

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

  if (sanction.status === 'completed' && sanction.files.length === 0) return null;

  async function run(work: () => Promise<void>, success: string) {
    setBusy(true);
    setPercent(null);
    setNotice(null);
    try {
      await work();
      setNotice({ tone: 'success', text: success });
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

  async function open(fileId: number) {
    const tab = window.open('', '_blank');
    try {
      const { url } = await api.fileUrl(fileId);
      if (tab) tab.location.href = url;
      else window.location.href = url;
    } catch (error) {
      tab?.close();
      setNotice({ tone: 'error', text: toApiError(error).message });
    }
  }

  /** Picking or dropping again adds to the list (the same file twice is ignored). */
  function addFiles(picked: File[]) {
    if (picked.length === 0) return;
    setSelected((current) => [
      ...current,
      ...picked.filter((file) => !current.some((c) => c.name === file.name && c.size === file.size)),
    ]);
    setNotice(null);
  }

  function submit() {
    const problem = checkSelection(selected, sanction.files.length);
    if (problem) {
      setNotice({ tone: 'error', text: problem });
      return;
    }
    void run(
      () => api.uploadProof(sanction.id, selected, undefined, setPercent).then(() => undefined),
      'Proof uploaded. The office will review it.',
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

  const lastFile = sanction.files.length <= 1;
  const title = sanction.status === 'returned' ? 'Upload a corrected file' : 'Upload your proof';

  return (
    <div className="mt-3 rounded-md bg-page p-3">
      <h3 className="text-sm font-semibold text-ink">Proof of completion</h3>

      {sanction.files.length > 0 ? (
        <ul className="mt-2 space-y-1">
          {sanction.files.map((file) => (
            <li key={file.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <button type="button" onClick={() => void open(file.id)} className="text-left text-primary underline">
                {file.name}
              </button>
              <span className="flex items-center gap-2">
                <span className="text-muted">{formatSize(file.sizeBytes)}</span>
                {sanction.canChangeFiles ? (
                  <>
                    <button
                      type="button"
                      disabled={busy}
                      className="rounded-md border border-line-strong bg-white px-2 py-0.5 text-xs font-medium text-ink"
                      onClick={() => {
                        setReplaceTarget(file.id);
                        replaceRef.current?.click();
                      }}
                    >
                      Replace
                    </button>
                    <button
                      type="button"
                      disabled={busy || (sanction.status === 'pending_verification' && lastFile)}
                      title={
                        sanction.status === 'pending_verification' && lastFile
                          ? 'You cannot remove the last file. Replace it instead.'
                          : undefined
                      }
                      className="rounded-md border border-line-strong bg-white px-2 py-0.5 text-xs font-medium text-danger disabled:opacity-50"
                      onClick={() => void run(() => api.deleteProofFile(file.id).then(() => undefined), 'File removed.')}
                    >
                      Remove
                    </button>
                  </>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-1 text-sm text-muted">No file uploaded yet.</p>
      )}

      {/* One hidden input serves every Replace button. */}
      <input
        ref={replaceRef}
        type="file"
        accept={ACCEPTED_EXTENSIONS.join(',')}
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
            return;
          }
          void run(() => api.uploadProof(sanction.id, [file], replaceTarget, setPercent).then(() => undefined), 'File replaced.');
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
              accept={ACCEPTED_EXTENSIONS.join(',')}
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
              className={`flex cursor-pointer flex-col items-center rounded-lg border-2 border-dashed px-4 py-6 text-center transition-colors hover:border-primary hover:bg-primary/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
                dragging ? 'border-primary bg-primary/5' : 'border-line-strong bg-white'
              } ${busy ? 'cursor-not-allowed opacity-60' : ''}`}
            >
              <Icon name="cloud_upload" className="text-4xl text-primary" />
              <p className="mt-1 text-sm font-semibold text-ink">Choose files to upload</p>
              <p className="mt-1 text-xs text-muted">Click to choose or drag files here · PDF or DOCX, up to 10 MB each, {MAX_FILES} files max</p>
            </div>

            {selected.length > 0 ? (
              <ul className="mt-3 space-y-1" aria-label="Files ready to upload">
                {selected.map((file) => (
                  <li key={`${file.name}-${file.size}`} className="flex items-center justify-between gap-2 text-sm">
                    <span className="flex min-w-0 items-center gap-2">
                      <Icon name="description" className="text-base text-muted" />
                      <span className="truncate text-ink">{file.name}</span>
                      <span className="shrink-0 text-xs text-muted">({formatSize(file.size)})</span>
                    </span>
                    <button
                      type="button"
                      disabled={busy}
                      className="shrink-0 rounded-md px-2 py-0.5 text-xs font-medium text-danger disabled:opacity-50"
                      aria-label={`Do not upload ${file.name}`}
                      onClick={() => setSelected((current) => current.filter((c) => c !== file))}
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
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
