import { useEffect, useState } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import type { SanctionTemplateView } from '@shared/types';
import { PageError, PageNotFound } from '@/components/feedback/PageState';
import { SkeletonList } from '@/components/feedback/Skeleton';
import { MasterDetail } from '@/components/layout/MasterDetail';
import { ClassTiles } from '@/components/student/ClassTiles';
import { handbookApi } from '@/api/handbook';
import { templatesApi } from '@/api/templates';
import { useApi } from '@/hooks/useApi';
import { HANDBOOK_PER_PAGE, filterHandbook, handbookTiles, type HandbookClass } from '@/utils/handbook';
import { HandbookEntry } from './handbook/HandbookEntry';
import { HandbookTable } from './handbook/HandbookTable';

/** Student Handbook (deck W80, W81): class tiles, the searchable table, the entry with its templates. */
export function StudentHandbookPage() {
  const { id } = useParams();
  const location = useLocation();
  const selectedId = /^\d+$/.test(id ?? '') ? Number(id) : null;
  const handbook = useApi(() => handbookApi.handbook(), []);
  const templates = useApi(() => templatesApi.sanctionTemplates().catch(() => ({ templates: [] as SanctionTemplateView[] })), []);
  const [cls, setCls] = useState<HandbookClass>('all');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);

  const entries = handbook.status === 'ready' ? handbook.data.entries : [];
  const rows = filterHandbook(entries, query, cls);

  // Arriving at an entry from elsewhere (a case's "View this offense") shows it on its page (5.4b).
  const fromList = (location.state as { fromList?: boolean } | null)?.fromList;
  const target = selectedId === null ? -1 : entries.findIndex((e) => e.id === selectedId);
  useEffect(() => {
    if (target < 0 || fromList) return;
    setCls('all');
    setQuery('');
    setPage(Math.floor(target / HANDBOOK_PER_PAGE) + 1);
  }, [target, location.key, fromList]);

  if (handbook.status === 'loading') {
    return (
      <SkeletonList label="Loading the handbook…" className="px-0" />
    );
  }
  if (handbook.status === 'error') return <PageError page="the Student Handbook" detail={handbook.error.message} onRetry={handbook.reload} />;

  const list = templates.status === 'ready' ? templates.data.templates : [];
  const current = selectedId === null ? rows[(page - 1) * HANDBOOK_PER_PAGE] : entries.find((e) => e.id === selectedId);
  const pane = current ? (
    <HandbookEntry key={current.id} entry={current} templates={list} />
  ) : selectedId !== null ? (
    <PageNotFound what="handbook entry" backTo="/handbook" backLabel="Back to the handbook" />
  ) : (
    <div className="grid min-h-40 place-items-center rounded-xl border border-line bg-white px-5 py-10 text-center text-muted">No handbook entry selected.</div>
  );

  return (
    <>
      <h1 className="sr-only">Student Handbook</h1>
      <MasterDetail
        ratio="handbook"
        detailKey={selectedId}
        list={
          <div className="flex h-full min-h-0 flex-col gap-2.5">
            <ClassTiles
              label="Category"
              tiles={handbookTiles(entries)}
              value={cls}
              onChange={(key) => {
                setCls(key);
                setPage(1);
              }}
            />
            <HandbookTable
              rows={rows}
              query={query}
              onQuery={(value) => {
                setQuery(value);
                setPage(1);
              }}
              page={page}
              onPage={setPage}
              selectedId={current?.id ?? null}
            />
          </div>
        }
        detail={selectedId === null ? null : pane}
        emptyDetail={pane}
      />
    </>
  );
}
