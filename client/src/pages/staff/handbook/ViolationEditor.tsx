import { useMemo, useState } from 'react';
import type { HandbookEntryView } from '@shared/types';
import { useToast } from '@/components/feedback';
import { Button } from '@/components/ui/Button';
import { toApiError } from '@/api/client';
import { handbookApi } from '@/api/handbook';
import { violationTitle } from '@/utils/format';
import { formErrors, isDirty, toPicks, toSanctionList, type ViolationFormValues } from '@/utils/handbookForm';
import { ViolationFields, useViolationForm, type SanctionChoice } from './ViolationFields';

export type { SanctionChoice };

/**
 * Edit one violation in the right-hand pane (deck W45). Adding a violation is a dialog (`AddViolationModal`) over
 * the same fields. The API enforces every rule again; an unchanged category is not sent.
 */
export function ViolationEditor({
  entry,
  entries,
  choices,
  onSaved,
}: {
  entry: HandbookEntryView;
  entries: HandbookEntryView[];
  choices: SanctionChoice[];
  onSaved: (id: number) => void;
}) {
  const toast = useToast();
  const initial = useMemo<ViolationFormValues>(
    () => ({
      violationType: entry.violation,
      severity: entry.severity,
      section: entry.section,
      description: entry.description,
      picks: toPicks(entry),
    }),
    [entry],
  );
  const form = useViolationForm(initial);
  const { values, setValues, setErrors } = form;
  const [busy, setBusy] = useState(false);
  const dirty = isDirty(values, initial);
  const used = entry.usedInCases ?? 0;

  async function save() {
    const found = formErrors(values, entries, entry.id);
    if (Object.keys(found).length > 0) {
      setErrors(found);
      return;
    }
    setBusy(true);
    const name = values.violationType.trim();
    try {
      // An unchanged category is not sent: the API refuses a category change once cases use the violation.
      await handbookApi.updateViolation(entry.id, {
        violationType: name,
        severity: values.severity === entry.severity ? undefined : values.severity,
        section: values.section.trim().replace(/^Sec\.?\s*/i, ''),
        description: values.description.trim(),
        sanctions: toSanctionList(values.picks),
      });
      toast.show(`Saved changes to ${name}.`, 'success');
      onSaved(entry.id);
    } catch (caught) {
      const failure = toApiError(caught);
      if (failure.code === 'violation_exists') setErrors({ name: 'This violation is already in the handbook.' });
      else toast.show(failure.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-label={`Edit ${violationTitle(entry.violation)}`} className="flex flex-col gap-[18px] rounded-xl border border-line bg-white p-6">
      <div>
        <p className="text-[13px] font-semibold text-muted">Edit violation</p>
        <h2 className="mt-0.5 text-[22px] leading-tight font-bold text-ink">{violationTitle(entry.violation)}</h2>
        <p className="mt-0.5 text-[13px] text-muted">
          {entry.severity} offense · Sec. {entry.section} · Used in {used} case{used === 1 ? '' : 's'}
        </p>
      </div>

      <ViolationFields form={form} choices={choices} used={used} />

      <div className="flex flex-wrap justify-end gap-2">
        {dirty ? (
          <Button
            variant="neutral"
            size="lg"
            disabled={busy}
            onClick={() => {
              setValues(initial);
              setErrors({});
            }}
          >
            Discard changes
          </Button>
        ) : null}
        <Button size="lg" busy={busy} disabled={!dirty} onClick={() => void save()}>
          {dirty ? 'Save changes' : 'Saved'}
        </Button>
      </div>
    </section>
  );
}
