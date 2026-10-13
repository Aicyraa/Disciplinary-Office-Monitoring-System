import { useMemo, useState, type FormEvent } from 'react';
import type { HandbookEntryView, Severity } from '@shared/types';
import { useToast } from '@/components/feedback';
import { buttonClass, fieldClass } from '@/components/ui';
import { api, toApiError } from '@/api/client';
import { formProblem, offenseSlots, toPicks, toSanctionList, type ViolationFormValues } from '@/utils/handbookForm';

export interface SanctionChoice {
  sanctionId: number;
  label: string;
}

/**
 * Create or edit one violation (SPEC 4.9). The API enforces every rule again; the category is locked in the
 * form for a violation that cases already use, because changing it would change how minors are counted.
 */
export function ViolationForm({
  entry,
  choices,
  onSaved,
  onCancel,
}: {
  entry?: HandbookEntryView;
  choices: SanctionChoice[];
  onSaved: () => void;
  onCancel: () => void;
}) {
  const initial = useMemo<ViolationFormValues>(
    () => ({
      violationType: entry?.violation ?? '',
      severity: entry?.severity ?? 'Minor',
      section: entry?.section ?? '',
      description: entry?.description ?? '',
      picks: entry ? toPicks(entry) : { 1: [] },
    }),
    [entry],
  );
  const toast = useToast();
  const [values, setValues] = useState<ViolationFormValues>(initial);
  const dirty = JSON.stringify(values) !== JSON.stringify(initial);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const used = entry?.usedInCases ?? 0;
  const idBase = `violation-${entry?.id ?? 'new'}`;

  const set = <K extends keyof ViolationFormValues>(key: K, value: ViolationFormValues[K]) =>
    setValues((current) => ({ ...current, [key]: value }));

  function toggle(offense: number, sanctionId: number) {
    setValues((current) => {
      const chosen = current.picks[offense] ?? [];
      const next = chosen.includes(sanctionId) ? chosen.filter((id) => id !== sanctionId) : [...chosen, sanctionId];
      return { ...current, picks: { ...current.picks, [offense]: next } };
    });
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const problem = formProblem(values);
    if (problem) {
      setError(problem);
      return;
    }
    setBusy(true);
    setError(null);
    const body = {
      violationType: values.violationType.trim(),
      severity: values.severity,
      section: values.section.trim(),
      description: values.description.trim(),
      sanctions: toSanctionList(values.picks),
    };
    try {
      if (entry) {
        // Only send the category when it changed: an unchanged category is not a change.
        await api.updateViolation(entry.id, { ...body, severity: values.severity === entry.severity ? undefined : values.severity });
      } else {
        await api.createViolation(body);
      }
      toast.show(entry ? 'Violation saved.' : 'Violation added.', 'success');
      onSaved();
    } catch (caught) {
      setError(toApiError(caught).message);
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="rounded-lg border border-line bg-white p-4">
      <p className="text-xs text-muted">{entry ? 'Edit violation' : 'New violation'}</p>
      <h3 className="text-lg font-bold text-ink">{entry ? entry.violation : 'Add violation'}</h3>
      {entry ? (
        <p className="mt-1 text-xs text-muted">
          {entry.severity} offense · Sec. {entry.section} · Used in {used} case{used === 1 ? '' : 's'}. Renaming never breaks them.
        </p>
      ) : null}

      <label htmlFor={`${idBase}-name`} className="mt-3 block text-sm font-medium text-ink">
        Violation name
      </label>
      <input
        id={`${idBase}-name`}
        className={`${fieldClass} mt-1 min-h-11`}
        maxLength={200}
        value={values.violationType}
        onChange={(event) => set('violationType', event.target.value)}
      />

      <div className="mt-3 flex flex-wrap gap-3">
        <div>
          <label htmlFor={`${idBase}-severity`} className="block text-sm font-medium text-ink">
            Category
          </label>
          <select
            id={`${idBase}-severity`}
            className={`${fieldClass} mt-1`}
            value={values.severity}
            disabled={used > 0}
            onChange={(event) => set('severity', event.target.value as Severity)}
          >
            <option value="Minor">Minor</option>
            <option value="Major">Major</option>
          </select>
          {used > 0 ? <p className="mt-1 text-xs text-muted">Locked: cases use this violation.</p> : null}
        </div>
        <div className="min-w-40 flex-1">
          <label htmlFor={`${idBase}-section`} className="block text-sm font-medium text-ink">
            Handbook section
          </label>
          <input
            id={`${idBase}-section`}
            className={`${fieldClass} mt-1`}
            placeholder="VI.D.1"
            maxLength={50}
            value={values.section}
            onChange={(event) => set('section', event.target.value)}
          />
        </div>
      </div>

      <label htmlFor={`${idBase}-desc`} className="mt-3 block text-sm font-medium text-ink">
        Description
      </label>
      <textarea
        id={`${idBase}-desc`}
        className={`${fieldClass} mt-1 min-h-20`}
        maxLength={2000}
        value={values.description}
        onChange={(event) => set('description', event.target.value)}
      />

      <fieldset className="mt-3">
        <legend className="text-sm font-medium text-ink">Sanctions the handbook allows, by offense</legend>
        <div className="mt-1 space-y-2">
          {offenseSlots(values.picks).map((offense) => (
            <div key={offense} className="rounded-md bg-white p-2">
              <div className="text-xs font-semibold text-muted">Offense {offense}</div>
              <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
                {choices.map((choice) => {
                  const inputId = `${idBase}-o${offense}-s${choice.sanctionId}`;
                  return (
                    <label key={choice.sanctionId} htmlFor={inputId} className="flex items-center gap-1 text-sm">
                      <input
                        id={inputId}
                        type="checkbox"
                        checked={(values.picks[offense] ?? []).includes(choice.sanctionId)}
                        onChange={() => toggle(offense, choice.sanctionId)}
                      />
                      {choice.label}
                    </label>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </fieldset>

      {error ? (
        <p role="alert" className="mt-2 text-sm font-medium text-danger">
          {error}
        </p>
      ) : null}
      <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
        {dirty ? <span className="mr-auto text-xs font-semibold text-[#7A4600]">Unsaved changes</span> : null}
        <button
          type="button"
          onClick={() => {
            if (entry) {
              setValues(initial);
              setError(null);
            } else {
              onCancel();
            }
          }}
          disabled={busy || (entry !== undefined && !dirty)}
          className="inline-flex min-h-11 items-center rounded-md border border-line-strong bg-white px-4 text-sm font-medium text-ink hover:bg-page disabled:opacity-50"
        >
          {entry ? 'Discard' : 'Cancel'}
        </button>
        <button type="submit" disabled={busy || (entry !== undefined && !dirty)} className={`${buttonClass} min-h-11`}>
          {busy ? 'Saving…' : entry ? (dirty ? 'Save changes' : 'Saved') : 'Add violation'}
        </button>
      </div>
    </form>
  );
}
