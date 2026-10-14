import { useRef, useState, type DragEvent } from 'react';
import type { SanctionTemplateView } from '@shared/types';
import { ConfirmModal, useToast } from '@/components/feedback';
import { FilePreview } from '@/components/feedback/FilePreview';
import { Spinner } from '@/components/feedback/PageState';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { FileRow } from '@/components/ui/FileRow';
import { Icon } from '@/components/ui/Icon';
import { Textarea } from '@/components/ui/Textarea';
import { api, toApiError } from '@/api/client';
import { cn } from '@/utils/cn';
import { ACCEPT_ATTRIBUTE, fileMeta } from '@/utils/files';
import { checkSelection } from '@/validators/files';
import { templateToasts } from '@/utils/templates';

/**
 * One sanction's template (deck W48, W49; src 1822 to 1905). One file per template: picking a file uploads it
 * at once and replaces the current one. Files are PDF only (D7); the API checks again.
 */
export function TemplateEditor({ template, meta, onChanged }: { template: SanctionTemplateView; meta: string; onChanged: () => void }) {
  const toast = useToast();
  const pickRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [removing, setRemoving] = useState(false);
  const saved = { title: template.title ?? '', description: template.description ?? '', requirements: template.requirements ?? '' };
  const [draft, setDraft] = useState(saved);
  const [saving, setSaving] = useState(false);
  const dirty = draft.title !== saved.title || draft.description !== saved.description || draft.requirements !== saved.requirements;
  const current = template.files[0] ?? null;
  const toasts = templateToasts(template.type);

  async function upload(files: FileList | null | undefined) {
    const file = files?.[0];
    if (!file) return;
    const problem = checkSelection([file], 0);
    if (problem) {
      setError(problem);
      return;
    }
    setError(null);
    setUploading(true);
    try {
      await api.uploadTemplateFiles(template.sanctionId, [file]);
      toast.show(current ? toasts.replaced : toasts.uploaded, 'success');
      onChanged();
    } catch (caught) {
      setError(toApiError(caught).message);
    } finally {
      setUploading(false);
    }
  }

  async function saveDetails() {
    setSaving(true);
    try {
      await api.saveTemplateText(template.sanctionId, {
        title: draft.title.trim(),
        description: draft.description.trim(),
        requirements: draft.requirements.trim(),
      });
      toast.show(toasts.saved, 'success');
      onChanged();
    } catch (caught) {
      toast.show(toApiError(caught).message, 'error');
    } finally {
      setSaving(false);
    }
  }

  const onDrop = (event: DragEvent) => {
    event.preventDefault();
    setDragging(false);
    void upload(event.dataTransfer?.files);
  };

  return (
    <section aria-label={`${template.type} template`} className="flex flex-col gap-[18px] rounded-xl border border-line bg-white p-6">
      <div>
        <p className="text-[13px] font-semibold text-muted">Sanction template</p>
        <h2 className="mt-0.5 text-[22px] leading-tight font-bold text-ink">{template.type}</h2>
        <p className="text-[13px] text-muted">{meta}</p>
      </div>

      <div className="overflow-hidden rounded-xl border border-line">
        <div className="flex items-center gap-2.5 border-b border-line-soft bg-surface-2 px-4 py-3">
          <Icon name="folder_managed" className="!text-xl text-primary" />
          <span className="min-w-0 flex-1 leading-snug">
            <span className="block text-sm font-bold text-ink">Template and requirements</span>
            <span className="block text-xs text-muted">Students can view and download only</span>
          </span>
        </div>
        <div className="flex flex-col gap-4 p-4">
          <div>
            <p className="mb-2 text-[13px] font-semibold text-ink">Template file</p>
            <input
              ref={pickRef}
              id={`tpl-file-${template.sanctionId}`}
              type="file"
              accept={ACCEPT_ATTRIBUTE}
              className="sr-only"
              onChange={(event) => {
                void upload(event.target.files);
                event.target.value = '';
              }}
            />
            {current ? (
              <FileRow
                name={current.name}
                meta={fileMeta(current, 'Posted')}
                onView={() => setPreviewing(true)}
                onReplace={uploading ? undefined : () => pickRef.current?.click()}
                onRemove={uploading ? undefined : () => setRemoving(true)}
                className="bg-surface-2 [&>div:last-child]:w-full [&>div:last-child]:flex-wrap [&>div:last-child]:justify-end [&_.truncate]:break-words [&_.truncate]:whitespace-normal"
              />
            ) : (
              <label
                htmlFor={`tpl-file-${template.sanctionId}`}
                onDragOver={(event) => {
                  event.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={onDrop}
                className={cn(
                  'flex min-h-16 cursor-pointer items-center gap-3 rounded-xl border-[1.5px] border-dashed px-4 py-3 hover:border-primary hover:bg-upload-hover has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-primary/35',
                  dragging ? 'border-primary bg-upload-hover' : 'border-upload-line bg-upload-bg',
                )}
              >
                <Icon name="upload_file" className="!text-[26px] text-primary" />
                <span className="min-w-0 flex-1 leading-snug">
                  <span className="block text-sm font-bold text-ink">Upload a template</span>
                  <span className="block text-xs text-muted">PDF only, up to 10 MB</span>
                </span>
              </label>
            )}
            {uploading ? (
              <p role="status" className="mt-2 flex items-center gap-2 text-[13px] text-muted">
                <Spinner />
                Uploading…
              </p>
            ) : null}
            {error ? (
              <p role="alert" className="mt-2 flex items-center gap-1.5 text-[13px] font-semibold text-danger">
                <Icon name="error" className="!text-lg" />
                {error}
              </p>
            ) : null}
          </div>
          <div className="border-t border-line-soft pt-4">
            <p className="text-sm font-bold text-ink">What students see</p>
            <p className="text-xs text-muted">The name, description and requirements shown beside the file.</p>
          </div>
          <Field
            label="Template name"
            placeholder="Name students will see"
            maxLength={200}
            value={draft.title}
            onChange={(event) => setDraft({ ...draft, title: event.target.value })}
          />
          <Textarea
            label="Short description"
            rows={2}
            maxLength={2000}
            placeholder="What this file is for"
            value={draft.description}
            onChange={(event) => setDraft({ ...draft, description: event.target.value })}
            className="min-h-0"
          />
          <Textarea
            label="Requirements and instructions"
            rows={4}
            maxLength={4000}
            placeholder="Documents, format and how to submit, as set by the SDO"
            hint="Shown to students when there is no template, or alongside it."
            value={draft.requirements}
            onChange={(event) => setDraft({ ...draft, requirements: event.target.value })}
          />
          <div className="flex flex-wrap justify-end gap-2">
            {dirty ? (
              <>
                <Button variant="neutral" size="lg" disabled={saving} onClick={() => setDraft(saved)}>
                  Discard
                </Button>
                <Button size="lg" busy={saving} onClick={() => void saveDetails()}>
                  Save details
                </Button>
              </>
            ) : (
              <Button size="lg" disabled>
                Saved
              </Button>
            )}
          </div>
        </div>
      </div>

      {previewing && current ? (
        <FilePreview
          file={{ name: current.name, meta: fileMeta(current, 'Posted') }}
          loadUrl={async () => (await api.templateFileUrl(current.id)).url}
          onClose={() => setPreviewing(false)}
        />
      ) : null}
      <ConfirmModal
        open={removing && current !== null}
        tone="danger"
        title="Remove the template file?"
        description={`Students will no longer be able to download “${current?.name ?? ''}” from the ${template.type} entry. The written requirements stay.`}
        confirmLabel="Remove file"
        cancelLabel="Keep it"
        onClose={() => setRemoving(false)}
        onConfirm={async () => {
          if (!current) return;
          try {
            await api.deleteTemplateFile(current.id);
          } catch (caught) {
            throw new Error(toApiError(caught).message);
          }
          setRemoving(false);
          toast.show(toasts.removed, 'success');
          onChanged();
        }}
      />
    </section>
  );
}
