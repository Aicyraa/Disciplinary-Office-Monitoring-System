import { describe, expect, test } from 'vitest';
import type { StaffCaseDetail, StaffSanctionView, StaffTimelineEntry } from '@shared/types';
import { availableActions, escalationNote, historyItems, latestRemark, sanctionFooter, sourceText } from '@/utils/caseWorkspace';

const detail = (over: Partial<StaffCaseDetail> = {}): StaffCaseDetail => ({
  id: 16,
  code: 'SDO-2026-016',
  status: 'reported',
  severity: 'Minor',
  violation: 'No ID',
  section: 'VI.D.2',
  caseDate: '2026-10-08T02:00:00.000Z',
  source: 'gate',
  student: { id: '2023-1001230', name: 'Juan Dela Cruz' },
  claimed: null,
  submissionRef: 'ref-a',
  submissionCode: 'GI-1042',
  isEscalated: false,
  convertedFrom: null,
  sanction: null,
  dateResolved: null,
  resolvedWithoutSanction: false,
  timeline: [],
  createdFromCaseIds: [],
  countedTowardCaseId: null,
  siblingCaseIds: [],
  caseCodes: { '16': 'SDO-2026-016' },
  sanctions: [],
  ...over,
});

const sanction = (over: Partial<StaffSanctionView> = {}): StaffSanctionView => ({
  id: 1,
  sanctionCode: 'S-019',
  type: 'Community service',
  status: 'pending_verification',
  dueDate: '2026-10-20',
  dateSubmitted: null,
  dateCompleted: null,
  staffNote: null,
  complianceNote: null,
  lateByDays: 0,
  files: [],
  ...over,
});

const entry = (over: Partial<StaffTimelineEntry>): StaffTimelineEntry => ({
  eventType: 'remark',
  statusAfter: null,
  remarks: null,
  date: '2026-10-09T02:00:00.000Z',
  by: 'Sam Reyes',
  ...over,
});

describe('availableActions (the API enforces the same rules)', () => {
  test('a reported, matched gate case can be validated or rejected', () => {
    expect(availableActions(detail())).toEqual(['validate', 'reject']);
  });
  test('an unmatched report must be linked first; it can still be rejected, never validated', () => {
    expect(availableActions(detail({ student: null }))).toEqual(['link_student', 'reject']);
  });
  test('a reported case without a submission offers nothing', () => {
    expect(availableActions(detail({ submissionRef: null }))).toEqual([]);
  });
  test('validated: assign or resolve without a sanction', () => {
    expect(availableActions(detail({ status: 'validated' }))).toEqual(['assign_sanction', 'resolve_without_sanction']);
  });
  test('for_sanction resolves only when every sanction is completed', () => {
    expect(availableActions(detail({ status: 'for_sanction', sanctions: [sanction()] }))).toEqual(['assign_sanction']);
    expect(availableActions(detail({ status: 'for_sanction', sanctions: [sanction({ status: 'completed' })] }))).toEqual([
      'assign_sanction',
      'resolve',
    ]);
  });
});

describe('sourceText and escalationNote (deck src 2751, 2760)', () => {
  test('gate or staff report', () => {
    expect(sourceText(detail())).toBe('Gate report GI-1042');
    expect(sourceText(detail({ source: 'staff', submissionCode: null }))).toBe('Staff report');
  });
  test('a counted minor and a converted Major get the amber note; others none', () => {
    expect(escalationNote(detail({ isEscalated: true, countedTowardCaseId: 20, caseCodes: { '20': 'SDO-2026-020' } }))).toBe(
      'Flagged as escalated. This minor counted toward SDO-2026-020. Handbook severity stays Minor.',
    );
    expect(
      escalationNote(
        detail({ severity: 'Major', convertedFrom: 'No ID', createdFromCaseIds: [3, 7], caseCodes: { '3': 'SDO-2026-003', '7': 'SDO-2026-007' } }),
      ),
    ).toBe('Treated as Major as the 3rd minor violation (Sec. VI.E.20). Linked cases: SDO-2026-003, SDO-2026-007.');
    expect(escalationNote(detail())).toBeNull();
  });
});

