import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, test } from 'vitest';
import type { StudentSanctionView } from '@shared/types';
import { ProofPanel } from '@/components/sanctions/ProofPanel';
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

describe('ProofPanel', () => {
  test('an assigned sanction offers a single-file upload with a labelled input and the limits', () => {
    const html = render(base);
    expect(html).not.toContain('multiple');
    expect(html).toContain('accept=".pdf,application/pdf"');
    expect(html).toContain('One PDF per sanction');
    expect(html).not.toContain('Replace');
  });

  test('the drop area is one hoverable, keyboard-operable container that says what to do', () => {
    const html = render(base);
    expect(html).toContain('Choose a file to upload');
    expect(html).toContain('Click to choose or drag your file here');
    expect(html).toContain('One PDF per sanction, up to 10 MB');
    expect(html).toMatch(/<div role="button" tabindex="0"[^>]*hover:border-primary/);
    expect(html).toContain('border-dashed');
  });

  test('the main button waits for a file: "Add a file to submit", disabled', () => {
    const html = render(base);
    expect(html).toMatch(/<button type="button" disabled=""(?:(?!<\/button>)[^])*>Add a file to submit<\/button>/);
    expect(html).not.toContain('Submit proof');
  });

  test('the hidden file input is not a keyboard tab stop (the drop area is)', () => {
    expect(render(base)).toMatch(/<input id="proof-7"[^>]*tabindex="-1"/);
  });

  test('no progress bar before an upload starts', () => {
    expect(render(base)).not.toContain('role="progressbar"');
  });

  test('a returned sanction still offers the drop area', () => {
    const html = render({ ...base, status: 'returned', canUpload: true, canChangeFiles: true, files: [file(1)] });
    expect(html).toContain('Choose a file to upload');
    expect(html).toContain('Add a file to submit');
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
  });

  test('verified: the sent proof with uploads closed', () => {
    const html = render({ ...base, status: 'completed', canUpload: false, files: [file(1)] });
    expect(html).toContain('This sanction is verified. Uploads are closed.');
    expect(html).not.toContain('Choose files to upload');
  });
});
