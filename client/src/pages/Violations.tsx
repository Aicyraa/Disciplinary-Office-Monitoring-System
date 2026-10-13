import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { StudentCaseDetailView, StudentCaseView } from '@shared/types';
import { MasterDetail } from '../components/MasterDetail';
import { ProofPanel } from '../components/ProofPanel';
import { StageTracker } from '../components/StageTracker';
import { EmptyState, ErrorState, LoadingState, PageHeader, StatusPill } from '../components/ui';
import { api } from '../lib/api';
import { caseStageIndex, formatDate, formatDateTime, statusLabel } from '../lib/format';
import { latestRemark, matchesViolationFilter, nextStep, violationTiles, type ViolationFilter } from '../lib/studentView';
import { useApi } from '../lib/useApi';

const STAGE_NAMES = ['Reported', 'Validated', 'Sanctioned', 'Resolved'] as const;

const FILTERS: Array<[ViolationFilter, string]> = [
  ['active', 'All'],
  ['reported', 'Pending review'],
  ['validated', 'Validated'],
  ['for_sanction', 'Sanction in progress'],
  ['closed', 'Closed'],
];

function Tile({ label, value, accent }: { label: string; value: number; accent: string }) {
  return (
    <div className="relative rounded-lg border border-line bg-white p-3 pl-4">
      <span aria-hidden="true" className={`absolute inset-y-0 left-0 w-1 rounded-l-lg ${accent}`} />
      <p className="text-xs font-medium text-muted">{label}</p>
      <p className="text-3xl font-bold text-ink">{value}</p>
    </div>
  );
}

