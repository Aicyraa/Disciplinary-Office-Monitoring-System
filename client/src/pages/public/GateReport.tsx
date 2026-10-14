import { useEffect, useRef, useState } from 'react';
import { toApiError } from '@/api/client';
import { gateApi } from '@/api/gate';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Pill } from '@/components/ui/Pill';
import { Spinner } from '@/components/feedback/PageState';
import { cn } from '@/utils/cn';
import { notificationWhen } from '@/utils/inbox';
import {
  YEAR_PILLS,
  categoryCounts,
  filterGateViolations,
  waitBeforeSubmit,
  type GateCategory,
  type GateFormValues,
  type GateViolation,
} from '@/utils/gateForm';
import { detailsErrors, violationsError, type DetailsErrors } from '@/validators/gateForm';
import { GateInput, GateSelect, gateControl } from './gate/GateFields';
import { GatePinned } from './gate/GatePinned';

type Options = { violations: GateViolation[]; programs: string[] };
type Done = { code: string; duplicate: boolean; submittedAt: string };

const EMPTY: GateFormValues = { studentId: '', name: '', program: '', year: '', violationIds: [] };
const STEPS = ['Details', 'Violations', 'Review'] as const;
const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
const NOT_SENT = 'Your report wasn’t sent. Check your connection and tap Submit again. Nothing was saved.';

/** The card has no fixed height: it is as tall as the step needs. */
const card = 'flex flex-col gap-4 rounded-3xl bg-white px-[18px] py-5 shadow-gate-card rail:px-7 rail:py-[22px]';
const navRow = 'mt-1 flex items-center border-t border-line-soft pt-3.5';
const navButton = 'rounded-xl font-semibold';
const backButton = cn(navButton, 'border-[1.5px] border-line text-primary hover:bg-pale');

function CategoryPill({ category }: { category: 'Minor' | 'Major' }) {
  return <Pill tone={category === 'Major' ? 'bad' : 'info'}>{category}</Pill>;
}

function CardHeader({ title, subtitle, aside }: { title: string; subtitle: string; aside?: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-[19px] font-bold text-ink">{title}</h2>
        {aside}
      </div>
      <p className="mt-0.5 text-[13px] text-pretty text-muted">{subtitle}</p>
    </div>
  );
}

/**
 * The public violation form (deck W07 to W14, src 119 to 258): no sign-in, three steps, then the reference to
 * show the guard. It never talks to Power Automate; the API files the report and sends the emails after it
 * commits. The form-timing token is fetched when the page opens and sent back with the report.
 */
