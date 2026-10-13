import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import seal from '@/assets/seal.png';
import { api, toApiError } from '@/api/client';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { Icon } from '@/components/ui/Icon';
import { Pill } from '@/components/ui/Pill';
import { Select } from '@/components/ui/Select';
import { StageTracker } from '@/components/ui/StageTracker';
import { LoadingState } from '@/components/ui';
import { cn } from '@/utils/cn';
import { notificationWhen } from '@/utils/inbox';
import {
  YEAR_PILLS,
  categoryCounts,
  detailsErrors,
  filterGateViolations,
  violationsError,
  waitBeforeSubmit,
  type DetailsErrors,
  type GateCategory,
  type GateFormValues,
  type GateViolation,
} from '@/utils/gateForm';

type Options = { violations: GateViolation[]; programs: string[] };
type Done = { code: string; duplicate: boolean; submittedAt: string };

const EMPTY: GateFormValues = { studentId: '', name: '', program: '', year: '', violationIds: [] };
const STEPS = ['Details', 'Violations', 'Review'] as const;
const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
const NOT_SENT = 'Your report wasn’t sent. Check your connection and tap Submit again. Nothing was saved.';

const card = 'flex flex-col rounded-xl border border-line bg-white';

function CategoryPill({ category }: { category: 'Minor' | 'Major' }) {
  return <Pill tone={category === 'Major' ? 'bad' : 'info'}>{category}</Pill>;
}

/**
 * The public violation form (deck W07 to W14, src 119 to 258): no sign-in, three steps, then the reference to
 * show the guard. It never talks to Power Automate; the API files the report and sends the emails after it
 * commits. The form-timing token is fetched when the page opens and sent back with the report.
 */
