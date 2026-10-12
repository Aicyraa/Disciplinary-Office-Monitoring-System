import { useRef, useState, type FormEvent } from 'react';
import type { SanctionTemplateView } from '@shared/types';
import { TemplateView } from '../components/TemplateDownloads';
import { EmptyState, Icon, Resource, buttonClass, fieldClass } from '../components/ui';
import { api, toApiError } from '../lib/api';
import { ACCEPTED_EXTENSIONS, checkSelection, formatSize, uploadButtonLabel } from '../lib/files';
import { useApi } from '../lib/useApi';

type Notice = { tone: 'success' | 'error'; text: string };

function Message({ notice }: { notice: Notice | null }) {
  if (!notice) return null;
  return (
    <p
      role={notice.tone === 'error' ? 'alert' : 'status'}
      className={`mt-2 text-sm font-medium ${notice.tone === 'error' ? 'text-danger' : 'text-success'}`}
    >
      {notice.text}
    </p>
  );
}

function TextEditor({ template, onSaved }: { template: SanctionTemplateView; onSaved: () => void }) {
  const [title, setTitle] = useState(template.title ?? '');
  const [description, setDescription] = useState(template.description ?? '');
  const [requirements, setRequirements] = useState(template.requirements ?? '');
  const [notice, setNotice] = useState<Notice | null>(null);
  const [busy, setBusy] = useState(false);
  const id = `tpl-${template.sanctionId}`;

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setNotice(null);
    try {
      await api.saveTemplateText(template.sanctionId, {
        title: title.trim(),
        description: description.trim(),
        requirements: requirements.trim(),
      });
      setNotice({ tone: 'success', text: 'Saved.' });
      onSaved();
    } catch (error) {
      setNotice({ tone: 'error', text: toApiError(error).message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="mt-3 rounded-md border border-line-strong bg-page p-3">
      <label htmlFor={`${id}-title`} className="block text-sm font-medium text-ink">
        Title
      </label>
      <input id={`${id}-title`} className={`${fieldClass} mt-1`} maxLength={200} value={title} onChange={(e) => setTitle(e.target.value)} />
      <label htmlFor={`${id}-desc`} className="mt-3 block text-sm font-medium text-ink">
        Description
      </label>
      <textarea
        id={`${id}-desc`}
        className={`${fieldClass} mt-1 min-h-20`}
        maxLength={2000}
        value={description}
        onChange={(e) => setDescription(e.target.value)}
      />
      <label htmlFor={`${id}-req`} className="mt-3 block text-sm font-medium text-ink">
        Written requirements
      </label>
      <textarea
        id={`${id}-req`}
        className={`${fieldClass} mt-1 min-h-24`}
        maxLength={4000}
        value={requirements}
        onChange={(e) => setRequirements(e.target.value)}
      />
      <div className="mt-3">
        <button type="submit" disabled={busy} className={buttonClass}>
          {busy ? 'Saving…' : 'Save text'}
        </button>
      </div>
      <Message notice={notice} />
    </form>
  );
}

/** One file per template: choosing another file replaces the current one (UI-POLISH-SPEC decision 7). */
function FileManager({ template, onChanged }: { template: SanctionTemplateView; onChanged: () => void }) {
  const [selected, setSelected] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [percent, setPercent] = useState<number | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const pickRef = useRef<HTMLInputElement>(null);
  const current = template.files[0] ?? null;

  async function upload() {
    if (!selected) return;
    const problem = checkSelection([selected], 0);
    if (problem) {
      setNotice({ tone: 'error', text: problem });
      return;
    }
    setBusy(true);
    setPercent(null);
    setNotice(null);
    try {
      await api.uploadTemplateFiles(template.sanctionId, [selected], setPercent);
      setSelected(null);
      setNotice({ tone: 'success', text: current ? 'File replaced.' : 'File uploaded.' });
      onChanged();
    } catch (error) {
      setNotice({ tone: 'error', text: toApiError(error).message });
    } finally {
      setBusy(false);
      setPercent(null);
    }
  }

  async function remove(fileId: number, name: string) {
    setNotice(null);
    try {
      await api.deleteTemplateFile(fileId);
      setNotice({ tone: 'success', text: `Removed ${name}.` });
    } catch (error) {
      setNotice({ tone: 'error', text: toApiError(error).message });
    }
    onChanged();
  }

  return (
    <div className="mt-3 rounded-md border border-line-strong bg-page p-3">
      <h4 className="text-sm font-semibold text-ink">File</h4>
      {current ? (
        <div className="mt-1 flex flex-wrap items-center justify-between gap-2 text-sm">
          <span>
            {current.name} <span className="text-muted">({formatSize(current.sizeBytes)})</span>
          </span>
          <button
            type="button"
            aria-label={`Remove ${current.name}`}
            className="min-h-11 rounded-md border border-line-strong bg-white px-3 text-xs font-medium text-danger"
            onClick={() => void remove(current.id, current.name)}
          >
            Remove
          </button>
        </div>
      ) : (
        <p className="mt-1 text-sm text-muted">No file yet.</p>
      )}

      <input
        ref={pickRef}
        type="file"
        accept={ACCEPTED_EXTENSIONS.join(',')}
        className="sr-only"
        tabIndex={-1}
        aria-label={`Choose the template file for ${template.type}`}
        onChange={(event) => {
          const picked = event.target.files?.[0] ?? null;
          event.target.value = '';
          if (picked) setSelected(picked);
          setNotice(null);
        }}
      />
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => pickRef.current?.click()}
          className="inline-flex min-h-11 items-center gap-1 rounded-md border border-line-strong bg-white px-3 text-sm font-medium text-ink disabled:opacity-50"
        >
          <Icon name="attach_file" className="text-base" />
          {current ? 'Choose a replacement' : 'Choose file'}
        </button>
        <button type="button" disabled={busy || !selected} onClick={() => void upload()} className={buttonClass}>
          {uploadButtonLabel({ count: selected ? 1 : 0, busy, percent })}
        </button>
        <span className="text-xs text-muted">PDF or DOCX, up to 10 MB. One file; a new upload replaces it.</span>
      </div>
      {selected ? (
        <p className="mt-2 text-sm" aria-label="File ready to upload">
          <span className="truncate">
            {selected.name} <span className="text-muted">({formatSize(selected.size)})</span>
          </span>{' '}
          <button type="button" className="text-xs font-medium text-danger" aria-label={`Do not upload ${selected.name}`} onClick={() => setSelected(null)}>
            Clear
          </button>
        </p>
      ) : null}
      <Message notice={notice} />
    </div>
  );
}

function TemplateCard({ template, isStaff, onChanged }: { template: SanctionTemplateView; isStaff: boolean; onChanged: () => void }) {
  const [editing, setEditing] = useState(false);
  return (
    <li className="rounded-lg border border-line bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="font-medium text-ink">
            {template.sanctionCode} · {template.type}
          </div>
          <div className="text-sm text-muted">{template.sanctionDescription}</div>
        </div>
        {isStaff ? (
          <button
            type="button"
            aria-expanded={editing}
            className="rounded-md border border-line-strong bg-white px-3 py-1 text-xs font-semibold text-ink hover:bg-page"
            onClick={() => setEditing((value) => !value)}
          >
            {editing ? 'Close editor' : 'Edit template'}
          </button>
        ) : null}
      </div>
      <TemplateView template={template} />
      {isStaff && editing ? (
        <>
          <TextEditor key={`${template.sanctionId}-${template.dateUpdated}`} template={template} onSaved={onChanged} />
          <FileManager template={template} onChanged={onChanged} />
        </>
      ) : null}
    </li>
  );
}

/** Handbook > Sanction templates: students read and download, staff also edit (SPEC 5, 6.1). */
export function TemplatesTab({ isStaff }: { isStaff: boolean }) {
  const resource = useApi(() => api.sanctionTemplates(), []);
  return (
    <Resource resource={resource} onRetry={resource.reload}>
      {({ templates }) =>
        templates.length === 0 ? (
          <EmptyState title="No sanctions are defined yet." />
        ) : (
          <ul className="space-y-3">
            {templates.map((template) => (
              <TemplateCard key={template.sanctionId} template={template} isStaff={isStaff} onChanged={resource.reload} />
            ))}
          </ul>
        )
      }
    </Resource>
  );
}
