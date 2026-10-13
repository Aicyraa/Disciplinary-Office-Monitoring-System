import { formatCaseCode, formatSubmissionCode } from '../../domain/codes.js';

/** Anything with Prisma's tagged `$queryRaw` (the client or a transaction). */
interface RawQuery {
  $queryRaw<T = unknown>(query: TemplateStringsArray, ...values: unknown[]): Promise<T>;
}

interface RankedRow {
  id: number;
  year: number;
  n: number;
}

/**
 * Case codes for some case ids: `SDO-<year>-<number>`, the number is the case's position among that year's cases
 * (year of `case_date` in Asia/Manila, ordered by id). Derived, never stored (codes.ts, UI-POLISH-SPEC decision 3).
 */
export async function loadCaseCodes(db: RawQuery, ids: number[]): Promise<Map<number, string>> {
  if (ids.length === 0) return new Map();
  const rows = await db.$queryRaw<RankedRow[]>`
    SELECT id, year, n FROM (
      SELECT disciplinary_case_id AS id,
             EXTRACT(YEAR FROM case_date AT TIME ZONE 'Asia/Manila')::int AS year,
             (row_number() OVER (
               PARTITION BY EXTRACT(YEAR FROM case_date AT TIME ZONE 'Asia/Manila')
               ORDER BY disciplinary_case_id
             ))::int AS n
      FROM disciplinary_cases
    ) ranked
    WHERE id = ANY(${ids}::int[])`;
  return new Map(rows.map((row) => [Number(row.id), formatCaseCode(Number(row.year), Number(row.n))]));
}

/** The case id behind a parsed code, or null when that year has fewer cases. */
export async function findCaseIdByCode(db: RawQuery, year: number, ordinal: number): Promise<number | null> {
  const rows = await db.$queryRaw<Array<{ id: number }>>`
    SELECT id FROM (
      SELECT disciplinary_case_id AS id,
             EXTRACT(YEAR FROM case_date AT TIME ZONE 'Asia/Manila')::int AS year,
             (row_number() OVER (
               PARTITION BY EXTRACT(YEAR FROM case_date AT TIME ZONE 'Asia/Manila')
               ORDER BY disciplinary_case_id
             ))::int AS n
      FROM disciplinary_cases
    ) ranked
    WHERE year = ${year} AND n = ${ordinal}`;
  return rows.length > 0 ? Number(rows[0].id) : null;
}

/** Gate submission codes (`GI-1042`) for some submission references: the rank of each among all submissions, by its first case. */
export async function loadSubmissionCodes(db: RawQuery, refs: string[]): Promise<Map<string, string>> {
  if (refs.length === 0) return new Map();
  const rows = await db.$queryRaw<Array<{ ref: string; n: number }>>`
    SELECT ref, n FROM (
      SELECT submission_ref::text AS ref,
             (row_number() OVER (ORDER BY MIN(disciplinary_case_id)))::int AS n
      FROM disciplinary_cases
      WHERE submission_ref IS NOT NULL
      GROUP BY submission_ref
    ) ranked
    WHERE ref = ANY(${refs}::text[])`;
  return new Map(rows.map((row) => [row.ref, formatSubmissionCode(Number(row.n))]));
}