function CaseList({ cases, selectedId }: { cases: StudentCaseView[]; selectedId: number | null }) {
  const [filter, setFilter] = useState<ViolationFilter>('active');
  const shown = useMemo(() => cases.filter((item) => matchesViolationFilter(item, filter)), [cases, filter]);
  const count = (value: ViolationFilter) => cases.filter((item) => matchesViolationFilter(item, value)).length;

  return (
    <section aria-label="My violations" className="rounded-lg border border-line bg-white">
      <div className="border-b border-line p-3">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Status">
          {FILTERS.map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={filter === value}
              onClick={() => setFilter(value)}
              className={`inline-flex min-h-11 items-center gap-2 rounded-full border px-3 text-sm font-medium ${
                filter === value ? 'border-primary bg-primary text-white' : 'border-line-strong bg-white text-ink'
              }`}
            >
              {label}
              <span className="rounded-full bg-black/10 px-1.5 text-xs">{count(value)}</span>
            </button>
          ))}
        </div>
      </div>
      {shown.length === 0 ? (
        <div className="p-3">
          <EmptyState title="No violations here." />
        </div>
      ) : (
        <ul>
          {shown.map((record) => (
            <li key={record.id}>
              <Link
                to={`/violations/${record.id}`}
                aria-current={record.id === selectedId ? 'page' : undefined}
                className={`flex min-h-16 items-start gap-3 border-b border-line px-3 py-2 hover:bg-page ${
                  record.id === selectedId ? 'bg-primary/10' : ''
                }`}
              >
                <span className="w-24 shrink-0 text-xs">
                  <span className="block font-semibold text-ink">{record.code}</span>
                  <span className="block text-muted">{formatDate(record.caseDate)}</span>
                </span>
                <span className="min-w-0 flex-1 text-sm font-medium text-ink">
                  {record.violation}
                  {record.convertedFrom ? (
                    <span className="ml-2 rounded-full bg-[#FCE9C6] px-2 py-0.5 text-[11px] font-semibold text-[#7A4600]">Treated as Major</span>
                  ) : record.isEscalated ? (
                    <span className="ml-2 rounded-full bg-[#FCE9C6] px-2 py-0.5 text-[11px] font-semibold text-[#7A4600]">Escalated</span>
                  ) : null}
                </span>
                <span className="shrink-0">
                  <StatusPill status={record.status} kind="case" />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function CaseDetail({ record, onChanged }: { record: StudentCaseDetailView; onChanged: () => void }) {
  const [tab, setTab] = useState<'details' | 'timeline'>('details');
  const remark = latestRemark(record.timeline);
  const rejected = record.status === 'rejected';

  return (
    <article aria-label={`Violation ${record.code}`} className="space-y-4 rounded-lg border border-line bg-white p-4">
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-xl font-bold text-ink">{record.violation}</h2>
          <p className="text-sm text-muted">{record.code}</p>
        </div>
        <StatusPill status={record.status} kind="case" />
      </header>

      {rejected ? (
        <p role="status" className="rounded-md bg-[#ECEEF1] px-3 py-2 text-sm font-medium text-[#4A5260]">
          Not verified: the office could not verify this report.
        </p>
      ) : (
        <StageTracker steps={STAGE_NAMES} current={Math.max(0, caseStageIndex(record.status))} label="Case progress" />
      )}

      <div className="flex rounded-full bg-page p-1" role="tablist" aria-label="Violation sections">
        {(['details', 'timeline'] as const).map((option) => (
          <button
            key={option}
            type="button"
            role="tab"
            aria-selected={tab === option}
            onClick={() => setTab(option)}
            className={`min-h-11 flex-1 rounded-full text-sm font-medium ${tab === option ? 'bg-white text-ink shadow-sm' : 'text-muted'}`}
          >
            {option === 'details' ? 'Details' : 'Timeline'}
          </button>
        ))}
      </div>

      {tab === 'details' ? (
        <dl className="rounded-lg border border-line">
          {(
            [
              ['Case ID', record.code],
              ['Filed', formatDate(record.caseDate)],
              ['Handbook', `${record.severity} · Sec. ${record.section}`],
              ...(record.convertedFrom ? [['Originally', record.convertedFrom] as [string, string]] : []),
              ...record.sanctions.map((s) => [`Sanction`, `${s.sanctionCode} · ${s.type} · Due ${formatDate(s.dueDate)}`] as [string, string]),
              ...(record.resolvedWithoutSanction && record.dateResolved
                ? [['Resolved', `Without a sanction on ${formatDate(record.dateResolved)}`] as [string, string]]
                : []),
              ['Remarks', remark ?? 'None'],
            ] as Array<[string, string]>
          ).map(([label, value], index) => (
            <div key={`${label}-${index}`} className="grid grid-cols-[6rem_1fr] gap-2 border-b border-line px-3 py-2 last:border-0">
              <dt className="text-xs font-semibold tracking-wide text-muted uppercase">{label}</dt>
              <dd className="text-sm text-ink">{value}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <ol className="space-y-3 border-l-2 border-line pl-4">
          {[...record.timeline].reverse().map((entry, index) => (
            <li key={`${entry.date}-${index}`}>
              <div className="text-sm font-medium text-ink">
                {statusLabel(entry.eventType)}
                {entry.statusAfter ? ` → ${statusLabel(entry.statusAfter, 'case')}` : ''}
              </div>
              {entry.remarks ? <div className="text-sm">{entry.remarks}</div> : null}
              <div className="text-xs text-muted">{formatDateTime(entry.date)}</div>
            </li>
          ))}
        </ol>
      )}

      {record.sanctions.map((sanction) => (
        <section key={sanction.id} aria-label={`Sanction ${sanction.sanctionCode}`} className="space-y-3">
          <p className="rounded-md bg-primary/10 px-3 py-2 text-sm text-ink">
            <span className="font-semibold">Next step: </span>
            {nextStep(sanction)}
          </p>
          <ProofPanel sanction={sanction} onChanged={onChanged} />
          <Link
            to="/sanctions"
            className="inline-flex min-h-11 w-full items-center justify-center rounded-full border border-primary text-sm font-semibold text-primary hover:bg-page"
          >
            Open the sanction
          </Link>
        </section>
      ))}
      {record.sanctions.length === 0 && !rejected && record.status !== 'resolved' ? (
        <p className="text-sm text-muted">No sanction has been assigned yet. The office will tell you when there is one.</p>
      ) : null}
    </article>
  );
}

function SelectedCase({ caseId, onChanged }: { caseId: number; onChanged: () => void }) {
  const resource = useApi(() => api.myCase(caseId), [caseId]);
  if (resource.status === 'loading') return <LoadingState label="Loading violation…" cards={2} />;
  if (resource.status === 'error') return <ErrorState message={resource.error.message} onRetry={resource.reload} />;
  return (
    <CaseDetail
      record={resource.data.case}
      onChanged={() => {
        resource.reload();
        onChanged();
      }}
    />
  );
}

/** My violations (deck W62 to W64): the list, tiles, and the selected case with its proof upload. */
export function ViolationsPage() {
  const { id } = useParams();
  const caseId = /^\d+$/.test(id ?? '') ? Number(id) : null;
  const resource = useApi(() => api.myCases(), []);

  return (
    <>
      <PageHeader title="My violations" subtitle="Reports recorded against you and where each one stands." />
      {resource.status === 'loading' ? <LoadingState label="Loading your violations…" /> : null}
      {resource.status === 'error' ? <ErrorState message={resource.error.message} onRetry={resource.reload} /> : null}
      {resource.status === 'ready' ? (
        resource.data.cases.length === 0 ? (
          <EmptyState title="You have no recorded violations." />
        ) : (
          <>
            <div className="mb-4 grid grid-cols-3 gap-3">
              {(() => {
                const tiles = violationTiles(resource.data.cases);
                return (
                  <>
                    <Tile label="All active cases" value={tiles.active} accent="bg-primary" />
                    <Tile label="Minor" value={tiles.minor} accent="bg-[#6B74B8]" />
                    <Tile label="Major" value={tiles.major} accent="bg-danger" />
                  </>
                );
              })()}
            </div>
            <MasterDetail
              list={<CaseList cases={resource.data.cases} selectedId={caseId} />}
              detail={caseId === null ? null : <SelectedCase key={caseId} caseId={caseId} onChanged={resource.reload} />}
              emptyDetail={<EmptyState title="Select a violation" hint="Its progress, details and any sanction appear here." />}
              backTo="/violations"
              backLabel="All violations"
            />
          </>
        )
      ) : null}
    </>
  );
}

