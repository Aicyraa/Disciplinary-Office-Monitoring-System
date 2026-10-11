import { beforeEach, describe, expect, test } from 'vitest';
import { createMemoryCaseStore, type MemoryCaseStore } from './memory-store.js';
import { createCaseService, type CaseService } from './service.js';
import type { CaseRecord } from './types.js';

const S1 = '2025-0000001';
const S2 = '2025-0000002';
const STAFF = 'E001';
const REF = '11111111-1111-4111-8111-111111111111';
const NOW = new Date('2026-10-12T02:00:00Z');

const HANDBOOK = [
  { handbookEntryId: 1, violationType: 'Improper uniform', severity: 'Minor' as const, isSystem: false },
  { handbookEntryId: 2, violationType: 'No ID', severity: 'Minor' as const, isSystem: false },
  { handbookEntryId: 3, violationType: 'Cheating', severity: 'Major' as const, isSystem: false },
  { handbookEntryId: 68, violationType: '3 minor offense', severity: 'Major' as const, isSystem: true },
];

let store: MemoryCaseStore;
let service: CaseService;

function seedCase(overrides: Partial<CaseRecord> & { caseId: number }): CaseRecord {
  const record: CaseRecord = {
    caseDate: new Date(Date.UTC(2026, 8, overrides.caseId, 2)),
    status: 'reported',
    severity: 'Minor',
    isEscalated: false,
    studentId: S1,
    handbookEntryId: 1,
    originalHandbookEntryId: null,
    source: 'gate',
    reportedByEmployeeId: null,
    claimedStudentId: S1,
    claimedName: 'Ana Cruz',
    submissionRef: null,
    resolvedWithoutSanction: false,
    dateResolved: null,
    ...overrides,
  };
  store.state.cases.push(record);
  store.state.nextCaseId = Math.max(store.state.nextCaseId, record.caseId + 1);
  return record;
}

beforeEach(() => {
  store = createMemoryCaseStore({ students: new Set([S1, S2]), handbook: HANDBOOK.map((h) => ({ ...h })) });
  service = createCaseService({ store, now: () => NOW });
});

const find = (caseId: number) => store.state.cases.find((c) => c.caseId === caseId) as CaseRecord;
const historyOf = (caseId: number) => store.state.history.filter((h) => h.caseId === caseId);
const keys = () => store.state.notifications.map((n) => n.idempotencyKey);

