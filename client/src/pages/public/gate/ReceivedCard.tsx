import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Pill } from '@/components/ui/Pill';
import { cn } from '@/utils/cn';
import { notificationWhen } from '@/utils/inbox';
import { gateBackButton, gateCard } from './GateCard';

/** The confirmation (deck W14): the reference to show the guard. A repeat report says so and is not filed twice. */
export function ReceivedCard({
  code,
  duplicate,
  submittedAt,
  onStartAgain,
}: {
  code: string;
  duplicate: boolean;
  submittedAt: string;
  onStartAgain: () => void;
}) {
  return (
    <div role="status" className={cn(gateCard, 'items-center gap-3 py-7 text-center')}>
      <span aria-hidden="true" className="grid size-[72px] place-items-center rounded-full bg-info-soft text-primary">
        <Icon name="check_circle" filled className="!text-[40px]" />
      </span>
      {duplicate ? (
        <>
          <h2 className="text-[22px] font-bold text-ink">We already have this report</h2>
          <p className="text-[13px] text-muted">You don’t need to submit it again.</p>
        </>
      ) : (
        <h2 className="text-[22px] font-bold text-ink">Report received</h2>
      )}
      <div className="w-full rounded-xl border-[1.5px] border-dashed border-upload-line bg-pale p-3.5">
        <p className="text-[13px] font-semibold text-muted">Reference</p>
        <p className="text-[28px] font-extrabold tracking-[0.04em] text-ink">{code}</p>
        <p className="text-[13px] text-muted">{notificationWhen(submittedAt)}</p>
      </div>
      <Pill tone="pending">Awaiting staff review</Pill>
      <p className="text-sm text-pretty text-body">
        Show this screen to the guard. The SDO checks your identity and the report before anything is added to your record.
        You’ll get a notice in your student portal and school email.
      </p>
      <Button variant="neutral" size="xl" className={cn(gateBackButton, 'w-full max-w-[320px]')} onClick={onStartAgain}>
        Start a new report
      </Button>
    </div>
  );
}
