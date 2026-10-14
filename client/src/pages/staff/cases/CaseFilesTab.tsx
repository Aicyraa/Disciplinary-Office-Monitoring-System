import { useState } from 'react';
import type { StaffCaseDetail, StaffProofFileView } from '@shared/types';
import { FilePreview } from '@/components/feedback/FilePreview';
import { StatusPill } from '@/components/ui';
import { EmptyBlock } from '@/components/ui/EmptyBlock';
import { FileRow } from '@/components/ui/FileRow';
import { Icon } from '@/components/ui/Icon';
import { api } from '@/api/client';
import { fileMeta } from '@/utils/files';
import { formatDate } from '@/utils/format';

/** The case's "Files" tab: every sanction of the case with the proof the student uploaded for it. */
export function CaseFilesTab({ detail, onViewed }: { detail: StaffCaseDetail; onViewed: () => void }) {
  const [previewing, setPreviewing] = useState<StaffProofFileView | null>(null);
  const sanctions = [...detail.sanctions].sort((a, b) => a.id - b.id);

  if (sanctions.length === 0) {
    return (
      <EmptyBlock icon="folder_open" title="No sanctions yet">
        Proof files appear here once a sanction is assigned and the student uploads.
      </EmptyBlock>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {sanctions.map((sanction) => (
        <section key={sanction.id} aria-label={`${sanction.sanctionCode} ${sanction.type}`} className="overflow-hidden rounded-xl border border-line bg-white">
          <header className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-line-soft bg-surface-2 px-3.5 py-3">
            <Icon name="gavel" className="!text-xl text-primary" />
            <span className="min-w-0 flex-1 basis-40">
              <span className="block text-sm font-bold text-ink">
                {sanction.sanctionCode} · {sanction.type}
              </span>
              <span className="block text-xs text-muted">
                Due {formatDate(sanction.dueDate)}
                {sanction.dateSubmitted ? ` · Submitted ${formatDate(sanction.dateSubmitted)}` : ''}
              </span>
            </span>
            <StatusPill status={sanction.status} kind="sanction" />
          </header>
          {sanction.files.length === 0 ? (
            <p className="flex items-center justify-center gap-1.5 px-3.5 py-[18px] text-center text-[13px] text-muted">
              <Icon name="hourglass_top" className="!text-lg" />
              Waiting for the student to upload proof.
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
        </section>
      ))}
      {previewing ? (
        <FilePreview
          file={{ name: previewing.name, meta: fileMeta(previewing) }}
          loadUrl={async () => (await api.fileUrl(previewing.id)).url}
          onLoaded={onViewed}
          onClose={() => setPreviewing(null)}
        />
      ) : null}
    </div>
  );
}
