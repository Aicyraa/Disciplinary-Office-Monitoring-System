import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { StudentCaseView, StudentSanctionView } from '@shared/types';
import { ProofUploadModal } from '@/components/sanctions/ProofUploadModal';
import { StatusPill } from '@/components/ui';
import { Button, buttonVariants } from '@/components/ui/Button';
import { DetailTable } from '@/components/ui/DetailTable';
import { HistoryList } from '@/components/ui/HistoryList';
import { Icon } from '@/components/ui/Icon';
import { SegmentedTabs } from '@/components/ui/SegmentedTabs';
import { StageTracker } from '@/components/ui/StageTracker';
import { cn } from '@/utils/cn';
import { manilaToday } from '@/utils/files';
import { SANCTION_STEP_LABELS, formatDate, sanctionStepIndex } from '@/utils/format';
import { dueLine, proofSummary, sanctionHistoryItems, sanctionNextStep, uploadPanel } from '@/utils/studentView';

const DUE_TONE = { info: 'text-info-ink', bad: 'text-bad-ink', done: 'text-success' } as const;

/** The compact proof row above the next-step note: status, file summary and the button that opens the upload dialog. */
function ProofRow({ sanction, onOpen }: { sanction: StudentSanctionView; onOpen: () => void }) {
  const panel = uploadPanel(sanction);
  const files = sanction.files.length;
  const label = panel.open ? (files === 0 ? 'Upload proof' : 'Continue upload') : 'View files';
  return (
    <div className="overflow-hidden rounded-xl border border-line">
      <div className="flex flex-wrap items-center gap-3 bg-surface-2 px-4 py-3">
        <span aria-hidden="true" className="grid size-9 shrink-0 place-items-center rounded-[10px] bg-info-soft text-primary">
          <Icon name="upload_file" className="!text-xl" />
        </span>
        <span className="min-w-0 flex-1 basis-40 leading-snug">
          <span className="flex flex-wrap items-center gap-2">
            <span className="text-[15px] font-bold text-ink">Proof of completion</span>
            <StatusPill status={sanction.status} kind="sanction" />
          </span>
          <span className="block truncate text-xs text-muted">{proofSummary(sanction)}</span>
        </span>
        <Button variant={panel.open ? 'primary' : 'secondary'} size="md" onClick={onOpen}>
          {label}
        </Button>
      </div>
      {panel.returned ? (
        <p role="alert" className="flex items-center gap-2 bg-bad-soft px-4 py-2.5 text-[13px] text-pretty text-bad-ink">
          <Icon name="undo" className="!text-lg" />
          {panel.returned}
        </p>
      ) : null}
    </div>
  );
}

/** One sanction (deck W65 to W67, src 1279 to 1333): tracker card with the due line, details, notes, timeline. */
export function SanctionDetail({
  sanction,
  caseRow,
  onChanged,
}: {
  sanction: StudentSanctionView;
  caseRow: StudentCaseView | undefined;
  onChanged: () => void;
}) {
  const [tab, setTab] = useState<'details' | 'timeline'>('details');
  // The page keys this component by sanction id, so switching sanctions closes the dialog.
  const [uploading, setUploading] = useState(false);
  const due = dueLine(sanction, manilaToday());
  const verified = sanction.status === 'completed';
  const next = sanctionNextStep(sanction);
  const showNote = Boolean(sanction.staffNote) && !verified;

  return (
    <article aria-label={`Sanction ${sanction.sanctionCode}`} className="flex min-h-full flex-col gap-5 rounded-xl border border-line bg-white p-6">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-[22px] leading-tight font-bold text-pretty text-ink">{sanction.type}</h2>
          <p className="mt-1 text-[13px] text-muted">{sanction.sanctionCode}</p>
        </div>
        <span className="mt-1 shrink-0">
          <StatusPill status={sanction.status} kind="sanction" />
        </span>
      </header>

      <div className="flex flex-col gap-3.5 rounded-xl border border-calendar-closed px-4 py-[18px]">
        <StageTracker steps={SANCTION_STEP_LABELS} current={sanctionStepIndex(sanction.status)} label="Sanction progress" size="lg" />
        <p className="flex flex-wrap items-center justify-center gap-1.5 border-t border-line-soft pt-3 text-sm text-ink">
          <Icon name={verified ? 'verified' : 'schedule'} className={cn('!text-lg', verified ? 'text-success-strong' : 'text-warn-ink')} />
          {verified ? (
            <span className={cn('font-semibold', DUE_TONE.done)}>Verified</span>
          ) : (
            <>
              <span className="font-semibold">{due.text.split(' · ')[0]}</span>
              <span className={cn('font-semibold', DUE_TONE[due.tone])}>· {due.text.split(' · ')[1]}</span>
            </>
          )}
        </p>
      </div>

      <SegmentedTabs
        label="Sanction sections"
        options={[
          { value: 'details', label: 'Details' },
          { value: 'timeline', label: 'Timeline' },
        ]}
        value={tab}
        onChange={(value) => setTab(value as 'details' | 'timeline')}
        className="flex w-full [&>button]:flex-1 [&>button]:justify-center"
      />

      {tab === 'details' ? (
        <DetailTable
          rows={[
            { label: 'Sanction ID', value: sanction.sanctionCode },
            { label: 'Case No.', value: sanction.caseCode },
            {
              label: 'Violation',
              value: (
                <span className="flex flex-wrap items-center gap-2">
                  {caseRow?.violation ?? '—'}
                  <StatusPill status={caseRow?.severity ?? sanction.severity} />
                  {caseRow ? <span className="text-muted">Sec. {caseRow.section}</span> : null}
                </span>
              ),
            },
            { label: 'Assigned', value: formatDate(sanction.dateAssigned) },
            { label: 'Due', value: formatDate(sanction.dueDate) },
            { label: 'Proof', value: proofSummary(sanction) },
            { label: 'Officer', value: sanction.assignedBy },
          ]}
        />
      ) : (
        <HistoryList items={sanctionHistoryItems(sanction)} />
      )}

      {tab === 'details' ? (
        <div className="mt-auto flex flex-col gap-3 border-t border-line-soft pt-4">
          <ProofRow sanction={sanction} onOpen={() => setUploading(true)} />
          {showNote ? (
            <p className="rounded-[10px] bg-warn-soft px-3.5 py-2.5 text-[13px] text-body">
              <strong className="font-bold text-warn-ink">{sanction.status === 'returned' ? 'Returned by the SDO' : 'Note from the SDO'}:</strong> {sanction.staffNote}
            </p>
          ) : null}
          {next ? (
            <p className="rounded-[10px] bg-info-soft px-3.5 py-2.5 text-[13px] text-pretty text-ink">
              <strong className="font-bold text-info-ink">Next step:</strong> {next}
            </p>
          ) : null}
          <Link to={`/violations/${sanction.caseId}`} className={cn(buttonVariants({ variant: 'secondary', size: 'lg', fullWidth: true }), 'min-h-[46px]')}>
            Open the case
          </Link>
        </div>
      ) : null}
      {uploading ? (
        <ProofUploadModal sanction={sanction} handbookEntryId={caseRow?.handbookEntryId} onClose={() => setUploading(false)} onChanged={onChanged} />
      ) : null}
    </article>
  );
}
