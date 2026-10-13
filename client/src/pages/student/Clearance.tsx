import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { ClearanceSlipView, ClearanceTermView } from '@shared/types';
import { useAuth } from '@/context/AuthContext';
import { ProgressBar } from '@/components/dashboard/DashboardCards';
import { LockedButton } from '@/components/feedback';
import { Card, EmptyState, ErrorState, Icon, LoadingState, PageHeader, Resource } from '@/components/ui';
import { api } from '@/api/client';
import { formatDate, formatTerm } from '@/utils/format';
import { useApi } from '@/hooks/useApi';

const STEPS = [
  'Get every open case resolved by the SDO.',
  'Finish your sanctions and get each one verified.',
  'Attend your guidance exit interview.',
  'Get the final SDO signature at the SDO office.',
];

const termKey = (term: { academicYear: number; semester: number }) => `${term.academicYear}-${term.semester}`;

/** Student clearance (deck W79): term chips, the requirement list, a slip that stays locked until every item is done. */
export function ClearancePage() {
  // `null` means "the newest term"; the API picks it.
  const [term, setTerm] = useState<{ academicYear: number; semester: number } | null>(null);
  // The term list is kept here, outside the loading state, so the chips are not unmounted while a term loads.
  const [terms, setTerms] = useState<ClearanceTermView[]>([]);
  const resource = useApi(() => api.myClearance(term ?? undefined), [term?.academicYear, term?.semester]);

  useEffect(() => {
    if (resource.status === 'ready') setTerms(resource.data.terms);
  }, [resource]);

  return (
    <>
      <PageHeader title="Clearance" subtitle="Requirements the office has set for each term. Staff mark them done." />
      {terms.length > 1 ? (
        <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label="Term">
          {terms.map((option) => {
            const active =
              term !== null
                ? termKey(option) === termKey(term)
                : resource.status === 'ready' && resource.data.clearance !== null && termKey(option) === termKey(resource.data.clearance);
            return (
              <button
                key={termKey(option)}
                type="button"
                aria-pressed={active}
                onClick={() => setTerm({ academicYear: option.academicYear, semester: option.semester })}
                className={`min-h-11 rounded-full border px-4 text-sm font-medium ${
                  active ? 'border-primary bg-primary text-white' : 'border-line-strong bg-white text-ink'
                }`}
              >
                {formatTerm(option.academicYear, option.semester)}
              </button>
            );
          })}
        </div>
      ) : null}
      <Resource resource={resource} onRetry={resource.reload}>
        {({ terms: loadedTerms, clearance }) => {
          if (loadedTerms.length === 0) return <EmptyState title="No clearance has been set up for you yet." />;
          if (!clearance) return <EmptyState title="No clearance for this term." />;
          const done = clearance.items.filter((item) => item.status === 'completed').length;
          const remaining = clearance.items.length - done;
          const cleared = clearance.status === 'cleared';
          const percent = clearance.items.length === 0 ? 0 : Math.round((done / clearance.items.length) * 100);
          return (
            <div className="grid gap-4 full:grid-cols-[3fr_2fr]">
              <Card>
                <p className="inline-flex items-center gap-1 rounded-full bg-page px-2.5 py-0.5 text-xs font-medium text-ink">
                  <Icon name="calendar_today" className="text-sm" />
                  {formatTerm(clearance.academicYear, clearance.semester)}
                </p>
                <h2 className={`mt-2 text-3xl font-extrabold tracking-tight ${cleared ? 'text-success' : 'text-[#7A5B00]'}`}>
                  {cleared ? 'CLEARED' : 'NOT YET CLEARED'}
                </h2>
                <p className="mt-1 flex flex-wrap gap-2 text-xs font-semibold">
                  <span className="rounded-full bg-[#FCE9C6] px-2 py-0.5 text-[#7A4600]">{remaining} remaining</span>
                  <span className="rounded-full bg-[#E4F3EA] px-2 py-0.5 text-success">{done} completed</span>
                </p>
                <div className="mt-3">
                  <ProgressBar percent={percent} label="Clearance progress" />
                </div>

                <h3 className="mt-5 text-xs font-semibold tracking-wide text-muted uppercase">Requirements</h3>
                <ul className="mt-2 space-y-2">
                  {clearance.items.map((item) => {
                    const complete = item.status === 'completed';
                    return (
                      <li
                        key={item.requirementId}
                        className={`flex items-center gap-3 rounded-lg border px-3 py-3 ${
                          complete ? 'border-[#BFE3CB] bg-[#F1FAF4]' : 'border-line bg-white'
                        }`}
                      >
                        <Icon name={complete ? 'check_circle' : 'radio_button_unchecked'} className={complete ? 'text-success' : 'text-muted'} />
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium text-ink">{item.label}</div>
                          {complete && item.dateCompleted ? (
                            <div className="text-xs text-muted">Done {formatDate(item.dateCompleted)}</div>
                          ) : null}
                          {item.remarks ? <div className="text-xs text-muted">{item.remarks}</div> : null}
                        </div>
                        <span className={`text-xs font-semibold ${complete ? 'text-success' : 'text-[#7A4600]'}`}>
                          {complete ? 'Completed' : 'Remaining'}
                        </span>
                      </li>
                    );
                  })}
                </ul>

                <div className="mt-5">
                  {cleared ? (
                    <Link
                      to={`/clearance/slip?academic_year=${clearance.academicYear}&semester=${clearance.semester}`}
                      className="inline-flex min-h-11 items-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-white hover:bg-primary-active"
                    >
                      <Icon name="download" className="text-base" />
                      Download clearance slip
                    </Link>
                  ) : (
                    <LockedButton lockedReason="Unlocks once every requirement is completed.">Download clearance slip</LockedButton>
                  )}
                </div>
              </Card>

              <Card className="self-start">
                <h3 className="text-base font-bold text-ink">How to get cleared</h3>
                <ol className="mt-3 space-y-3">
                  {STEPS.map((step, index) => (
                    <li key={step} className="flex gap-3 text-sm">
                      <span className="inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                        {index + 1}
                      </span>
                      {step}
                    </li>
                  ))}
                </ol>
                {!cleared ? (
                  <div className="mt-4 flex gap-2 rounded-lg bg-primary/10 p-3 text-sm text-ink">
                    <Icon name="arrow_forward" className="text-base" />
                    <span>
                      <span className="block text-xs font-semibold text-muted">What to do next</span>
                      Finish each sanction and upload your proof in My violations. The SDO verifies it.
                    </span>
                  </div>
                ) : null}
              </Card>
            </div>
          );
        }}
      </Resource>
    </>
  );
}

