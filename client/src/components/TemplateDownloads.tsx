import { useState } from 'react';
import type { SanctionTemplateView } from '@shared/types';
import { api, toApiError } from '../lib/api';
import { formatSize } from '../lib/files';
import { Icon } from './ui';

/** What a template page shows a reader: the written text and the downloadable files. */
export function hasTemplateContent(template: Pick<SanctionTemplateView, 'title' | 'description' | 'requirements' | 'files'>): boolean {
  return Boolean(template.title || template.description || template.requirements || template.files.length > 0);
}

/** One button per file. A click asks the API for a short-lived link and opens it in a new tab. */
export function TemplateFileLinks({ template }: { template: Pick<SanctionTemplateView, 'files'> }) {
  const [error, setError] = useState<string | null>(null);

  async function open(fileId: number) {
    const tab = window.open('', '_blank');
    setError(null);
    try {
      const { url } = await api.templateFileUrl(fileId);
      if (tab) tab.location.href = url;
      else window.location.href = url;
    } catch (caught) {
      tab?.close();
      setError(toApiError(caught).message);
    }
  }

  if (template.files.length === 0) return null;
  return (
    <div>
      <ul className="mt-2 space-y-1">
        {template.files.map((file) => (
          <li key={file.id} className="flex flex-wrap items-center gap-2 text-sm">
            <Icon name="description" className="text-base text-muted" />
            <button type="button" onClick={() => void open(file.id)} className="text-left text-primary underline">
              {file.name}
            </button>
            <span className="text-muted">({formatSize(file.sizeBytes)})</span>
          </li>
        ))}
      </ul>
      {error ? (
        <p role="alert" className="mt-1 text-sm font-medium text-danger">
          {error}
        </p>
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
