import { useParams } from 'react-router-dom';
import { PageError, Spinner } from '@/components/feedback/PageState';
import { MasterDetail } from '@/components/layout/MasterDetail';
import { EmptyBlock } from '@/components/ui/EmptyBlock';
import { handbookApi } from '@/api/handbook';
import { templatesApi } from '@/api/templates';
import { useApi } from '@/hooks/useApi';
import { categoryMeta, sanctionCategories } from '@/utils/templates';
import { TemplateEditor } from './templates/TemplateEditor';
import { TemplateList } from './templates/TemplateList';

/** Staff "Sanction templates" (deck W47 to W49): its own page and nav item (UI-POLISH-SPEC 5.12). */
export function SanctionTemplatesPage() {
  const { id } = useParams();
  const templates = useApi(() => templatesApi.sanctionTemplates(), []);
  // The violations say which category a sanction belongs to (sanctions carry none).
  const handbook = useApi(() => handbookApi.handbook(), []);
  const selectedId = /^\d+$/.test(id ?? '') ? Number(id) : null;

  if (templates.status === 'loading' || handbook.status === 'loading') {
    return (
      <p role="status" className="flex items-center gap-2 text-[13px] text-muted">
        <Spinner />
        Loading sanction templates…
      </p>
    );
  }
  if (templates.status === 'error') return <PageError page="Sanction templates" detail={templates.error.message} onRetry={templates.reload} />;
  const entries = handbook.status === 'ready' ? handbook.data.entries : [];
  const list = templates.data.templates;
  const current = selectedId === null ? (list[0] ?? null) : (list.find((t) => t.sanctionId === selectedId) ?? null);
  const editor = current ? (
    <TemplateEditor
      key={`${current.sanctionId}-${current.dateUpdated}-${current.files[0]?.id ?? 0}`}
      template={current}
      meta={categoryMeta(sanctionCategories(current.sanctionId, entries))}
      onChanged={templates.reload}
    />
  ) : (
    <div className="rounded-xl border border-line bg-white">
      <EmptyBlock icon="folder_managed" title="No sanction selected">
        Pick a sanction from the list.
      </EmptyBlock>
    </div>
  );

  return (
    <>
      <h1 className="sr-only">Sanction templates</h1>
      <MasterDetail
        ratio="handbook"
        detailKey={selectedId}
        list={<TemplateList templates={list} entries={entries} selectedId={current?.sanctionId ?? null} />}
        detail={selectedId === null ? null : editor}
        emptyDetail={editor}
      />
    </>
  );
}
