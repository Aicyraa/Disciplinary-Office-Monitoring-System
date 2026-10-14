import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, test } from 'vitest';
import type { StudentSanctionView } from '@shared/types';
import { ProofPanel } from '@/components/sanctions/ProofPanel';
import { ProofUploadDialog } from '@/components/sanctions/ProofUploadDialog';
import { lastFileRemovalMessage } from '@/utils/files';

const base: StudentSanctionView = {
  id: 7,
  caseId: 1,
  caseCode: 'C001',
  sanctionId: 1,
  sanctionCode: 'S001',
  type: 'Violation Slip',
  description: 'x',
  severity: 'Minor',
  status: 'assigned',
  dateAssigned: '2026-10-01T02:00:00.000Z',
  dueDate: '2026-10-30',
  dateSubmitted: null,
  dateCompleted: null,
  staffNote: null,
  complianceNote: null,
  assignedBy: 'Officer One',
  history: [],
  files: [],
  lateByDays: 0,
  canUpload: true,
  canChangeFiles: false,
};

const file = (id: number) => ({
  id,
  name: `proof-${id}.pdf`,
  mimeType: 'application/pdf',
  sizeBytes: 2048,
  dateUploaded: '2026-10-03T02:00:00.000Z',
});

const render = (sanction: StudentSanctionView) =>
  renderToStaticMarkup(
    <MemoryRouter>
      <ProofPanel sanction={sanction} onChanged={() => {}} />
    </MemoryRouter>,
  );

const renderDialog = (selected: File[] = []) =>
  renderToStaticMarkup(
    <ProofUploadDialog
      open
      inputId="proof-7"
      title="Upload proof of completion"
      subtitle="Sanction S001 · Violation Slip"
      submitLabel="Submit for verification"
      selected={selected}
      existingCount={0}
      error={null}
      busy={false}
      percent={null}
      onPick={() => {}}
      onRemove={() => {}}
      onPreview={() => {}}
      onSubmit={() => {}}
      onClose={() => {}}
    />,
  );

describe('ProofPanel', () => {
  test('an assigned sanction shows an Upload proof button, not the drop area', () => {
    const html = render(base);
    expect(html).toContain('Upload proof of completion');
    expect(html).toContain('Sanction S001 · Violation Slip');
    expect(html).toContain('Upload proof');
    expect(html).not.toContain('Choose files to upload');
    expect(html).not.toContain('role="dialog"');
    expect(html).not.toContain('Replace');
  });

  test('the dialog has the labelled multi-file input, the limits and a hoverable keyboard-operable drop area', () => {
    const html = renderDialog();
    expect(html).toContain('role="dialog"');
    expect(html).toContain('multiple');
    expect(html).toContain('accept=".pdf,application/pdf"');
    expect(html).toContain('Choose files to upload');
    expect(html).toContain('PDF only, up to 10 MB each, 5 files max');
    expect(html).toMatch(/<div role="button" tabindex="0"[^>]*hover:border-primary/);
    expect(html).toContain('border-dashed');
    expect(html).toMatch(/<input id="proof-7"[^>]*tabindex="-1"/);
  });

  test('the dialog submit waits for a file: "Add a file to submit", disabled', () => {
    const html = renderDialog();
    expect(html).toMatch(/<button type="button" disabled=""(?:(?!<\/button>)[^])*>Add a file to submit<\/button>/);
    expect(html).not.toContain('Submit for verification');
  });

  test('the dialog lists chosen files as not submitted yet and offers the submit label', () => {
    const html = renderDialog([new File(['x'], 'slip.pdf', { type: 'application/pdf' })]);
    expect(html).toContain('slip.pdf');
    expect(html).toContain('Not submitted yet');
    expect(html).toContain('Submit for verification');
  });

  test('no progress bar before an upload starts', () => {
    expect(render(base)).not.toContain('role="progressbar"');
  });

  test('a returned sanction offers a new upload', () => {
    const html = render({ ...base, status: 'returned', canUpload: true, canChangeFiles: true, files: [file(1)] });
    expect(html).toContain('Upload new proof');
  });

  test('pending and unreviewed: lists files with Replace and Remove, no new upload', () => {
    const html = render({ ...base, status: 'pending_verification', canUpload: false, canChangeFiles: true, files: [file(1), file(2)] });
    expect(html).toContain('proof-1.pdf');
    expect(html).toContain('Replace');
    expect(html).toContain('Remove');
    expect(html).not.toContain('Submit proof');
  });

  test('pending with files: each file row has View, Replace and a labelled remove (the last-file rule explains on click)', () => {
    const html = render({ ...base, status: 'pending_verification', canUpload: false, canChangeFiles: true, files: [file(1)] });
    expect(html).toContain('>View<');
    expect(html).toContain('>Replace<');
    expect(html).toContain('aria-label="Remove proof-1.pdf"');
    expect(lastFileRemovalMessage('pending_verification', 1)).toBe(
      'Keep at least one file for the SDO to review. Use Replace to swap it for another file.',
    );
    expect(lastFileRemovalMessage('pending_verification', 2)).toBeNull();
    expect(lastFileRemovalMessage('returned', 1)).toBeNull();
  });

  test('pending and reviewed: read-only with an explanation', () => {
    const html = render({ ...base, status: 'pending_verification', canUpload: false, canChangeFiles: false, files: [file(1)] });
    expect(html).not.toContain('Replace');
    expect(html).not.toContain('Remove');
    expect(html).toContain('You can upload again only if the SDO returns it.');
  });

  test('returned: the reason in a red alert, then a new upload', () => {
    const html = render({ ...base, status: 'returned', staffNote: 'Missing signature.', canUpload: true, canChangeFiles: true, files: [file(1)] });
    expect(html).toContain('Returned by the SDO: Missing signature.');
    expect(html).toContain('Upload proof of completion');
  });

  test('verified: the sent proof with uploads closed', () => {
    const html = render({ ...base, status: 'completed', canUpload: false, files: [file(1)] });
    expect(html).toContain('Verified by the SDO.');
    expect(html).toContain('This sanction is verified. Uploads are closed.');
    expect(html).not.toContain('Upload proof</');
    expect(html).not.toContain('Upload new proof');
  });
});
