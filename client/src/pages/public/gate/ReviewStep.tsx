import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { cn } from '@/utils/cn';
import { YEAR_PILLS, type GateFormValues, type GateViolation } from '@/utils/gateForm';
import { CardHeader, CategoryPill, gateBackButton, gateCard, gateNavButton, gateNavRow } from './GateCard';

/** Step 3 (deck W12, W13): everything entered, then Submit. A failed send shows the deck's "not sent" alert. */
export function ReviewStep({
  values,
  chosen,
  failure,
  busy,
  onBack,
  onSubmit,
}: {
  values: GateFormValues;
  chosen: GateViolation[];
  failure: { network: boolean; message: string } | null;
  busy: boolean;
  onBack: () => void;
  onSubmit: () => void;
}) {
  const yearLabel = YEAR_PILLS.find((pill) => pill.value === values.year)?.label;
  return (
    <div className={gateCard}>
      <CardHeader title="Check and submit" subtitle="Make sure everything is correct. You can go back to change anything." />
      <section>
        <h3 className="mb-2 text-sm font-semibold text-ink">Student Information</h3>
        <dl className="rounded-2xl bg-pale px-4">
          {(
            [
              ['Student ID', values.studentId.trim()],
              ['Full name', values.name.trim()],
              ['Program', values.program],
              ['Year level', yearLabel ? `${yearLabel} Year` : ''],
            ] as const
          ).map(([label, value]) => (
            <div key={label} className="grid grid-cols-[110px_minmax(0,1fr)] gap-3 border-b border-pale-line py-2 text-sm last:border-b-0">
              <dt className="text-muted">{label}</dt>
              <dd className="min-w-0 font-semibold break-words text-ink">{value}</dd>
            </div>
          ))}
        </dl>
      </section>
      <section>
        <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-ink">
          Selected Violations
          <span className="rounded-full bg-info-soft px-2 py-0.5 text-xs font-bold text-primary">{chosen.length}</span>
        </h3>
        <ul aria-label="Selected violations" className="flex max-h-[148px] flex-col gap-1.5 overflow-y-auto p-0.5">
          {chosen.map((violation) => (
            <li key={violation.id} className="flex min-h-11 items-center gap-2.5 rounded-xl border-[1.5px] border-line bg-white px-3 py-1.5">
              <Icon name="check_circle" filled className="shrink-0 !text-xl text-primary" />
              <span className="min-w-0 flex-1 text-sm font-semibold text-ink">{violation.name}</span>
              <CategoryPill category={violation.category} />
            </li>
          ))}
        </ul>
      </section>
      {failure ? (
        <Alert tone="error" icon={failure.network ? 'wifi_off' : 'error'}>
          {failure.message}
        </Alert>
      ) : null}
      <div className={cn(gateNavRow, 'justify-between')}>
        <Button variant="neutral" size="xl" className={gateBackButton} disabled={busy} onClick={onBack}>
          <Icon name="arrow_back" className="!text-xl" />
          Back
        </Button>
        <Button size="xl" className={gateNavButton} busy={busy} busyLabel="Submitting…" onClick={onSubmit}>
          Submit report
          <Icon name="send" className="!text-xl" />
        </Button>
      </div>
    </div>
  );
}
