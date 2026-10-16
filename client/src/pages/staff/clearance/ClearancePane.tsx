import { useState } from 'react';
import type { ClearanceRosterRow, TermRef } from '@shared/types';
import { useToast } from '@/components/feedback';
import { PageError } from '@/components/feedback/PageState';
import { SkeletonPanel } from '@/components/feedback/Skeleton';
import { Button } from '@/components/ui/Button';
import { EmptyBlock } from '@/components/ui/EmptyBlock';
import { HistoryList } from '@/components/ui/HistoryList';
import { Icon } from '@/components/ui/Icon';
import { Pill } from '@/components/ui/Pill';
import { SegmentedTabs } from '@/components/ui/SegmentedTabs';
import { toApiError } from '@/api/client';
import { clearanceApi } from '@/api/clearance';
import { useApi } from '@/hooks/useApi';
import { clearanceCopy, clearanceHistoryItems, clearanceStatus } from '@/utils/clearance';
import { formatTerm } from '@/utils/format';
import { Requirements } from './Requirements';

/** The right pane: one student for one term (deck W51 to W56). */
export function ClearancePane({ studentId, term, onChanged }: { studentId: string; term: TermRef; onChanged: () => void }) {
  const toast = useToast();
  const [tab, setTab] = useState<'req' | 'log'>('req');
  const [settingUp, setSettingUp] = useState(false);
  // The student's roster row says who they are and whether this term is set up.
  const row = useApi(async () => {
    const roster = await clearanceApi.clearanceRoster(term.academicYear, term.semester, { q: studentId });
    return roster.students.find((r) => r.studentId === studentId) ?? null;
  }, [studentId, term.academicYear, term.semester]);
  const clearanceId = row.status === 'ready' ? (row.data?.clearance?.id ?? null) : null;
  const detail = useApi(() => (clearanceId === null ? Promise.resolve(null) : clearanceApi.staffClearance(clearanceId).then((r) => r.clearance)), [clearanceId]);
  const termText = formatTerm(term.academicYear, term.semester);

  if (row.status === 'loading' || (clearanceId !== null && detail.status === 'loading')) {
    return (
      <SkeletonPanel label="Loading clearance…" />
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
      await clearanceApi.setUpClearance({ studentId: student!.studentId, academicYear: term.academicYear, semester: term.semester });
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
          <p className="text-muted">{termText}</p>
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
