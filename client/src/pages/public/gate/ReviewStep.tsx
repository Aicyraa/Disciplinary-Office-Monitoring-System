import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { cn } from '@/utils/cn';
import { YEAR_PILLS, type GateFormValues } from '@/utils/gateForm';
import { CardHeader, gateBackButton, gateCard, gateNavButton, gateNavRow } from './GateCard';

/**
 * Step 3 (deck W12, W13): the student's details, then Submit. The picked violations are not listed again here;
 * step 2 already shows them. A failed send shows the deck's "not sent" alert.
 */
export function ReviewStep({
  values,
  failure,
  busy,
  onBack,
  onSubmit,
}: {
  values: GateFormValues;
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
