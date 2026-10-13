import { useState } from 'react';
import type { SanctionTemplateView } from '@shared/types';
import { api } from '@/api/client';
import { fileMeta } from '@/utils/files';
import { FileRow } from '@/components/ui/FileRow';
import { FilePreview } from '@/components/feedback/FilePreview';

/** What a template page shows a reader: the written text and the downloadable files. */
export function hasTemplateContent(template: Pick<SanctionTemplateView, 'title' | 'description' | 'requirements' | 'files'>): boolean {
  return Boolean(template.title || template.description || template.requirements || template.files.length > 0);
}

/** One row per file; "View" opens the preview modal in the app (UI-POLISH-SPEC 4.2b), never a new tab. */
export function TemplateFileLinks({ template }: { template: Pick<SanctionTemplateView, 'files'> }) {
  const [previewing, setPreviewing] = useState<SanctionTemplateView['files'][number] | null>(null);

  if (template.files.length === 0) return null;
  return (
    <div className="mt-2 flex flex-col gap-2">
      {template.files.map((file) => (
        <FileRow key={file.id} name={file.name} meta={fileMeta(file, 'Posted')} onView={() => setPreviewing(file)} />
      ))}
      {previewing ? (
        <FilePreview
          file={{ name: previewing.name, meta: fileMeta(previewing, 'Posted') }}
          loadUrl={async () => (await api.templateFileUrl(previewing.id)).url}
          onClose={() => setPreviewing(null)}
        />
      ) : null}
    </div>
  );
}

/** A read-only template: title, description, written requirements and the file links. */
export function TemplateView({ template }: { template: SanctionTemplateView }) {
  if (!hasTemplateContent(template)) {
    return <p className="mt-2 text-sm text-muted">The office has not published a template for this sanction yet.</p>;
  }
  return (
    <div className="mt-2 space-y-2 text-sm">
      {template.title ? <div className="font-medium text-ink">{template.title}</div> : null}
      {template.description ? <p className="whitespace-pre-line">{template.description}</p> : null}
      {template.requirements ? (
        <div>
          <div className="font-medium text-ink">Requirements</div>
          <p className="whitespace-pre-line">{template.requirements}</p>
        </div>
      ) : null}
      <TemplateFileLinks template={template} />
    </div>
  );
}
