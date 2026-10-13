import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { StaffCaseDetail, StaffProofFileView, StaffSanctionView } from '@shared/types';
import { ConfirmModal, useToast } from '@/components/feedback';
import { FilePreview } from '@/components/feedback/FilePreview';
import { PageError, Spinner } from '@/components/feedback/PageState';
import { StatusPill } from '@/components/ui';
import { Button } from '@/components/ui/Button';
import { DetailTable, type DetailRow } from '@/components/ui/DetailTable';
import { Field } from '@/components/ui/Field';
import { FileRow } from '@/components/ui/FileRow';
import { HistoryList } from '@/components/ui/HistoryList';
import { Icon } from '@/components/ui/Icon';
import { SegmentedTabs } from '@/components/ui/SegmentedTabs';
import { Select } from '@/components/ui/Select';
import { StageTracker } from '@/components/ui/StageTracker';
import { StudentLookup } from '@/components/ui/StudentLookup';
import { Textarea } from '@/components/ui/Textarea';
import { api, toApiError } from '@/api/client';
import { useApi } from '@/hooks/useApi';
import { STUDENT_ID, useStudentLookup } from '@/hooks/useStudentLookup';
import { CASE_STAGES, stageIndex, stageText } from '@/utils/caseView';
import { availableActions, codeOf, escalationNote, historyItems, latestRemark, sanctionFooter, sourceText } from '@/utils/caseWorkspace';
import { addDays, fileMeta, manilaToday } from '@/utils/files';
import { formatDate } from '@/utils/format';

const msg = (error: unknown): string => toApiError(error).message;
const nameOf = (detail: StaffCaseDetail): string => detail.student?.name ?? detail.claimed?.name ?? 'the student';

type Done = (toast: string) => void;

