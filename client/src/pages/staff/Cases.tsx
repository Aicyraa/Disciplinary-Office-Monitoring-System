import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useParams, useSearchParams } from 'react-router-dom';
import type { Severity } from '@shared/types';
import { MasterDetail } from '@/components/layout/MasterDetail';
import { ListHeader } from '@/components/layout/ListHeader';
import { usePageAction } from '@/components/layout/PageAction';
import { PageError, Spinner } from '@/components/feedback/PageState';
import { StatusPill } from '@/components/ui';
import { ChipGroup } from '@/components/ui/ChipGroup';
import { EmptyBlock } from '@/components/ui/EmptyBlock';
import { controlVariants } from '@/components/ui/FieldShell';
import { GroupHead } from '@/components/ui/GroupHead';
import { HighTag } from '@/components/ui/HighTag';
import { Icon } from '@/components/ui/Icon';
import { ListCard } from '@/components/ui/ListCard';
import { Pager } from '@/components/ui/Pager';
import { Tag } from '@/components/ui/Tag';
import { api } from '@/api/client';
import { useApi } from '@/hooks/useApi';
import { caseRowView, groupHeads, queueFromParam, queueOptions, type QueueKey } from '@/utils/caseView';
import { cn } from '@/utils/cn';
import { manilaToday } from '@/utils/files';
import { formatDate } from '@/utils/format';
import { CaseWorkspace } from './CaseDetail';
import { RecordViolationModal } from './cases/RecordViolationModal';

/** Links inside the queue carry this, so arriving from elsewhere (dashboard, bell) is told apart (5.4b). */
const FROM_QUEUE = { fromQueue: true } as const;

const CLASSES = [
  { value: '', label: 'All' },
  { value: 'Minor', label: 'Minor' },
  { value: 'Major', label: 'Major' },
] as const;