export default function GateReportPage() {
  const navigate = useNavigate();
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
      const [loaded, issued] = await Promise.all([api.gateOptions(), api.gateToken()]);
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
      const result = await api.submitGateReport({
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
        token.current = { value: (await api.gateToken()).token, openedAt: Date.now() };
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

  const backLabel = done || step === 1 ? 'Back to sign in' : 'Back to the previous step';

  const shell = (children: React.ReactNode) => (
    <div className="flex min-h-screen flex-col bg-page">
      <header className="sticky top-0 z-40 flex h-16 items-center border-b border-line bg-white px-4 text-ink">
        <div className="mx-auto flex w-full max-w-[560px] items-center gap-3">
          <button
            type="button"
            aria-label={backLabel}
            title={backLabel}
            onClick={() => (done || step === 1 ? navigate('/login') : go((step - 1) as 1 | 2))}
            className="grid size-10 shrink-0 place-items-center rounded-full hover:bg-primary-tint focus-visible:ring-[3px] focus-visible:ring-primary/25 focus-visible:outline-none"
          >
            <Icon name="arrow_back" className="!text-2xl" />
          </button>
          <img src={seal} alt="" className="w-[34px] shrink-0" />
          <div className="min-w-0">
            <h1 className="text-base leading-tight font-bold">Violation Form</h1>
            <p className="text-xs text-muted">Student Discipline Office</p>
          </div>
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-[560px] flex-1 flex-col gap-3.5 p-4">{children}</main>
    </div>
  );

  if (done) {
    return shell(
      <div role="status" className={cn(card, 'items-center gap-3 px-[18px] py-6 text-center')}>
        <span aria-hidden="true" className="grid size-14 place-items-center rounded-full bg-success-soft text-success">
          <Icon name="check" className="!text-[32px]" />
        </span>
        {done.duplicate ? (
          <>
            <h2 className="text-[22px] font-bold text-ink">We already have this report</h2>
            <p className="text-[13px] text-muted">You don’t need to submit it again.</p>
          </>
        ) : (
          <h2 className="text-[22px] font-bold text-ink">Report received</h2>
        )}
        <div className="w-full rounded-[10px] border border-dashed border-disabled bg-page p-3.5">
          <p className="text-[13px] font-semibold text-muted">Reference</p>
          <p className="text-[28px] font-extrabold tracking-[0.04em] text-ink">{done.code}</p>
          <p className="text-[13px] text-muted">{notificationWhen(done.submittedAt)}</p>
        </div>
        <Pill tone="pending">Awaiting staff review</Pill>
        <p className="text-sm text-pretty text-body">
          Show this screen to the guard. The SDO checks your identity and the report before anything is added to your record.
          You’ll get a notice in your student portal and school email.
        </p>
        <Button variant="secondary" size="xxl" fullWidth onClick={startAgain}>
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

  if (!options) return shell(<LoadingState label="Opening the form…" />);

  const shown = filterGateViolations(options.violations, search, category);
  const counts = categoryCounts(options.violations, search);
  const chosen = options.violations.filter((violation) => values.violationIds.includes(violation.id));
  const yearLabel = YEAR_PILLS.find((pill) => pill.value === values.year)?.label;

  return shell(
    <>
      <StageTracker steps={STEPS} current={step - 1} label="Progress" size="md" />

      {step === 1 ? (
        <div className={cn(card, 'gap-[22px] px-[22px] py-7')}>
          <h2 className="text-xl font-bold text-ink">Your details</h2>
          <Field
            label="Student ID"
            size="lg"
            inputMode="numeric"
            autoComplete="off"
            placeholder="e.g. 2025-1234567"
            value={values.studentId}
            error={errors.studentId}
            onChange={(event) => set('studentId', event.target.value)}
          />
          <Field
            label="Full name"
            size="lg"
            autoComplete="name"
            maxLength={100}
            placeholder="First and last name"
            value={values.name}
            error={errors.name}
            onChange={(event) => set('name', event.target.value)}
          />
          <Select label="Program" size="lg" value={values.program} error={errors.program} onChange={(event) => set('program', event.target.value)}>
            <option value="">Choose your program</option>
            {options.programs.map((program) => (
              <option key={program} value={program}>
                {program}
              </option>
            ))}
          </Select>
          <div role="radiogroup" aria-labelledby="gate-year-label">
            <p id="gate-year-label" className="mb-2 text-sm font-semibold text-ink">
              Year level
            </p>
            <div className="grid grid-cols-5 gap-2">
              {YEAR_PILLS.map((pill) => {
                const on = values.year === pill.value;
                return (
                  <button
                    key={pill.value}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => set('year', pill.value)}
                    className={cn(
                      'min-h-12 rounded-full border px-1 text-sm font-semibold focus-visible:ring-[3px] focus-visible:ring-primary/30 focus-visible:outline-none',
                      on ? 'border-primary bg-primary text-white' : 'border-line-strong bg-white text-body hover:border-primary',
                    )}
                  >
                    {pill.label}
                  </button>
                );
              })}
            </div>
            {errors.year ? (
              <p role="alert" className="mt-1.5 flex items-center gap-1.5 text-[13px] font-semibold text-danger-strong">
                <Icon name="error" className="!text-lg" />
                {errors.year}
              </p>
            ) : null}
          </div>
          <Button
            size="xxl"
            className="mt-1.5"
            onClick={() => {
              const found = detailsErrors(values);
              setErrors(found);
              if (Object.keys(found).length === 0) go(2);
            }}
          >
            Next: violations
          </Button>
        </div>
      ) : null}

      {step === 2 ? (
        <div className={cn(card, 'gap-3 px-4 py-6')}>
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="text-xl font-bold text-ink">What were you stopped for?</h2>
            <span aria-live="polite" className="text-[13px] font-semibold whitespace-nowrap text-primary">
              {values.violationIds.length ? `${values.violationIds.length} selected` : 'None selected'}
            </span>
          </div>
          <p className="-mt-1.5 text-[13px] text-muted">Check every violation the guard named. They’re sent together as one report.</p>
          <label className="relative block">
            <span className="sr-only">Search violations</span>
            <Icon name="search" className="absolute top-1/2 left-3 -translate-y-1/2 text-muted-2" />
            <input
              type="search"
              placeholder="Search violations"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="block min-h-12 w-full rounded-lg border border-line-strong bg-white pr-3.5 pl-10 text-base text-ink outline-none placeholder:text-muted-2 focus:border-primary focus:ring-[3px] focus:ring-primary/18"
            />
          </label>
          <div role="tablist" aria-label="Classification" className="flex gap-2">
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
                    'inline-flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-full border px-3 text-sm font-semibold focus-visible:ring-[3px] focus-visible:ring-primary/30 focus-visible:outline-none',
                    on ? 'border-primary bg-primary text-white' : 'border-line-strong bg-white text-body hover:border-primary',
                  )}
                >
                  {key}
                  <span className={cn('grid h-5 min-w-5 place-items-center rounded-full px-1.5 text-[11px]', on ? 'bg-white/22' : 'bg-line-soft')}>
                    {counts[key]}
                  </span>
                </button>
              );
            })}
          </div>
          {pickError ? <Alert tone="error">{pickError}</Alert> : null}
          <div role="group" aria-label="Violations" className="flex max-h-[360px] flex-col gap-1.5 overflow-y-auto p-0.5">
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
                    'flex min-h-14 w-full items-center gap-3 rounded-[10px] border px-3 py-2 text-left focus-visible:ring-[3px] focus-visible:ring-primary/30 focus-visible:outline-none',
                    on ? 'border-primary bg-info-soft' : 'border-line bg-white hover:bg-row-hover',
                  )}
                >
                  <Icon name={on ? 'check_box' : 'check_box_outline_blank'} className={cn('!text-2xl', on ? 'text-primary' : 'text-muted-2')} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px] font-semibold text-ink">{violation.name}</span>
                    <span className="block text-xs text-muted">Sec. {violation.section}</span>
                  </span>
                  <CategoryPill category={violation.category} />
                </button>
              );
            })}
            {shown.length === 0 ? <p className="p-4 text-center text-[13px] text-muted">No violation matches that search.</p> : null}
          </div>
          <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)] gap-2">
            <Button variant="secondary" size="xxl" onClick={() => go(1)}>
              Back
            </Button>
            <Button
              size="xxl"
              onClick={() => {
                const problem = violationsError(values.violationIds);
                setPickError(problem);
                if (problem === null) go(3);
              }}
            >
              Next: review
            </Button>
          </div>
        </div>
      ) : null}

      {step === 3 ? (
        <div className={cn(card, 'gap-3.5 px-4 py-6')}>
          <h2 className="text-xl font-bold text-ink">Check and submit</h2>
          <dl className="flex flex-col rounded-[10px] border border-line-soft">
            {(
              [
                ['Student ID', values.studentId.trim()],
                ['Full name', values.name.trim()],
                ['Program', values.program],
                ['Year level', yearLabel ? `${yearLabel} year` : ''],
              ] as const
            ).map(([label, value]) => (
              <div key={label} className="flex gap-3 border-b border-line-soft px-3 py-2.5 text-sm last:border-b-0">
                <dt className="w-24 shrink-0 text-muted">{label}</dt>
                <dd className="min-w-0 flex-1 font-semibold text-ink">{value}</dd>
              </div>
            ))}
          </dl>
          <div>
            <p className="mb-2 text-[13px] font-semibold text-muted">Violations</p>
            <ul className="flex flex-col gap-1.5">
              {chosen.map((violation) => (
                <li key={violation.id} className="flex items-center gap-2.5 rounded-lg bg-surface-2 px-3 py-2.5">
                  <span className="flex-1 font-semibold text-ink">{violation.name}</span>
                  <CategoryPill category={violation.category} />
                </li>
              ))}
            </ul>
          </div>
          {failure ? (
            <Alert tone="error" icon={failure.network ? 'wifi_off' : 'error'}>
              {failure.message}
            </Alert>
          ) : null}
          <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)] gap-2">
            <Button variant="secondary" size="xxl" disabled={busy} onClick={() => go(2)}>
              Back
            </Button>
            <Button size="xxl" busy={busy} busyLabel="Submitting…" onClick={() => void submit()}>
              Submit report
            </Button>
          </div>
        </div>
      ) : null}
    </>,
  );
}
