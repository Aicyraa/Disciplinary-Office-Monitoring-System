import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import type { SanctionTemplateView } from '@shared/types';
import { MasterDetail } from '@/components/layout/MasterDetail';
import { TemplateView, hasTemplateContent } from '@/components/templates/TemplateDownloads';
import { EmptyState, ErrorState, Icon, LoadingState } from '@/components/ui';
import { api } from '@/api/client';
import { useApi } from '@/hooks/useApi';

type Filter = 'all' | 'posted' | 'not_posted';

/** "Posted" is a template with a file or any written text; the rest show "Nothing posted yet". */
export function filterTemplates(templates: SanctionTemplateView[], filter: Filter): SanctionTemplateView[] {
  if (filter === 'all') return templates;
  return templates.filter((template) => hasTemplateContent(template) === (filter === 'posted'));
}

function TemplateList({
  templates,
  selectedId,
}: {
  templates: SanctionTemplateView[];
  selectedId: number | null;
}) {
  const [filter, setFilter] = useState<Filter>('all');
  const posted = templates.filter(hasTemplateContent).length;
  const shown = useMemo(() => filterTemplates(templates, filter), [templates, filter]);
  const chips: Array<[Filter, string]> = [
    ['all', `All ${templates.length}`],
    ['posted', `Posted ${posted}`],
    ['not_posted', `Not posted ${templates.length - posted}`],
  ];

  return (
    <section aria-label="Sanctions" className="rounded-lg border border-line bg-white">
      <div className="space-y-3 border-b border-line p-3">
        <div>
          <h2 className="text-base font-bold text-ink">All sanctions</h2>
          <p className="text-xs text-muted">
            {posted} of {templates.length} have a template or requirements
          </p>
        </div>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Show">
          {chips.map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={filter === value}
              onClick={() => setFilter(value)}
              className={`min-h-11 rounded-full border px-4 text-sm font-medium ${
                filter === value ? 'border-primary bg-primary text-white' : 'border-line-strong bg-white text-ink'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      {shown.length === 0 ? (
        <div className="p-3">
          <EmptyState title="No sanctions match." />
        </div>
      ) : (
        <ul>
          {shown.map((template) => {
            const isPosted = hasTemplateContent(template);
            return (
              <li key={template.sanctionId}>
                <Link
                  to={`/handbook?tab=templates&sanction=${template.sanctionId}`}
                  aria-current={template.sanctionId === selectedId ? 'page' : undefined}
                  className={`flex min-h-16 items-center gap-3 border-b border-line px-3 py-2 hover:bg-page ${
                    template.sanctionId === selectedId ? 'bg-primary/10' : ''
                  }`}
                >
                  <span
                    className={`inline-flex size-9 shrink-0 items-center justify-center rounded-lg ${
                      isPosted ? 'bg-[#E4F3EA] text-success' : 'bg-page text-muted'
                    }`}
                  >
                    <Icon name={isPosted ? 'task' : 'draft'} />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-ink">{template.type}</span>
                    <span className="block text-xs text-muted">{isPosted ? 'Template posted' : 'Nothing posted yet'}</span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function TemplatePane({ template }: { template: SanctionTemplateView }) {
  return (
    <article aria-label={template.type} className="rounded-lg border border-line bg-white p-4">
      <p className="text-xs text-muted">Sanction template</p>
      <h2 className="text-xl font-bold text-ink">{template.type}</h2>
      <p className="text-sm text-muted">
        {template.sanctionCode} · {template.sanctionDescription}
      </p>
      <TemplateView template={template} />
    </article>
  );
}

/** Student Handbook > Sanction templates: read and download (SPEC 5, 6.1). Staff edit on their own page. */
export function TemplatesTab() {
  const resource = useApi(() => api.sanctionTemplates(), []);
  const [params] = useSearchParams();
  const raw = params.get('sanction');
  const selectedId = raw !== null && /^\d+$/.test(raw) ? Number(raw) : null;

  if (resource.status === 'loading') return <LoadingState label="Loading templates…" />;
  if (resource.status === 'error') return <ErrorState message={resource.error.message} onRetry={resource.reload} />;
  const { templates } = resource.data;
  if (templates.length === 0) return <EmptyState title="No sanctions are defined yet." />;
  const selected = templates.find((template) => template.sanctionId === selectedId) ?? null;

  return (
    <MasterDetail
      ratio="handbook"
      detailKey={selectedId}
      list={<TemplateList templates={templates} selectedId={selectedId} />}
      detail={selectedId === null ? null : selected ? <TemplatePane key={selected.sanctionId} template={selected} /> : <ErrorState message="That sanction was not found." />}
      emptyDetail={<EmptyState title="Select a sanction" hint="Its posted template and requirements appear here." />}
    />
  );
}