describe('recordViolation', () => {
  test('creates a validated staff case with a timeline entry and a notification', async () => {
    const result = await service.recordViolation({ employeeId: STAFF, studentId: S1, handbookEntryId: 1 });
    expect(result).toMatchObject({ ok: true, caseId: 1, conversions: [] });
    expect(find(1)).toMatchObject({ status: 'validated', source: 'staff', reportedByEmployeeId: STAFF, studentId: S1 });
    expect(historyOf(1)).toEqual([
      expect.objectContaining({ eventType: 'validated', statusAfter: 'validated', employeeId: STAFF }),
    ]);
    expect(store.state.notifications).toEqual([
      expect.objectContaining({ studentId: S1, kind: 'newviol', caseId: 1, idempotencyKey: 'case:1:recorded' }),
    ]);
  });

  test('rejects an unknown student, an unknown violation and a system-only violation', async () => {
    expect(await service.recordViolation({ employeeId: STAFF, studentId: '2025-9999999', handbookEntryId: 1 })).toMatchObject({
      ok: false,
      code: 'student_not_found',
    });
    expect(await service.recordViolation({ employeeId: STAFF, studentId: S1, handbookEntryId: 999 })).toMatchObject({
      ok: false,
      code: 'violation_not_found',
    });
    expect(await service.recordViolation({ employeeId: STAFF, studentId: S1, handbookEntryId: 68 })).toMatchObject({
      ok: false,
      code: 'violation_not_allowed',
    });
    expect(store.state.cases).toHaveLength(0);
  });

  test('the third minor of any kind becomes the Major and the first two are flagged', async () => {
    await service.recordViolation({ employeeId: STAFF, studentId: S1, handbookEntryId: 1 });
    await service.recordViolation({ employeeId: STAFF, studentId: S1, handbookEntryId: 2 });
    const third = await service.recordViolation({ employeeId: STAFF, studentId: S1, handbookEntryId: 1 });

    expect(third).toMatchObject({ ok: true, caseId: 3, conversions: [{ majorCaseId: 3, minorCaseIds: [1, 2] }] });
    // No fourth case is created: 2 flagged minors + 1 converted Major.
    expect(store.state.cases).toHaveLength(3);
    expect(find(3)).toMatchObject({ handbookEntryId: 68, originalHandbookEntryId: 1, isEscalated: false });
    expect(find(1).isEscalated).toBe(true);
    expect(find(2).isEscalated).toBe(true);
    expect(store.state.escalations).toEqual([
      { majorCaseId: 3, minorCaseId: 1 },
      { majorCaseId: 3, minorCaseId: 2 },
    ]);
  });

  test('writes timeline entries on all three cases and notifies the student once', async () => {
    for (const handbookEntryId of [1, 2, 1]) {
      await service.recordViolation({ employeeId: STAFF, studentId: S1, handbookEntryId });
    }
    expect(historyOf(3).map((h) => h.eventType)).toEqual(['validated', 'escalated']);
    expect(historyOf(3)[1].remarks).toBe('Treated as Major: 3rd minor violation. Linked cases C001 and C002.');
    expect(historyOf(1).map((h) => h.eventType)).toEqual(['validated', 'flagged_escalated']);
    expect(historyOf(1)[1].remarks).toBe('Counted toward Major case C003.');
    expect(keys().filter((k) => k.startsWith('esc:'))).toEqual(['esc:3']);
  });

  test("another student's cases do not count", async () => {
    await service.recordViolation({ employeeId: STAFF, studentId: S1, handbookEntryId: 1 });
    await service.recordViolation({ employeeId: STAFF, studentId: S2, handbookEntryId: 1 });
    const third = await service.recordViolation({ employeeId: STAFF, studentId: S1, handbookEntryId: 2 });
    expect(third).toMatchObject({ ok: true, conversions: [] });
  });

  test('a recorded Major does not count toward the three minors', async () => {
    await service.recordViolation({ employeeId: STAFF, studentId: S1, handbookEntryId: 3 });
    await service.recordViolation({ employeeId: STAFF, studentId: S1, handbookEntryId: 1 });
    const third = await service.recordViolation({ employeeId: STAFF, studentId: S1, handbookEntryId: 2 });
    expect(third).toMatchObject({ ok: true, conversions: [] });
  });

  test('the counter restarts after a conversion', async () => {
    for (const handbookEntryId of [1, 2, 1, 2]) {
      await service.recordViolation({ employeeId: STAFF, studentId: S1, handbookEntryId });
    }
    expect(store.state.escalations).toHaveLength(2);
    expect(find(4)).toMatchObject({ handbookEntryId: 2, isEscalated: false });
  });

  test('is atomic: a failure while converting leaves no partial case, history or flags', async () => {
    await service.recordViolation({ employeeId: STAFF, studentId: S1, handbookEntryId: 1 });
    await service.recordViolation({ employeeId: STAFF, studentId: S1, handbookEntryId: 2 });
    const before = JSON.stringify([...store.state.cases, ...store.state.history, ...store.state.escalations]);

    store.failAfterWrites(5); // insert + history + notification + conversion update succeed, then it breaks
    await expect(service.recordViolation({ employeeId: STAFF, studentId: S1, handbookEntryId: 1 })).rejects.toThrow(
      /simulated failure/,
    );
    store.failAfterWrites(null);

    expect(JSON.stringify([...store.state.cases, ...store.state.history, ...store.state.escalations])).toBe(before);
    expect(store.state.cases).toHaveLength(2);
  });

  test('fails loudly, rolling back, when the system H068 entry is missing', async () => {
    store.state.handbook = store.state.handbook.filter((h) => !h.isSystem);
    await service.recordViolation({ employeeId: STAFF, studentId: S1, handbookEntryId: 1 });
    await service.recordViolation({ employeeId: STAFF, studentId: S1, handbookEntryId: 2 });
    await expect(service.recordViolation({ employeeId: STAFF, studentId: S1, handbookEntryId: 1 })).rejects.toThrow(/H068/);
    expect(store.state.cases).toHaveLength(2);
  });
});

