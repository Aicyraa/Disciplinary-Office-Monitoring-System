import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FormModal, useToast } from '@/components/feedback';
import { PageError, Spinner } from '@/components/feedback/PageState';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { Icon } from '@/components/ui/Icon';
import { StudentLookup } from '@/components/ui/StudentLookup';
import { Textarea } from '@/components/ui/Textarea';
import { toApiError } from '@/api/client';
import { casesApi } from '@/api/cases';
import { handbookApi } from '@/api/handbook';
import { useApi } from '@/hooks/useApi';
import { useStudentLookup } from '@/hooks/useStudentLookup';
import { cn } from '@/utils/cn';
import { matchViolations, recordedToast, recordProblem, violationCounts, type ClassFilter } from '@/utils/recordForm';

const CLASSES: Array<{ value: Exclude<ClassFilter, ''>; label: string }> = [
  { value: 'Minor', label: 'Minor' },
  { value: 'Major', label: 'Major' },
];

/**
 * Record violation, as a dialog over Cases: student ID lookup, the handbook violation picker (Minor / Major
 * tabs and a search) and remarks. The API still enforces every rule; staff reports are saved as validated.
 */
export function RecordViolationModal({ onClose }: { onClose: () => void }) {
  const toast = useToast();
  const navigate = useNavigate();
  const handbook = useApi(() => handbookApi.handbook(), []);
  const [studentId, setStudentId] = useState('');
  const [query, setQuery] = useState('');
  const [cls, setCls] = useState<Exclude<ClassFilter, ''>>('Minor');
  const [picked, setPicked] = useState<number | null>(null);
  const [remarks, setRemarks] = useState('');
  const [tried, setTried] = useState(false);
  const [saving, setSaving] = useState(false);
  const { lookup, profile } = useStudentLookup(studentId);

  const progress = { studentFound: profile !== null, violationPicked: picked !== null };
  // "No student found" already shows under the field; otherwise a blocked save marks the ID itself.
  const idError = tried && !profile && lookup.status !== 'not_found' ? 'Enter a valid student ID, e.g. 2025-1234567.' : undefined;
  const violationError = tried && picked === null ? 'Pick a violation from the handbook.' : undefined;

  async function save() {
    if (recordProblem(progress) || picked === null || !profile) {
      setTried(true);
      return;
    }
    setSaving(true);
    try {
      const result = await casesApi.recordViolation(profile.studentId, picked, remarks.trim());
      const created = await casesApi.staffCase(result.caseId).catch(() => null);
      const code = created?.case.code ?? 'The case';
      toast.show(recordedToast(code, `${profile.firstName} ${profile.lastName}`, result.conversions.length > 0), 'success');
      onClose();
      navigate(`/cases/${result.caseId}?queue=all`);
    } catch (error) {
      toast.show(toApiError(error).message, 'error');
      setSaving(false);
    }
  }

  const counts = handbook.status === 'ready' ? violationCounts(handbook.data.entries, query) : null;
  const shown = handbook.status === 'ready' ? matchViolations(handbook.data.entries, query, cls) : [];

  return (
    <FormModal
      open
      icon="add_circle"
      title="Record violation"
      subtitle="Staff reports are saved as validated cases."
      busy={saving}
      onClose={onClose}
      maxWidth="max-w-[600px]"
      footer={
        <>
          <Button variant="secondary" size="lg" disabled={saving} onClick={onClose}>
            Cancel
          </Button>
          <Button size="lg" busy={saving} onClick={() => void save()}>
            Save case
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <StudentLookup
          label="Student ID"
          placeholder="e.g. 2025-1234567"
          value={studentId}
          onChange={setStudentId}
          lookup={lookup}
          error={idError}
          autoComplete="off"
        />

        <div>
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
          {handbook.status === 'ready' && counts ? (
            <div className={cn('rounded-lg', violationError && 'ring-1 ring-danger-strong')}>
              <div className="flex flex-col gap-2.5 rounded-t-lg border border-line-strong bg-surface-2 p-2.5">
                <label className="relative block">
                  <span className="sr-only">Search violations</span>
                  <Icon name="search" className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 !text-xl text-muted-2" />
                  <input
                    type="search"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search violation or section"
                    className="block min-h-11 w-full rounded-lg border border-line-strong bg-white py-2 pr-3 pl-[38px] text-[13px] text-ink outline-none placeholder:text-muted-2 focus:border-primary"
                  />
                </label>
                <div role="tablist" aria-label="Classification" className="flex flex-wrap gap-2">
                  {CLASSES.map((option) => (
                    <Chip key={option.value} role="tab" selected={cls === option.value} count={counts[option.value]} onClick={() => setCls(option.value)} className="min-h-11 px-3 rail:min-h-9">
                      {option.label}
                    </Chip>
                  ))}
                </div>
              </div>
              <div role="listbox" aria-label="Violations" className="flex max-h-60 min-h-40 flex-col gap-1 overflow-y-auto rounded-b-lg border border-t-0 border-line-strong p-1.5">
                {shown.map((entry) => {
                  const selected = picked === entry.id;
                  return (
                    <button
                      key={entry.id}
                      type="button"
                      role="option"
                      aria-selected={selected}
                      onClick={() => setPicked(entry.id)}
                      className={cn(
                        'flex min-h-11 w-full items-center gap-2.5 rounded-md border px-2.5 py-1.5 text-left text-[13px] text-body outline-none hover:bg-row-hover focus-visible:ring-2 focus-visible:ring-primary',
                        selected ? 'border-primary bg-row-selected' : 'border-transparent bg-surface-2',
                      )}
                    >
                      <Icon name={selected ? 'radio_button_checked' : 'radio_button_unchecked'} className={cn('!text-lg', selected ? 'text-primary' : 'text-muted-2')} />
                      <span className="min-w-0 flex-1">
                        <strong className="font-semibold text-ink">{entry.violation}</strong> <span className="text-muted">· Sec. {entry.section}</span>
                      </span>
                    </button>
                  );
                })}
                {shown.length === 0 ? <p className="px-3 py-6 text-center text-[13px] text-muted">No violation matches that search.</p> : null}
              </div>
            </div>
          ) : null}
          {violationError ? (
            <p role="alert" className="mt-1.5 flex items-center gap-1.5 text-[13px] font-semibold text-danger-strong">
              <Icon name="error" className="!text-[18px]" />
              {violationError}
            </p>
          ) : null}
        </div>

        <Textarea
          label="Remarks for the student (optional)"
          rows={3}
          maxLength={1000}
          placeholder="e.g. Report to the SDO for validation within 3 days."
          value={remarks}
          onChange={(event) => setRemarks(event.target.value)}
        />
      </div>
    </FormModal>
  );
}
