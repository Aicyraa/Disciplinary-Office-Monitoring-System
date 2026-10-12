import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { SanctionTemplateView, StudentSanctionView } from '@shared/types';
import { MasterDetail } from '../components/MasterDetail';
import { StageTracker } from '../components/StageTracker';
import { TemplateFileLinks, hasTemplateContent } from '../components/TemplateDownloads';
import { EmptyState, ErrorState, LoadingState, PageHeader, StatusPill } from '../components/ui';
import { api } from '../lib/api';
import { manilaToday } from '../lib/files';
import { SANCTION_STEP_LABELS, formatDate, formatDateTime, sanctionStepIndex, statusLabel } from '../lib/format';
import { dueLabel, matchesSanctionFilter, nextStep, type SanctionFilter } from '../lib/studentView';
import { useApi } from '../lib/useApi';

const FILTERS: Array<[SanctionFilter, string]> = [
  ['all', 'All'],
  ['in_progress', 'In progress'],
  ['pending_verification', 'Pending verification'],
  ['cleared', 'Cleared'],
];

const HISTORY_LABEL: Record<string, string> = {
  assigned: 'Assigned by the office',
  proof_uploaded: 'Proof uploaded',
  proof_replaced: 'Proof file replaced',
  proof_removed: 'Proof file removed',
  compliance_recorded: 'Compliance recorded',
  returned: 'Returned to you',
  verified: 'Verified by the office',
};

function Tile({ label, value, accent }: { label: string; value: number; accent: string }) {
  return (
    <div className="relative rounded-lg border border-line bg-white p-3 pl-4">
      <span aria-hidden="true" className={`absolute inset-y-0 left-0 w-1 rounded-l-lg ${accent}`} />
      <p className="text-xs font-medium text-muted">{label}</p>
      <p className="text-3xl font-bold text-ink">{value}</p>
    </div>
  );
}