describe('validateSubmission', () => {
  beforeEach(() => {
    seedCase({ caseId: 1, submissionRef: REF });
    seedCase({ caseId: 2, submissionRef: REF, handbookEntryId: 2 });
  });

  test('validates every case in the submission, with history and notifications', async () => {
    const result = await service.validateSubmission({ employeeId: STAFF, submissionRef: REF });
    expect(result).toMatchObject({ ok: true, caseIds: [1, 2], conversions: [] });
    expect(find(1).status).toBe('validated');
    expect(find(2).status).toBe('validated');
    expect(historyOf(1)).toEqual([expect.objectContaining({ eventType: 'validated', employeeId: STAFF })]);
    expect(keys()).toEqual(['case:1:validated', 'case:2:validated']);
  });

  test('cannot validate a second time', async () => {
    await service.validateSubmission({ employeeId: STAFF, submissionRef: REF });
    expect(await service.validateSubmission({ employeeId: STAFF, submissionRef: REF })).toMatchObject({
      ok: false,
      code: 'already_decided',
    });
    expect(keys()).toHaveLength(2);
  });

  test('cannot validate without a matched student: nothing changes', async () => {
    find(1).studentId = null;
    find(2).studentId = null;
    expect(await service.validateSubmission({ employeeId: STAFF, submissionRef: REF })).toMatchObject({
      ok: false,
      code: 'student_not_matched',
    });
    expect(find(1).status).toBe('reported');
  });

  test('an unknown reference is not_found', async () => {
    expect(await service.validateSubmission({ employeeId: STAFF, submissionRef: '22222222-2222-4222-8222-222222222222' })).toMatchObject({
      ok: false,
      code: 'not_found',
    });
  });

  test('validating the submission that holds the 3rd minor converts it', async () => {
    seedCase({ caseId: 9, status: 'validated', studentId: S1 }); // earlier minor already counted
    const result = await service.validateSubmission({ employeeId: STAFF, submissionRef: REF });
    // counted minors by date: C001 (day 1), C002 (day 2), C009 (day 9) -> C009 converts
    expect(result).toMatchObject({ ok: true, conversions: [{ majorCaseId: 9, minorCaseIds: [1, 2] }] });
    expect(find(9)).toMatchObject({ handbookEntryId: 68, originalHandbookEntryId: 1 });
  });

  test('a five-case submission with two prior minors makes one group and leaves the rest waiting', async () => {
    seedCase({ caseId: 3, submissionRef: REF });
    seedCase({ caseId: 4, submissionRef: REF });
    seedCase({ caseId: 5, submissionRef: REF });
    const result = await service.validateSubmission({ employeeId: STAFF, submissionRef: REF });
    expect(result).toMatchObject({ ok: true });
    if (result.ok) expect(result.conversions).toEqual([{ majorCaseId: 3, minorCaseIds: [1, 2] }]);
  });
});

describe('previewEscalation', () => {
  beforeEach(() => {
    seedCase({ caseId: 1, status: 'validated' });
    seedCase({ caseId: 2, status: 'validated', handbookEntryId: 2 });
    seedCase({ caseId: 3, submissionRef: REF });
  });

  test('says which case would convert, and changes nothing', async () => {
    const snapshot = JSON.stringify(store.state.cases);
    expect(await service.previewEscalation(REF)).toEqual({
      ok: true,
      conversions: [{ majorCaseId: 3, minorCaseIds: [1, 2] }],
    });
    expect(JSON.stringify(store.state.cases)).toBe(snapshot);
    expect(store.state.history).toEqual([]);
  });

  test('is empty when the submission does not reach the threshold', async () => {
    find(2).status = 'rejected';
    expect(await service.previewEscalation(REF)).toEqual({ ok: true, conversions: [] });
  });

  test('refuses a submission that was already decided', async () => {
    find(3).status = 'validated';
    expect(await service.previewEscalation(REF)).toMatchObject({ ok: false, code: 'already_decided' });
  });
});

