import { invalid, valid, type Validated } from '../helpers/validation.js';

export interface TermQuery {
  year: number | undefined;
  semester: number | undefined;
}

/** `?academic_year=YYYY&semester=1..3`; a malformed value reads as undefined. */
export function readTermQuery(query: Record<string, unknown>): TermQuery {
  const { academic_year: yearParam, semester: semesterParam } = query;
  return {
    year: typeof yearParam === 'string' && /^\d{4}$/.test(yearParam) ? Number(yearParam) : undefined,
    semester: typeof semesterParam === 'string' && /^[1-3]$/.test(semesterParam) ? Number(semesterParam) : undefined,
  };
}

/** `/me/clearance`: both term parts together, or neither (then the newest term is used). */
export function parseOptionalTermQuery(query: Record<string, unknown>): Validated<TermQuery> {
  if (query.academic_year === undefined && query.semester === undefined) return valid({ year: undefined, semester: undefined });
  const term = readTermQuery(query);
  if (term.year === undefined || term.semester === undefined) {
    return invalid('academic_year (YYYY) and semester (1-3) are required together.');
  }
  return valid(term);
}

/** `/me/clearance/slip`: the term is required. */
export function parseRequiredTermQuery(query: Record<string, unknown>): Validated<{ year: number; semester: number }> {
  const { year, semester } = readTermQuery(query);
  if (year === undefined || semester === undefined) return invalid('academic_year (YYYY) and semester (1-3) are required.');
  return valid({ year, semester });
}
