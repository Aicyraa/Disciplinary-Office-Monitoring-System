import { useEffect, useState } from 'react';
import type { ClearanceTermView } from '@shared/types';
import { ProgressBar } from '@/components/dashboard/DashboardCards';
import { PageError, Spinner } from '@/components/feedback/PageState';
import { Icon } from '@/components/ui';
import { Button } from '@/components/ui/Button';
import { ChipGroup } from '@/components/ui/ChipGroup';
import { Pill } from '@/components/ui/Pill';
import { meApi } from '@/api/me';
import { studentNextStep } from '@/utils/clearance';
import { cn } from '@/utils/cn';
import { formatTerm } from '@/utils/format';
import { useApi } from '@/hooks/useApi';
import { ClearanceSlipModal } from './clearance/ClearanceSlipModal';

const STEPS = [
  'Get every open case resolved by the SDO.',
  'Finish your sanctions and get each one verified.',
  'Attend your guidance exit interview.',
  'Get the final SDO signature at the SDO office.',
];

const termKey = (term: { academicYear: number; semester: number }) => `${term.academicYear}-${term.semester}`;

/** Student Clearance (deck W79, src 1340 to 1391): status, requirements, the slip, and how to get cleared. */
export function ClearancePage() {
  // `null` means "the newest term"; the API picks it.
  const [term, setTerm] = useState<{ academicYear: number; semester: number } | null>(null);
  // The term list is kept here, outside the loading state, so the chips stay while a term loads.
  const [terms, setTerms] = useState<ClearanceTermView[]>([]);
  const [slipOpen, setSlipOpen] = useState(false);
  const resource = useApi(() => meApi.myClearance(term ?? undefined), [term?.academicYear, term?.semester]);

  // Depend on the loaded list, not on `resource` (a new object every render).
  const loadedTerms = resource.status === 'ready' ? resource.data.terms : null;
  useEffect(() => {
    if (loadedTerms) setTerms(loadedTerms);
  }, [loadedTerms]);

  if (resource.status === 'loading' && terms.length === 0) {
    return (
      <p role="status" className="flex items-center gap-2 text-[13px] text-muted">
        <Spinner />
        Loading your clearance…
      </p>
    );
  }
  if (resource.status === 'error') return <PageError page="Clearance" detail={resource.error.message} onRetry={resource.reload} />;

  const clearance = resource.status === 'ready' ? resource.data.clearance : null;
  const shownTerm = clearance ?? term ?? terms[0] ?? null;
  const items = clearance?.items ?? [];
  const done = items.filter((item) => item.status === 'completed').length;
  const cleared = clearance?.status === 'cleared';
  const percent = items.length === 0 ? 0 : Math.round((done / items.length) * 100);

  return (
    <>
      <h1 className="sr-only">Clearance</h1>
      {slipOpen && clearance ? (
        <ClearanceSlipModal academicYear={clearance.academicYear} semester={clearance.semester} onClose={() => setSlipOpen(false)} />
      ) : null}
      <div className="flex flex-wrap items-stretch gap-6">
        <section className="flex min-w-0 flex-[1.3_1_420px] flex-col gap-5 rounded-xl border border-line bg-white p-6">
          <div>
            {terms.length > 1 ? (
              <ChipGroup
                label="Term"
                options={terms.map((option) => ({ value: termKey(option), label: formatTerm(option.academicYear, option.semester) }))}
                value={shownTerm ? termKey(shownTerm) : ''}
                onChange={(value) => {
                  const [year, semester] = value.split('-').map(Number);
                  setTerm({ academicYear: year, semester });
                }}
                className="gap-1.5 [&>button]:min-h-11 rail:[&>button]:min-h-8"
              />
            ) : shownTerm ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-line-soft px-2.5 py-1 text-xs font-bold text-body">
                <Icon name="calendar_month" className="!text-base" />
                {formatTerm(shownTerm.academicYear, shownTerm.semester)}
              </span>
            ) : null}
            <p className={cn('mt-2 text-[26px] leading-tight font-extrabold rail:text-[32px]', cleared ? 'text-success' : 'text-warn-ink')}>
              {cleared ? 'CLEARED' : 'NOT YET CLEARED'}
            </p>
            {clearance ? (
              <>
                <p className="my-2 flex flex-wrap gap-2">
                  <Pill tone="pending">{items.length - done} remaining</Pill>
                  <Pill tone="done">{done} completed</Pill>
                </p>
                <ProgressBar percent={percent} label="Clearance progress" tone={cleared ? 'green' : 'gold'} />
              </>
            ) : null}
          </div>

          <div>
            <p className="mb-2 text-[13px] font-semibold text-muted">Requirements</p>
            {clearance ? (
              <ul className="flex flex-col gap-2">
                {items.map((item) => {
                  const complete = item.status === 'completed';
                  return (
                    <li
                      key={item.requirementId}
                      className={cn('flex min-h-12 items-center gap-3 rounded-[10px] border px-3.5 py-2.5', complete ? 'border-success-line bg-success-soft/50' : 'border-calendar-closed bg-white')}
                    >
                      <Icon name={complete ? 'check_circle' : 'radio_button_unchecked'} filled={complete} className={cn('!text-[22px]', complete ? 'text-success-strong' : 'text-disabled')} />
                      <span className="min-w-0 flex-1 font-medium text-ink">{item.label}</span>
                      <span className={cn('text-xs font-bold', complete ? 'text-success' : 'text-warn-ink')}>{complete ? 'Completed' : 'Remaining'}</span>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-sm text-muted">The SDO has not set up your clearance for this term yet.</p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {cleared && clearance ? (
              <Button size="lg" onClick={() => setSlipOpen(true)}>
                <Icon name="download" className="!text-xl" />
                Download clearance slip
              </Button>
            ) : (
              <>
                <Button size="lg" disabled>
                  <Icon name="lock" className="!text-xl" />
                  Download clearance slip
                </Button>
                <span className="text-xs text-muted">Unlocks once every requirement is completed.</span>
              </>
            )}
          </div>
        </section>

        <section className="flex min-w-0 flex-[1_1_320px] flex-col gap-5 rounded-xl border border-line bg-white p-6">
          <h2 className="text-[19px] font-bold text-ink">How to get cleared</h2>
          <ol className="flex flex-col gap-3.5">
            {STEPS.map((step, index) => (
              <li key={step} className="flex items-start gap-3">
                <span aria-hidden="true" className="grid size-[26px] shrink-0 place-items-center rounded-full bg-info-soft text-xs font-bold text-primary">
                  {index + 1}
                </span>
                <span className="pt-[3px] text-body">{step}</span>
              </li>
            ))}
          </ol>
          <div className="mt-auto flex items-center gap-3 rounded-[10px] border border-info-soft bg-info-soft px-4 py-3.5">
            <Icon name="arrow_forward" className="!text-[22px] text-primary" />
            <div>
              <p className="text-[13px] font-semibold text-info-ink">What to do next</p>
              <p className="mt-0.5 text-pretty text-ink">{studentNextStep(clearance)}</p>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
