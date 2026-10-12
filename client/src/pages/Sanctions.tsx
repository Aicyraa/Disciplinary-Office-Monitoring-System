import { useState } from 'react';
import type { Severity, StudentSanctionView } from '@shared/types';
import { ProofPanel } from '../components/ProofPanel';
import { Card, EmptyState, PageHeader, Resource, StatusPill } from '../components/ui';
import { api } from '../lib/api';
import { formatDate, SANCTION_STEPS, statusLabel } from '../lib/format';
import { useApi } from '../lib/useApi';

type Filter = 'all' | Severity;

function Tracker({ status }: { status: string }) {
  const current = SANCTION_STEPS.indexOf(status as (typeof SANCTION_STEPS)[number]);
  return (
    <ol className="mt-3 grid grid-cols-4 gap-2" aria-label="Sanction progress">
      {SANCTION_STEPS.map((step, index) => (
        <li key={step} className="text-center">
          <span className={`block h-1.5 rounded-full ${index <= current ? 'bg-primary' : 'bg-line'}`} aria-hidden="true" />
          <span className={`mt-1 block text-[11px] ${index === current ? 'font-semibold text-ink' : 'text-muted'}`}>
            {statusLabel(step)}
          </span>
        </li>
      ))}
    </ol>
  );
}

function SanctionCard({ sanction, onChanged }: { sanction: StudentSanctionView; onChanged: () => void }) {
  return (
    <li className="rounded-lg border border-line bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="font-medium text-ink">
            {sanction.sanctionCode} · {sanction.type}
          </div>
          <div className="text-sm text-muted">
            {sanction.caseCode} · assigned {formatDate(sanction.dateAssigned)} · due {formatDate(sanction.dueDate)}
            {sanction.lateByDays > 0 ? (
              <span className="ml-2 rounded bg-[#F7E6E6] px-1.5 py-0.5 text-xs font-semibold text-[#9B2C2C]">
                Late by {sanction.lateByDays} day{sanction.lateByDays === 1 ? '' : 's'}
              </span>
            ) : null}
          </div>
        </div>
        <div className="flex gap-2">
          <StatusPill status={sanction.severity} />
          <StatusPill status={sanction.status} />
        </div>
      </div>
      <p className="mt-2 text-sm">{sanction.description}</p>
      {sanction.staffNote ? (
        <p className="mt-2 rounded-md bg-page px-3 py-2 text-sm">
          <span className="font-medium text-ink">From the office:</span> {sanction.staffNote}
        </p>
      ) : null}
      <Tracker status={sanction.status} />
      <ProofPanel sanction={sanction} onChanged={onChanged} />
    </li>
  );
}

export function SanctionsPage() {
  const resource = useApi(() => api.mySanctions(), []);
  const [filter, setFilter] = useState<Filter>('all');

  return (
    <>
      <PageHeader title="My sanctions" subtitle="Sanctions assigned to you and their progress." />
      <Resource resource={resource} onRetry={resource.reload}>
        {({ sanctions }) => {
          const shown = filter === 'all' ? sanctions : sanctions.filter((s) => s.severity === filter);
          const count = (status: string) => sanctions.filter((s) => s.status === status).length;
          return (
            <>
              <div className="mb-4 grid grid-cols-2 gap-3 full:grid-cols-4">
                {SANCTION_STEPS.map((step) => (
                  <Card key={step}>
                    <div className="text-2xl font-bold text-ink">{count(step)}</div>
                    <div className="text-sm text-muted">{statusLabel(step)}</div>
                  </Card>
                ))}
              </div>
              <div className="mb-4 flex gap-2" role="group" aria-label="Filter by severity">
                {(['all', 'Minor', 'Major'] as const).map((option) => (
                  <button
                    key={option}
                    type="button"
                    aria-pressed={filter === option}
                    onClick={() => setFilter(option)}
                    className={`rounded-full border px-3 py-1 text-sm font-medium ${
                      filter === option ? 'border-primary bg-primary text-white' : 'border-line-strong bg-white text-ink'
                    }`}
                  >
                    {option === 'all' ? 'All' : option}
                  </button>
                ))}
              </div>
              {shown.length === 0 ? (
                <EmptyState title="No sanctions to show." />
              ) : (
                <ul className="space-y-3">
                  {shown.map((sanction) => (
                    <SanctionCard key={sanction.id} sanction={sanction} onChanged={resource.reload} />
                  ))}
                </ul>
              )}
            </>
          );
        }}
      </Resource>
    </>
  );
}
