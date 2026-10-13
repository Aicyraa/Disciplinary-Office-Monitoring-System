import type { ComponentProps } from 'react';
import { Icon } from '@/components/ui';
import { Field } from './Field';

/** What the live lookup has found so far; the API owns the answer, this only shows it. */
export type LookupState =
  | { status: 'idle' }
  | { status: 'checking' }
  | { status: 'found'; summary: string }
  | { status: 'not_found' };

export type StudentLookupProps = Omit<ComponentProps<'input'>, 'value' | 'onChange' | 'size'> & {
  label: string;
  value: string;
  onChange: (value: string) => void;
  lookup: LookupState;
  error?: string;
};

/** Student ID input with the deck's live result line under it (green match, red "No student found"). */
export function StudentLookup({ label, value, onChange, lookup, error, ...rest }: StudentLookupProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <Field label={label} value={value} error={error} onChange={(event) => onChange(event.target.value)} {...rest} />
      <p aria-live="polite" className="min-h-5 text-[13px] font-semibold">
        {lookup.status === 'found' ? (
          <span className="flex items-center gap-1.5 text-success">
            <Icon name="person_check" className="!text-[18px]" />
            {lookup.summary}
          </span>
        ) : null}
        {lookup.status === 'not_found' ? (
          <span className="flex items-center gap-1.5 text-danger">
            <Icon name="error" className="!text-[18px]" />
            No student found with that ID.
          </span>
        ) : null}
        {lookup.status === 'checking' ? <span className="font-normal text-muted">Checking…</span> : null}
      </p>
    </div>
  );
}