describe('rejectSubmission', () => {
  beforeEach(() => {
    seedCase({ caseId: 1, submissionRef: REF });
    seedCase({ caseId: 2, submissionRef: REF });
  });

  test('rejects every case with the reason in the timeline and notifies the student', async () => {
    const result = await service.rejectSubmission({ employeeId: STAFF, submissionRef: REF, reason: '  Wrong person  ' });
    expect(result).toMatchObject({ ok: true, caseIds: [1, 2] });
    expect(find(1).status).toBe('rejected');
    expect(historyOf(2)[0]).toMatchObject({ eventType: 'rejected', remarks: 'Wrong person', employeeId: STAFF });
    expect(keys()).toEqual(['case:1:rejected', 'case:2:rejected']);
  });

  test.each([undefined, '', '   ', 5, 'x'.repeat(1001)])('requires a usable reason (%s)', async (reason) => {
    expect(await service.rejectSubmission({ employeeId: STAFF, submissionRef: REF, reason })).toMatchObject({
      ok: false,
      code: 'invalid_input',
    });
    expect(find(1).status).toBe('reported');
  });

  test('can reject an unmatched report and sends no notification (no student)', async () => {
    find(1).studentId = null;
    find(2).studentId = null;
    const result = await service.rejectSubmission({ employeeId: STAFF, submissionRef: REF, reason: 'Unknown ID' });
    expect(result.ok).toBe(true);
    expect(store.state.notifications).toEqual([]);
  });

  test('cannot reject something already validated', async () => {
    find(1).status = 'validated';
    expect(await service.rejectSubmission({ employeeId: STAFF, submissionRef: REF, reason: 'x' })).toMatchObject({
      ok: false,
      code: 'already_decided',
    });
  });
});

describe('linkStudent', () => {
  beforeEach(() => {
    seedCase({ caseId: 1, submissionRef: REF, studentId: null, claimedStudentId: '2025-0000009' });
    seedCase({ caseId: 2, submissionRef: REF, studentId: null, claimedStudentId: '2025-0000009', handbookEntryId: 2 });
  });

  test('links every unmatched case in the submission and logs a remark', async () => {
    const result = await service.linkStudent({ employeeId: STAFF, caseId: 1, studentId: S2 });
    expect(result).toMatchObject({ ok: true, caseIds: [1, 2] });
    expect(find(1).studentId).toBe(S2);
    expect(find(2).studentId).toBe(S2);
    expect(historyOf(1)[0]).toMatchObject({ eventType: 'remark', employeeId: STAFF });
  });

  test('rejects an unknown student, an already-linked case and a decided case', async () => {
    expect(await service.linkStudent({ employeeId: STAFF, caseId: 1, studentId: '2025-9999999' })).toMatchObject({
      code: 'student_not_found',
    });
    await service.linkStudent({ employeeId: STAFF, caseId: 1, studentId: S2 });
    expect(await service.linkStudent({ employeeId: STAFF, caseId: 1, studentId: S1 })).toMatchObject({
      code: 'student_already_linked',
    });
    seedCase({ caseId: 7, studentId: null, status: 'rejected', claimedStudentId: '2025-0000008' });
    expect(await service.linkStudent({ employeeId: STAFF, caseId: 7, studentId: S1 })).toMatchObject({ code: 'invalid_status' });
  });

  test('after linking, the submission can be validated', async () => {
    await service.linkStudent({ employeeId: STAFF, caseId: 1, studentId: S2 });
    expect(await service.validateSubmission({ employeeId: STAFF, submissionRef: REF })).toMatchObject({ ok: true });
  });
});

