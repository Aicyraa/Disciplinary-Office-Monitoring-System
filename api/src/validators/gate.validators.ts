import { MAX_REPORT_BODY_CHARACTERS } from '../config/gate.js';
import { parseReport, type ParsedReport } from '../domain/gate/validate.js';
import { invalid, valid, type Validated } from '../helpers/validation.js';

/**
 * Size limit, then field validation (SPEC 4.10). Only the five report fields are read; nothing else in the
 * body can reach the database. The caller answers every failure with the same generic refusal.
 */
export function parseGateReportBody(body: unknown): Validated<ParsedReport> {
  if (JSON.stringify(body ?? null).length > MAX_REPORT_BODY_CHARACTERS) return invalid('Report is too large.');
  const parsed = parseReport(body);
  return parsed.ok ? valid(parsed.value) : invalid('Report is not valid.');
}
