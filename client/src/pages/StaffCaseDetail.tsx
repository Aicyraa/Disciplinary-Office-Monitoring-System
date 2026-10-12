import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { StaffCaseDetail } from '@shared/types';
import { ReasonForm } from '../components/ReasonForm';
import { Card, ErrorState, PageHeader, Resource, StatusPill, buttonClass, fieldClass } from '../components/ui';
import { api, toApiError } from '../lib/api';
import { formatDate, formatDateTime, statusLabel } from '../lib/format';
import { useApi } from '../lib/useApi';
import { AssignSanctionForm, SanctionsPanel } from './StaffSanctions';
import { whoLabel } from './StaffCases';

export type CaseAction = 'validate' | 'reject' | 'link_student' | 'assign_sanction' | 'resolve' | 'resolve_without_sanction';

/**
 * Which workflow buttons make sense for a case (SPEC 4.1). The API enforces the same rules; this only keeps
 * the screen from offering what the API would refuse. Remarks are always allowed and handled separately.
 */
export function availableActions(
  detail: Pick<StaffCaseDetail, 'status' | 'student' | 'submissionRef' | 'sanctions'>,
): CaseAction[] {
  switch (detail.status) {
    case 'reported':
      if (detail.submissionRef === null) return [];
      return detail.student ? ['validate', 'reject'] : ['link_student', 'reject'];
    case 'validated':
      return ['assign_sanction', 'resolve_without_sanction'];
    case 'for_sanction':
      return detail.sanctions.length > 0 && detail.sanctions.every((s) => s.status === 'completed')
        ? ['assign_sanction', 'resolve']
        : ['assign_sanction'];
    default:
      return [];
  }
}

const msg = (error: unknown): string => toApiError(error).message;

