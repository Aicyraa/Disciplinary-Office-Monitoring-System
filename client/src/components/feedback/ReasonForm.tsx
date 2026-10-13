import { useState, type FormEvent } from 'react';
import { buttonClass, fieldClass } from '@/components/ui';

interface ReasonFormProps {
  /** Heading above the field, for example "Reject this report". */
  title: string;
  label: string;
  submitLabel: string;
  /** Shown above the field, for example what the action will do. */
  description?: string;
  /** Throws or rejects with an Error whose message is shown. */
  onSubmit: (reason: string) => Promise<void>;
  onCancel: () => void;
  /** The reason is required (spec: confirm with a required reason). Defaults to true. */
  required?: boolean;
}

/** Inline confirm-with-reason form. The API checks the reason too; this only saves a round trip. */
export function ReasonForm({ title, label, submitLabel, description, onSubmit, onCancel, required = true }: ReasonFormProps) {
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handle(event: FormEvent) {
    event.preventDefault();
    const text = value.trim();
    if (required && text === '') {
      setError('Enter a reason.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onSubmit(text);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Something went wrong.');
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handle} className="mt-3 rounded-md border border-line-strong bg-page p-3" noValidate>
      <h3 className="text-sm font-semibold text-ink">{title}</h3>
      {description ? <p className="mt-1 text-sm text-muted">{description}</p> : null}
      <label className="mt-2 block text-sm font-medium text-ink">
        {label}
        <textarea
          className={`${fieldClass} mt-1 min-h-20`}
          value={value}
          maxLength={1000}
          onChange={(event) => setValue(event.target.value)}
        />
      </label>
      {error ? (
        <p role="alert" className="mt-1 text-sm font-medium text-danger">
          {error}
        </p>
      ) : null}
      <div className="mt-3 flex gap-2">
        <button type="submit" disabled={busy} className={buttonClass}>
          {busy ? 'Working…' : submitLabel}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          className="rounded-md border border-line-strong bg-white px-4 py-2 text-sm font-medium text-ink hover:bg-page"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
