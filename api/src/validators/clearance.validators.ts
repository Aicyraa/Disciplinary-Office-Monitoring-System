import { invalid, valid, type Validated } from '../helpers/validation.js';
import { parsePage, parseSearchText } from './common.validators.js';

export interface TermParams {
  academicYear: number;
  semester: number;
}

/** `/clearances/terms/:year/:semester/students` (UI-POLISH-SPEC D3): a four-digit start year, term 1 to 3. */
export function parseRosterRequest(
  params: Record<string, unknown>,
  query: Record<string, unknown>,
): Validated<{ term: TermParams; q: string | undefined; page: number }> {
  const { year, semester } = params;
  if (!/^\d{4}$/.test(String(year)) || !/^[1-3]$/.test(String(semester))) {
    return invalid('The term is a four-digit start year and a term number from 1 to 3.');
  }
  const page = parsePage(query.page);
  if (!page.ok) return page;
  const q = parseSearchText(query.q);
  if (!q.ok) return q;
  return valid({ term: { academicYear: Number(year), semester: Number(semester) }, q: q.value, page: page.value });
}

/**
 * The term set-up body: both `academicYear` and `semester`, or neither (null: use the current term). The values
 * themselves are checked by the service (`checkTerm`), like the manual set-up.
 */
export function parseTermSetupBody(body: unknown): Validated<{ academicYear: unknown; semester: unknown } | null> {
  const { academicYear, semester } = (typeof body === 'object' && body !== null ? body : {}) as Record<string, unknown>;
  if (academicYear === undefined && semester === undefined) return valid(null);
  if (academicYear === undefined || semester === undefined) {
    return invalid('Send both academicYear and semester, or neither for the current term.');
  }
  return valid({ academicYear, semester });
}

export function parseClearanceListQuery(
  query: Record<string, unknown>,
): Validated<{ status: 'pending' | 'cleared' | undefined; q: string | undefined; page: number }> {
  const { status } = query;
  if (status !== undefined && status !== 'pending' && status !== 'cleared') {
    return invalid('status must be pending or cleared.');
  }
  const page = parsePage(query.page);
  if (!page.ok) return page;
  const q = parseSearchText(query.q);
  if (!q.ok) return q;
  return valid({ status: status as 'pending' | 'cleared' | undefined, q: q.value, page: page.value });
}
