import { useState } from 'react';
import type { HandbookEntryView, SanctionTemplateView } from '@shared/types';
import { FilePreview, downloadFile } from '@/components/feedback/FilePreview';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { ApiError, api } from '@/api/client';
import { useToast } from '@/components/feedback';
import { fileMeta } from '@/utils/files';
import { ladder, postedTemplates } from '@/utils/handbook';

type TemplateFile = SanctionTemplateView['files'][number];

function PostedTemplate({ template }: { template: SanctionTemplateView }) {
  const toast = useToast();
  const [previewing, setPreviewing] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const file: TemplateFile | undefined = template.files[0];

  async function download(target: TemplateFile) {
    setDownloading(true);
    try {
      const { url } = await api.templateFileUrl(target.id);
      await downloadFile(url, target.name);
    } catch (error) {
      toast.show(error instanceof ApiError || error instanceof Error ? error.message : 'The file could not be downloaded. Try again.', 'error');
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="flex flex-col gap-3 border-b border-line-soft pb-3.5 last:border-b-0 last:pb-0">
      <p className="text-xs font-bold tracking-[0.04em] text-info-ink uppercase">{template.type}</p>
      {file ? (
        <>
          <div className="flex items-start gap-3">
            <span aria-hidden="true" className="grid size-11 shrink-0 place-items-center rounded-[10px] bg-bad-soft text-bad-ink">
              <Icon name="picture_as_pdf" className="!text-2xl" />
            </span>
            <div className="min-w-0 flex-1 leading-snug">
              <p className="text-[15px] font-bold text-ink">{template.title || file.name}</p>
              {template.description ? <p className="mt-0.5 text-sm text-pretty text-body">{template.description}</p> : null}
              <p className="mt-1 text-xs text-muted">{fileMeta(file, 'Posted')}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" size="lg" className="flex-[1_1_140px]" onClick={() => setPreviewing(true)}>
              <Icon name="visibility" className="!text-xl" />
              View template
            </Button>
            <Button size="lg" className="flex-[1_1_140px]" busy={downloading} busyLabel="Downloading…" onClick={() => void download(file)} aria-label={`Download ${file.name}`}>
              <Icon name="download" className="!text-xl" />
              Download
            </Button>
          </div>
        </>
      ) : null}
      {template.requirements ? (
        <div>
          <p className="mb-1 text-[13px] font-semibold text-muted">What to prepare</p>
          <p className="text-sm whitespace-pre-line text-pretty text-body">{template.requirements}</p>
        </div>
      ) : null}
      {previewing && file ? (
        <FilePreview file={{ name: file.name, meta: fileMeta(file, 'Posted') }} loadUrl={async () => (await api.templateFileUrl(file.id)).url} onClose={() => setPreviewing(false)} />
      ) : null}
    </div>
  );
}

/** One handbook entry for students (deck W81, src 1828 to 1870): wording, the sanction ladder, templates. */
export function HandbookEntry({ entry, templates }: { entry: HandbookEntryView; templates: SanctionTemplateView[] }) {
  const posted = postedTemplates(entry, templates);
  const steps = ladder(entry);
  return (
    <article aria-label={entry.violation} className="flex min-h-full flex-col gap-5 rounded-xl border border-line bg-white p-6">
      <div>
        <p className="text-[13px] font-semibold text-muted">Handbook entry</p>
        <h2 className="mt-0.5 text-[22px] leading-tight font-bold text-ink">{entry.violation}</h2>
        <p className="text-[13px] text-muted">
          {entry.severity} offense · Sec. {entry.section}
        </p>
      </div>
      <div>
        <p className="text-[13px] font-semibold text-muted">What the handbook says</p>
        <p className="mt-1 text-body">{entry.description}</p>
      </div>
      <div className="rounded-[10px] bg-info-soft px-[18px] py-4">
        <p className="mb-2 text-[13px] font-semibold text-info-ink">Sanction</p>
        {steps.length === 0 ? <p className="text-sm text-ink">The handbook lists no sanction for this violation.</p> : null}
        <dl className="flex flex-col gap-2.5">
          {steps.map((step) => (
            <div key={step.label} className="flex items-baseline gap-2.5">
              <dt className="min-w-[92px] shrink-0 text-xs font-bold text-info-ink">{step.label}</dt>
              <dd className="font-medium text-ink">{step.text}</dd>
            </div>
          ))}
        </dl>
      </div>
      <div className="overflow-hidden rounded-xl border border-line">
        <div className="flex items-center gap-2.5 border-b border-line-soft bg-surface-2 px-4 py-3">
          <Icon name="folder_open" className="!text-xl text-primary" />
          <span className="text-sm font-bold text-ink">Template and requirements</span>
        </div>
        <div className="flex flex-col gap-3.5 p-4">
          {posted.map((template) => (
            <PostedTemplate key={template.sanctionId} template={template} />
          ))}
          {posted.length === 0 ? (
            <p className="flex items-start gap-2 text-sm text-pretty text-muted">
              <Icon name="info" className="!text-lg" />
              The SDO has not posted a template for the sanctions under this offense. Follow the sanction above, and ask the SDO office if you are unsure what to prepare.
            </p>
          ) : null}
        </div>
      </div>
    </article>
  );
}
