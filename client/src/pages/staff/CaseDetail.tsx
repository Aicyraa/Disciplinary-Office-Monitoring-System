import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { StaffCaseDetail } from '@shared/types';
import { ConfirmModal, useToast } from '@/components/feedback';
import { ErrorState, Icon, LoadingState, StatusPill, buttonClass, fieldClass } from '@/components/ui';
import { api, toApiError } from '@/api/client';
import { CASE_STAGES, stageIndex, stageText } from '@/utils/caseView';
import { formatDate, formatDateTime, statusLabel } from '@/utils/format';
import { useApi } from '@/hooks/useApi';
import { AssignSanctionForm, SanctionsPanel } from './Sanctions';
import { whoLabel } from './Cases';

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
const codeOf = (detail: Pick<StaffCaseDetail, 'caseCodes'>, id: number): string => detail.caseCodes[String(id)] ?? `#${id}`;

const secondaryButton =
  'inline-flex min-h-11 items-center justify-center rounded-md border border-line-strong bg-white px-4 text-sm font-semibold text-ink hover:bg-page';
const dangerButton =
  'inline-flex min-h-11 items-center justify-center rounded-md border border-danger px-4 text-sm font-semibold text-danger hover:bg-page';

/** Four dots joined by a line: Reported, Validated, Sanctioned, Resolved. A rejected report shows a notice instead. */
function Tracker({ status }: { status: StaffCaseDetail['status'] }) {
  const current = stageIndex(status);
  if (current === null) {
    return (
      <p role="note" className="rounded-md bg-page px-3 py-2 text-sm text-body">
        This report was not verified. No further steps apply.
      </p>
    );
  }
  return (
    <ol aria-label="Case progress" className="flex items-start">
      {CASE_STAGES.map((stage, index) => {
        const done = index <= current;
        return (
          <li key={stage} aria-current={index === current ? 'step' : undefined} className="relative flex flex-1 flex-col items-center text-center">
            {index > 0 ? (
              <span aria-hidden="true" className={`absolute top-3 right-1/2 h-0.5 w-full ${index <= current ? 'bg-primary' : 'bg-line'}`} />
            ) : null}
            <span
              className={`relative inline-flex size-6 items-center justify-center rounded-full border-2 text-xs font-bold ${
                done ? 'border-primary bg-primary text-white' : 'border-line-strong bg-white text-muted'
              }`}
            >
              {index + 1}
            </span>
            <span className={`mt-1 text-xs ${index === current ? 'font-semibold text-ink' : 'text-muted'}`}>{stage}</span>
          </li>
        );
      })}
    </ol>
  );
}

type Modal = 'reject' | 'resolve_without_sanction' | 'assign_sanction' | null;

