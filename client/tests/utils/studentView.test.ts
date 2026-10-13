import { describe, expect, test } from 'vitest';
import type { StudentCaseDetailView, StudentCaseView, StudentSanctionView } from '@shared/types';
import {
  caseNextStep,
  caseTag,
  classTiles,
  dueLine,
  escalationText,
  latestRemark,
  proofSummary,
  sanctionChips,
  sanctionHistoryItems,
  sanctionNextStep,
  statusChips,
  uploadPanel,
  violationBase,
} from '@/utils/studentView';

const TODAY = '2026-10-09';

const c = (over: Partial<StudentCaseView>): StudentCaseView => ({
  id: 1,
  code: 'SDO-2026-001',
  status: 'validated',
  caseDate: '2026-10-01T02:00:00.000Z',
  violation: 'Improper uniform',
  severity: 'Minor',
  section: 'VI.D.1',
  handbookEntryId: 1,
  isEscalated: false,
  convertedFrom: null,
  resolvedWithoutSanction: false,
  dateResolved: null,
  ...over,
});

const s = (over: Partial<StudentSanctionView>): StudentSanctionView =>
  ({
    id: 21,
    caseId: 1,
    caseCode: 'SDO-2026-016',
    sanctionId: 21,
    sanctionCode: 'S-021',
    type: 'Violation slip',
    description: '',
    severity: 'Minor',
    status: 'assigned',
    dateAssigned: '2026-10-02T02:00:00.000Z',
    dueDate: '2026-10-16',
    dateSubmitted: null,
    dateCompleted: null,
    staffNote: null,
    complianceNote: null,
    assignedBy: 'Andrea Reyes',
    history: [],
    files: [],
    lateByDays: 0,
    canUpload: true,
    canChangeFiles: true,
    ...over,
  }) as StudentSanctionView;

describe('My violations (deck W62 to W64, src 2950 to 2986, D14)', () => {
  const cases = [
    c({ id: 1, status: 'reported' }),
    c({ id: 2, status: 'for_sanction', severity: 'Major' }),
    c({ id: 3, status: 'resolved' }),
    c({ id: 4, status: 'rejected' }),
  ];

  test('active cases only, unless resolved ones are asked for', () => {
    expect(violationBase(cases, false).map((x) => x.id)).toEqual([1, 2]);
    expect(violationBase(cases, true).map((x) => x.id)).toEqual([3, 4]);
  });

  test('class tiles and status chips count what is shown', () => {
    const base = violationBase(cases, false);
    expect(classTiles(base, false).map((t) => [t.label, t.count])).toEqual([
      ['All active cases', 2],
      ['Minor', 1],
      ['Major', 1],
    ]);
    expect(classTiles(violationBase(cases, true), true)[0].label).toBe('All resolved cases');
    expect(statusChips(base).map((x) => [x.label, x.count])).toEqual([
      ['All', 2],
      ['Pending review', 1],
      ['Validated', 0],
      ['Sanction in progress', 1],
    ]);
  });

  test('tags: Treated as Major on a converted case, Escalated on a counted minor', () => {
    expect(caseTag(c({ convertedFrom: 'No ID' }))).toBe('Treated as Major');
    expect(caseTag(c({ isEscalated: true }))).toBe('Escalated');
    expect(caseTag(c({}))).toBeNull();
  });

  test('escalation text names the linked cases', () => {
    const detail = (over: Partial<StudentCaseDetailView>) => ({ linkedCaseCodes: [], countedTowardCode: null, ...over }) as StudentCaseDetailView;
    expect(escalationText(detail({ linkedCaseCodes: ['SDO-2026-003', 'SDO-2026-007'] }))).toBe(
      'This was your 3rd minor violation, so it is treated as a Major offense (Sec. VI.E.20). The handbook still lists it as Minor. Linked cases: SDO-2026-003, SDO-2026-007.',
    );
    expect(escalationText(detail({ countedTowardCode: 'SDO-2025-042' }))).toBe('This minor violation counted toward SDO-2025-042, which is treated as Major.');
    expect(escalationText(detail({}))).toBeNull();
  });

  test('next step only when the student must act', () => {
    expect(caseNextStep(s({ status: 'assigned' }))).toBe('Complete sanction S-021, then upload your proof below as a PDF file.');
    expect(caseNextStep(s({ status: 'returned' }))).toBe('Complete sanction S-021, then upload your proof below as a PDF file.');
    expect(caseNextStep(s({ status: 'pending_verification' }))).toBeNull();
    expect(caseNextStep(undefined)).toBeNull();
  });
});

