import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { StaffCaseDetail } from '@shared/types';
import { ConfirmModal, useToast } from '@/components/feedback';
import { PageError, Spinner } from '@/components/feedback/PageState';
import { StatusPill } from '@/components/ui';
import { DetailTable, type DetailRow } from '@/components/ui/DetailTable';
import { HistoryList } from '@/components/ui/HistoryList';
import { Icon } from '@/components/ui/Icon';
import { SegmentedTabs } from '@/components/ui/SegmentedTabs';
import { StageTracker } from '@/components/ui/StageTracker';
import { api, toApiError } from '@/api/client';
import { useApi } from '@/hooks/useApi';
import { CASE_STAGES, stageIndex, stageText } from '@/utils/caseView';
import { codeOf, escalationNote, historyItems, latestRemark, sourceText } from '@/utils/caseWorkspace';
import { formatDate } from '@/utils/format';
import { CaseFilesTab } from './cases/CaseFilesTab';
import { DecideFooter } from './cases/DecideFooter';
import { ReviewFooter } from './cases/ReviewFooter';
import { SanctionFooter } from './cases/SanctionFooter';

const msg = (error: unknown): string => toApiError(error).message;

type Done = (toast: string) => void;

function detailRows(detail: StaffCaseDetail): DetailRow[] {
  const links = (ids: number[]): ReactNode =>
    ids.map((id, index) => (
      <span key={id}>
        {index > 0 ? ', ' : ''}
        <Link to={`/cases/${id}?queue=all`} className="font-semibold text-primary hover:underline">
          {codeOf(detail, id)}
        </Link>
      </span>
    ));
  const studentId = detail.student?.id ?? detail.claimed?.studentId ?? 'not given';
  const rows: DetailRow[] = [
    {
      label: 'Student',
      value: (
        <>
          {detail.student?.name ?? detail.claimed?.name ?? 'Unknown student'}
          <span className="block text-[13px] text-muted">
            ID {studentId}
            {detail.student ? '' : ' · No matching student record'}
          </span>
        </>
      ),
    },
    {
      label: 'Case ID',
      value: (
        <>
          {detail.code} <span className="text-muted">· {sourceText(detail)}</span>
        </>
      ),
    },
    { label: 'Date reported', value: formatDate(detail.caseDate) },
    {
      label: 'Violation',
      value: (
        <>
          {detail.violation}
          <span className="mt-1 flex flex-wrap items-center gap-1.5">
            <StatusPill status={detail.severity} />
            <span className="text-[13px] text-muted">Sec. {detail.section}</span>
          </span>
        </>
      ),
    },
    { label: 'Stage', value: stageText(detail.status) },
  ];
  if (detail.claimed?.program || detail.claimed?.year) {
    rows.push({ label: 'Typed on the form', value: [detail.claimed.program, detail.claimed.year].filter(Boolean).join(' · ') });
  }
  if (detail.convertedFrom) rows.push({ label: 'Originally', value: detail.convertedFrom });
  if (detail.createdFromCaseIds.length > 0) rows.push({ label: 'Created from', value: links(detail.createdFromCaseIds) });
  if (detail.countedTowardCaseId !== null) rows.push({ label: 'Counted toward', value: links([detail.countedTowardCaseId]) });
  if (detail.siblingCaseIds.length > 0) rows.push({ label: 'Same report', value: links(detail.siblingCaseIds) });
  if (detail.dateResolved) rows.push({ label: 'Resolved', value: formatDate(detail.dateResolved) });
  return rows;
}

