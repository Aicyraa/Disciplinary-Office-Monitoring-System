import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useToast } from '@/components/feedback';
import { PageError, Spinner } from '@/components/feedback/PageState';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { Icon } from '@/components/ui/Icon';
import { SectionLabel } from '@/components/ui/SectionLabel';
import { StudentLookup } from '@/components/ui/StudentLookup';
import { Textarea } from '@/components/ui/Textarea';
import { api, toApiError } from '@/api/client';
import { useApi } from '@/hooks/useApi';
import { STUDENT_ID, useStudentLookup } from '@/hooks/useStudentLookup';
import { cn } from '@/utils/cn';
import { matchViolations, recordedToast, recordHelp, recordProblem, violationCounts, type ClassFilter } from '@/utils/recordForm';

const CLASSES: Array<{ value: ClassFilter; label: string }> = [
  { value: '', label: 'All' },
  { value: 'Minor', label: 'Minor' },
  { value: 'Major', label: 'Major' },
];

/** Staff Record violation (deck W33 to W35): one card, three numbered sections, help line and Save case. */
export function RecordViolationPage() {
  const toast = useToast();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const handbook = useApi(() => api.handbook(), []);
  const [studentId, setStudentId] = useState(STUDENT_ID.test(params.get('student') ?? '') ? (params.get('student') as string) : '');
  const [query, setQuery] = useState('');
  const [cls, setCls] = useState<ClassFilter>('');
  const [picked, setPicked] = useState<number | null>(null);
  const [remarks, setRemarks] = useState('');
  const [tried, setTried] = useState(false);
  const [saving, setSaving] = useState(false);
  const { lookup, profile } = useStudentLookup(studentId);

  const progress = { studentFound: profile !== null, violationPicked: picked !== null };
  const help = recordHelp(progress);
  // "No student found" already shows under the field; otherwise a failed save marks the ID itself.
  const idError = tried && !profile && lookup.status !== 'not_found' ? 'Enter a valid student ID, e.g. 2025-1234567.' : undefined;

  async function save() {
    const problem = recordProblem(progress);
    if (problem || picked === null || !profile) {
      setTried(true);
      toast.show(problem ?? 'Enter a valid student ID before saving.', 'error');
      return;
    }
    setSaving(true);
    try {
      const result = await api.recordViolation(profile.studentId, picked, remarks.trim());
      const created = await api.staffCase(result.caseId).catch(() => null);
      const code = created?.case.code ?? 'The case';
      toast.show(recordedToast(code, `${profile.firstName} ${profile.lastName}`, result.conversions.length > 0), 'success');
      navigate(`/cases/${result.caseId}?queue=all`);
    } catch (error) {
      toast.show(toApiError(error).message, 'error');
      setSaving(false);
    }
  }

  return (
    <>
      <h1 className="sr-only">Record violation</h1>
      <section className="flex min-h-[calc(100vh-128px)] flex-col gap-[22px] rounded-xl border border-line bg-white p-6">
        <div className="flex flex-col gap-3">
          <SectionLabel index={1}>Student</SectionLabel>
          <div className="max-w-md">
            <StudentLookup
              label="Student ID"
              placeholder="e.g. 2025-1234567"
              value={studentId}
              onChange={setStudentId}
              lookup={lookup}
              error={idError}
              autoComplete="off"
            />
          </div>
        </div>

        <div className="flex flex-1 flex-col gap-3">
          <SectionLabel index={2}>Violation</SectionLabel>
          <div className="flex flex-1 flex-col">
            <p className="mb-1.5 text-[13px] font-semibold text-ink">
              Violation <span className="font-normal text-muted">(from the handbook)</span>
            </p>
            {handbook.status === 'loading' ? (
              <p role="status" className="flex items-center gap-2 rounded-lg border border-line-strong px-3 py-6 text-[13px] text-muted">
                <Spinner />
                Loading the handbook…
              </p>
            ) : null}
            {handbook.status === 'error' ? <PageError page="the handbook" detail={handbook.error.message} onRetry={handbook.reload} /> : null}
            {handbook.status === 'ready' ? (
              <>
                <div className="flex flex-col gap-2.5 rounded-t-lg border border-line-strong bg-surface-2 p-2.5">
                  <label className="relative block">
                    <span className="sr-only">Filter violations</span>
                    <Icon name="search" className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 !text-xl text-muted-2" />
                    <input
                      type="search"
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      placeholder="Search violation or section"
                      className="block min-h-11 w-full rounded-lg border border-line-strong bg-white py-2 pr-3 pl-[38px] text-[13px] text-ink outline-none placeholder:text-muted-2 focus:border-primary rail:min-h-10"
                    />
                  </label>
                  <div role="tablist" aria-label="Classification" className="flex flex-wrap gap-2">
                    {CLASSES.map((option) => (
                      <Chip
                        key={option.label}
                        role="tab"
                        selected={cls === option.value}
                        count={violationCounts(handbook.data.entries, query)[option.value]}
                        onClick={() => setCls(option.value)}
                        className="min-h-11 px-3 rail:min-h-8"
                      >
                        {option.label}
                      </Chip>
                    ))}
                  </div>
                </div>
                <div role="listbox" aria-label="Violations" className="flex min-h-60 flex-[1_1_240px] flex-col gap-1 overflow-y-auto rounded-b-lg border border-t-0 border-line-strong p-1.5">
                  {matchViolations(handbook.data.entries, query, cls).map((entry) => {
                    const selected = picked === entry.id;
                    return (
                      <button
                        key={entry.id}
                        type="button"
                        role="option"
                        aria-selected={selected}
                        onClick={() => setPicked(entry.id)}
                        className={cn(
                          'flex min-h-11 w-full items-center gap-2.5 rounded-md border px-2.5 py-1.5 text-left text-[13px] text-body outline-none hover:bg-row-hover focus-visible:ring-2 focus-visible:ring-primary rail:min-h-10',
                          selected ? 'border-primary bg-row-selected' : 'border-transparent bg-surface-2',
                        )}
                      >
                        <Icon name={selected ? 'radio_button_checked' : 'radio_button_unchecked'} className={cn('!text-lg', selected ? 'text-primary' : 'text-muted-2')} />
                        <span className="min-w-0 flex-1">
                          <strong className="font-semibold text-ink">{entry.violation}</strong>{' '}
                          <span className="text-muted">
                            · {entry.severity} · Sec. {entry.section}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                  {matchViolations(handbook.data.entries, query, cls).length === 0 ? (
                    <p className="px-3 py-6 text-center text-[13px] text-muted">No violation matches that search.</p>
                  ) : null}
                </div>
              </>
            ) : null}
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <SectionLabel index={3}>Remarks</SectionLabel>
          <Textarea
            label="Remarks for the student"
            rows={3}
            maxLength={1000}
            placeholder="e.g. Report to the SDO for validation within 3 days."
            value={remarks}
            onChange={(event) => setRemarks(event.target.value)}
          />
        </div>

        <div className="flex justify-end border-t border-line-soft pt-[18px]">
          <div className="flex flex-row-reverse flex-wrap items-center gap-2.5">
            <Button size="lg" busy={saving} onClick={() => void save()}>
              Save case
            </Button>
            <Button variant="secondary" size="lg" onClick={() => navigate('/cases')} disabled={saving}>
              Cancel
            </Button>
            <span role="status" className={cn('text-[13px] font-semibold', tried && (!progress.studentFound || !progress.violationPicked) ? 'text-danger' : 'text-muted')}>
              {help}
            </span>
          </div>
        </div>
      </section>
    </>
  );
}