/** Reported: "Validate report (2 violations)" + Reject; an unmatched report links the right student first (D12). */
function ReviewFooter({ detail, done, failed }: { detail: StaffCaseDetail; done: Done; failed: (error: unknown) => void }) {
  const [busy, setBusy] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [linkId, setLinkId] = useState('');
  const [linkError, setLinkError] = useState<string | undefined>();
  const [linking, setLinking] = useState(false);
  const { lookup } = useStudentLookup(linkId);
  const actions = availableActions(detail);
  const ref = detail.submissionRef;
  const gi = detail.submissionCode ?? detail.code;
  const count = detail.siblingCaseIds.length + 1;
  const label = `Validate report (${count} violation${count === 1 ? '' : 's'})`;
  const preview = useApi(
    () => (ref && actions.includes('validate') ? api.escalationPreview(ref) : Promise.resolve({ conversions: [] })),
    [ref, detail.status, detail.student?.id],
  );
  const conversions = preview.status === 'ready' ? preview.data.conversions : [];

  async function validate() {
    if (!ref) return;
    setBusy(true);
    try {
      const result = await api.validateSubmission(ref);
      const majors = result.conversions.map((c) => codeOf(detail, c.majorCaseId)).join(', ');
      done(`${gi} validated.${majors ? ` ${majors} is now treated as Major.` : ''}`);
    } catch (error) {
      failed(error);
    } finally {
      setBusy(false);
    }
  }

  async function link() {
    if (!STUDENT_ID.test(linkId.trim())) {
      setLinkError('Enter a valid student ID, e.g. 2025-1234567.');
      return;
    }
    setLinkError(undefined);
    setLinking(true);
    try {
      await api.linkStudent(detail.id, linkId.trim());
      setLinkId('');
      done('Student linked.');
    } catch (error) {
      setLinkError(msg(error));
    } finally {
      setLinking(false);
    }
  }

  return (
    <>
      {conversions.length > 0 ? (
        <p role="note" className="rounded-[10px] bg-amber-soft px-3.5 py-2.5 text-[13px] text-pretty text-amber-ink">
          {conversions.map((c) => `${codeOf(detail, c.majorCaseId)} becomes the 3rd minor and will be treated as Major.`).join(' ')}
        </p>
      ) : null}
      {actions.includes('link_student') ? (
        <div className="flex flex-col gap-2">
          <p className="text-[13px] text-muted">The ID on this report has no matching student record. Enter the right ID to validate it.</p>
          <div className="flex flex-wrap items-start gap-2">
            <div className="min-w-0 flex-[1_1_220px]">
              <StudentLookup label="Student ID" placeholder="e.g. 2025-1234567" value={linkId} onChange={setLinkId} lookup={lookup} error={linkError} />
            </div>
            <Button variant="secondary" size="lg" className="mt-[26px]" busy={linking} onClick={() => void link()}>
              Link student
            </Button>
          </div>
        </div>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button
          size="lg"
          className="flex-[1_1_220px]"
          disabled={!actions.includes('validate')}
          disabledReason="Can’t validate without a matching student record."
          busy={busy}
          onClick={() => void validate()}
        >
          {label}
        </Button>
        <Button variant="danger" size="lg" className="flex-[0_1_140px]" onClick={() => setRejecting(true)}>
          Reject
        </Button>
      </div>
      <ConfirmModal
        open={rejecting && Boolean(ref)}
        tone="danger"
        title={`Reject ${gi}?`}
        description="Every violation in this submission is marked not verified. The student gets a short notice."
        reasonLabel="Reason (saved to case history)"
        reasonPlaceholder="e.g. The ID entered did not match the student at the gate."
        confirmLabel="Reject submission"
        cancelLabel="Keep reviewing"
        onClose={() => setRejecting(false)}
        onConfirm={async (reason) => {
          try {
            await api.rejectSubmission(ref as string, reason);
          } catch (error) {
            throw new Error(msg(error));
          }
          setRejecting(false);
          done(`${gi} marked not verified.`);
        }}
      />
    </>
  );
}

/** Validated: "Decide on a sanction" with the sanction, its due date and instructions (SPEC flexible due date). */
function DecideFooter({ detail, done, allowResolve = true }: { detail: StaffCaseDetail; done: Done; allowResolve?: boolean }) {
  const options = useApi(() => api.sanctionOptions(detail.id), [detail.id]);
  const today = manilaToday();
  const [picked, setPicked] = useState<number | ''>('');
  const [dueDate, setDueDate] = useState(addDays(today, 14));
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [resolving, setResolving] = useState(false);

  const choices = options.status === 'ready' ? options.data.options.sanctions.filter((s) => !s.alreadyAssigned) : [];
  const sanctionId: number | undefined = picked === '' ? choices[0]?.sanctionId : picked;

  async function assign() {
    if (sanctionId === undefined) return;
    setBusy(true);
    setError(null);
    try {
      await api.assignSanction(detail.id, sanctionId, dueDate, note.trim());
      done(`Sanction assigned for ${detail.code}.`);
    } catch (caught) {
      setError(msg(caught));
      setBusy(false);
    }
  }

  return (
    <>
      <p className="text-sm font-semibold text-ink">Decide on a sanction</p>
      {options.status === 'loading' ? (
        <p role="status" className="flex items-center gap-2 text-[13px] text-muted">
          <Spinner />
          Loading the handbook options…
        </p>
      ) : null}
      {options.status === 'error' ? <p className="text-[13px] text-danger">{options.error.message}</p> : null}
      {options.status === 'ready' ? (
        <>
          {options.data.options.sanctions.length === 0 ? (
            <p className="text-[13px] text-muted">The handbook defines no sanction for this violation.</p>
          ) : (
            <Select
              label="Sanction"
              hint={`Offense ${options.data.options.offenseNumber} for this violation.`}
              value={sanctionId ?? ''}
              onChange={(event) => setPicked(Number(event.target.value))}
            >
              {choices.map((choice) => (
                <option key={choice.sanctionId} value={choice.sanctionId}>
                  {choice.sanctionCode} · {choice.type}
                </option>
              ))}
            </Select>
          )}
          <div className="grid gap-3 @min-[420px]:grid-cols-[180px_1fr]">
            <Field label="Due date" type="date" min={today} value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
            <Textarea label="Instructions (optional)" rows={2} maxLength={1000} value={note} onChange={(event) => setNote(event.target.value)} />
          </div>
        </>
      ) : null}
      {error ? (
        <p role="alert" className="text-[13px] font-medium text-danger">
          {error}
        </p>
      ) : null}
      <div className="flex flex-col items-stretch gap-2 pt-1">
        <Button size="xl" fullWidth busy={busy} disabled={sanctionId === undefined} disabledReason="Every allowed sanction is already assigned." onClick={() => void assign()}>
          Assign sanction
        </Button>
        {allowResolve ? (
          <button
            type="button"
            onClick={() => setResolving(true)}
            className="inline-flex min-h-11 items-center gap-1.5 self-center rounded-full px-3.5 text-[13px] font-semibold text-success outline-none hover:bg-success-soft focus-visible:ring-[3px] focus-visible:ring-primary/25 rail:min-h-9"
          >
            Resolve without sanction
          </button>
        ) : null}
      </div>
      <ConfirmModal
        open={resolving}
        tone="ok"
        title={`Resolve ${detail.code} without a sanction?`}
        description={`The case closes with no sanction. ${nameOf(detail)} is notified.`}
        reasonLabel="Reason (saved to case history)"
        reasonPlaceholder="e.g. First report, settled with a verbal reminder."
        confirmLabel="Resolve case"
        cancelLabel="Keep open"
        onClose={() => setResolving(false)}
        onConfirm={async (reason) => {
          try {
            await api.resolveWithoutSanction(detail.id, reason);
          } catch (error) {
            throw new Error(msg(error));
          }
          setResolving(false);
          done(`${detail.code} resolved.`);
        }}
      />
    </>
  );
}

/** One sanction's proof box: files with View and "Viewed", the hint, the note and Verify / Return (src 701 to 727). */
function ProofBlock({ detail, sanction, titled, done, failed, onViewed }: {
  detail: StaffCaseDetail;
  sanction: StaffSanctionView;
  titled: boolean;
  done: Done;
  failed: (error: unknown) => void;
  onViewed: () => void;
}) {
  const [previewing, setPreviewing] = useState<StaffProofFileView | null>(null);
  const [returning, setReturning] = useState(false);
  const [busy, setBusy] = useState(false);
  const view = sanctionFooter(sanction);

  async function verify() {
    setBusy(true);
    try {
      await api.verifySanction(sanction.id);
      setPreviewing(null);
      done(`${sanction.sanctionCode} verified.`);
    } catch (error) {
      failed(error);
    } finally {
      setBusy(false);
    }
  }

  const verifyButton = (
    <Button
      variant="success"
      size="lg"
      className="flex-[1_1_140px] disabled:bg-success-disabled disabled:text-white"
      disabled={!view.canVerify}
      disabledReason="Open each file before verifying"
      busy={busy}
      onClick={() => void verify()}
    >
      Verify sanction
    </Button>
  );
  const returnButton = (
    <Button variant="danger" size="lg" className="flex-[1_1_140px]" onClick={() => setReturning(true)}>
      Return to student
    </Button>
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-hidden rounded-xl border border-line bg-white">
        <div className="flex items-center gap-2.5 border-b border-line-soft bg-surface-2 px-3.5 py-3">
          <Icon name="attach_file" className="!text-xl text-primary" />
          <span className="min-w-0 flex-1 text-sm font-bold text-ink">
            Submitted proof{titled ? ` · ${sanction.sanctionCode} ${sanction.type}` : ''}
          </span>
          {view.proofSub ? <span className="text-xs text-muted">{view.proofSub}</span> : null}
        </div>
        {view.noFilesText ? (
          <p className="flex items-center justify-center gap-1.5 px-3.5 py-[18px] text-center text-[13px] text-muted">
            <Icon name="hourglass_top" className="!text-lg" />
            {view.noFilesText}
          </p>
        ) : (
          sanction.files.map((file) => (
            <FileRow
              key={file.id}
              name={file.name}
              meta={fileMeta(file)}
              viewed={file.viewed}
              onView={() => setPreviewing(file)}
              className="-mb-px rounded-none border-0 border-b border-line-soft"
            />
          ))
        )}
      </div>
      {view.needView ? (
        <p className="flex items-center gap-1.5 text-[13px] text-amber-ink">
          <Icon name="info" className="!text-lg" />
          Open each file before you verify this sanction.
        </p>
      ) : null}
      {view.note ? <p className="rounded-[10px] bg-warn-soft px-3.5 py-2.5 text-[13px] text-pretty text-amber-ink">{view.note}</p> : null}
      {view.pending ? (
        <div className="flex flex-wrap gap-2">
          {verifyButton}
          {returnButton}
        </div>
      ) : null}

      {previewing ? (
        <FilePreview
          file={{ name: previewing.name, meta: fileMeta(previewing) }}
          loadUrl={async () => (await api.fileUrl(previewing.id)).url}
          onLoaded={onViewed}
          onClose={() => setPreviewing(null)}
          footer={
            view.pending ? (
              <>
                <span className="min-w-0 flex-[1_1_200px] text-[13px] text-muted">
                  {view.canVerify ? 'All files viewed. You can verify this sanction.' : 'Open the other files before you verify.'}
                </span>
                {returnButton}
                {verifyButton}
              </>
            ) : undefined
          }
        />
      ) : null}
      <ConfirmModal
        open={returning}
        tone="danger"
        title={`Return ${sanction.sanctionCode} to the student?`}
        description="The sanction goes back to the student. Tell them what is missing."
        reasonLabel="What the student needs to fix"
        reasonPlaceholder="e.g. The service log is missing the supervisor’s signature."
        confirmLabel="Return sanction"
        onClose={() => setReturning(false)}
        onConfirm={async (reason) => {
          try {
            await api.returnSanction(sanction.id, reason);
          } catch (error) {
            throw new Error(msg(error));
          }
          setReturning(false);
          setPreviewing(null);
          done(`${sanction.sanctionCode} returned to ${nameOf(detail)}.`);
        }}
      />
    </div>
  );
}

/** For sanction: the proof of each open sanction, then "Resolve case" (green, enabled once every sanction is verified). */
function SanctionFooter({ detail, done, failed, onViewed }: { detail: StaffCaseDetail; done: Done; failed: (error: unknown) => void; onViewed: () => void }) {
  const [resolving, setResolving] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const canResolve = availableActions(detail).includes('resolve');
  // Open sanctions first, newest first; a verified one shows only when nothing else is open.
  const ordered = [...detail.sanctions].sort((a, b) => Number(a.status === 'completed') - Number(b.status === 'completed') || b.id - a.id);
  const shown = ordered.filter((s) => s.status !== 'completed');
  const blocks = shown.length > 0 ? shown : ordered.slice(0, 1);
  const verified = detail.sanctions.filter((s) => s.status === 'completed').map((s) => s.sanctionCode).join(', ');

  return (
    <>
      {blocks.map((sanction) => (
        <ProofBlock key={sanction.id} detail={detail} sanction={sanction} titled={detail.sanctions.length > 1} done={done} failed={failed} onViewed={onViewed} />
      ))}
      <div className="flex flex-wrap gap-2">
        <Button
          variant="success"
          size="lg"
          className="flex-[1_1_180px]"
          disabled={!canResolve}
          disabledReason="Resolve once the sanction is verified"
          onClick={() => setResolving(true)}
        >
          Resolve case
        </Button>
      </div>
      <button
        type="button"
        onClick={() => setAssigning((value) => !value)}
        aria-expanded={assigning}
        className="inline-flex min-h-11 items-center gap-1.5 self-center rounded-full px-3.5 text-[13px] font-semibold text-primary outline-none hover:bg-primary-tint focus-visible:ring-[3px] focus-visible:ring-primary/25 rail:min-h-9"
      >
        <Icon name={assigning ? 'expand_less' : 'add'} className="!text-lg" />
        Assign another sanction
      </button>
      {assigning ? <DecideFooter detail={detail} done={done} allowResolve={false} /> : null}
      <ConfirmModal
        open={resolving}
        tone="ok"
        title={`Resolve ${detail.code}?`}
        description={`Sanction ${verified} is verified. The case closes and ${nameOf(detail)} gets an email.`}
        confirmLabel="Resolve case"
        cancelLabel="Keep open"
        onClose={() => setResolving(false)}
        onConfirm={async () => {
          try {
            await api.resolveCase(detail.id);
          } catch (error) {
            throw new Error(msg(error));
          }
          setResolving(false);
          done(`${detail.code} resolved.`);
        }}
      />
    </>
  );
}

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
  const [tab, setTab] = useState<'details' | 'history'>('details');
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
          { value: 'history', label: 'History' },
        ]}
        value={tab}
        onChange={(value) => setTab(value as 'details' | 'history')}
        className="flex w-full [&>button]:flex-1 [&>button]:justify-center"
      />

      {tab === 'details' ? <DetailTable rows={detailRows(detail)} /> : <HistoryList items={historyItems(detail)} />}

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