function CaseQueue({
  selectedId,
  reloadRef,
  onFirstRow,
}: {
  selectedId: number | null;
  reloadRef: React.MutableRefObject<(() => void) | null>;
  onFirstRow: (id: number | null) => void;
}) {
  const [params, setParams] = useSearchParams();
  const location = useLocation();
  const queue = queueFromParam(params.get('queue'));
  const [severity, setSeverity] = useState<Severity | ''>('');
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  // null: open the page that holds the selected case (a deep link); a number once the officer pages.
  const [page, setPage] = useState<number | null>(null);
  const today = manilaToday();

  // Arriving from outside the queue resets what could hide the selected case (UI-POLISH-SPEC 5.4b).
  const arrivedFromOutside = !(location.state as { fromQueue?: boolean } | null)?.fromQueue;
  useEffect(() => {
    if (!arrivedFromOutside) return;
    setSeverity('');
    setSearch('');
    setQ('');
    setPage(null);
  }, [location.key, arrivedFromOutside]);

  // The list filters while typing (deck src 554), a moment after the last key.
  useEffect(() => {
    const timer = setTimeout(() => {
      setQ((current) => {
        if (current !== search.trim()) setPage(1);
        return search.trim();
      });
    }, 250);
    return () => clearTimeout(timer);
  }, [search]);

  const resource = useApi(
    () =>
      api.staffCases({
        status: queue.status,
        class: severity,
        q,
        group: queue.key === 'all' ? 'status' : undefined,
        page: page ?? 1,
        focus: page === null && selectedId !== null ? selectedId : undefined,
      }),
    [queue.key, severity, q, page, page === null ? selectedId : null],
  );
  useEffect(() => {
    reloadRef.current = resource.reload;
  }, [reloadRef, resource.reload]);

  const firstId = resource.status === 'ready' ? (resource.data.cases[0]?.id ?? null) : undefined;
  useEffect(() => {
    if (firstId !== undefined) onFirstRow(firstId);
  }, [firstId, onFirstRow]);

  const counts = resource.status === 'ready' ? resource.data.statusCounts : null;
  const shownPage = resource.status === 'ready' ? resource.data.page : (page ?? 1);
  const pageCount = resource.status === 'ready' ? Math.max(1, Math.ceil(resource.data.total / resource.data.pageSize)) : 1;
  const heads = resource.status === 'ready' && queue.key === 'all' ? groupHeads(resource.data.cases, resource.data.statusCounts) : new Map();
  const highlighted = selectedId ?? (firstId === undefined ? null : firstId);

  function pickQueue(key: QueueKey) {
    const next = new URLSearchParams(params);
    next.set('queue', key);
    setParams(next, { state: FROM_QUEUE });
    setPage(1);
  }

  return (
    <ListCard className="@container flex h-full flex-col">
      <ListHeader title="Cases" subtitle="Gate reports and staff-recorded violations" />
      <div className="flex flex-col gap-3 border-b border-line-soft px-6 py-[18px]">
        <label className="relative block">
          <span className="sr-only">Search cases</span>
          <Icon name="search" className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 !text-xl text-muted-2" />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Case ID, student ID, email, name or violation"
            className={cn(controlVariants(), 'pl-10')}
          />
        </label>
        <div className="flex flex-wrap items-center gap-2.5">
          <label className="flex min-w-0 flex-[1_1_220px] items-center gap-2">
            <span className="relative block min-w-0 flex-1">
              <select
                aria-label="Case queue"
                value={queue.key}
                onChange={(event) => pickQueue(event.target.value as QueueKey)}
                className={cn(controlVariants(), 'min-h-11 cursor-pointer appearance-none pr-9 font-medium rail:min-h-10')}
              >
                {queueOptions(counts).map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <Icon name="expand_more" className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-muted" />
            </span>
          </label>
          <ChipGroup
            label="Classification"
            options={CLASSES}
            value={severity}
            onChange={(value) => {
              setSeverity(value as Severity | '');
              setPage(1);
            }}
            className="gap-1.5"
          />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {resource.status === 'loading' ? (
          <p role="status" className="flex items-center justify-center gap-2 px-6 py-10 text-[13px] text-muted">
            <Spinner />
            Loading cases…
          </p>
        ) : null}
        {resource.status === 'error' ? <PageError page="the cases" detail={resource.error.message} onRetry={resource.reload} /> : null}
        {resource.status === 'ready' && resource.data.cases.length === 0 ? (
          <EmptyBlock icon="search_off" title="No cases in this queue">
            Try another filter, name, student ID or case number.
          </EmptyBlock>
        ) : null}
        {resource.status === 'ready'
          ? resource.data.cases.map((row) => {
              const view = caseRowView(row, today);
              const head = heads.get(row.id);
              const selected = row.id === highlighted;
              return (
                <div key={row.id}>
                  {head ? <GroupHead tone={head.tone} label={head.label} count={head.count} unit={head.count === 1 ? 'case' : 'cases'} /> : null}
                  <Link
                    to={`/cases/${row.id}?queue=${queue.key}`}
                    state={FROM_QUEUE}
                    aria-current={selected ? 'true' : undefined}
                    className={cn(
                      'flex min-h-[72px] items-center gap-3.5 border-b border-line-soft px-6 py-2.5 outline-none transition-colors',
                      'focus-visible:ring-[3px] focus-visible:ring-primary/35 focus-visible:ring-inset',
                      selected ? 'bg-row-selected shadow-[inset_3px_0_0_var(--color-primary)]' : 'bg-white hover:bg-row-hover',
                    )}
                  >
                    <span className="hidden w-[108px] shrink-0 leading-snug @min-[560px]:block">
                      <span className="block text-xs font-bold whitespace-nowrap text-ink">{row.code}</span>
                      <span className="block text-xs whitespace-nowrap text-muted">{formatDate(row.caseDate)}</span>
                    </span>
                    <span className="min-w-0 flex-1 leading-snug">
                      <span className="flex min-w-0 items-center gap-1.5">
                        {view.high ? <HighTag className="shrink-0">HIGH</HighTag> : null}
                        <span className="truncate font-semibold text-ink">{view.name}</span>
                        <span className="min-w-0 truncate text-xs text-muted">{view.studentId}</span>
                      </span>
                      <span className="mt-[3px] flex min-w-0 items-center gap-1.5">
                        <span className="truncate text-[13px] text-body">
                          <span className="@min-[560px]:hidden">{row.code} · </span>
                          {row.violation}
                        </span>
                        <StatusPill status={row.severity} />
                        {view.tag ? <Tag className="shrink-0">{view.tag}</Tag> : null}
                        {view.unmatched ? <Tag className="shrink-0 bg-bad-soft text-bad-ink">No matching record</Tag> : null}
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-muted">{view.line3}</span>
                    </span>
                    <span className="mt-0.5 shrink-0 self-start">
                      <StatusPill status={row.status} kind="case" />
                    </span>
                  </Link>
                </div>
              );
            })
          : null}
      </div>
      <Pager page={shownPage} pageCount={pageCount} onChange={setPage} className="mt-auto border-t border-line-soft py-2.5" />
    </ListCard>
  );
}

/** Staff Cases (deck W17 to W29): the queue on the left, the selected case on the right. No page header. */
export function CasesPage() {
  const { id } = useParams();
  const caseId = /^\d+$/.test(id ?? '') ? Number(id) : null;
  // The workspace tells the queue to reload after an action, so a validated report leaves "Needs review".
  const reloadQueue = useRef<(() => void) | null>(null);
  // With nothing selected, the wide layout shows the first case of the queue (deck: `cs[0]`).
  const [firstRow, setFirstRow] = useState<number | null>(null);
  // Record violation is a dialog over the queue; its trigger is the header pill (desktop) or the floating button.
  const [recording, setRecording] = useState(false);
  usePageAction('Record violation', 'add_circle', () => setRecording(true));

  return (
    <>
      <h1 className="sr-only">Cases</h1>
      {recording ? <RecordViolationModal onClose={() => setRecording(false)} /> : null}
      <MasterDetail
        ratio="cases"
        detailKey={caseId}
        list={<CaseQueue selectedId={caseId} reloadRef={reloadQueue} onFirstRow={setFirstRow} />}
        detail={caseId === null ? null : <CaseWorkspace key={caseId} caseId={caseId} onChanged={() => reloadQueue.current?.()} />}
        emptyDetail={
          firstRow === null ? (
            <div className="rounded-xl border border-line bg-white">
              <EmptyBlock icon="inbox" title="No case selected">
                Pick a case from the queue to review it.
              </EmptyBlock>
            </div>
          ) : (
            <CaseWorkspace key={firstRow} caseId={firstRow} onChanged={() => reloadQueue.current?.()} />
          )
        }
      />
    </>
  );
}
