import type { StaffCaseDetail } from '@shared/types';
import { EmptyBlock } from '@/components/ui/EmptyBlock';
import { ProofBlock } from './ProofBlock';

/** The case's "Files" tab: every sanction of the case with its status, the uploaded proof and the verify / return actions. */
export function CaseFilesTab({
  detail,
  done,
  failed,
  onViewed,
}: {
  detail: StaffCaseDetail;
  done: (toast: string) => void;
  failed: (error: unknown) => void;
  onViewed: () => void;
}) {
  const sanctions = [...detail.sanctions].sort((a, b) => a.id - b.id);
  if (sanctions.length === 0) {
    return (
      <EmptyBlock icon="folder_open" title="No sanctions yet">
        Proof files appear here once a sanction is assigned and the student uploads.
      </EmptyBlock>
    );
  }
  return (
    <div className="flex flex-col gap-4">
      {sanctions.map((sanction) => (
        <ProofBlock key={sanction.id} detail={detail} sanction={sanction} done={done} failed={failed} onViewed={onViewed} />
      ))}
    </div>
  );
}
