import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import type { ClearanceRosterRow, StaffClearanceItemView, StaffClearanceView, TermRef } from '@shared/types';
import { ProgressBar } from '@/components/dashboard/DashboardCards';
import { ConfirmModal, useToast } from '@/components/feedback';
import { PageError, Spinner } from '@/components/feedback/PageState';
import { MasterDetail } from '@/components/layout/MasterDetail';
import { Button } from '@/components/ui/Button';
import { ChipGroup } from '@/components/ui/ChipGroup';
import { EmptyBlock } from '@/components/ui/EmptyBlock';
import { HistoryList } from '@/components/ui/HistoryList';
import { Icon } from '@/components/ui/Icon';
import { ListCard } from '@/components/ui/ListCard';
import { Pager } from '@/components/ui/Pager';
import { Pill } from '@/components/ui/Pill';
import { SegmentedTabs } from '@/components/ui/SegmentedTabs';
import { Tag } from '@/components/ui/Tag';
import { api, toApiError } from '@/api/client';
import { useApi } from '@/hooks/useApi';
import { ordinalYear } from '@/utils/account';
import { clearanceCopy, clearanceHistoryItems, clearanceStatus, parseTermParam, rosterProgress, termParam } from '@/utils/clearance';
import { cn } from '@/utils/cn';
import { formatTerm } from '@/utils/format';

const STUDENT_ID = /^\d{4}-\d{7}$/;
const PROGRESS_TONE = { ink: 'text-ink', done: 'text-success', muted: 'text-disabled-ink' } as const;

function StudentRoster({
  term,
  selectedId,
  onFirstRow,
  reloadRef,
}: {
  term: TermRef;
  selectedId: string | null;
  onFirstRow: (id: string | null) => void;
  reloadRef: React.MutableRefObject<(() => void) | null>;
}) {
  const [page, setPage] = useState(1);
  const roster = useApi(() => api.clearanceRoster(term.academicYear, term.semester, { page }), [term.academicYear, term.semester, page]);
  useEffect(() => {
    reloadRef.current = roster.reload;
  }, [reloadRef, roster.reload]);
  useEffect(() => setPage(1), [term.academicYear, term.semester]);
  const firstId = roster.status === 'ready' ? (roster.data.students[0]?.studentId ?? null) : undefined;
  useEffect(() => {
    if (firstId !== undefined) onFirstRow(firstId);
  }, [firstId, onFirstRow]);
  const highlighted = selectedId ?? firstId ?? null;

  return (
    <ListCard className="flex h-full flex-col">
      <div className="sticky top-0 z-[1] border-b border-line-soft bg-white px-6 py-4">
        <h2 className="text-[19px] font-bold text-ink">Students</h2>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {roster.status === 'loading' ? (
          <p role="status" className="flex items-center justify-center gap-2 px-6 py-10 text-[13px] text-muted">
            <Spinner />
            Loading students…
          </p>
        ) : null}
        {roster.status === 'error' ? <PageError page="the students" detail={roster.error.message} onRetry={roster.reload} /> : null}
        {roster.status === 'ready' && roster.data.students.length === 0 ? (
          <p className="px-6 py-8 text-center text-[13px] text-muted">No active students for this term.</p>
        ) : null}
        {roster.status === 'ready'
          ? roster.data.students.map((row) => {
              const progress = rosterProgress(row.clearance);
              const selected = row.studentId === highlighted;
              return (
                <Link
                  key={row.studentId}
                  to={`/clearance/${row.studentId}?term=${termParam(term)}`}
                  aria-current={selected ? 'true' : undefined}
                  className={cn(
                    'flex items-center gap-3 border-b border-line-soft px-6 py-3 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset',
                    selected ? 'bg-row-selected shadow-[inset_3px_0_0_var(--color-primary)]' : 'bg-white hover:bg-row-hover',
                  )}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold text-ink">{row.name}</span>
                    <span className="block truncate text-xs text-muted">
                      {row.studentId} · {row.program} {ordinalYear(row.yearLevel)}
                    </span>
                  </span>
                  <span className={cn('text-[13px] font-bold whitespace-nowrap', PROGRESS_TONE[progress.tone])}>{progress.text}</span>
                </Link>
              );
            })
          : null}
      </div>
      {roster.status === 'ready' ? (
        <Pager
          page={roster.data.page}
          pageCount={Math.max(1, Math.ceil(roster.data.total / roster.data.pageSize))}
          onChange={setPage}
          className="mt-auto border-t border-line-soft py-2.5"
        />
      ) : null}
    </ListCard>
  );
}

