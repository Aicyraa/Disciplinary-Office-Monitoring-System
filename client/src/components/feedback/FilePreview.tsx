import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { Icon } from '@/components/ui/Icon';
import { toApiError } from '@/api/client';
import { canPreview } from '@/utils/files';
import { Spinner } from './PageState';
import { useDialogFocus } from './useDialogFocus';

export interface PreviewFile {
  name: string;
  /** "PDF · 242 KB · Uploaded Oct 7, 2:28 PM" */
  meta: string;
}

export type PreviewState = { status: 'loading' } | { status: 'ready'; url: string } | { status: 'error'; message: string };

const CANNOT_PREVIEW = 'This file could not be previewed here. Download it instead.';

const iconButton =
  'inline-flex size-11 shrink-0 items-center justify-center rounded-full outline-none hover:bg-primary-tint focus-visible:ring-[3px] focus-visible:ring-primary/25';

/** The preview modal as the deck draws it (W24, src 1952). Presentational, so it renders in tests. */
export function FilePreviewFrame({
  file,
  state,
  onClose,
  onDownload,
  footer,
}: {
  file: PreviewFile;
  state: PreviewState;
  onClose: () => void;
  onDownload: () => void;
  footer?: ReactNode;
}) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  useDialogFocus({ open: true, panelRef, onClose });

  return (
    <div
      className="fixed inset-0 z-[85] flex items-stretch justify-center bg-ink/60 rail:items-center rail:p-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="flex h-full w-full max-w-[980px] flex-col overflow-hidden bg-white shadow-[0_20px_50px_rgba(16,22,52,0.35)] rail:h-[min(88vh,920px)] rail:rounded-[14px]"
      >
        <div className="flex shrink-0 items-center gap-3 border-b border-line pt-[calc(10px+env(safe-area-inset-top))] pr-3 pb-3 pl-4 rail:pt-3">
          <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-[10px] bg-bad-soft text-bad-ink">
            <Icon name="picture_as_pdf" />
          </span>
          <div className="min-w-0 flex-1 leading-snug">
            <h2 id={titleId} className="truncate text-base font-bold text-ink">
              {file.name}
            </h2>
            <p className="truncate text-xs text-muted">{file.meta}</p>
          </div>
          <button type="button" aria-label={`Download ${file.name}`} title="Download" onClick={onDownload} className={`${iconButton} text-primary`}>
            <Icon name="download" />
          </button>
          <button type="button" aria-label="Close preview" onClick={onClose} className={`${iconButton} text-ink`}>
            <Icon name="close" className="!text-2xl" />
          </button>
        </div>

        <div className="relative min-h-0 flex-1 bg-preview">
          {state.status === 'loading' ? (
            <div role="status" className="absolute inset-0 flex items-center justify-center gap-2.5 text-sm text-muted">
              <Spinner />
              Preparing preview…
            </div>
          ) : null}
          {state.status === 'ready' ? <iframe src={state.url} title={file.name} className="absolute inset-0 size-full border-0 bg-white" /> : null}
          {state.status === 'error' ? (
            <div role="alert" className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-6 text-center text-sm text-body">
              <Icon name="draft" className="!text-4xl text-muted" />
              <span className="max-w-[360px]">{state.message}</span>
            </div>
          ) : null}
        </div>

        {footer ? (
          <div className="flex shrink-0 flex-wrap items-center gap-2.5 border-t border-line bg-white px-4 pt-3 pb-[calc(12px+env(safe-area-inset-bottom))] rail:pb-3">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}

/** Saves the file without leaving the app: fetch the bytes (the bucket allows browser reads), then a local link. */
export async function downloadFile(url: string, name: string): Promise<void> {
  const response = await fetch(url);
  if (!response.ok) throw new Error('The file could not be downloaded. Try again.');
  const objectUrl = URL.createObjectURL(await response.blob());
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = name;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(objectUrl), 10_000);
}

/**
 * Opens one file in the preview modal. `loadUrl` asks the API for the short-lived link (for staff that also
 * marks the file viewed) or returns a local object URL for a file that is not uploaded yet.
 */
export function FilePreview({
  file,
  loadUrl,
  onClose,
  onLoaded,
  footer,
}: {
  file: PreviewFile;
  loadUrl: () => Promise<string>;
  onClose: () => void;
  /** Runs once the link was issued (for example to refresh the "viewed" marks). */
  onLoaded?: () => void;
  footer?: ReactNode;
}) {
  const [state, setState] = useState<PreviewState>({ status: 'loading' });
  const [url, setUrl] = useState<string | null>(null);
  const loadRef = useRef(loadUrl);
  loadRef.current = loadUrl;
  const loadedRef = useRef(onLoaded);
  loadedRef.current = onLoaded;

  useEffect(() => {
    let cancelled = false;
    loadRef.current().then(
      (issued) => {
        if (cancelled) return;
        setUrl(issued);
        setState(canPreview(file.name) ? { status: 'ready', url: issued } : { status: 'error', message: CANNOT_PREVIEW });
        loadedRef.current?.();
      },
      (error: unknown) => {
        if (!cancelled) setState({ status: 'error', message: toApiError(error).message });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [file.name]);

  return (
    <FilePreviewFrame
      file={file}
      state={state}
      onClose={onClose}
      footer={footer}
      onDownload={() => {
        if (!url) return;
        downloadFile(url, file.name).catch((error: unknown) =>
          setState({ status: 'error', message: error instanceof Error ? error.message : CANNOT_PREVIEW }),
        );
      }}
    />
  );
}