describe('historyItems: sentences from the event data, newest first (src 2662 to 2744)', () => {
  test('each event reads as a sentence with its staff name', () => {
    const items = historyItems(
      detail({
        timeline: [
          entry({ eventType: 'reported', statusAfter: 'reported', by: 'System', date: '2026-10-08T02:00:00.000Z' }),
          entry({ eventType: 'validated', statusAfter: 'validated' }),
          entry({ eventType: 'sanction_assigned', statusAfter: 'for_sanction', remarks: 'Community service, due 2026-10-20.' }),
          entry({ eventType: 'remark', remarks: 'Bring the signed form.' }),
          entry({ eventType: 'resolved', statusAfter: 'resolved' }),
        ],
      }),
    );
    expect(items.map((i) => i.text)).toEqual([
      'Case resolved',
      'Remarks updated: Bring the signed form.',
      'Sanction assigned: Community service, due 2026-10-20.',
      'Report GI-1042 validated. Identity checked by staff.',
      'Reported through gate intake GI-1042',
    ]);
    expect(items[0]).toMatchObject({ date: 'Oct 9, 2026', by: 'Sam Reyes' });
    expect(items.at(-1)?.by).toBeUndefined();
  });

  test('reject, resolve without a sanction, staff record and escalation events', () => {
    const texts = historyItems(
      detail({
        source: 'staff',
        submissionCode: null,
        timeline: [
          entry({ eventType: 'validated', statusAfter: 'validated', remarks: 'Recorded by staff.' }),
          entry({ eventType: 'escalated', remarks: 'Treated as Major: 3rd minor violation. Linked cases SDO-2026-003.' }),
          entry({ eventType: 'rejected', statusAfter: 'rejected', remarks: 'ID did not match.' }),
          entry({ eventType: 'resolved', statusAfter: 'resolved', remarks: 'Verbal reminder.' }),
        ],
      }),
    ).map((i) => i.text);
    expect(texts).toEqual([
      'Case resolved with no sanction: Verbal reminder.',
      'Submission not verified: ID did not match.',
      'Treated as Major: 3rd minor violation. Linked cases SDO-2026-003.',
      'Recorded by staff',
    ]);
  });

  test('latestRemark: the newest remark text, or null', () => {
    expect(latestRemark(detail({ timeline: [entry({ remarks: 'First' }), entry({ remarks: 'Second' })] }))).toBe('Second');
    expect(latestRemark(detail())).toBeNull();
  });
});

describe('sanctionFooter (src 2706 to 2714)', () => {
  const file = (viewed: boolean) => ({ id: 1, name: 'proof.pdf', mimeType: 'application/pdf', sizeBytes: 1000, dateUploaded: '2026-10-08T02:00:00.000Z', viewed });
  test('proof summary, the view hint, and Verify enabled only when every file was opened', () => {
    const footer = sanctionFooter(sanction({ files: [file(true), file(false)] }));
    expect(footer).toMatchObject({ proofSub: '1 of 2 viewed', needView: true, canVerify: false, noFilesText: null });
    expect(sanctionFooter(sanction({ files: [file(true)] }))).toMatchObject({ needView: false, canVerify: true });
  });
  test('no files: waiting while the student can upload; the note reads Returned or Instructions', () => {
    expect(sanctionFooter(sanction({ status: 'assigned', staffNote: 'Bring the form.' }))).toMatchObject({
      noFilesText: 'Waiting for the student to upload proof.',
      note: 'Instructions: Bring the form.',
      pending: false,
    });
    expect(sanctionFooter(sanction({ status: 'returned', staffNote: 'Missing signature.' })).note).toBe('Returned: Missing signature.');
    expect(sanctionFooter(sanction({ status: 'completed' })).noFilesText).toBe('No files were uploaded.');
    // Online proof only: with no uploaded file there is nothing to verify.
    expect(sanctionFooter(sanction()).canVerify).toBe(false);
  });
});

describe('sourceText for an unknown gate code', () => {
  test('falls back to "Gate report"', () => {
    expect(sourceText(detail({ submissionCode: null }))).toBe('Gate report');
  });
});