type Pending = { kind: 'reverse' | 'remove'; item: StaffClearanceItemView } | { kind: 'add' } | null;

function Requirements({ view, name, term, onChanged }: { view: StaffClearanceView; name: string; term: string; onChanged: () => void }) {
  const toast = useToast();
  const [saving, setSaving] = useState<number | null>(null);
  const [pending, setPending] = useState<Pending>(null);
  const copy = clearanceCopy(name, term);
  const done = view.items.filter((item) => item.status === 'completed').length;
  const percent = view.items.length === 0 ? 0 : Math.round((done / view.items.length) * 100);
  const finish = (text: string) => {
    setPending(null);
    toast.show(text, 'success');
    onChanged();
  };
  const fail = (error: unknown): never => {
    throw new Error(toApiError(error).message);
  };

  async function mark(item: StaffClearanceItemView) {
    setSaving(item.requirementId);
    try {
      await api.markRequirementDone(view.id, item.requirementId, '');
      finish(copy.marked(item.label));
    } catch (error) {
      toast.show(toApiError(error).message, 'error');
      onChanged();
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className="flex flex-1 flex-col gap-3.5">
      <div>
        <p className="mb-1.5 flex justify-between text-[13px]">
          <span className="font-semibold text-ink">
            {done} of {view.items.length} requirements complete
          </span>
          <span className="text-muted">{percent}%</span>
        </p>
        <ProgressBar percent={percent} label="Clearance progress" tone="primary" />
      </div>
      <ul className="flex flex-col gap-2">
        {view.items.map((item) => {
          const completed = item.status === 'completed';
          return (
            <li
              key={item.requirementId}
              className={cn(
                'flex flex-wrap items-center gap-3 rounded-[10px] border py-2.5 pr-3 pl-3.5',
                completed ? 'border-success-line bg-success-soft/50' : 'border-calendar-closed bg-white',
              )}
            >
              <Icon name={completed ? 'check_circle' : 'radio_button_unchecked'} filled={completed} className={cn('!text-[22px]', completed ? 'text-success-strong' : 'text-disabled')} />
              <span className="min-w-0 flex-[1_1_160px]">
                <span className="flex flex-wrap items-center gap-2 font-medium text-ink">
                  {item.label}
                  {item.warning ? (
                    <Tag className="bg-bad-soft text-bad-ink">
                      Open cases: {view.openCases}
                    </Tag>
                  ) : null}
                </span>
                <span className={cn('block text-xs font-bold', completed ? 'text-success' : 'text-warn-ink')}>{completed ? 'Completed' : 'Remaining'}</span>
              </span>
              {saving === item.requirementId ? (
                <span role="status" className="inline-flex items-center gap-2 text-[13px] text-muted">
                  <Spinner />
                  Saving…
                </span>
              ) : completed ? (
                <button
                  type="button"
                  onClick={() => setPending({ kind: 'reverse', item })}
                  className="min-h-11 rounded-full border border-line-strong bg-white px-3.5 text-[13px] font-semibold whitespace-nowrap text-body outline-none hover:border-danger hover:text-danger focus-visible:ring-[3px] focus-visible:ring-primary/25 rail:min-h-[38px]"
                >
                  Reverse…
                </button>
              ) : (
                <Button size="sm" className="min-h-11 rail:min-h-[38px]" onClick={() => void mark(item)}>
                  Record completion
                </Button>
              )}
              <button
                type="button"
                aria-label={`Remove ${item.label}`}
                title="Remove requirement"
                onClick={() => setPending({ kind: 'remove', item })}
                className="grid size-11 shrink-0 place-items-center rounded-full text-muted outline-none hover:bg-danger-soft hover:text-danger focus-visible:ring-[3px] focus-visible:ring-danger/25 rail:size-9"
              >
                <Icon name="delete" className="!text-xl" />
              </button>
            </li>
          );
        })}
      </ul>
      <div className="mt-auto flex justify-end border-t border-line-soft pt-4">
        <Button variant="secondary" size="sm" className="min-h-11 rail:min-h-10" onClick={() => setPending({ kind: 'add' })}>
          <Icon name="add" className="!text-lg" />
          Add requirement
        </Button>
      </div>

      <ConfirmModal
        open={pending?.kind === 'reverse'}
        tone="danger"
        title={pending?.kind === 'reverse' ? `Reverse “${pending.item.label}”?` : ''}
        description="Reversals are saved to the change log with your name and reason."
        reasonLabel="Reason"
        reasonPlaceholder="e.g. Sanction S-021 was reopened."
        confirmLabel="Reverse"
        cancelLabel="Keep it"
        onClose={() => setPending(null)}
        onConfirm={async (reason) => {
          if (pending?.kind !== 'reverse') return;
          await api.reverseRequirement(view.id, pending.item.requirementId, reason).catch(fail);
          finish(copy.reversed(pending.item.label));
        }}
      />
      <ConfirmModal
        open={pending?.kind === 'remove'}
        tone="danger"
        title={pending?.kind === 'remove' ? `Remove “${pending.item.label}”?` : ''}
        description={copy.removeBody}
        confirmLabel="Remove"
        cancelLabel="Keep it"
        onClose={() => setPending(null)}
        onConfirm={async () => {
          if (pending?.kind !== 'remove') return;
          await api.removeRequirement(view.id, pending.item.requirementId).catch(fail);
          finish(copy.removed(pending.item.label));
        }}
      />
      <ConfirmModal
        open={pending?.kind === 'add'}
        title="Add a clearance requirement"
        description={copy.addBody}
        reasonLabel="Requirement"
        reasonPlaceholder="e.g. Return borrowed laboratory equipment"
        confirmLabel="Add requirement"
        onClose={() => setPending(null)}
        onConfirm={async (label) => {
          await api.addRequirement(view.id, label).catch(fail);
          finish(copy.added);
        }}
      />
    </div>
  );
}

/** The right pane: one student for one term (deck W51 to W56). */
function ClearancePane({ studentId, term, onChanged }: { studentId: string; term: TermRef; onChanged: () => void }) {
  const toast = useToast();
  const [tab, setTab] = useState<'req' | 'log'>('req');
  const [settingUp, setSettingUp] = useState(false);
  // The student's roster row says who they are and whether this term is set up.
  const row = useApi(async () => {
    const roster = await api.clearanceRoster(term.academicYear, term.semester, { q: studentId });
    return roster.students.find((r) => r.studentId === studentId) ?? null;
  }, [studentId, term.academicYear, term.semester]);
  const clearanceId = row.status === 'ready' ? (row.data?.clearance?.id ?? null) : null;
  const detail = useApi(() => (clearanceId === null ? Promise.resolve(null) : api.staffClearance(clearanceId).then((r) => r.clearance)), [clearanceId]);
  const termText = formatTerm(term.academicYear, term.semester);

  if (row.status === 'loading' || (clearanceId !== null && detail.status === 'loading')) {
    return (
      <div role="status" className="flex min-h-40 items-center justify-center gap-2 rounded-xl border border-line bg-white text-[13px] text-muted">
        <Spinner />
        Loading clearance…
      </div>
    );
  }
  if (row.status === 'error' || detail.status === 'error') {
    const failed = row.status === 'error' ? row : detail;
    return (
      <div className="rounded-xl border border-line bg-white">
        <PageError page="this clearance" detail={failed.status === 'error' ? failed.error.message : undefined} onRetry={failed.reload} />
      </div>
    );
  }
  const student: ClearanceRosterRow | null = row.data;
  if (!student) {
    return (
      <div className="rounded-xl border border-line bg-white">
        <EmptyBlock icon="person_off" title="Student not found">
          No active student has that ID.
        </EmptyBlock>
      </div>
    );
  }
  const view = detail.status === 'ready' ? detail.data : null;
  const status = clearanceStatus(view);
  const reload = () => {
    row.reload();
    detail.reload();
    onChanged();
  };

  async function setUp() {
    setSettingUp(true);
    try {
      await api.setUpClearance({ studentId: student!.studentId, academicYear: term.academicYear, semester: term.semester });
      toast.show(clearanceCopy(student!.name, termText).setUp, 'success');
      reload();
    } catch (error) {
      toast.show(toApiError(error).message, 'error');
    } finally {
      setSettingUp(false);
    }
  }

  return (
    <article aria-label={`Clearance, ${student.name}`} className="flex min-h-full flex-col gap-5 rounded-xl border border-line bg-white p-6">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-xl font-bold text-ink">{student.name}</h2>
          <p className="text-muted">
            {student.studentId} · {termText}
          </p>
        </div>
        <Pill tone={status === 'Cleared' ? 'done' : status === 'In progress' ? 'pending' : 'neutral'}>{status}</Pill>
      </header>

      <SegmentedTabs
        label="Clearance sections"
        options={[
          { value: 'req', label: 'Requirements' },
          { value: 'log', label: 'Activity history' },
        ]}
        value={tab}
        onChange={(value) => setTab(value as 'req' | 'log')}
        className="flex w-full [&>button]:flex-1 [&>button]:justify-center"
      />

      {tab === 'req' ? (
        view ? (
          <Requirements view={view} name={student.name} term={termText} onChanged={reload} />
        ) : (
          <div className="flex flex-col items-center gap-2 px-5 py-9 text-center text-muted">
            <Icon name="checklist" className="!text-[32px] text-disabled" />
            <p className="font-semibold text-body">No clearance set for this term</p>
            <p className="mb-2 text-[13px]">Add the standard requirements to start tracking.</p>
            <Button busy={settingUp} onClick={() => void setUp()}>
              Set up clearance
            </Button>
          </div>
        )
      ) : view && view.history.length > 0 ? (
        <HistoryList items={clearanceHistoryItems(view)} />
      ) : (
        <p className="text-[13px] text-muted">No changes recorded for this term.</p>
      )}
    </article>
  );
}

/** Staff Clearance (deck W50 to W56): term chips, every student of the term, one student's checklist (D3, D8). */
export function StaffClearancePage() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const studentId = STUDENT_ID.test(id ?? '') ? (id as string) : null;
  const terms = useApi(() => api.clearanceTerms(), []);
  const [firstRow, setFirstRow] = useState<string | null>(null);
  const rosterReload = useRef<(() => void) | null>(null);
  const reloadRoster = () => rosterReload.current?.();

  if (terms.status === 'loading') {
    return (
      <p role="status" className="flex items-center gap-2 text-[13px] text-muted">
        <Spinner />
        Loading terms…
      </p>
    );
  }
  if (terms.status === 'error') return <PageError page="Clearance" detail={terms.error.message} onRetry={terms.reload} />;

  const term = parseTermParam(params.get('term')) ?? terms.data.current;
  const options = [...terms.data.terms];
  if (!options.some((t) => termParam(t) === termParam(term))) options.unshift(term);
  const pickTerm = (value: string) => navigate(studentId ? `/clearance/${studentId}?term=${value}` : `/clearance?term=${value}`);

  return (
    <>
      <h1 className="sr-only">Clearance</h1>
      <div className="mb-5 flex flex-wrap items-center gap-2.5">
        <span className="text-[13px] font-semibold text-muted">Term</span>
        <ChipGroup
          label="Term"
          options={options.map((t) => ({ value: termParam(t), label: formatTerm(t.academicYear, t.semester) }))}
          value={termParam(term)}
          onChange={pickTerm}
          className="gap-1.5"
        />
      </div>
      <MasterDetail
        ratio="clearance"
        detailKey={studentId}
        list={<StudentRoster term={term} selectedId={studentId} onFirstRow={setFirstRow} reloadRef={rosterReload} />}
        detail={studentId === null ? null : <ClearancePane key={`${studentId}-${termParam(term)}`} studentId={studentId} term={term} onChanged={reloadRoster} />}
        emptyDetail={
          firstRow === null ? (
            <div className="rounded-xl border border-line bg-white">
              <EmptyBlock icon="checklist" title="No student selected">
                Pick a student to see their checklist.
              </EmptyBlock>
            </div>
          ) : (
            <ClearancePane key={`${firstRow}-${termParam(term)}`} studentId={firstRow} term={term} onChanged={reloadRoster} />
          )
        }
      />
    </>
  );
}
