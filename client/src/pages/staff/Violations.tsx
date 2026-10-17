import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { PageError, PageNotFound } from '@/components/feedback/PageState';
import { SkeletonList } from '@/components/feedback/Skeleton';
import { MasterDetail } from '@/components/layout/MasterDetail';
import { usePageAction } from '@/components/layout/PageAction';
import { EmptyBlock } from '@/components/ui/EmptyBlock';
import { handbookApi } from '@/api/handbook';
import { templatesApi } from '@/api/templates';
import { useApi } from '@/hooks/useApi';
import { AddViolationModal } from './handbook/AddViolationModal';
import { ViolationEditor, type SanctionChoice } from './handbook/ViolationEditor';
import { ViolationList } from './handbook/ViolationList';

/**
 * Staff "Violations" (deck W44 to W46): the handbook list and the editor. Add violation is a dialog over the
 * list, opened from the header pill (desktop) or the floating button (phone). Sanction templates have their own page.
 */
export function StaffViolationsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const handbook = useApi(() => handbookApi.handbook(), []);
  const sanctions = useApi(() => templatesApi.sanctionTemplates(), []);
  const [adding, setAdding] = useState(false);
  usePageAction('Add violation', 'post_add', () => setAdding(true));
  const selectedId = /^\d+$/.test(id ?? '') ? Number(id) : null;

  if (handbook.status === 'loading' || sanctions.status === 'loading') {
    return (
      <SkeletonList label="Loading the handbook…" className="px-0" />
    );
  }
  if (handbook.status === 'error') return <PageError page="the handbook" detail={handbook.error.message} onRetry={handbook.reload} />;
  if (sanctions.status === 'error') return <PageError page="the sanctions" detail={sanctions.error.message} onRetry={sanctions.reload} />;

  const entries = handbook.data.entries;
  const choices: SanctionChoice[] = sanctions.data.templates.map((t) => ({ sanctionId: t.sanctionId, label: `${t.sanctionCode} · ${t.type}` }));
  const saved = (savedId: number) => {
    handbook.reload();
    navigate(`/handbook/${savedId}`);
  };

  const current = selectedId === null ? (entries[0] ?? null) : (entries.find((e) => e.id === selectedId) ?? null);
  const editor = current ? (
    <ViolationEditor key={`${current.id}-${current.violation}-${current.section}-${current.sanctions.length}`} entry={current} entries={entries} choices={choices} onSaved={saved} />
  ) : selectedId !== null ? (
    <PageNotFound what="violation" backTo="/handbook" backLabel="Back to violations" />
  ) : (
    <div className="rounded-xl border border-line bg-white">
      <EmptyBlock icon="menu_book" title="Violation not found">
        Pick a violation from the list.
      </EmptyBlock>
    </div>
  );

  return (
    <>
      <h1 className="sr-only">Violations</h1>
      {adding ? (
        <AddViolationModal
          entries={entries}
          choices={choices}
          onClose={() => setAdding(false)}
          onAdded={(addedId) => {
            setAdding(false);
            saved(addedId);
          }}
        />
      ) : null}
      <MasterDetail
        ratio="handbook"
        detailKey={selectedId}
        list={<ViolationList entries={entries} selectedId={current?.id ?? null} />}
        detail={selectedId === null ? null : editor}
        emptyDetail={editor}
      />
    </>
  );
}
