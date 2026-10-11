import { Link, useParams } from 'react-router-dom';
import type { StudentCaseDetailView, StudentCaseView } from '../../../shared/types';
import { Card, EmptyState, ErrorState, PageHeader, Resource, StatusPill } from '../components/ui';
import { api } from '../lib/api';
import { CASE_STAGES, caseStageIndex, formatDate, formatDateTime, statusLabel } from '../lib/format';
import { useApi } from '../lib/useApi';

function Stepper({ status }: { status: string }) {
  if (status === 'rejected') {
    return (
      <div role="status" className="rounded-md bg-[#ECEEF1] px-3 py-2 text-sm font-medium text-[#4A5260]">
        Not verified: the office could not verify this report.
      </div>
    );
  }
  const current = caseStageIndex(status);
  return (
    <ol className="flex items-center gap-2" aria-label="Case progress">
      {CASE_STAGES.map((stage, index) => (
        <li key={stage} className="flex flex-1 flex-col items-center gap-1 text-center">
          <span
            className={`h-2 w-full rounded-full ${index <= current ? 'bg-primary' : 'bg-line'}`}
            aria-hidden="true"
          />
          <span className={`text-xs ${index === current ? 'font-semibold text-ink' : 'text-muted'}`}>
            {statusLabel(stage)}
          </span>
        </li>
      ))}
    </ol>
  );
}

function CaseRow({ record }: { record: StudentCaseView }) {
  return (
    <li>
      <Link
        to={`/violations/${record.id}`}
        className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line bg-white p-3 hover:border-primary"
      >
        <div>
          <div className="font-medium text-ink">
            {record.code} · {record.violation}
          </div>
          <div className="text-sm text-muted">
            {record.section} · {formatDate(record.caseDate)}
            {record.isEscalated ? ' · counted toward a 3-minor offense' : ''}
          </div>
        </div>
        <div className="flex gap-2">
          <StatusPill status={record.severity} />
          <StatusPill status={record.status} />
        </div>
      </Link>
    </li>
  );
}

export function ViolationsList() {
  const resource = useApi(() => api.myCases(), []);
  return (
    <>
      <PageHeader title="My violations" subtitle="Reports recorded against you and where each one stands." />
      <Resource resource={resource} onRetry={resource.reload}>
        {({ cases }) =>
          cases.length === 0 ? (
            <EmptyState title="You have no recorded violations." />
          ) : (
            <ul className="space-y-2">
              {cases.map((record) => (
                <CaseRow key={record.id} record={record} />
              ))}
            </ul>
          )
        }
      </Resource>
    </>
  );
}

function Detail({ record }: { record: StudentCaseDetailView }) {
  return (
    <>
      <PageHeader
        title={`${record.code} · ${record.violation}`}
        subtitle={`${record.section} · reported ${formatDate(record.caseDate)}`}
        actions={
          <div className="flex gap-2">
            <StatusPill status={record.severity} />
            <StatusPill status={record.status} />
          </div>
        }
      />
      <Card className="mb-4">
        <Stepper status={record.status} />
        {record.convertedFrom ? (
          <p className="mt-3 text-sm text-muted">
            This case was converted to a Major offense after three Minor offenses. It started as “{record.convertedFrom}”.
          </p>
        ) : null}
        {record.resolvedWithoutSanction && record.dateResolved ? (
          <p className="mt-3 text-sm text-muted">Resolved without a sanction on {formatDate(record.dateResolved)}.</p>
        ) : null}
      </Card>

      <h2 className="mb-2 text-lg font-semibold text-ink">Sanctions</h2>
      {record.sanctions.length === 0 ? (
        <EmptyState title="No sanction has been assigned yet." />
      ) : (
        <ul className="mb-6 space-y-2">
          {record.sanctions.map((sanction) => (
            <li key={sanction.id} className="rounded-lg border border-line bg-white p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium text-ink">{sanction.type}</span>
                <StatusPill status={sanction.status} />
              </div>
              <p className="mt-1 text-sm text-muted">Due {formatDate(sanction.dueDate)}</p>
              {sanction.staffNote ? <p className="mt-1 text-sm">Note from the office: {sanction.staffNote}</p> : null}
            </li>
          ))}
        </ul>
      )}

      <h2 className="mb-2 text-lg font-semibold text-ink">Timeline</h2>
      <ol className="space-y-3 border-l-2 border-line pl-4">
        {[...record.timeline].reverse().map((entry, index) => (
          <li key={`${entry.date}-${index}`}>
            <div className="text-sm font-medium text-ink">
              {statusLabel(entry.eventType)}
              {entry.statusAfter ? ` → ${statusLabel(entry.statusAfter)}` : ''}
            </div>
            {entry.remarks ? <div className="text-sm">{entry.remarks}</div> : null}
            <div className="text-xs text-muted">{formatDateTime(entry.date)}</div>
          </li>
        ))}
      </ol>
    </>
  );
}

export function ViolationDetail() {
  const { id } = useParams();
  const caseId = /^\d+$/.test(id ?? '') ? Number(id) : null;
  const resource = useApi(() => api.myCase(caseId ?? 0), [caseId]);

  if (caseId === null) return <ErrorState message="This violation could not be found." />;
  return (
    <>
      <p className="mb-3 text-sm">
        <Link to="/violations" className="text-primary underline">
          ← All violations
        </Link>
      </p>
      <Resource resource={resource} onRetry={resource.reload}>
        {({ case: record }) => <Detail record={record} />}
      </Resource>
    </>
  );
}
