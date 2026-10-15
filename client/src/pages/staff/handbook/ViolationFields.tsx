import { useState } from 'react';
import type { Severity } from '@shared/types';
import { controlVariants } from '@/components/ui/FieldShell';
import { Field } from '@/components/ui/Field';
import { Icon } from '@/components/ui/Icon';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { cn } from '@/utils/cn';
import { offenseLabel, offenseSlots, type ViolationFormErrors, type ViolationFormValues } from '@/utils/handbookForm';

export interface SanctionChoice {
  sanctionId: number;
  label: string;
}

/** The state of the violation form and its sanction slots; the editor and the Add violation dialog share it. */
export function useViolationForm(initial: ViolationFormValues) {
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState<ViolationFormErrors>({});

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

  return { values, setValues, errors, setErrors, set, setSlot, addSlot, dropSlot };
}

export type ViolationForm = ReturnType<typeof useViolationForm>;

/**
 * The fields of one violation (deck W45, W46; src 1717 to 1739): name, category, section, wording, and one select
 * per offense with "Add another sanction" because the handbook allows several (D13). The category is locked once
 * cases use the violation (`used`), because changing it would change how minors are counted.
 */
export function ViolationFields({ form, choices, used }: { form: ViolationForm; choices: SanctionChoice[]; used: number }) {
  const { values, errors, set, setSlot, addSlot, dropSlot } = form;
  return (
    <div className="flex flex-col gap-[18px]">
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
    </div>
  );
}