function Actions({ detail, onDone }: { detail: StaffCaseDetail; onDone: () => void }) {
  const [open, setOpen] = useState<CaseAction | 'remark' | null>(null);
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [linkId, setLinkId] = useState('');
  const [linkError, setLinkError] = useState<string | null>(null);
  const actions = availableActions(detail);
  const ref = detail.submissionRef;

  // What validating would do to the escalation count, shown before the staff member commits.
  const preview = useApi(
    () => (ref && actions.includes('validate') ? api.escalationPreview(ref) : Promise.resolve({ conversions: [] })),
    [ref, detail.status, detail.student?.id],
  );

  const finish = (message: string) => {
    setOpen(null);
    setNotice({ tone: 'success', text: message });
    onDone();
  };

  /** A refused action (for example 409: someone else already decided) is an error, and the view is stale. */
  const failure = (error: unknown) => {
    setOpen(null);
    setNotice({ tone: 'error', text: msg(error) });
    onDone();
  };

  async function validate() {
    if (!ref) return;
    try {
      const result = await api.validateSubmission(ref);
      const converted = result.conversions.length > 0;
      finish(converted ? 'Validated. A 3rd minor was converted into a Major case.' : 'Validated.');
    } catch (error) {
      failure(error);
    }
  }

  async function link() {
    setLinkError(null);
    if (!/^\d{4}-\d{7}$/.test(linkId.trim())) {
      setLinkError('Student ID must look like 2025-1234567.');
      return;
    }
    try {
      await api.linkStudent(detail.id, linkId.trim());
      setLinkId('');
      finish('Student linked.');
    } catch (error) {
      setLinkError(msg(error));
    }
  }

  const conversion = preview.status === 'ready' ? preview.data.conversions : [];

  return (
    <Card className="mb-4">
      <h2 className="mb-2 text-lg font-semibold text-ink">Actions</h2>
      {notice ? (
        <p
          role={notice.tone === 'error' ? 'alert' : 'status'}
          className={`mb-2 text-sm font-medium ${notice.tone === 'error' ? 'text-danger' : 'text-success'}`}
        >
          {notice.text}
        </p>
      ) : null}

      {actions.includes('validate') && conversion.length > 0 ? (
        <p role="note" className="mb-3 rounded-md bg-[#FCE9C6] px-3 py-2 text-sm text-[#7A4600]">
          {conversion
            .map((c) => `This will convert case C${String(c.majorCaseId).padStart(3, '0')} into a Major (3 minor offense).`)
            .join(' ')}
        </p>
      ) : null}

      {actions.includes('link_student') ? (
        <div className="mb-3">
          <p className="mb-1 text-sm text-muted">
            The ID on this report did not match a student. Correct it to be able to validate.
          </p>
          <div className="flex flex-wrap gap-2">
            <label htmlFor="link-student" className="sr-only">
              Student ID
            </label>
            <input
              id="link-student"
              className={`${fieldClass} max-w-56`}
              placeholder="2025-1234567"
              value={linkId}
              onChange={(event) => setLinkId(event.target.value)}
            />
            <button type="button" className={buttonClass} onClick={() => void link()}>
              Link student
            </button>
          </div>
          {linkError ? (
            <p role="alert" className="mt-1 text-sm font-medium text-danger">
              {linkError}
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {actions.includes('validate') ? (
          <button type="button" className={buttonClass} onClick={() => void validate()}>
            Validate{detail.siblingCaseIds.length > 0 ? ` all ${detail.siblingCaseIds.length + 1} cases` : ''}
          </button>
        ) : null}
        {actions.includes('reject') ? (
          <button
            type="button"
            className="rounded-md border border-danger px-4 py-2 text-sm font-semibold text-danger hover:bg-page"
            onClick={() => setOpen('reject')}
          >
            Reject
          </button>
        ) : null}
        {actions.includes('assign_sanction') ? (
          <button type="button" className={buttonClass} onClick={() => setOpen('assign_sanction')}>
            Assign sanction
          </button>
        ) : null}
        {actions.includes('resolve') ? (
          <button
            type="button"
            className={buttonClass}
            onClick={async () => {
              try {
                await api.resolveCase(detail.id);
                finish('Case resolved.');
              } catch (error) {
                failure(error);
              }
            }}
          >
            Resolve case
          </button>
        ) : null}
        {actions.includes('resolve_without_sanction') ? (
          <button
            type="button"
            className="rounded-md border border-line-strong bg-white px-4 py-2 text-sm font-semibold text-ink hover:bg-page"
            onClick={() => setOpen('resolve_without_sanction')}
          >
            Resolve without a sanction
          </button>
        ) : null}
        <button
          type="button"
          className="rounded-md border border-line-strong bg-white px-4 py-2 text-sm font-semibold text-ink hover:bg-page"
          onClick={() => setOpen('remark')}
        >
          Add remark
        </button>
      </div>

      {detail.status === 'for_sanction' && !actions.includes('resolve') ? (
        <p className="mt-3 text-sm text-muted">This case can be resolved once every sanction is completed.</p>
      ) : null}

      {open === 'assign_sanction' ? (
        <AssignSanctionForm
          caseId={detail.id}
          onCancel={() => setOpen(null)}
          onAssigned={() => finish('Sanction assigned.')}
        />
      ) : null}

      {open === 'reject' && ref ? (
        <ReasonForm
          title="Reject this report"
          description={
            detail.siblingCaseIds.length > 0
              ? `This rejects all ${detail.siblingCaseIds.length + 1} cases in the submission. The student sees it as "Not verified".`
              : 'The student sees it as "Not verified".'
          }
          label="Reason (required)"
          submitLabel="Reject"
          onCancel={() => setOpen(null)}
          onSubmit={async (reason) => {
            try {
              await api.rejectSubmission(ref, reason);
            } catch (error) {
              throw new Error(msg(error));
            }
            finish('Rejected.');
          }}
        />
      ) : null}
      {open === 'resolve_without_sanction' ? (
        <ReasonForm
          title="Resolve without a sanction"
          label="Reason (required)"
          submitLabel="Resolve"
          onCancel={() => setOpen(null)}
          onSubmit={async (reason) => {
            try {
              await api.resolveWithoutSanction(detail.id, reason);
            } catch (error) {
              throw new Error(msg(error));
            }
            finish('Case resolved without a sanction.');
          }}
        />
      ) : null}
      {open === 'remark' ? (
        <ReasonForm
          title="Add a remark"
          description="The student sees remarks on the case timeline."
          label="Remark"
          submitLabel="Add remark"
          onCancel={() => setOpen(null)}
          onSubmit={async (remarks) => {
            try {
              await api.addRemark(detail.id, remarks);
            } catch (error) {
              throw new Error(msg(error));
            }
            finish('Remark added.');
          }}
        />
      ) : null}
    </Card>
  );
}

function Details({ detail }: { detail: StaffCaseDetail }) {
  const rows: Array<[string, string]> = [
    ['Student', whoLabel(detail)],
    ['Violation', `${detail.violation} (${detail.section})`],
    ['Reported', formatDate(detail.caseDate)],
    ['Source', detail.source === 'gate' ? 'Gate report' : 'Recorded by staff'],
  ];
  if (detail.claimed?.program || detail.claimed?.year) {
    rows.push(['Typed on the form', [detail.claimed.program, detail.claimed.year].filter(Boolean).join(' · ')]);
  }
  if (detail.convertedFrom) rows.push(['Originally', detail.convertedFrom]);
  return (
    <Card>
      <dl className="grid gap-3 sm:grid-cols-2">
        {rows.map(([label, value]) => (
          <div key={label}>
            <dt className="text-xs font-semibold tracking-wide text-muted uppercase">{label}</dt>
            <dd className="text-sm text-ink">{value}</dd>
          </div>
        ))}
      </dl>
      {detail.createdFromCaseIds.length > 0 ? (
        <p className="mt-4 text-sm">
          Created from cases{' '}
          {detail.createdFromCaseIds.map((id, index) => (
            <span key={id}>
              {index > 0 ? ', ' : ''}
              <Link to={`/cases/${id}`} className="font-medium text-primary underline">
                C{String(id).padStart(3, '0')}
              </Link>
            </span>
          ))}
          .
        </p>
      ) : null}
      {detail.countedTowardCaseId !== null ? (
        <p className="mt-4 text-sm">
          Counted toward Major case{' '}
          <Link to={`/cases/${detail.countedTowardCaseId}`} className="font-medium text-primary underline">
            C{String(detail.countedTowardCaseId).padStart(3, '0')}
          </Link>
          .
        </p>
      ) : null}
      {detail.siblingCaseIds.length > 0 ? (
        <p className="mt-2 text-sm text-muted">
          Same submission:{' '}
          {detail.siblingCaseIds.map((id, index) => (
            <span key={id}>
              {index > 0 ? ', ' : ''}
              <Link to={`/cases/${id}`} className="text-primary underline">
                C{String(id).padStart(3, '0')}
              </Link>
            </span>
          ))}
        </p>
      ) : null}
    </Card>
  );
}

function History({ detail }: { detail: StaffCaseDetail }) {
  return (
    <Card>
      <ol className="space-y-3 border-l-2 border-line pl-4">
        {[...detail.timeline].reverse().map((entry, index) => (
          <li key={`${entry.date}-${index}`}>
            <div className="text-sm font-medium text-ink">
              {statusLabel(entry.eventType)}
              {entry.statusAfter ? ` → ${statusLabel(entry.statusAfter)}` : ''}
            </div>
            {entry.remarks ? <div className="text-sm">{entry.remarks}</div> : null}
            <div className="text-xs text-muted">
              {entry.by} · {formatDateTime(entry.date)}
            </div>
          </li>
        ))}
      </ol>
    </Card>
  );
}

export function CaseDetailPage() {
  const { id } = useParams();
  const caseId = /^\d+$/.test(id ?? '') ? Number(id) : null;
  const resource = useApi(() => api.staffCase(caseId ?? 0), [caseId]);
  const [tab, setTab] = useState<'details' | 'history'>('details');

  if (caseId === null) return <ErrorState message="This case could not be found." />;
  return (
    <>
      <p className="mb-3 text-sm">
        <Link to="/cases" className="text-primary underline">
          ← All cases
        </Link>
      </p>
      <Resource resource={resource} onRetry={resource.reload}>
        {({ case: detail }) => (
          <>
            <PageHeader
              title={`${detail.code} · ${detail.violation}`}
              actions={
                <div className="flex gap-2">
                  <StatusPill status={detail.severity} />
                  <StatusPill status={detail.status} />
                </div>
              }
            />
            <Actions detail={detail} onDone={resource.reload} />
            <SanctionsPanel sanctions={detail.sanctions} onChanged={resource.reload} />
            <div className="mb-3 flex gap-2" role="tablist" aria-label="Case sections">
              {(['details', 'history'] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  role="tab"
                  aria-selected={tab === option}
                  onClick={() => setTab(option)}
                  className={`rounded-full border px-3 py-1 text-sm font-medium ${
                    tab === option ? 'border-primary bg-primary text-white' : 'border-line-strong bg-white text-ink'
                  }`}
                >
                  {option === 'details' ? 'Details' : 'History'}
                </button>
              ))}
            </div>
            {tab === 'details' ? <Details detail={detail} /> : <History detail={detail} />}
          </>
        )}
      </Resource>
    </>
  );
}
