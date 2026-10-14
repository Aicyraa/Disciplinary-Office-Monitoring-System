import { useState } from 'react';
import type { HandbookEntryView } from '@shared/types';
import { FormModal, useToast } from '@/components/feedback';
import { Button } from '@/components/ui/Button';
import { api, toApiError } from '@/api/client';
import { formErrors, toSanctionList } from '@/utils/handbookForm';
import { ViolationFields, useViolationForm, type SanctionChoice } from './ViolationFields';

/** Add violation, as a dialog over the handbook list: name, category, section, wording and a sanction per offense. */
export function AddViolationModal({
  entries,
  choices,
  onClose,
  onAdded,
}: {
  entries: HandbookEntryView[];
  choices: SanctionChoice[];
  onClose: () => void;
  onAdded: (id: number) => void;
}) {
  const toast = useToast();
  const form = useViolationForm({ violationType: '', severity: 'Minor', section: '', description: '', picks: {} });
  const { values, setErrors } = form;
  const [busy, setBusy] = useState(false);

  async function save() {
    const found = formErrors(values, entries, null);
    if (Object.keys(found).length > 0) {
      setErrors(found);
      return;
    }
    setBusy(true);
    const name = values.violationType.trim();
    try {
      const { handbookEntryId } = await api.createViolation({
        violationType: name,
        severity: values.severity,
        section: values.section.trim().replace(/^Sec\.?\s*/i, ''),
        description: values.description.trim(),
        sanctions: toSanctionList(values.picks),
      });
      toast.show(`Added ${name} to the handbook.`, 'success');
      onAdded(handbookEntryId);
    } catch (caught) {
      const failure = toApiError(caught);
      if (failure.code === 'violation_exists') setErrors({ name: 'This violation is already in the handbook.' });
      else toast.show(failure.message, 'error');
      setBusy(false);
    }
  }

  return (
    <FormModal
      open
      icon="post_add"
      title="Add violation"
      subtitle="Adds an entry to the Student Handbook that staff can record."
      busy={busy}
      onClose={onClose}
      maxWidth="max-w-[640px]"
      footer={
        <>
          <Button variant="secondary" size="lg" disabled={busy} onClick={onClose}>
            Cancel
          </Button>
          <Button size="lg" busy={busy} onClick={() => void save()}>
            Add violation
          </Button>
        </>
      }
    >
      <ViolationFields form={form} choices={choices} used={0} />
    </FormModal>
  );
}