function Actions({
  detail,
  onDone,
  remarkOpen,
  onRemarkClose,
}: {
  detail: StaffCaseDetail;
  onDone: () => void;
  remarkOpen: boolean;
  onRemarkClose: () => void;
}) {
  const toast = useToast();
  const [open, setOpen] = useState<Modal>(null);
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
    toast.show(message, 'success');
    onDone();
  };

  /** A refused action (for example 409: someone else already decided) is an error, and the view is stale. */
  const failure = (error: unknown) => {
    setOpen(null);
    toast.show(msg(error), 'error');
    onDone();
  };

  async function validate() {
    if (!ref) return;
    try {
      const result = await api.validateSubmission(ref);
      finish(result.conversions.length > 0 ? 'Validated. A 3rd minor was converted into a Major case.' : 'Validated.');
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
  const count = detail.siblingCaseIds.length + 1;

  return (
    <div className="space-y-3">
      {actions.includes('validate') && conversion.length > 0 ? (
        <p role="note" className="rounded-md bg-[#FCE9C6] px-3 py-2 text-sm text-[#7A4600]">
          {conversion
            .map((c) => `This will convert case ${codeOf(detail, c.majorCaseId)} into a Major (3 minor offense).`)
            .join(' ')}
        </p>
      ) : null}

      {actions.includes('link_student') ? (
        <div>
          <p className="mb-1 text-sm text-muted">The ID on this report did not match a student. Correct it to be able to validate.</p>
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
            <button type="button" className={`${buttonClass} min-h-11`} onClick={() => void link()}>
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
          <button type="button" className={`${buttonClass} min-h-11 flex-1`} onClick={() => void validate()}>
            {count > 1 ? `Validate report (${count} violations)` : 'Validate report'}
          </button>
        ) : null}
        {actions.includes('reject') ? (
          <button type="button" className={dangerButton} onClick={() => setOpen('reject')}>
            Reject
          </button>
        ) : null}
        {actions.includes('assign_sanction') ? (
          <button type="button" className={`${buttonClass} min-h-11`} onClick={() => setOpen('assign_sanction')}>
            Assign sanction
          </button>
        ) : null}
        {actions.includes('resolve') ? (
          <button
            type="button"
            className={`${buttonClass} min-h-11`}
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
          <button type="button" className={secondaryButton} onClick={() => setOpen('resolve_without_sanction')}>
            Resolve without a sanction
          </button>
        ) : null}
      </div>

      {detail.status === 'for_sanction' && !actions.includes('resolve') ? (
        <p className="text-sm text-muted">This case can be resolved once every sanction is completed.</p>
      ) : null}

      {open === 'assign_sanction' ? (
        <AssignSanctionForm caseId={detail.id} onCancel={() => setOpen(null)} onAssigned={() => finish('Sanction assigned.')} />
      ) : null}

      <ConfirmModal
        open={open === 'reject' && Boolean(ref)}
        title="Reject this report"
        description={
          count > 1
            ? `This rejects all ${count} cases in the submission. The student sees it as "Not verified".`
            : 'The student sees it as "Not verified".'
        }
        reasonLabel="Reason (required)"
        confirmLabel="Reject"
        danger
        onClose={() => setOpen(null)}
        onConfirm={async (reason) => {
          try {
            await api.rejectSubmission(ref as string, reason);
          } catch (error) {
            throw new Error(msg(error));
          }
          finish('Rejected.');
        }}
      />
      <ConfirmModal
        open={open === 'resolve_without_sanction'}
        title="Resolve without a sanction"
        description="The case is closed with no sanction. The student is told the reason."
        reasonLabel="Reason (required)"
        confirmLabel="Resolve"
        onClose={() => setOpen(null)}
        onConfirm={async (reason) => {
          try {
            await api.resolveWithoutSanction(detail.id, reason);
          } catch (error) {
            throw new Error(msg(error));
          }
          finish('Case resolved without a sanction.');
        }}
      />
      <ConfirmModal
        open={remarkOpen}
        title="Remarks for the student"
        description="The student sees remarks on the case timeline and is notified."
        reasonLabel="Remark"
        confirmLabel="Add remark"
        onClose={onRemarkClose}
        onConfirm={async (remarks) => {
          try {
            await api.addRemark(detail.id, remarks);
          } catch (error) {
            throw new Error(msg(error));
          }
          finish('Remark added.');
        }}
      />
    </div>
  );
}

function Details({ detail }: { detail: StaffCaseDetail }) {
  const rows: Array<[string, string]> = [
    ['Case ID', `${detail.code} · ${detail.source === 'gate' ? `Gate report${detail.submissionCode ? ` ${detail.submissionCode}` : ''}` : 'Staff report'}`],
    ['Date reported', formatDate(detail.caseDate)],
    ['Violation', `${detail.violation} · ${detail.severity} · Sec. ${detail.section}`],
    ['Stage', stageText(detail.status)],
  ];
  if (detail.claimed?.program || detail.claimed?.year) {
    rows.push(['Typed on the form', [detail.claimed.program, detail.claimed.year].filter(Boolean).join(' · ')]);
  }
  if (detail.convertedFrom) rows.push(['Originally', detail.convertedFrom]);
  const links = (ids: number[]) =>
    ids.map((id, index) => (
      <span key={id}>
        {index > 0 ? ', ' : ''}
        <Link to={`/cases/${id}`} className="font-medium text-primary underline">
          {codeOf(detail, id)}
        </Link>
      </span>
    ));
  return (
    <div>
      <dl className="rounded-lg border border-line">
        {rows.map(([label, value]) => (
          <div key={label} className="grid grid-cols-[7rem_1fr] gap-2 border-b border-line px-3 py-2 last:border-0">
            <dt className="text-xs font-semibold tracking-wide text-muted uppercase">{label}</dt>
            <dd className="text-sm text-ink">{value}</dd>
          </div>
        ))}
      </dl>
      {detail.createdFromCaseIds.length > 0 ? (
        <p className="mt-3 text-sm">Created from cases {links(detail.createdFromCaseIds)}.</p>
      ) : null}
      {detail.countedTowardCaseId !== null ? (
        <p className="mt-3 text-sm">Counted toward Major case {links([detail.countedTowardCaseId])}.</p>
      ) : null}
      {detail.siblingCaseIds.length > 0 ? (
        <p className="mt-2 text-sm text-muted">Same submission: {links(detail.siblingCaseIds)}</p>
      ) : null}
    </div>
  );
}

function History({ detail }: { detail: StaffCaseDetail }) {
  return (
    <ol className="space-y-3 border-l-2 border-line pl-4">
      {[...detail.timeline].reverse().map((entry, index) => (
        <li key={`${entry.date}-${index}`}>
          <div className="text-sm font-medium text-ink">
            {statusLabel(entry.eventType)}
            {entry.statusAfter ? ` → ${statusLabel(entry.statusAfter, 'case')}` : ''}
          </div>
          {entry.remarks ? <div className="text-sm">{entry.remarks}</div> : null}
          <div className="text-xs text-muted">
            {entry.by} · {formatDateTime(entry.date)}
          </div>
        </li>
      ))}
    </ol>
  );
}

/** "Remarks for the student": the latest remark and a button to add another (the full log is on History). */
function RemarksCard({ detail, onAdd }: { detail: StaffCaseDetail; onAdd: () => void }) {
  const latest = [...detail.timeline].reverse().find((entry) => entry.eventType === 'remark' && entry.remarks);
  return (
    <div className="flex items-start justify-between gap-3 rounded-lg border border-line px-3 py-2">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-ink">Remarks for the student</p>
        <p className="text-sm text-muted">{latest?.remarks ?? 'No remarks yet.'}</p>
      </div>
      <button
        type="button"
        onClick={onAdd}
        aria-label="Add a remark"
        className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-full border border-primary text-primary hover:bg-page"
      >
        <Icon name="edit_note" />
      </button>
    </div>
  );
}

/** The right pane of the Cases screen: one case, its tracker, details, history and the workflow actions. */
export function CaseWorkspace({ caseId, onChanged }: { caseId: number; onChanged: () => void }) {
  const resource = useApi(() => api.staffCase(caseId), [caseId]);
  const [tab, setTab] = useState<'details' | 'history'>('details');
  const [remarking, setRemarking] = useState(false);

  if (resource.status === 'loading') return <LoadingState label="Loading case…" cards={2} />;
  if (resource.status === 'error') return <ErrorState message={resource.error.message} onRetry={resource.reload} />;
  const detail = resource.data.case;
  const reload = () => {
    resource.reload();
    onChanged();
  };

  return (
    <article aria-label={`Case ${detail.code}`} className="rounded-lg border border-line bg-white">
      <div className="space-y-4 p-4">
        <header className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <h2 className="text-xl font-bold text-ink">{detail.violation}</h2>
            <p className="text-sm text-muted">
              {whoLabel(detail)}
              {detail.student ? (
                <>
                  {' · '}
                  <Link to={`/students/${detail.student.id}`} className="font-medium text-primary underline">
                    View student
                  </Link>
                </>
              ) : null}
            </p>
          </div>
          <div className="flex gap-2">
            <StatusPill status={detail.severity} />
            <StatusPill status={detail.status} kind="case" />
          </div>
        </header>

        <Tracker status={detail.status} />

        <div className="flex rounded-full bg-page p-1" role="tablist" aria-label="Case sections">
          {(['details', 'history'] as const).map((option) => (
            <button
              key={option}
              type="button"
              role="tab"
              aria-selected={tab === option}
              onClick={() => setTab(option)}
              className={`min-h-11 flex-1 rounded-full text-sm font-medium ${tab === option ? 'bg-white text-ink shadow-sm' : 'text-muted'}`}
            >
              {option === 'details' ? 'Details' : 'History'}
            </button>
          ))}
        </div>

        {tab === 'details' ? <Details detail={detail} /> : <History detail={detail} />}

        <RemarksCard detail={detail} onAdd={() => setRemarking(true)} />

        <SanctionsPanel sanctions={detail.sanctions} onChanged={reload} />
      </div>
      <div className="border-t border-line bg-page/60 p-4">
        <Actions
          detail={detail}
          onDone={() => {
            setRemarking(false);
            reload();
          }}
          remarkOpen={remarking}
          onRemarkClose={() => setRemarking(false)}
        />
      </div>
    </article>
  );
}

/** Kept so `/cases/:id` still resolves on its own where a route renders it directly. */
export function CaseDetailPage() {
  const { id } = useParams();
  const caseId = /^\d+$/.test(id ?? '') ? Number(id) : null;
  if (caseId === null) return <ErrorState message="This case could not be found." />;
  return <CaseWorkspace caseId={caseId} onChanged={() => undefined} />;
}