/** The right pane of staff Cases (deck W17 to W29): header, tracker, note, tabs, remarks and the stage footer. */
export function CaseWorkspace({ caseId, onChanged }: { caseId: number; onChanged: () => void }) {
  const toast = useToast();
  const resource = useApi(() => api.staffCase(caseId), [caseId]);
  const [tab, setTab] = useState<'details' | 'files' | 'history'>('details');
  const [remarking, setRemarking] = useState(false);

  if (resource.status === 'loading') {
    return (
      <div role="status" className="flex min-h-40 items-center justify-center gap-2 rounded-xl border border-line bg-white text-[13px] text-muted">
        <Spinner />
        Loading case…
      </div>
    );
  }
  if (resource.status === 'error') {
    return (
      <div className="rounded-xl border border-line bg-white">
        <PageError page="this case" detail={resource.error.message} onRetry={resource.reload} />
      </div>
    );
  }
  const detail = resource.data.case;
  const reload = () => {
    resource.reload();
    onChanged();
  };
  const done: Done = (text) => {
    toast.show(text, 'success');
    reload();
  };
  // A refused action (409: someone else already decided) is an error, and the view is stale.
  const failed = (error: unknown) => {
    toast.show(msg(error), 'error');
    reload();
  };
  const note = escalationNote(detail);
  const stage = stageIndex(detail.status);
  const open = detail.status !== 'resolved' && detail.status !== 'rejected';

  return (
    <article aria-label={`Case ${detail.code}`} className="flex min-h-full flex-col gap-5 rounded-xl border border-line bg-white p-6">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-[22px] leading-tight font-bold text-pretty text-ink">{detail.violation}</h2>
          <p className="mt-1.5 flex flex-wrap items-center gap-1.5 text-sm text-body">
            <span className="font-semibold">{detail.student?.name ?? detail.claimed?.name ?? 'Unknown student'}</span>
            <span className="text-muted">· {detail.student?.id ?? detail.claimed?.studentId ?? 'No ID'}</span>
            {detail.student ? (
              <Link
                to={`/students/${detail.student.id}`}
                className="rounded-md px-1 py-0.5 text-[13px] font-semibold text-primary outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-primary/25"
              >
                View student
              </Link>
            ) : null}
          </p>
        </div>
        <StatusPill status={detail.status} kind="case" />
      </header>

      <StageTracker steps={CASE_STAGES} current={stage ?? 0} label="Case progress" size="sm" />

      {note ? <p className="rounded-[10px] bg-amber-soft px-3.5 py-2.5 text-[13px] text-pretty text-amber-ink">{note}</p> : null}

      <SegmentedTabs
        label="Case sections"
        options={[
          { value: 'details', label: 'Details' },
          { value: 'files', label: 'Files' },
          { value: 'history', label: 'History' },
        ]}
        value={tab}
        onChange={(value) => setTab(value as 'details' | 'files' | 'history')}
        className="flex w-full [&>button]:flex-1 [&>button]:justify-center"
      />

      {tab === 'details' ? <DetailTable rows={detailRows(detail)} /> : null}
      {tab === 'files' ? <CaseFilesTab detail={detail} onViewed={resource.reload} /> : null}
      {tab === 'history' ? <HistoryList items={historyItems(detail)} /> : null}

      {tab === 'details' && open ? (
        <div className="flex items-center gap-3 rounded-[10px] border border-line bg-white px-3.5 py-3">
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-semibold text-ink">Remarks for the student</p>
            <p className="truncate text-[13px] text-muted">{latestRemark(detail) ?? 'No remarks yet'}</p>
          </div>
          <button
            type="button"
            onClick={() => setRemarking(true)}
            aria-label="Edit remarks for the student"
            title="Edit remarks for the student"
            className="grid size-11 shrink-0 place-items-center rounded-full border border-primary bg-white text-primary outline-none hover:bg-primary-tint focus-visible:ring-[3px] focus-visible:ring-primary/25 rail:size-10"
          >
            <Icon name="edit_note" />
          </button>
        </div>
      ) : null}

      {tab === 'details' ? (
        <div className="@container -mx-6 mt-auto -mb-6 flex flex-col gap-3 rounded-b-xl border-t border-line-soft bg-surface-2 px-6 pt-4 pb-5">
          {detail.status === 'reported' ? <ReviewFooter detail={detail} done={done} failed={failed} /> : null}
          {detail.status === 'validated' ? <DecideFooter detail={detail} done={done} /> : null}
          {detail.status === 'for_sanction' ? <SanctionFooter detail={detail} done={done} failed={failed} onViewed={resource.reload} /> : null}
          {detail.status === 'resolved' ? (
            <p role="status" className="flex items-center gap-2 text-sm font-semibold text-success">
              <Icon name="check_circle" className="!text-xl" />
              Resolved on {formatDate(detail.dateResolved ?? detail.caseDate)}. Kept on file for history.
            </p>
          ) : null}
          {detail.status === 'rejected' ? (
            <p role="status" className="flex items-center gap-2 text-sm font-semibold text-neutral-ink">
              <Icon name="block" className="!text-xl" />
              Report not verified. No action needed.
            </p>
          ) : null}
        </div>
      ) : null}

      <ConfirmModal
        open={remarking}
        title="Remarks for the student"
        description={`The student sees these remarks on case ${detail.code}.`}
        reasonLabel="Remarks"
        reasonPlaceholder="e.g. Report to the SDO office within 3 days."
        initialReason={latestRemark(detail) ?? ''}
        confirmLabel="Save remark"
        onClose={() => setRemarking(false)}
        onConfirm={async (remarks) => {
          try {
            await api.addRemark(detail.id, remarks);
          } catch (error) {
            throw new Error(msg(error));
          }
          setRemarking(false);
          done(`Remarks saved for ${detail.code}.`);
        }}
      />
    </article>
  );
}
