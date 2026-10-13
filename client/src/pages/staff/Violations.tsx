import { useNavigate, useParams } from 'react-router-dom';
import { PageError, Spinner } from '@/components/feedback/PageState';
import { MasterDetail } from '@/components/layout/MasterDetail';
import { EmptyBlock } from '@/components/ui/EmptyBlock';
import { api } from '@/api/client';
import { useApi } from '@/hooks/useApi';
import { ViolationEditor, type SanctionChoice } from './handbook/ViolationEditor';
import { ViolationList } from './handbook/ViolationList';

/**
 * Staff "Violations" (deck W44 to W46): the handbook list and the editor. `/handbook/new` hides the list
 * and shows the empty editor ("Add violation"). Sanction templates have their own page.
 */
export function StaffViolationsPage({ adding = false }: { adding?: boolean }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const handbook = useApi(() => api.handbook(), []);
  const sanctions = useApi(() => api.sanctionTemplates(), []);
  const selectedId = /^\d+$/.test(id ?? '') ? Number(id) : null;

  if (handbook.status === 'loading' || sanctions.status === 'loading') {
    return (
      <p role="status" className="flex items-center gap-2 text-[13px] text-muted">
        <Spinner />
        Loading the handbook…
      </p>
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

  if (adding) {
    return (
      <>
        <h1 className="sr-only">Add violation</h1>
        <ViolationEditor entry={null} entries={entries} choices={choices} onSaved={saved} />
      </>
    );
  }

  const current = selectedId === null ? (entries[0] ?? null) : (entries.find((e) => e.id === selectedId) ?? null);
  const editor = current ? (
    <ViolationEditor key={`${current.id}-${current.violation}-${current.section}-${current.sanctions.length}`} entry={current} entries={entries} choices={choices} onSaved={saved} />
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