describe('resolveCase', () => {
  test('needs a for_sanction case with every sanction completed', async () => {
    seedCase({ caseId: 1, status: 'for_sanction' });
    store.state.sanctions.set(1, ['completed', 'pending_verification']);
    expect(await service.resolveCase({ employeeId: STAFF, caseId: 1 })).toMatchObject({ code: 'sanctions_incomplete' });

    store.state.sanctions.set(1, ['completed', 'completed']);
    expect(await service.resolveCase({ employeeId: STAFF, caseId: 1 })).toEqual({ ok: true });
    expect(find(1)).toMatchObject({ status: 'resolved', dateResolved: NOW, resolvedWithoutSanction: false });
    expect(keys()).toEqual(['case:1:resolved']);
  });

  test('a for_sanction case with no sanction rows cannot be resolved', async () => {
    seedCase({ caseId: 1, status: 'for_sanction' });
    expect(await service.resolveCase({ employeeId: STAFF, caseId: 1 })).toMatchObject({ code: 'sanctions_incomplete' });
  });

  test.each(['reported', 'validated', 'resolved', 'rejected'] as const)('is invalid from %s', async (status) => {
    seedCase({ caseId: 1, status });
    expect(await service.resolveCase({ employeeId: STAFF, caseId: 1 })).toMatchObject({ code: 'invalid_status' });
  });

  test('an unknown case is not_found', async () => {
    expect(await service.resolveCase({ employeeId: STAFF, caseId: 404 })).toMatchObject({ code: 'not_found' });
  });
});

describe('resolveWithoutSanction', () => {
  test('resolves a validated case with a reason and flags it', async () => {
    seedCase({ caseId: 1, status: 'validated' });
    expect(await service.resolveWithoutSanction({ employeeId: STAFF, caseId: 1, reason: 'Warning given' })).toEqual({ ok: true });
    expect(find(1)).toMatchObject({ status: 'resolved', resolvedWithoutSanction: true });
    expect(historyOf(1)[0]).toMatchObject({ eventType: 'resolved', remarks: 'Warning given' });
  });

  test('needs a reason', async () => {
    seedCase({ caseId: 1, status: 'validated' });
    expect(await service.resolveWithoutSanction({ employeeId: STAFF, caseId: 1, reason: ' ' })).toMatchObject({
      code: 'invalid_input',
    });
    expect(find(1).status).toBe('validated');
  });

  test.each(['reported', 'for_sanction', 'resolved', 'rejected'] as const)('is invalid from %s', async (status) => {
    seedCase({ caseId: 1, status });
    expect(await service.resolveWithoutSanction({ employeeId: STAFF, caseId: 1, reason: 'x' })).toMatchObject({
      code: 'invalid_status',
    });
  });
});

describe('addRemark', () => {
  test('appends a remark entry keeping the status, and notifies the student', async () => {
    seedCase({ caseId: 1, status: 'validated' });
    expect(await service.addRemark({ employeeId: STAFF, caseId: 1, remarks: ' Please visit Room 204 ' })).toEqual({ ok: true });
    expect(historyOf(1)[0]).toMatchObject({
      eventType: 'remark',
      statusAfter: 'validated',
      remarks: 'Please visit Room 204',
      employeeId: STAFF,
    });
    expect(store.state.notifications[0]).toMatchObject({ kind: 'case', studentId: S1 });
    expect(find(1).status).toBe('validated');
  });

  test('rejects an empty or oversized remark and an unknown case', async () => {
    seedCase({ caseId: 1, status: 'validated' });
    expect(await service.addRemark({ employeeId: STAFF, caseId: 1, remarks: '' })).toMatchObject({ code: 'invalid_input' });
    expect(await service.addRemark({ employeeId: STAFF, caseId: 1, remarks: 'x'.repeat(1001) })).toMatchObject({
      code: 'invalid_input',
    });
    expect(await service.addRemark({ employeeId: STAFF, caseId: 99, remarks: 'hi' })).toMatchObject({ code: 'not_found' });
  });
});
