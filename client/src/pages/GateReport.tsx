import { useEffect, useRef, useState, type FormEvent } from 'react';
import { buttonClass, fieldClass, Icon, LoadingState } from '../components/ui';
import { api, toApiError } from '../lib/api';
import {
  YEAR_LEVEL_OPTIONS,
  shortReference,
  stepProblem,
  waitBeforeSubmit,
  type GateFormValues,
} from '../lib/gateForm';

type Options = { violations: Array<{ id: number; name: string; section: string }>; programs: string[] };

const EMPTY: GateFormValues = { studentId: '', name: '', program: '', year: '', violationIds: [] };
const STEPS = ['Student', 'Program', 'Violations'] as const;
const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * The public violation form (SPEC 4.10): no sign-in, three steps, then a confirmation with the reference.
 * It never talks to Power Automate; the API files the report and sends the emails after it commits. The
 * form-timing token is fetched when the page opens and sent back with the report.
 */
export default function GateReportPage() {
  const [options, setOptions] = useState<Options | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [values, setValues] = useState<GateFormValues>(EMPTY);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ reference: string; duplicate: boolean } | null>(null);
  const [search, setSearch] = useState('');
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

  const set = <K extends keyof GateFormValues>(key: K, value: GateFormValues[K]) =>
    setValues((current) => ({ ...current, [key]: value }));

  function next(event: FormEvent) {
    event.preventDefault();
    const message = stepProblem(step, values);
    setProblem(message);
    if (message === null && step < 3) setStep((current) => (current + 1) as 2 | 3);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const message = stepProblem(3, values);
    setProblem(message);
    if (message !== null || !token.current) return;
    setBusy(true);
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
      setDone(result);
    } catch (error) {
      const apiError = toApiError(error);
      setProblem(
        apiError.status === 429
          ? 'Too many reports from this device. Please wait a few minutes and try again.'
          : 'We could not accept this report. Please check the form and try again.',
      );
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

  function reset() {
    setValues(EMPTY);
    setStep(1);
    setProblem(null);
    setDone(null);
    setSearch('');
    void openForm();
  }

  const shell = (children: React.ReactNode) => (
    <div className="flex min-h-screen items-start justify-center bg-page px-4 py-8">
      <div className="w-full max-w-xl rounded-lg border border-line bg-white p-5 shadow-sm sm:p-6">
        <p className="text-sm font-semibold text-primary">NU Fairview · Student Discipline Office</p>
        <h1 className="mt-1 text-2xl font-bold text-ink">Report a violation</h1>
        {children}
      </div>
    </div>
  );

  if (done) {
    return shell(
      <div role="status" className="mt-6">
        <div className="flex items-center gap-2 text-success">
          <Icon name="check_circle" className="text-3xl" />
          <h2 className="text-lg font-semibold">{done.duplicate ? 'This report was already received' : 'Report received'}</h2>
        </div>
        <p className="mt-3 text-sm text-ink">Your reference number is</p>
        <p className="mt-1 text-3xl font-bold tracking-wider text-ink">{shortReference(done.reference)}</p>
        <p className="mt-3 text-sm text-muted">
          The SDO office will review it. Keep this number if you need to ask about the report.
        </p>
        <button type="button" onClick={reset} className={`${buttonClass} mt-6`}>
          File another report
        </button>
      </div>,
    );
  }

  if (loadError) {
    return shell(
      <div role="alert" className="mt-6">
        <p className="text-sm font-medium text-danger">{loadError}</p>
        <button type="button" onClick={() => void openForm()} className={`${buttonClass} mt-3`}>
          Try again
        </button>
      </div>,
    );
  }

  if (!options) return shell(<LoadingState label="Opening the form…" />);

  const needle = search.trim().toLowerCase();
  const shown = options.violations.filter(
    (violation) => needle === '' || violation.name.toLowerCase().includes(needle) || violation.section.toLowerCase().includes(needle),
  );

  return shell(
    <>
      <ol className="mt-4 flex gap-2" aria-label="Steps">
        {STEPS.map((label, index) => (
          <li
            key={label}
            aria-current={step === index + 1 ? 'step' : undefined}
            className={`flex-1 rounded-md px-2 py-1 text-center text-xs font-semibold ${
              step === index + 1 ? 'bg-primary text-white' : step > index + 1 ? 'bg-line text-ink' : 'bg-page text-muted'
            }`}
          >
            {index + 1}. {label}
          </li>
        ))}
      </ol>

      <form onSubmit={step === 3 ? submit : next} noValidate className="mt-5 space-y-4">
        {step === 1 ? (
          <>
            <div>
              <label htmlFor="gate-id" className="mb-1 block text-sm font-medium text-ink">
                Student ID
              </label>
              <input
                id="gate-id"
                inputMode="numeric"
                autoComplete="off"
                placeholder="2025-1234567"
                className={fieldClass}
                value={values.studentId}
                onChange={(event) => set('studentId', event.target.value)}
              />
            </div>
            <div>
              <label htmlFor="gate-name" className="mb-1 block text-sm font-medium text-ink">
                Student name
              </label>
              <input
                id="gate-name"
                autoComplete="off"
                className={fieldClass}
                maxLength={100}
                value={values.name}
                onChange={(event) => set('name', event.target.value)}
              />
            </div>
          </>
        ) : null}

        {step === 2 ? (
          <>
            <div>
              <label htmlFor="gate-program" className="mb-1 block text-sm font-medium text-ink">
                Program
              </label>
              <select
                id="gate-program"
                className={fieldClass}
                value={values.program}
                onChange={(event) => set('program', event.target.value)}
              >
                <option value="">Choose the program…</option>
                {options.programs.map((program) => (
                  <option key={program} value={program}>
                    {program}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="gate-year" className="mb-1 block text-sm font-medium text-ink">
                Year level
              </label>
              <select id="gate-year" className={fieldClass} value={values.year} onChange={(event) => set('year', event.target.value)}>
                <option value="">Choose the year level…</option>
                {YEAR_LEVEL_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </>
        ) : null}

        {step === 3 ? (
          <fieldset>
            <legend className="mb-1 text-sm font-medium text-ink">What did the student do? Choose one or more.</legend>
            <label htmlFor="gate-search" className="sr-only">
              Search violations
            </label>
            <input
              id="gate-search"
              type="search"
              placeholder="Search violations"
              className={fieldClass}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <ul className="mt-2 max-h-72 space-y-1 overflow-y-auto rounded-md border border-line p-2">
              {shown.length === 0 ? <li className="text-sm text-muted">No violation matches.</li> : null}
              {shown.map((violation) => {
                const inputId = `gate-violation-${violation.id}`;
                return (
                  <li key={violation.id}>
                    <label htmlFor={inputId} className="flex items-start gap-2 text-sm">
                      <input
                        id={inputId}
                        type="checkbox"
                        className="mt-1"
                        checked={values.violationIds.includes(violation.id)}
                        onChange={() =>
                          set(
                            'violationIds',
                            values.violationIds.includes(violation.id)
                              ? values.violationIds.filter((id) => id !== violation.id)
                              : [...values.violationIds, violation.id],
                          )
                        }
                      />
                      <span>
                        {violation.name} <span className="text-muted">({violation.section})</span>
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
            <p className="mt-2 text-xs text-muted">{values.violationIds.length} chosen</p>
          </fieldset>
        ) : null}

        {problem ? (
          <p role="alert" className="text-sm font-medium text-danger">
            {problem}
          </p>
        ) : null}

        <div className="flex gap-2">
          {step > 1 ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setProblem(null);
                setStep((current) => (current - 1) as 1 | 2);
              }}
              className="rounded-md border border-line-strong bg-white px-4 py-2 text-sm font-medium text-ink hover:bg-page"
            >
              Back
            </button>
          ) : null}
          <button type="submit" disabled={busy} className={`${buttonClass} flex-1`}>
            {step < 3 ? 'Next' : busy ? 'Submitting…' : 'Submit report'}
          </button>
        </div>
      </form>
    </>,
  );
}
