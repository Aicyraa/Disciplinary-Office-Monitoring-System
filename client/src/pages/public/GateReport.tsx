import { useEffect, useRef, useState, type ReactNode } from 'react';
import { toApiError } from '@/api/client';
import { gateApi } from '@/api/gate';
import { Alert } from '@/components/ui/Alert';
import { SkeletonPanel } from '@/components/feedback/Skeleton';
import { waitBeforeSubmit, type GateCategory, type GateFormValues, type GateViolation } from '@/utils/gateForm';
import type { DetailsErrors } from '@/validators/gateForm';
import { DetailsStep } from './gate/DetailsStep';
import { GatePinned } from './gate/GatePinned';
import { ReceivedCard } from './gate/ReceivedCard';
import { ReviewStep } from './gate/ReviewStep';
import { ViolationsStep } from './gate/ViolationsStep';

type Options = { violations: GateViolation[]; programs: string[] };
type Done = { code: string; duplicate: boolean; submittedAt: string };

const EMPTY: GateFormValues = { studentId: '', name: '', program: '', year: '', violationIds: [] };
const STEPS = ['Details', 'Violations', 'Review'] as const;
const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
const NOT_SENT = 'Your report wasn’t sent. Check your connection and tap Submit again. Nothing was saved.';

/** The column: the pinned header and steps stay put between steps; only the card below changes. */
function GateColumn({ children, step }: { children: ReactNode; step?: 1 | 2 | 3 }) {
  return (
    <div className="min-h-screen bg-page">
      <main className="gate-zoom mx-auto flex w-full max-w-[640px] flex-col gap-4 px-3.5 pt-4 pb-7 rail:px-6 rail:pt-10 rail:pb-8">
        <GatePinned steps={step ? STEPS : undefined} current={step ? step - 1 : undefined} />
        {children}
      </main>
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

  if (done) {
    return (
      <GateColumn>
        <ReceivedCard code={done.code} duplicate={done.duplicate} submittedAt={done.submittedAt} onStartAgain={startAgain} />
      </GateColumn>
    );
  }

  if (loadError) {
    return (
      <GateColumn>
        <Alert tone="error">
          {loadError}{' '}
          <button type="button" className="font-semibold underline" onClick={() => void openForm()}>
            Try again
          </button>
        </Alert>
      </GateColumn>
    );
  }

  if (!options) {
    return (
      <GateColumn>
        <SkeletonPanel label="Opening the form…" lines={5} className="border-0 p-0" />
      </GateColumn>
    );
  }

  return (
    <GateColumn step={step}>
      {step === 1 ? (
        <DetailsStep
          values={values}
          errors={errors}
          programs={options.programs}
          onChange={set}
          onErrors={setErrors}
          onContinue={() => go(2)}
        />
      ) : null}
      {step === 2 ? (
        <ViolationsStep
          violations={options.violations}
          selectedIds={values.violationIds}
          search={search}
          category={category}
          pickError={pickError}
          onSearch={setSearch}
          onCategory={setCategory}
          onToggle={toggle}
          onPickError={setPickError}
          onBack={() => go(1)}
          onContinue={() => go(3)}
        />
      ) : null}
      {step === 3 ? (
        <ReviewStep
          values={values}
          chosen={options.violations.filter((violation) => values.violationIds.includes(violation.id))}
          failure={failure}
          busy={busy}
          onBack={() => go(2)}
          onSubmit={() => void submit()}
        />
      ) : null}
    </GateColumn>
  );
}
