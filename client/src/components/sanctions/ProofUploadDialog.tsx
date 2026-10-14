import { useId, useRef, useState, type DragEvent, type KeyboardEvent } from 'react';
import { Dialog } from '@/components/feedback/Dialog';
import { Button } from '@/components/ui/Button';
import { FileRow } from '@/components/ui/FileRow';
import { Icon } from '@/components/ui/Icon';
import { cn } from '@/utils/cn';
import { ACCEPT_ATTRIBUTE, MAX_FILES, fileMeta } from '@/utils/files';

/**
 * The upload dialog for one sanction's proof: a drop area, the files chosen so far and the submit button.
 * Choosing and the rules (PDF only, size, count) are handled by the panel; this is the frame.
 */
export function ProofUploadDialog({
  open,
  inputId,
  title,
  subtitle,
  submitLabel,
  selected,
  existingCount,
  error,
  busy,
  percent,
  onPick,
  onRemove,
  onPreview,
  onSubmit,
  onClose,
}: {
  open: boolean;
  inputId: string;
  title: string;
  subtitle: string;
  submitLabel: string;
  selected: File[];
  /** Files already submitted for this sanction; they count toward the limit. */
  existingCount: number;
  error: string | null;
  busy: boolean;
  percent: number | null;
  onPick: (files: File[]) => void;
  onRemove: (file: File) => void;
  onPreview: (file: File) => void;
  onSubmit: () => void;
  onClose: () => void;
}) {
  const titleId = useId();
  const pickRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
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
    if (!busy) onPick(Array.from(event.dataTransfer.files));
  };
  const room = Math.max(0, MAX_FILES - existingCount);

  return (
    <Dialog open={open} labelledBy={titleId} onClose={busy ? undefined : onClose} maxWidth="max-w-[520px]">
      <div className="flex items-start gap-3">
        <span aria-hidden="true" className="grid size-10 shrink-0 place-items-center rounded-[10px] bg-info-soft text-primary">
          <Icon name="upload_file" className="!text-[22px]" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 id={titleId} className="text-xl font-bold text-pretty text-ink">
            {title}
          </h2>
          <p className="mt-0.5 text-[13px] text-muted">{subtitle}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          disabled={busy}
          aria-label="Close"
          className="grid size-9 shrink-0 place-items-center rounded-full text-muted outline-none hover:bg-primary-tint hover:text-primary focus-visible:ring-[3px] focus-visible:ring-primary/25 disabled:opacity-50"
        >
          <Icon name="close" className="!text-xl" />
        </button>
      </div>

      <input
        ref={pickRef}
        id={inputId}
        type="file"
        multiple
        accept={ACCEPT_ATTRIBUTE}
        className="sr-only"
        tabIndex={-1}
        onChange={(event) => {
          const picked = Array.from(event.target.files ?? []);
          event.target.value = '';
          onPick(picked);
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
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false);
        }}
        onDrop={onDrop}
        className={cn(
          'flex min-h-36 cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border-[1.5px] border-dashed px-4 py-5 text-center outline-none transition-colors hover:border-primary hover:bg-upload-hover focus-visible:ring-[3px] focus-visible:ring-primary/35',
          dragging ? 'border-primary bg-upload-hover' : 'border-upload-line bg-upload-bg',
          busy && 'cursor-not-allowed opacity-60',
        )}
      >
        <Icon name="cloud_upload" className="!text-[36px] text-primary" />
        <span className="text-[15px] font-bold text-ink">Choose files to upload</span>
        <span className="text-[13px] text-pretty text-muted">
          <span className="rail:hidden">Tap to choose</span>
          <span className="hidden rail:inline">Click to choose or drag files here</span> · PDF only, up to 10 MB each, {MAX_FILES} files max
        </span>
      </div>

      {error ? (
        <p role="alert" className="flex items-start gap-1.5 text-[13px] font-semibold text-danger">
          <Icon name="error" className="!text-lg" />
          {error}
        </p>
      ) : null}

      {selected.length > 0 ? (
        <div className="overflow-hidden rounded-[10px] border border-line-soft" aria-label="Files to submit">
          {selected.map((file) => (
            <FileRow
              key={`${file.name}-${file.size}`}
              name={file.name}
              meta={`${fileMeta({ name: file.name, sizeBytes: file.size })} · Not submitted yet`}
              onView={() => onPreview(file)}
              onRemove={busy ? undefined : () => onRemove(file)}
              className="-mb-px rounded-none border-0 border-b border-line-soft"
            />
          ))}
        </div>
      ) : (
        <p className="text-center text-xs text-muted">
          {room === 0 ? 'The file limit is reached.' : `You can add up to ${room} more ${room === 1 ? 'file' : 'files'}.`}
        </p>
      )}

      <div className="mt-1 flex flex-wrap justify-end gap-2.5">
        <Button variant="neutral" size="lg" onClick={onClose} disabled={busy}>
          Cancel
        </Button>
        <Button
          size="lg"
          busy={busy}
          busyLabel={`Uploading…${percent === null ? '' : ` ${percent}%`}`}
          disabled={selected.length === 0}
          onClick={onSubmit}
        >
          {selected.length === 0 ? 'Add a file to submit' : submitLabel}
        </Button>
      </div>
    </Dialog>
  );
}
