import { describe, expect, test } from 'vitest';
import {
  parseCaseListQuery,
  parseLinkStudentBody,
  parseRecordViolationBody,
  parseSanctionQueueQuery,
  parseSubmissionRef,
} from '../../src/validators/cases.validators.js';

describe('case list query', () => {
  test('defaults to newest, page 1', () => {
    expect(parseCaseListQuery({})).toEqual({
      ok: true,
      value: { status: undefined, severity: undefined, q: undefined, sort: 'newest', group: undefined, page: 1, focus: undefined },
    });
  });

  test('rejects an unknown status, class, sort, group, page and focus', () => {
    for (const query of [
      { status: 'open' },
      { class: 'Severe' },
      { sort: 'random' },
      { group: 'class' },
      { page: '0' },
      { focus: 'abc' },
    ]) {
      expect(parseCaseListQuery(query).ok).toBe(false);
    }
  });

  test('truncates the search text to 100 characters', () => {
    const result = parseCaseListQuery({ q: 'x'.repeat(150) });
    expect(result.ok && result.value.q?.length).toBe(100);
  });
});

describe('sanction queue query', () => {
  test('defaults to active, page 1', () => {
    expect(parseSanctionQueueQuery({})).toEqual({ ok: true, value: { filter: 'active', page: 1 } });
  });

  test('rejects an unknown filter', () => {
    expect(parseSanctionQueueQuery({ filter: 'done' }).ok).toBe(false);
  });
});

describe('record violation body', () => {
  test('rejects a malformed student id or a non-positive handbook entry', () => {
    expect(parseRecordViolationBody({ studentId: '2025-123', handbookEntryId: 1 }).ok).toBe(false);
    expect(parseRecordViolationBody({ studentId: '2025-1234567', handbookEntryId: 0 }).ok).toBe(false);
    expect(parseRecordViolationBody(undefined).ok).toBe(false);
  });

  test('trims the student id', () => {
    expect(parseRecordViolationBody({ studentId: ' 2025-1234567 ', handbookEntryId: 4 })).toEqual({
      ok: true,
      value: { studentId: '2025-1234567', handbookEntryId: 4 },
    });
  });
});

describe('link student body and submission ref', () => {
  test('student id must match YYYY-NNNNNNN', () => {
    expect(parseLinkStudentBody({ studentId: 'abc' }).ok).toBe(false);
    expect(parseLinkStudentBody({ studentId: '2025-1234567' }).ok).toBe(true);
  });

  test('a submission ref that is not a UUID is treated as not found', () => {
    expect(parseSubmissionRef('nope')).toBeNull();
    expect(parseSubmissionRef('3F2504E0-4F89-41D3-9A0C-0305E82C3301')).toBe('3f2504e0-4f89-41d3-9a0c-0305e82c3301');
  });
});