describe('upload panel (src 2442 to 2459, UI-POLISH-SPEC 5.15)', () => {
  test('open: upload title, sanction line, submit label; returned adds the reason', () => {
    expect(uploadPanel(s({}))).toMatchObject({
      title: 'Upload proof of completion',
      sub: 'Sanction S-021 · Violation slip',
      open: true,
      returned: null,
      submitLabel: 'Submit for verification',
    });
    expect(uploadPanel(s({ status: 'returned', staffNote: 'Missing signature.' }))).toMatchObject({
      returned: 'Returned by the SDO: Missing signature.',
      submitLabel: 'Resubmit for verification',
    });
  });

  test('sent: reviewing, changeable or locked; verified is closed', () => {
    expect(uploadPanel(s({ status: 'pending_verification', canUpload: false, canChangeFiles: true }))).toMatchObject({
      title: 'Submitted proof',
      sub: 'Sanction S-021 · The SDO is reviewing your files.',
      note: { icon: 'info', text: 'You can replace or remove files until the SDO verifies them.' },
    });
    expect(
      uploadPanel(s({ status: 'pending_verification', canUpload: false, canChangeFiles: false, dateSubmitted: '2026-10-07T06:28:00.000Z' })).note,
    ).toEqual({ icon: 'lock', text: 'Submitted Oct 7, 2:28 PM. You can upload again only if the SDO returns it.' });
    expect(uploadPanel(s({ status: 'completed', canUpload: false, canChangeFiles: false }))).toMatchObject({
      sub: 'Verified by the SDO.',
      note: { icon: 'lock', text: 'This sanction is verified. Uploads are closed.' },
    });
  });
});

describe('My sanctions (deck W65 to W67, src 2988 to 3017)', () => {
  test('chips: All, In progress (assigned and returned), Pending verification, Cleared', () => {
    const list = [s({ status: 'assigned' }), s({ status: 'returned' }), s({ status: 'pending_verification' }), s({ status: 'completed' })];
    expect(sanctionChips(list).map((x) => [x.label, x.count])).toEqual([
      ['All', 4],
      ['In progress', 2],
      ['Pending verification', 1],
      ['Cleared', 1],
    ]);
  });

  test('due line: days left, due today, overdue in red, verified in green', () => {
    expect(dueLine(s({}), TODAY)).toEqual({ text: 'Due October 16, 2026 · 7 days left', tone: 'info' });
    expect(dueLine(s({ dueDate: '2026-10-09' }), TODAY)).toEqual({ text: 'Due October 9, 2026 · Due today', tone: 'bad' });
    expect(dueLine(s({ dueDate: '2026-10-07' }), TODAY)).toEqual({ text: 'Due October 7, 2026 · Overdue by 2 days', tone: 'bad' });
    expect(dueLine(s({ status: 'completed' }), TODAY)).toEqual({ text: 'Verified', tone: 'done' });
  });

  test('next step texts and the proof line', () => {
    expect(sanctionNextStep(s({}))).toBe(
      'Complete this sanction, then upload your proof (PDF) from the case in My Violations. The SDO reviews it and updates the status.',
    );
    expect(sanctionNextStep(s({ status: 'returned' }))).toBe(
      'The SDO returned this sanction. Fix what they asked for and upload your proof again from the case in My Violations.',
    );
    expect(sanctionNextStep(s({ status: 'pending_verification' }))).toBe('The SDO is reviewing the proof you uploaded. Nothing to do right now.');
    expect(sanctionNextStep(s({ status: 'completed' }))).toBeNull();
    const file = (n: number) => ({ id: n, name: `p${n}.pdf`, mimeType: 'application/pdf', sizeBytes: 10, dateUploaded: '2026-10-07T06:28:00.000Z' });
    expect(proofSummary(s({}))).toBe('Not submitted yet');
    expect(proofSummary(s({ files: [file(1), file(2)] }))).toBe('2 files submitted · Oct 7');
  });

  test('timeline sentences, newest first', () => {
    const items = sanctionHistoryItems(
      s({
        history: [
          { eventType: 'assigned', remarks: null, by: 'staff', date: '2026-10-02T02:00:00.000Z' },
          { eventType: 'proof_uploaded', remarks: null, by: 'student', date: '2026-10-03T02:00:00.000Z' },
          { eventType: 'returned', remarks: 'Missing signature.', by: 'staff', date: '2026-10-04T02:00:00.000Z' },
          { eventType: 'verified', remarks: null, by: 'staff', date: '2026-10-05T02:00:00.000Z' },
        ],
      }),
    );
    expect(items.map((i) => [i.text, i.by])).toEqual([
      ['Verified by the SDO', 'SDO staff'],
      ['Returned by the SDO: Missing signature.', 'SDO staff'],
      ['Proof uploaded', 'You'],
      ['Sanction assigned', 'SDO staff'],
    ]);
  });
});

describe('latestRemark', () => {
  test('the newest remark, or null', () => {
    expect(latestRemark([{ eventType: 'remark', statusAfter: null, remarks: 'A', date: 'x' }, { eventType: 'remark', statusAfter: null, remarks: 'B', date: 'y' }])).toBe('B');
    expect(latestRemark([])).toBeNull();
  });
});
