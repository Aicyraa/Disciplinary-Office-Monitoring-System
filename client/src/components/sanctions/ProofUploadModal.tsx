import type { StudentSanctionView } from '@shared/types';
import { FormModal } from '@/components/feedback';
import { Button } from '@/components/ui/Button';
import { uploadPanel } from '@/utils/studentView';
import { ProofPanel } from './ProofPanel';

/** The proof upload dialog of one sanction: the existing proof panel inside the shared form modal. */
export function ProofUploadModal({
  sanction,
  handbookEntryId,
  onClose,
  onChanged,
}: {
  sanction: StudentSanctionView;
  handbookEntryId?: number;
  onClose: () => void;
  onChanged: () => void;
}) {
  const panel = uploadPanel(sanction);
  return (
    <FormModal
      open
      icon="upload_file"
      title={panel.open ? 'Upload proof' : 'Proof files'}
      subtitle={panel.sub}
      onClose={onClose}
      footer={
        <Button variant="neutral" size="lg" onClick={onClose}>
          Close
        </Button>
      }
    >
      <ProofPanel sanction={sanction} handbookEntryId={handbookEntryId} onChanged={onChanged} />
    </FormModal>
  );
}
