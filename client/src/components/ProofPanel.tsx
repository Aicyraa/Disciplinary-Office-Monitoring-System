import { useRef, useState } from 'react';
import type { StudentSanctionView } from '@shared/types';
import { api, toApiError } from '../lib/api';
import { ACCEPTED_EXTENSIONS, MAX_FILES, checkSelection, formatSize } from '../lib/files';
import { buttonClass, Icon } from './ui';

type Notice = { tone: 'success' | 'error'; text: string };

/**
 * Proof upload for one sanction (SPEC 4.3, 6.1). What is offered comes from the API's `canUpload` and
 * `canChangeFiles`; the API enforces the same rules again, so this is only a convenience.
 */
export function ProofPanel({ sanction, onChanged }: { sanction: StudentSanctionView; onChanged: () => void }) {
  const [selected, setSelected] = useState<File[]>([]);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [busy, setBusy] = useState(false);
  const pickRef = useRef<HTMLInputElement>(null);
  const replaceRef = useRef<HTMLInputElement>(null);
  const [replaceTarget, setReplaceTarget] = useState<number | null>(null);

  if (sanction.status === 'completed' && sanction.files.length === 0) return null;

  async function run(work: () => Promise<void>, success: string) {
    setBusy(true);
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

  function submit() {
    const problem = checkSelection(selected, sanction.files.length);
    if (problem) {
      setNotice({ tone: 'error', text: problem });
      return;
    }
    void run(() => api.uploadProof(sanction.id, selected).then(() => undefined), 'Proof submitted. The office will review it.');
  }

  const lastFile = sanction.files.length <= 1;

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
          void run(() => api.uploadProof(sanction.id, [file], replaceTarget).then(() => undefined), 'File replaced.');
        }}
      />

      {sanction.canUpload ? (
        <div className="mt-3 rounded-md border border-dashed border-line-strong bg-white p-3">
          <label htmlFor={`proof-${sanction.id}`} className="block text-sm font-medium text-ink">
            {sanction.status === 'returned' ? 'Upload a corrected file' : 'Upload your proof'}
          </label>
          <p className="text-xs text-muted">
            PDF or DOCX, up to 10 MB each, at most {MAX_FILES} files. Choose your files, then press Upload.
          </p>
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
              // Picking again adds to the list (the same file twice is ignored).
              setSelected((current) => [
                ...current,
                ...picked.filter((file) => !current.some((c) => c.name === file.name && c.size === file.size)),
              ]);
              setNotice(null);
            }}
          />

          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => pickRef.current?.click()}
              className="inline-flex items-center gap-1 rounded-md border border-line-strong bg-white px-3 py-1.5 text-sm font-medium text-ink disabled:opacity-50"
            >
              <Icon name="attach_file" className="text-base" />
              Choose files
            </button>
            <button type="button" disabled={busy || selected.length === 0} onClick={submit} className={buttonClass}>
              {busy ? 'Uploading…' : 'Upload'}
            </button>
          </div>

          {selected.length === 0 ? (
            <p className="mt-2 text-xs text-muted">No file chosen yet.</p>
          ) : (
            <ul className="mt-2 space-y-1" aria-label="Files ready to upload">
              {selected.map((file) => (
                <li key={`${file.name}-${file.size}`} className="flex items-center justify-between gap-2 text-sm">
                  <span className="min-w-0 truncate text-ink">
                    {file.name} <span className="text-muted">({formatSize(file.size)})</span>
                  </span>
                  <button
                    type="button"
                    disabled={busy}
                    className="rounded-md px-2 py-0.5 text-xs font-medium text-danger disabled:opacity-50"
                    aria-label={`Do not upload ${file.name}`}
                    onClick={() => setSelected((current) => current.filter((c) => c !== file))}
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
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