function SlipDocument({ slip }: { slip: ClearanceSlipView }) {
  const name = `${slip.student.firstName} ${slip.student.lastName}`;
  return (
    <article aria-label="Clearance slip" className="mx-auto max-w-2xl rounded-lg border border-line bg-white p-8 print:max-w-none print:rounded-none print:border-0 print:p-0">
      <header className="border-b border-line pb-4 text-center">
        <p className="text-xs font-semibold tracking-widest text-muted uppercase">NU Fairview</p>
        <h2 className="text-xl font-bold text-ink">Student Discipline Office</h2>
        <p className="mt-1 text-lg font-semibold text-ink">Clearance slip</p>
        <p className="text-sm text-muted">{formatTerm(slip.academicYear, slip.semester)}</p>
      </header>
      <dl className="mt-4 grid grid-cols-[8rem_1fr] gap-y-2 text-sm">
        <dt className="text-muted">Name</dt>
        <dd className="font-medium text-ink">{name}</dd>
        <dt className="text-muted">Student ID</dt>
        <dd className="font-medium text-ink">{slip.student.studentId}</dd>
        <dt className="text-muted">Program</dt>
        <dd className="text-ink">{slip.student.program}</dd>
        <dt className="text-muted">Cleared on</dt>
        <dd className="text-ink">{slip.clearedOn ? formatDate(slip.clearedOn) : '—'}</dd>
      </dl>
      <h3 className="mt-6 text-xs font-semibold tracking-wide text-muted uppercase">Requirements</h3>
      <ul className="mt-2 divide-y divide-line border-y border-line">
        {slip.items.map((item) => (
          <li key={item.label} className="flex items-center justify-between gap-3 py-2 text-sm">
            <span className="text-ink">{item.label}</span>
            <span className="text-muted">{item.dateCompleted ? `Completed ${formatDate(item.dateCompleted)}` : 'Completed'}</span>
          </li>
        ))}
      </ul>
      <p className="mt-6 text-center text-sm font-semibold text-success">CLEARED</p>
      <p className="mt-6 text-xs text-muted">This slip is generated by the SDO Portal. Present it at the SDO office when asked.</p>
    </article>
  );
}

/** A print-styled slip: the browser saves it as a PDF. The API refuses until every requirement is done. */
export function ClearanceSlipPage() {
  const { state } = useAuth();
  const params = new URLSearchParams(window.location.search);
  const year = Number(params.get('academic_year'));
  const semester = Number(params.get('semester'));
  const valid = Number.isInteger(year) && year > 2000 && semester >= 1 && semester <= 3;
  const slip = useApi(() => (valid ? api.myClearanceSlip(year, semester) : Promise.reject(new Error('Choose a term from the Clearance page.'))), [year, semester]);
  if (state.status !== 'authenticated') return null;

  return (
    <>
      <div className="print:hidden">
        <PageHeader
          title="Clearance slip"
          actions={
            slip.status === 'ready' ? (
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex min-h-11 items-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-white hover:bg-primary-active"
              >
                <Icon name="print" className="text-base" />
                Print or save as PDF
              </button>
            ) : undefined
          }
        />
        <p className="mb-3 text-sm">
          <Link to="/clearance" className="font-medium text-primary underline">
            Back to clearance
          </Link>
        </p>
      </div>
      {slip.status === 'loading' ? <LoadingState label="Preparing your slip…" cards={1} /> : null}
      {slip.status === 'error' ? <ErrorState message={slip.error.message} onRetry={slip.reload} /> : null}
      {slip.status === 'ready' ? <SlipDocument slip={slip.data.slip} /> : null}
    </>
  );
}