function SanctionList({ sanctions, selectedId }: { sanctions: StudentSanctionView[]; selectedId: number | null }) {
  const [filter, setFilter] = useState<SanctionFilter>('all');
  const today = manilaToday();
  const shown = useMemo(() => sanctions.filter((item) => matchesSanctionFilter(item, filter)), [sanctions, filter]);

  return (
    <section aria-label="My sanctions" className="rounded-lg border border-line bg-white">
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
              <span className="rounded-full bg-black/10 px-1.5 text-xs">{sanctions.filter((s) => matchesSanctionFilter(s, value)).length}</span>
            </button>
          ))}
        </div>
      </div>
      {shown.length === 0 ? (
        <div className="p-3">
          <EmptyState title="No sanctions to show." />
        </div>
      ) : (
        <ul>
          {shown.map((sanction) => (
            <li key={sanction.id}>
              <Link
                to={`/sanctions/${sanction.id}`}
                aria-current={sanction.id === selectedId ? 'page' : undefined}
                className={`flex min-h-16 items-start justify-between gap-3 border-b border-line px-3 py-2 hover:bg-page ${
                  sanction.id === selectedId ? 'bg-primary/10' : ''
                }`}
              >
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-ink">
                    {sanction.sanctionCode} · {sanction.type}
                  </span>
                  <span className="block text-xs text-muted">
                    {sanction.caseCode} · Due {formatDate(sanction.dueDate)} · {dueLabel(sanction.dueDate, today, sanction.status)}
                  </span>
                </span>
                <StatusPill status={sanction.status} kind="sanction" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function SanctionDetail({ sanction, template }: { sanction: StudentSanctionView; template: SanctionTemplateView | undefined }) {
  const [tab, setTab] = useState<'details' | 'timeline'>('details');
  const today = manilaToday();

  return (
    <article aria-label={`Sanction ${sanction.sanctionCode}`} className="space-y-4 rounded-lg border border-line bg-white p-4">
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-xl font-bold text-ink">{sanction.type}</h2>
          <p className="text-sm text-muted">
            {sanction.sanctionCode} · {sanction.caseCode}
          </p>
        </div>
        <StatusPill status={sanction.status} kind="sanction" />
      </header>

      <StageTracker steps={SANCTION_STEP_LABELS} current={sanctionStepIndex(sanction.status)} label="Sanction progress" />

      <p className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-page px-3 py-2 text-sm">
        <span className="text-ink">
          Due <span className="font-semibold">{formatDate(sanction.dueDate)}</span>
        </span>
        <span className={`font-semibold ${sanction.lateByDays > 0 && sanction.status !== 'completed' ? 'text-danger' : 'text-muted'}`}>
          {dueLabel(sanction.dueDate, today, sanction.status)}
        </span>
      </p>

      <div className="flex rounded-full bg-page p-1" role="tablist" aria-label="Sanction sections">
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
        <div className="space-y-3">
          <p className="text-sm">{sanction.description}</p>
          {sanction.staffNote ? (
            <p className="rounded-md bg-page px-3 py-2 text-sm">
              <span className="font-medium text-ink">Note from the SDO:</span> {sanction.staffNote}
            </p>
          ) : null}
          {template && template.files.length > 0 && hasTemplateContent(template) ? (
            <div className="rounded-md bg-page px-3 py-2 text-sm">
              <span className="font-medium text-ink">Template to download:</span>
              <TemplateFileLinks template={template} />
            </div>
          ) : null}
        </div>
      ) : (
        <ol className="space-y-3 border-l-2 border-line pl-4">
          {[...sanction.history].reverse().map((entry, index) => (
            <li key={`${entry.date}-${index}`}>
              <div className="text-sm font-medium text-ink">{HISTORY_LABEL[entry.eventType] ?? statusLabel(entry.eventType)}</div>
              {entry.remarks ? <div className="text-sm">{entry.remarks}</div> : null}
              <div className="text-xs text-muted">{formatDateTime(entry.date)}</div>
            </li>
          ))}
        </ol>
      )}

      <p className="rounded-md bg-primary/10 px-3 py-2 text-sm text-ink">
        <span className="font-semibold">Next step: </span>
        {nextStep(sanction)}
      </p>
      {sanction.canUpload || sanction.canChangeFiles ? (
        <Link
          to={`/violations/${sanction.caseId}`}
          className="inline-flex min-h-11 w-full items-center justify-center rounded-full bg-primary text-sm font-semibold text-white hover:bg-primary-active"
        >
          Upload proof in My violations
        </Link>
      ) : (
        <Link
          to={`/violations/${sanction.caseId}`}
          className="inline-flex min-h-11 w-full items-center justify-center rounded-full border border-primary text-sm font-semibold text-primary hover:bg-page"
        >
          Open the violation
        </Link>
      )}
    </article>
  );
}

/** My sanctions (deck W65 to W67): tiles, the list, and the selected sanction. Proof is uploaded in My violations. */
export function SanctionsPage() {
  const { id } = useParams();
  const selectedId = /^\d+$/.test(id ?? '') ? Number(id) : null;
  const resource = useApi(() => api.mySanctions(), []);
  // A failed template request must never hide the student's own sanctions, so errors are simply "no template".
  const templates = useApi(() => api.sanctionTemplates().catch(() => ({ templates: [] as SanctionTemplateView[] })), []);
  const templateBySanction = new Map(
    (templates.status === 'ready' ? templates.data.templates : []).map((template) => [template.sanctionId, template]),
  );

  return (
    <>
      <PageHeader title="My sanctions" subtitle="Sanctions assigned to you and their progress." />
      {resource.status === 'loading' ? <LoadingState label="Loading your sanctions…" /> : null}
      {resource.status === 'error' ? <ErrorState message={resource.error.message} onRetry={resource.reload} /> : null}
      {resource.status === 'ready' ? (
        resource.data.sanctions.length === 0 ? (
          <EmptyState title="You have no sanctions." hint="A sanction appears here when the office assigns one." />
        ) : (
          <>
            <div className="mb-4 grid grid-cols-3 gap-3">
              <Tile label="All sanctions" value={resource.data.sanctions.length} accent="bg-primary" />
              <Tile label="Minor offense" value={resource.data.sanctions.filter((s) => s.severity === 'Minor').length} accent="bg-[#6B74B8]" />
              <Tile label="Major offense" value={resource.data.sanctions.filter((s) => s.severity === 'Major').length} accent="bg-danger" />
            </div>
            <MasterDetail
              list={<SanctionList sanctions={resource.data.sanctions} selectedId={selectedId} />}
              detail={(() => {
                if (selectedId === null) return null;
                const found = resource.data.sanctions.find((item) => item.id === selectedId);
                if (!found) return <ErrorState message="That sanction was not found." />;
                return <SanctionDetail key={found.id} sanction={found} template={templateBySanction.get(found.sanctionId)} />;
              })()}
              emptyDetail={<EmptyState title="Select a sanction" hint="Its progress and next step appear here." />}
              backTo="/sanctions"
              backLabel="All sanctions"
            />
          </>
        )
      ) : null}
    </>
  );
}
