import { STUDENT_ID_PATTERN } from '../auth/policy.js';

export const YEAR_LEVELS = ['1st year', '2nd year', '3rd year', '4th year', '5th year'] as const;
export const MAX_VIOLATIONS_PER_REPORT = 20;
export const MAX_NAME_LENGTH = 100;
export const MAX_PROGRAM_LENGTH = 120;

export interface ParsedReport {
  studentId: string;
  name: string;
  program: string;
  year: (typeof YEAR_LEVELS)[number];
  violationIds: number[];
}

export type ParseResult = { ok: true; value: ParsedReport } | { ok: false };

// eslint-disable-next-line no-control-regex
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/;

function yearLevel(value: unknown): ParsedReport['year'] | null {
  const number = typeof value === 'number' ? value : typeof value === 'string' && /^[1-5]$/.test(value) ? Number(value) : NaN;
  return Number.isInteger(number) && number >= 1 && number <= 5 ? YEAR_LEVELS[number - 1] : null;
}

/**
 * Field validation for the public report. It returns only ok or not ok: the caller answers every failure with
 * the same generic error, so the form never teaches a bot which field it got wrong (the page checks its own
 * fields before submit and shows its own messages).
 */
export function parseReport(body: unknown): ParseResult {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) return { ok: false };
  const { studentId, name, program, year, violationIds } = body as Record<string, unknown>;

  if (typeof studentId !== 'string' || !STUDENT_ID_PATTERN.test(studentId.trim())) return { ok: false };

  if (typeof name !== 'string' || CONTROL_CHARACTERS.test(name)) return { ok: false };
  const cleanName = name.trim().replace(/\s+/g, ' ');
  if (cleanName.length < 2 || cleanName.length > MAX_NAME_LENGTH) return { ok: false };

  if (typeof program !== 'string' || CONTROL_CHARACTERS.test(program)) return { ok: false };
  const cleanProgram = program.trim();
  if (cleanProgram.length === 0 || cleanProgram.length > MAX_PROGRAM_LENGTH) return { ok: false };

  const level = yearLevel(year);
  if (level === null) return { ok: false };

  if (!Array.isArray(violationIds) || violationIds.length === 0 || violationIds.length > MAX_VIOLATIONS_PER_REPORT) {
    return { ok: false };
  }
  if (!violationIds.every((id) => typeof id === 'number' && Number.isInteger(id) && id > 0)) return { ok: false };
  if (new Set(violationIds).size !== violationIds.length) return { ok: false };

  return {
    ok: true,
    value: {
      studentId: studentId.trim(),
      name: cleanName,
      program: cleanProgram,
      year: level,
      violationIds: violationIds as number[],
    },
  };
}
