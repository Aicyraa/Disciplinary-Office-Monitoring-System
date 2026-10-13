import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { HandbookEntryView, Severity } from '@shared/types';
import { useToast } from '@/components/feedback';
import { Button } from '@/components/ui/Button';
import { controlVariants } from '@/components/ui/FieldShell';
import { Field } from '@/components/ui/Field';
import { Icon } from '@/components/ui/Icon';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { api, toApiError } from '@/api/client';
import { cn } from '@/utils/cn';
import {
  formErrors,
  isDirty,
  offenseLabel,
  offenseSlots,
  toPicks,
  toSanctionList,
  type ViolationFormErrors,
  type ViolationFormValues,
} from '@/utils/handbookForm';

export interface SanctionChoice {
  sanctionId: number;
  label: string;
}

/**
 * Edit or add one violation (deck W45, W46; src 1717 to 1739). One select per offense, plus "Add another
 * sanction" because the handbook allows several (D13). The API enforces every rule again; the category is
 * locked once cases use the violation, because changing it would change how minors are counted.
 */
export function ViolationEditor({
  entry,
  entries,
  choices,
  onSaved,
}: {
  entry: HandbookEntryView | null;
  entries: HandbookEntryView[];
  choices: SanctionChoice[];
  onSaved: (id: number) => void;
}) {
  const toast = useToast();
  const navigate = useNavigate();
  const initial = useMemo<ViolationFormValues>(
    () => ({
      violationType: entry?.violation ?? '',
      severity: entry?.severity ?? 'Minor',
      section: entry?.section ?? '',
      description: entry?.description ?? '',
      picks: entry ? toPicks(entry) : {},
    }),
    [entry],
  );
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState<ViolationFormErrors>({});
  const [busy, setBusy] = useState(false);
  const dirty = isDirty(values, initial);
  const used = entry?.usedInCases ?? 0;
  const isNew = entry === null;

  const set = <K extends keyof ViolationFormValues>(key: K, value: ViolationFormValues[K], error?: keyof ViolationFormErrors) => {
    setValues((current) => ({ ...current, [key]: value }));
    if (error) setErrors((current) => ({ ...current, [error]: undefined }));
  };
  const setSlot = (offense: number, index: number, sanctionId: number) =>
    setValues((current) => {
      const slots = [...(current.picks[offense]?.length ? current.picks[offense] : [0])];
      slots[index] = sanctionId;
      return { ...current, picks: { ...current.picks, [offense]: slots } };
    });
  const addSlot = (offense: number) =>
    setValues((current) => ({ ...current, picks: { ...current.picks, [offense]: [...(current.picks[offense]?.length ? current.picks[offense] : [0]), 0] } }));
  const dropSlot = (offense: number, index: number) =>
    setValues((current) => ({ ...current, picks: { ...current.picks, [offense]: (current.picks[offense] ?? []).filter((_, i) => i !== index) } }));

  async function save() {
    const found = formErrors(values, entries, entry?.id ?? null);
    if (Object.keys(found).length > 0) {
      setErrors(found);
      return;
    }
    setBusy(true);
    const name = values.violationType.trim();
    const body = {
      violationType: name,
      severity: values.severity,
      section: values.section.trim().replace(/^Sec\.?\s*/i, ''),
      description: values.description.trim(),
      sanctions: toSanctionList(values.picks),
    };
    try {
      if (entry) {
        // An unchanged category is not sent: the API refuses a category change once cases use the violation.
        await api.updateViolation(entry.id, { ...body, severity: values.severity === entry.severity ? undefined : values.severity });
        toast.show(`Saved changes to ${name}.`, 'success');
        onSaved(entry.id);
      } else {
        const { handbookEntryId } = await api.createViolation(body);
        toast.show(`Added ${name} to the handbook.`, 'success');
        onSaved(handbookEntryId);
      }
    } catch (caught) {
      const failure = toApiError(caught);
      if (failure.code === 'violation_exists') setErrors({ name: 'This violation is already in the handbook.' });
      else toast.show(failure.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-label={isNew ? 'New violation' : `Edit ${entry.violation}`} className="flex flex-col gap-[18px] rounded-xl border border-line bg-white p-6">
      <div>
        <p className="text-[13px] font-semibold text-muted">{isNew ? 'New violation' : 'Edit violation'}</p>
        <h2 className="mt-0.5 text-[22px] leading-tight font-bold text-ink">{isNew ? values.violationType.trim() || 'Add a violation' : entry.violation}</h2>
        {entry ? (
          <p className="mt-0.5 text-[13px] text-muted">
            {entry.severity} offense · Sec. {entry.section} · Used in {used} case{used === 1 ? '' : 's'}
          </p>
        ) : null}
      </div>

      <Field
        label="Violation name"
        placeholder="e.g. Improper uniform"
        maxLength={200}
        value={values.violationType}
        error={errors.name}
        onChange={(event) => set('violationType', event.target.value, 'name')}
      />
      <div className="flex flex-wrap gap-3">
        <div className="min-w-0 flex-[1_1_140px]">
          <Select
            label="Category"
            value={values.severity}
            disabled={used > 0}
            hint={used > 0 ? `Locked: ${used} case${used === 1 ? '' : 's'} use this violation.` : undefined}
            onChange={(event) => set('severity', event.target.value as Severity)}
          >
            <option value="Minor">Minor</option>
            <option value="Major">Major</option>
          </Select>
        </div>
        <div className="min-w-0 flex-[1_1_140px]">
          <Field
            label="Handbook section"
            placeholder="e.g. VI.D.9"
            maxLength={50}
            value={values.section}
            error={errors.section}
            onChange={(event) => set('section', event.target.value, 'section')}
          />
        </div>
      </div>
      <Textarea
        label="What the handbook says"
        rows={4}
        maxLength={2000}
        placeholder="The wording from the Student Handbook"
        value={values.description}
        error={errors.description}
        onChange={(event) => set('description', event.target.value, 'description')}
      />

      <div className="overflow-hidden rounded-xl border border-line">
        <div className="border-b border-line-soft bg-surface-2 px-4 py-3">
          <p className="text-sm font-bold text-ink">Sanction per offense</p>
          <p className="text-xs text-muted">Choose the sanction the handbook sets for each offense.</p>
        </div>
        {offenseSlots(values.picks).map((offense) => {
          const slots = values.picks[offense]?.length ? values.picks[offense] : [0];
          return (
            <div key={offense} className="-mb-px flex flex-wrap items-start gap-3 border-b border-line-soft px-4 py-3">
              <span className="flex min-h-11 flex-[0_0_110px] items-center text-[13px] font-bold text-info-ink">{offenseLabel(offense)}</span>
              <div className="flex min-w-0 flex-[1_1_220px] flex-col gap-2">
                {slots.map((sanctionId, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <span className="relative block min-w-0 flex-1">
                      <select
                        aria-label={`${offenseLabel(offense)}${index > 0 ? `, sanction ${index + 1}` : ''}`}
                        value={sanctionId}
                        onChange={(event) => setSlot(offense, index, Number(event.target.value))}
                        className={cn(controlVariants(), 'cursor-pointer appearance-none pr-9 font-medium')}
                      >
                        <option value={0}>No sanction</option>
                        {choices.map((choice) => (
                          <option key={choice.sanctionId} value={choice.sanctionId}>
                            {choice.label}
                          </option>
                        ))}
                      </select>
                      <Icon name="expand_more" className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-muted" />
                    </span>
                    {index > 0 ? (
                      <button
                        type="button"
                        aria-label={`Remove sanction ${index + 1} of the ${offenseLabel(offense)}`}
                        onClick={() => dropSlot(offense, index)}
                        className="grid size-11 shrink-0 place-items-center rounded-full text-muted outline-none hover:bg-danger-soft hover:text-danger focus-visible:ring-[3px] focus-visible:ring-danger/25"
                      >
                        <Icon name="close" className="!text-lg" />
                      </button>
                    ) : null}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => addSlot(offense)}
                  className="inline-flex min-h-9 items-center gap-1 self-start rounded-full px-2 text-[13px] font-semibold text-primary outline-none hover:bg-primary-tint focus-visible:ring-[3px] focus-visible:ring-primary/25"
                >
                  <Icon name="add" className="!text-lg" />
                  Add another sanction
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap justify-end gap-2">
        {isNew ? (
          <Button variant="neutral" size="lg" onClick={() => navigate('/handbook')} disabled={busy}>
            Cancel
          </Button>
        ) : dirty ? (
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
        <Button size="lg" busy={busy} disabled={!isNew && !dirty} onClick={() => void save()}>
          {isNew ? 'Add violation' : dirty ? 'Save changes' : 'Saved'}
        </Button>
      </div>
    </section>
  );
}
