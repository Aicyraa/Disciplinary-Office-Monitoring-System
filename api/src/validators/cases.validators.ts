import type { CaseStatus, Severity } from '@shared/types.js';
import { STUDENT_ID_PATTERN } from '../domain/auth/policy.js';
import { CASE_STATUSES } from '../domain/cases/status.js';
import { invalid, valid, type Validated } from '../helpers/validation.js';

const STATUSES = CASE_STATUSES;
const SEVERITIES: readonly Severity[] = ['Minor', 'Major'];
const SANCTION_FILTERS = ['active', 'pending_verification', 'overdue'] as const;
export type SanctionQueueFilter = (typeof SANCTION_FILTERS)[number];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface CaseListInput {
  status?: CaseStatus;
  severity?: Severity;
  q?: string;
  sort: 'newest' | 'oldest';
  group?: 'status';
  page: number;
  focus?: number;
}

export function parseCaseListQuery(query: Record<string, unknown>): Validated<CaseListInput> {
  const { status, class: severity, q, sort, page, group, focus } = query;
  if (group !== undefined && group !== 'status') return invalid('group must be status.');
  if (focus !== undefined && !(typeof focus === 'string' && /^[1-9]\d{0,9}$/.test(focus))) {
    return invalid('focus must be a case id.');
  }
  if (status !== undefined && !STATUSES.includes(status as CaseStatus)) return invalid('Unknown status.');
  if (severity !== undefined && !SEVERITIES.includes(severity as Severity)) return invalid('class must be Minor or Major.');
  if (sort !== undefined && sort !== 'newest' && sort !== 'oldest') return invalid('sort must be newest or oldest.');
  if (page !== undefined && !(typeof page === 'string' && /^[1-9]\d{0,5}$/.test(page))) {
    return invalid('page must be a positive whole number.');
  }
  return valid({
    status: status as CaseStatus | undefined,
    severity: severity as Severity | undefined,
    q: typeof q === 'string' ? q.slice(0, 100) : undefined,
    sort: sort === 'oldest' ? 'oldest' : 'newest',
    group: group === 'status' ? 'status' : undefined,
    page: page === undefined ? 1 : Number(page),
    focus: focus === undefined ? undefined : Number(focus),
  });
}

export function parseSanctionQueueQuery(
  query: Record<string, unknown>,
): Validated<{ filter: SanctionQueueFilter; page: number }> {
  const rawFilter = query.filter;
  const rawPage = query.page;
  const filter = rawFilter === undefined ? 'active' : rawFilter;
  if (!SANCTION_FILTERS.includes(filter as SanctionQueueFilter)) {
    return invalid('filter must be active, pending_verification or overdue.');
  }
  if (rawPage !== undefined && (typeof rawPage !== 'string' || !/^[1-9]\d{0,5}$/.test(rawPage))) {
    return invalid('page must be a positive number.');
  }
  return valid({ filter: filter as SanctionQueueFilter, page: rawPage === undefined ? 1 : Number(rawPage) });
}

const trimmedString = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

export function parseRecordViolationBody(body: unknown): Validated<{ studentId: string; handbookEntryId: number }> {
  const source = (body ?? {}) as Record<string, unknown>;
  const studentId = trimmedString(source.studentId);
  const handbookEntryId = source.handbookEntryId;
  if (!STUDENT_ID_PATTERN.test(studentId) || !Number.isInteger(handbookEntryId) || (handbookEntryId as number) < 1) {
    return invalid('studentId (YYYY-NNNNNNN) and handbookEntryId are required.');
  }
  return valid({ studentId, handbookEntryId: handbookEntryId as number });
}

export function parseLinkStudentBody(body: unknown): Validated<{ studentId: string }> {
  const studentId = trimmedString(((body ?? {}) as Record<string, unknown>).studentId);
  if (!STUDENT_ID_PATTERN.test(studentId)) return invalid('studentId must look like YYYY-NNNNNNN.');
  return valid({ studentId });
}

/** A submission reference is a UUID; anything else is "not found" rather than a validation error. */
export function parseSubmissionRef(value: unknown): string | null {
  const ref = String(value);
  return UUID.test(ref) ? ref.toLowerCase() : null;
}
