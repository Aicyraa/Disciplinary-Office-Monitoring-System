import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { cn } from '@/utils/cn';
import { YEAR_PILLS, type GateFormValues } from '@/utils/gateForm';
import { detailsErrors, type DetailsErrors } from '@/validators/gateForm';
import { CardHeader, gateCard, gateNavButton, gateNavRow } from './GateCard';
import { GateInput, GateSelect } from './GateFields';

/** Step 1 (deck W08): student id, name, program, year level. Continue only when every field passes. */
export function DetailsStep({
  values,
  errors,
  programs,
  onChange,
  onErrors,
  onContinue,
}: {
  values: GateFormValues;
  errors: DetailsErrors;
  programs: string[];
  onChange: <K extends keyof GateFormValues>(key: K, value: GateFormValues[K]) => void;
  onErrors: (errors: DetailsErrors) => void;
  onContinue: () => void;
}) {
  return (
    <div className={gateCard}>
      <CardHeader
        title="Your details"
        subtitle="Enter your details as they appear on your school ID. The SDO uses them to match this report to your record."
      />
      <div className="flex flex-col gap-5">
        <GateInput
          label="Student ID"
          inputMode="numeric"
          autoComplete="off"
          placeholder="e.g. 2025-1234567"
          value={values.studentId}
          error={errors.studentId}
          onChange={(event) => onChange('studentId', event.target.value)}
        />
        <GateInput
          label="Full name"
          autoComplete="name"
          maxLength={100}
          placeholder="First and last name"
          value={values.name}
          error={errors.name}
          onChange={(event) => onChange('name', event.target.value)}
        />
        <GateSelect label="Program" value={values.program} error={errors.program} onChange={(event) => onChange('program', event.target.value)}>
          <option value="">Choose your program</option>
          {programs.map((program) => (
            <option key={program} value={program}>
              {program}
            </option>
          ))}
        </GateSelect>
        <GateSelect label="Year level" value={values.year} error={errors.year} onChange={(event) => onChange('year', event.target.value)}>
          <option value="">Choose your year level</option>
          {YEAR_PILLS.map((pill) => (
            <option key={pill.value} value={pill.value}>
              {pill.label} Year
            </option>
          ))}
        </GateSelect>
      </div>
      <div className={cn(gateNavRow, 'justify-end')}>
        <Button
          size="xl"
          className={gateNavButton}
          onClick={() => {
            const found = detailsErrors(values);
            onErrors(found);
            if (Object.keys(found).length === 0) onContinue();
          }}
        >
          Continue
          <Icon name="arrow_forward" className="!text-xl" />
        </Button>
      </div>
    </div>
  );
}
