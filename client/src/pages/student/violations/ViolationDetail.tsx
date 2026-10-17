import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { StudentCaseDetailView } from '@shared/types';
import { PageError } from '@/components/feedback/PageState';
import { SkeletonPanel } from '@/components/feedback/Skeleton';
import { StatusPill } from '@/components/ui';
import { buttonVariants } from '@/components/ui/Button';
import { DetailTable, type DetailRow } from '@/components/ui/DetailTable';
import { HistoryList } from '@/components/ui/HistoryList';
import { SegmentedTabs } from '@/components/ui/SegmentedTabs';
import { StageTracker } from '@/components/ui/StageTracker';
import { meApi } from '@/api/me';
import { useApi } from '@/hooks/useApi';
import { CASE_STAGES, stageIndex } from '@/utils/caseView';
import { caseEventSentence } from '@/utils/caseWorkspace';
import { cn } from '@/utils/cn';
import { formatDate, violationTitle } from '@/utils/format';
import { caseNextStep, escalationText, latestRemark } from '@/utils/studentView';

const longDate = (iso: string): string =>
  new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(iso));

function rows(record: StudentCaseDetailView): DetailRow[] {
  const list: DetailRow[] = [
    { label: 'Case ID', value: record.code },
    { label: 'Filed', value: formatDate(record.caseDate) },
    { label: 'Category', value: <StatusPill status={record.severity} /> },
    { label: 'Source', value: record.source === 'gate' ? `Gate report${record.submissionCode ? ` ${record.submissionCode}` : ''}` : 'Recorded by SDO staff' },
  ];
  if (record.convertedFrom) list.push({ label: 'Originally', value: violationTitle(record.convertedFrom) });
  for (const sanction of record.sanctions) {
    list.push({
      label: 'Sanction',
      value: (
        <span className="flex flex-wrap items-center gap-2">
          {sanction.sanctionCode} · {sanction.type} · Due {formatDate(sanction.dueDate)}
          <StatusPill status={sanction.status} kind="sanction" />
        </span>
      ),
    });
  }
  if (record.resolvedWithoutSanction && record.dateResolved) list.push({ label: 'Resolved', value: `Without a sanction on ${formatDate(record.dateResolved)}` });
  list.push({ label: 'Remarks', value: latestRemark(record.timeline) ?? 'None' });
  return list;
}

/** The selected case (deck W62 to W64, W68 to W76): tracker card, Details / Timeline, next step. Proof upload lives in My Sanctions. */
export function ViolationDetail({ caseId }: { caseId: number }) {
  const resource = useApi(() => meApi.myCase(caseId), [caseId]);
  const [tab, setTab] = useState<'details' | 'timeline'>('details');

  if (resource.status === 'loading') {
    return (
      <SkeletonPanel label="Loading violation…" />
    );
  }
  if (resource.status === 'error') {
    return (
      <div className="rounded-xl border border-line bg-white">
        <PageError page="this violation" status={resource.error.status} detail={resource.error.message} onRetry={resource.reload} />
      </div>
    );
  }
  const record = resource.data.case;
  const sanctions = [...record.sanctions].sort((a, b) => b.id - a.id);
  const next = caseNextStep(sanctions[0]);
  const note = escalationText(record);

  return (
    <article aria-label={`Violation ${record.code}`} className="flex min-h-full flex-col gap-5 rounded-xl border border-line bg-white p-6">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-[22px] leading-tight font-bold text-pretty text-ink">{violationTitle(record.violation)}</h2>
          <p className="mt-1 text-[13px] text-muted">{record.code}</p>
        </div>
        <span className="mt-1 shrink-0">
          <StatusPill status={record.status} kind="case" />
        </span>
      </header>

      <div className="rounded-xl border border-calendar-closed px-4 py-[18px]">
        <StageTracker steps={CASE_STAGES} current={stageIndex(record.status) ?? 0} label="Case progress" size="lg" />
      </div>

      {note ? <p className="rounded-[10px] bg-amber-soft px-3.5 py-2.5 text-[13px] text-pretty text-amber-ink">{note}</p> : null}

      <SegmentedTabs
        label="Case sections"
        options={[
          { value: 'details', label: 'Details' },
          { value: 'timeline', label: 'Timeline' },
        ]}
        value={tab}
        onChange={(value) => setTab(value as 'details' | 'timeline')}
        className="flex w-full [&>button]:flex-1 [&>button]:justify-center"
      />

      {tab === 'details' ? (
        <DetailTable rows={rows(record)} />
      ) : (
        <HistoryList
          items={record.timeline
            .map((entry, index) => ({ id: index, date: longDate(entry.date), text: caseEventSentence(entry, record) }))
            .reverse()}
        />
      )}

      {tab === 'details' && (next || sanctions.length > 0) ? (
        <div className="mt-auto flex flex-col gap-3 border-t border-line-soft pt-4">
          {next ? (
            <p className="rounded-[10px] bg-info-soft px-3.5 py-2.5 text-[13px] text-pretty text-ink">
              <strong className="font-bold text-info-ink">Next step:</strong> {next}
            </p>
          ) : null}
          {sanctions[0] ? (
            <Link to={`/sanctions/${sanctions[0].id}`} className={cn(buttonVariants({ variant: 'secondary', size: 'lg', fullWidth: true }), 'min-h-[46px]')}>
              Open the sanction
            </Link>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}