export default function GateReportPage() {
  const [options, setOptions] = useState<Options | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [values, setValues] = useState<GateFormValues>(EMPTY);
  const [errors, setErrors] = useState<DetailsErrors>({});
  const [pickError, setPickError] = useState<string | null>(null);
  const [failure, setFailure] = useState<{ network: boolean; message: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<Done | null>(null);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<GateCategory>('All');
  const token = useRef<{ value: string; openedAt: number } | null>(null);

  async function openForm() {
    setLoadError(null);
    try {
      const [loaded, issued] = await Promise.all([gateApi.gateOptions(), gateApi.gateToken()]);
      token.current = { value: issued.token, openedAt: Date.now() };
      setOptions(loaded);
    } catch (error) {
      setLoadError(toApiError(error).message);
    }
  }

  useEffect(() => {
    void openForm();
  }, []);

  const go = (next: 1 | 2 | 3) => {
    setStep(next);
    setFailure(null);
    window.scrollTo(0, 0);
  };

  function set<K extends keyof GateFormValues>(key: K, value: GateFormValues[K]) {
    setValues((current) => ({ ...current, [key]: value }));
    if (key in errors) setErrors((current) => ({ ...current, [key]: undefined }));
  }

  function toggle(id: number) {
    set('violationIds', values.violationIds.includes(id) ? values.violationIds.filter((v) => v !== id) : [...values.violationIds, id]);
    setPickError(null);
  }

  async function submit() {
    if (!token.current) return;
    setBusy(true);
    setFailure(null);
    try {
      // The API refuses a form younger than 3 seconds. A person rarely gets there, but autofill can.
      await sleep(waitBeforeSubmit(Date.now() - token.current.openedAt));
      const result = await gateApi.submitGateReport({
        token: token.current.value,
        studentId: values.studentId.trim(),
        name: values.name.trim(),
        program: values.program,
        year: values.year,
        violationIds: values.violationIds,
      });
      setDone({ code: result.code, duplicate: result.duplicate, submittedAt: result.submittedAt });
      window.scrollTo(0, 0);
    } catch (error) {
      const apiError = toApiError(error);
      // No status: the request never reached the server (the deck's "not sent" state, W13).
      const network = !apiError.status;
      setFailure({
        network,
        message: network
          ? NOT_SENT
          : apiError.status === 429
            ? 'Too many reports from this device. Please wait a few minutes and try again.'
            : 'We could not accept this report. Please check the form and try again.',
      });
      // A token is good for one sitting; get a fresh one so the next try is not refused for being stale.
      try {
        token.current = { value: (await gateApi.gateToken()).token, openedAt: Date.now() };
      } catch {
        /* the next submit will say so */
      }
    } finally {
      setBusy(false);
    }
  }

  function startAgain() {
    setValues(EMPTY);
    setErrors({});
    setPickError(null);
    setFailure(null);
    setDone(null);
    setSearch('');
    setCategory('All');
    setStep(1);
    window.scrollTo(0, 0);
    void openForm();
  }

  /** The column: the pinned header and steps stay put between steps; only the card below changes. */
  const shell = (children: React.ReactNode, steps = false) => (
    <div className="min-h-screen bg-page">
      <main className="gate-zoom mx-auto flex w-full max-w-[640px] flex-col gap-4 px-3.5 pt-4 pb-7 rail:px-6 rail:pt-10 rail:pb-8">
        <GatePinned steps={steps ? STEPS : undefined} current={steps ? step - 1 : undefined} />
        {children}
      </main>
    </div>
  );

  if (done) {
    return shell(
      <div role="status" className={cn(card, 'items-center gap-3 py-7 text-center')}>
        <span aria-hidden="true" className="grid size-[72px] place-items-center rounded-full bg-info-soft text-primary">
          <Icon name="check_circle" filled className="!text-[40px]" />
        </span>
        {done.duplicate ? (
          <>
            <h2 className="text-[22px] font-bold text-ink">We already have this report</h2>
            <p className="text-[13px] text-muted">You don’t need to submit it again.</p>
          </>
        ) : (
          <h2 className="text-[22px] font-bold text-ink">Report received</h2>
        )}
        <div className="w-full rounded-xl border-[1.5px] border-dashed border-upload-line bg-pale p-3.5">
          <p className="text-[13px] font-semibold text-muted">Reference</p>
          <p className="text-[28px] font-extrabold tracking-[0.04em] text-ink">{done.code}</p>
          <p className="text-[13px] text-muted">{notificationWhen(done.submittedAt)}</p>
        </div>
        <Pill tone="pending">Awaiting staff review</Pill>
        <p className="text-sm text-pretty text-body">
          Show this screen to the guard. The SDO checks your identity and the report before anything is added to your record.
          You’ll get a notice in your student portal and school email.
        </p>
        <Button variant="neutral" size="xl" className={cn(backButton, 'w-full max-w-[320px]')} onClick={startAgain}>
          Start a new report
        </Button>
      </div>,
    );
  }

  if (loadError) {
    return shell(
      <Alert tone="error">
        {loadError}{' '}
        <button type="button" className="font-semibold underline" onClick={() => void openForm()}>
          Try again
        </button>
      </Alert>,
    );
  }

  if (!options)
    return shell(
      <p role="status" className="flex items-center justify-center gap-2 py-10 text-[13px] text-muted">
        <Spinner />
        Opening the form…
      </p>,
    );

  const shown = filterGateViolations(options.violations, search, category);
  const counts = categoryCounts(options.violations, search);
  const chosen = options.violations.filter((violation) => values.violationIds.includes(violation.id));
  const yearLabel = YEAR_PILLS.find((pill) => pill.value === values.year)?.label;

  return shell(
    <>
      {step === 1 ? (
        <div className={card}>
          <CardHeader
            title="Your details"
            subtitle="Enter your details as they appear on your school ID. The SDO uses them to match this report to your record."
          />
          <div className="flex flex-col gap-5">
            <GateInput
              label="Student ID"
              inputMode="numeric"
              autoComplete="off"
              placeholder="e.g. 2025-1234567"
              value={values.studentId}
              error={errors.studentId}
              onChange={(event) => set('studentId', event.target.value)}
            />
            <GateInput
              label="Full name"
              autoComplete="name"
              maxLength={100}
              placeholder="First and last name"
              value={values.name}
              error={errors.name}
              onChange={(event) => set('name', event.target.value)}
            />
            <GateSelect label="Program" value={values.program} error={errors.program} onChange={(event) => set('program', event.target.value)}>
              <option value="">Choose your program</option>
              {options.programs.map((program) => (
                <option key={program} value={program}>
                  {program}
                </option>
              ))}
            </GateSelect>
            <GateSelect label="Year level" value={values.year} error={errors.year} onChange={(event) => set('year', event.target.value)}>
              <option value="">Choose your year level</option>
              {YEAR_PILLS.map((pill) => (
                <option key={pill.value} value={pill.value}>
                  {pill.label} Year
                </option>
              ))}
            </GateSelect>
          </div>
          <div className={cn(navRow, 'justify-end')}>
            <Button
              size="xl"
              className={navButton}
              onClick={() => {
                const found = detailsErrors(values);
                setErrors(found);
                if (Object.keys(found).length === 0) go(2);
              }}
            >
              Continue
              <Icon name="arrow_forward" className="!text-xl" />
            </Button>
          </div>
        </div>
      ) : null}

      {step === 2 ? (
        <div className={card}>
          <CardHeader
            title="What were you stopped for?"
            subtitle="Check every violation the guard named. They’re sent together as one report."
            aside={
              <span aria-live="polite" className="shrink-0 rounded-full bg-info-soft px-3 py-1 text-xs font-bold whitespace-nowrap text-primary">
                {values.violationIds.length ? `${values.violationIds.length} selected` : 'None selected'}
              </span>
            }
          />
          <label className="relative block">
            <span className="sr-only">Search violations</span>
            <Icon name="search" className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-muted-2" />
            <input
              type="search"
              placeholder="Search violations"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className={cn(gateControl(false), 'pl-12')}
            />
          </label>
          <div role="tablist" aria-label="Classification" className="flex gap-1 rounded-[14px] bg-pale p-1">
            {(['All', 'Minor', 'Major'] as const).map((key) => {
              const on = category === key;
              return (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={on}
                  onClick={() => setCategory(key)}
                  className={cn(
                    'inline-flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-[10px] px-3 text-sm font-semibold outline-none focus-visible:ring-[3px] focus-visible:ring-primary/30',
                    on ? 'bg-white text-primary shadow-tab' : 'text-muted hover:text-ink',
                  )}
                >
                  {key}
                  <span className={cn('grid h-5 min-w-5 place-items-center rounded-full px-1.5 text-[11px]', on ? 'bg-info-soft text-primary' : 'bg-line-soft text-muted')}>
                    {counts[key]}
                  </span>
                </button>
              );
            })}
          </div>
          {pickError ? <Alert tone="error">{pickError}</Alert> : null}
          <div role="group" aria-label="Violations" className="grid max-h-[340px] auto-rows-min gap-2 overflow-y-auto p-0.5 rail:max-h-[320px]">
            {shown.map((violation) => {
              const on = values.violationIds.includes(violation.id);
              return (
                <button
                  key={violation.id}
                  type="button"
                  role="checkbox"
                  aria-checked={on}
                  onClick={() => toggle(violation.id)}
                  className={cn(
                    'flex min-h-[46px] w-full items-center gap-3 rounded-[14px] border-[1.5px] px-3 py-1.5 text-left outline-none focus-visible:ring-[3px] focus-visible:ring-primary/30',
                    on ? 'border-row-hover bg-row-hover' : 'border-line bg-white hover:border-upload-line',
                  )}
                >
                  <Icon name={on ? 'check_box' : 'check_box_outline_blank'} filled={on} className={cn('shrink-0 !text-2xl', on ? 'text-primary' : 'text-muted-2')} />
                  <span className="min-w-0 flex-1 leading-snug">
                    <span className="block text-[15px] font-semibold text-ink">{violation.name}</span>
                    <span className="block text-xs text-muted">Sec. {violation.section}</span>
                  </span>
                  <CategoryPill category={violation.category} />
                </button>
              );
            })}
            {shown.length === 0 ? <p className="p-4 text-center text-[13px] text-muted">No violation matches that search.</p> : null}
          </div>
          <div className={cn(navRow, 'justify-between')}>
            <Button variant="neutral" size="xl" className={backButton} onClick={() => go(1)}>
              <Icon name="arrow_back" className="!text-xl" />
              Back
            </Button>
            <Button
              size="xl"
              className={navButton}
              onClick={() => {
                const problem = violationsError(values.violationIds);
                setPickError(problem);
                if (problem === null) go(3);
              }}
            >
              Continue
              <Icon name="arrow_forward" className="!text-xl" />
            </Button>
          </div>
        </div>
      ) : null}

      {step === 3 ? (
        <div className={card}>
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
          <div className={cn(navRow, 'justify-between')}>
            <Button variant="neutral" size="xl" className={backButton} disabled={busy} onClick={() => go(2)}>
              <Icon name="arrow_back" className="!text-xl" />
              Back
            </Button>
            <Button size="xl" className={navButton} busy={busy} busyLabel="Submitting…" onClick={() => void submit()}>
              Submit report
              <Icon name="send" className="!text-xl" />
            </Button>
          </div>
        </div>
      ) : null}
    </>,
    true,
  );
}
