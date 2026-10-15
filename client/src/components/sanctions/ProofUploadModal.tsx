import type { StudentSanctionView } from '@shared/types';
import { FormModal } from '@/components/feedback';
import { uploadPanel } from '@/utils/studentView';
import { ProofPanel } from './ProofPanel';

/**
 * The proof upload dialog of one sanction: the proof panel inside the shared form modal. The icon chip in the
 * header links to the offense in the Handbook (tooltip on hover); the header's close button is the only Close.
 */
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
      iconLink={handbookEntryId === undefined ? undefined : { to: `/handbook/${handbookEntryId}`, tooltip: 'View this offense in the Handbook' }}
    >
      <ProofPanel sanction={sanction} onChanged={onChanged} />
    </FormModal>
  );
}
