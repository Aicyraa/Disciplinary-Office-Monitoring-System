import type { Severity } from '@shared/types.js';
import type { HandbookAdminStore, SanctionChoice } from '../repositories/handbook/admin-types.js';

export type HandbookAdminFailureCode = 'not_found' | 'invalid_input' | 'violation_exists' | 'violation_in_use';

export interface HandbookAdminFailure {
  ok: false;
  code: HandbookAdminFailureCode;
  message: string;
}

export type HandbookAdminResult<T> = ({ ok: true } & T) | HandbookAdminFailure;

export const MAX_NAME_LENGTH = 200;
export const MAX_SECTION_LENGTH = 50;
export const MAX_DESCRIPTION_LENGTH = 2000;
export const MAX_OFFENSE_NUMBER = 5;

const fail = (code: HandbookAdminFailureCode, message: string): HandbookAdminFailure => ({ ok: false, code, message });

const SEVERITIES: readonly Severity[] = ['Minor', 'Major'];

/** Trimmed non-empty text within the limit, else undefined. */
function required(value: unknown, max: number): string | undefined {
  if (typeof value !== 'string') return undefined;
  const text = value.trim();
  return text.length > 0 && text.length <= max ? text : undefined;
}

/** A list of unique `{offenseNumber, sanctionId}` pairs, or undefined when malformed. */
function parseSanctions(value: unknown): SanctionChoice[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const seen = new Set<string>();
  const result: SanctionChoice[] = [];
  for (const item of value) {
    if (typeof item !== 'object' || item === null) return undefined;
    const { offenseNumber, sanctionId } = item as Record<string, unknown>;
    if (typeof offenseNumber !== 'number' || !Number.isInteger(offenseNumber) || offenseNumber < 1 || offenseNumber > MAX_OFFENSE_NUMBER) {
      return undefined;
    }
    if (typeof sanctionId !== 'number' || !Number.isInteger(sanctionId) || sanctionId < 1) return undefined;
    const key = `${offenseNumber}:${sanctionId}`;
    if (seen.has(key)) return undefined;
    seen.add(key);
    result.push({ offenseNumber, sanctionId });
  }
  return result;
}

function isUniqueViolation(error: unknown): boolean {
  const text = [
    error instanceof Error ? error.message : '',
    typeof error === 'object' && error !== null && 'code' in error ? String((error as { code: unknown }).code) : '',
    typeof error === 'object' && error !== null && 'cause' in error ? JSON.stringify((error as { cause: unknown }).cause) : '',
  ].join(' ');
  return /unique constraint|duplicate key|\b23505\b|\bP2002\b/i.test(text);
}

export interface HandbookAdminService {
  create(input: {
    violationType: unknown;
    severity: unknown;
    section: unknown;
    description: unknown;
    sanctions?: unknown;
  }): Promise<HandbookAdminResult<{ handbookEntryId: number }>>;
  /** Only the fields that are present change. */
  update(input: {
    handbookEntryId: number;
    violationType?: unknown;
    severity?: unknown;
    section?: unknown;
    description?: unknown;
    sanctions?: unknown;
  }): Promise<HandbookAdminResult<unknown>>;
}

export function createHandbookAdminService({ store }: { store: HandbookAdminStore }): HandbookAdminService {
  const exists = fail('violation_exists', 'A violation with that name already exists.');

  async function guarded<T>(work: () => Promise<HandbookAdminResult<T>>): Promise<HandbookAdminResult<T>> {
    try {
      return await work();
    } catch (error) {
      if (isUniqueViolation(error)) return exists;
      throw error;
    }
  }

  return {
    async create({ violationType, severity, section, description, sanctions }) {
      const name = required(violationType, MAX_NAME_LENGTH);
      if (name === undefined) return fail('invalid_input', `The violation name is required (up to ${MAX_NAME_LENGTH} characters).`);
      if (typeof severity !== 'string' || !SEVERITIES.includes(severity as Severity)) {
        return fail('invalid_input', 'The category must be Minor or Major.');
      }
      const sectionText = required(section, MAX_SECTION_LENGTH);
      if (sectionText === undefined) return fail('invalid_input', `The handbook section is required (up to ${MAX_SECTION_LENGTH} characters).`);
      const descriptionText = required(description, MAX_DESCRIPTION_LENGTH);
      if (descriptionText === undefined) {
        return fail('invalid_input', `The description is required (up to ${MAX_DESCRIPTION_LENGTH} characters).`);
      }
      const choices = sanctions === undefined ? [] : parseSanctions(sanctions);
      if (choices === undefined) {
        return fail('invalid_input', `Sanctions must be a list of offense numbers (1 to ${MAX_OFFENSE_NUMBER}) with a sanction each, without repeats.`);
      }

      return guarded(() =>
        store.transaction(async (tx) => {
          if (await tx.findViolationByName(name)) return exists;
          const ids = [...new Set(choices.map((choice) => choice.sanctionId))];
          if (ids.length > 0 && (await tx.countSanctions(ids)) !== ids.length) {
            return fail('invalid_input', 'One of the chosen sanctions does not exist.');
          }
          const violationId = await tx.insertViolation({ violationType: name, severity: severity as Severity, description: descriptionText });
          const handbookEntryId = await tx.insertEntry({ violationId, section: sectionText });
          if (choices.length > 0) await tx.replaceSanctions(handbookEntryId, choices);
          return { ok: true as const, handbookEntryId };
        }),
      );
    },

    async update({ handbookEntryId, violationType, severity, section, description, sanctions }) {
      const patch: { name?: string; severity?: Severity; section?: string; description?: string; sanctions?: SanctionChoice[] } = {};
      if (violationType !== undefined) {
        const name = required(violationType, MAX_NAME_LENGTH);
        if (name === undefined) return fail('invalid_input', `The violation name cannot be empty (up to ${MAX_NAME_LENGTH} characters).`);
        patch.name = name;
      }
      if (severity !== undefined) {
        if (typeof severity !== 'string' || !SEVERITIES.includes(severity as Severity)) {
          return fail('invalid_input', 'The category must be Minor or Major.');
        }
        patch.severity = severity as Severity;
      }
      if (section !== undefined) {
        const text = required(section, MAX_SECTION_LENGTH);
        if (text === undefined) return fail('invalid_input', `The handbook section cannot be empty (up to ${MAX_SECTION_LENGTH} characters).`);
        patch.section = text;
      }
      if (description !== undefined) {
        const text = required(description, MAX_DESCRIPTION_LENGTH);
        if (text === undefined) return fail('invalid_input', `The description cannot be empty (up to ${MAX_DESCRIPTION_LENGTH} characters).`);
        patch.description = text;
      }
      if (sanctions !== undefined) {
        const choices = parseSanctions(sanctions);
        if (choices === undefined) {
          return fail('invalid_input', `Sanctions must be a list of offense numbers (1 to ${MAX_OFFENSE_NUMBER}) with a sanction each, without repeats.`);
        }
        patch.sanctions = choices;
      }
      if (Object.keys(patch).length === 0) return fail('invalid_input', 'There is nothing to change.');

      return guarded(() =>
        store.transaction(async (tx) => {
          const entry = await tx.getEntry(handbookEntryId);
          // The system entry (H068) is never edited by hand and is not shown to staff, so it reads as missing.
          if (!entry || entry.isSystem) return fail('not_found', 'Handbook entry not found.');

          if (patch.severity !== undefined && patch.severity !== entry.severity) {
            const used = await tx.countCases(handbookEntryId);
            if (used > 0) {
              return fail(
                'violation_in_use',
                `This violation is used in ${used} case${used === 1 ? '' : 's'}, so its category cannot change (it would change how minors are counted).`,
              );
            }
          }
          if (patch.name !== undefined && patch.name.toLowerCase() !== entry.violationType.toLowerCase()) {
            const clash = await tx.findViolationByName(patch.name);
            if (clash && clash.violationId !== entry.violationId) return exists;
          }
          if (patch.sanctions !== undefined) {
            const ids = [...new Set(patch.sanctions.map((choice) => choice.sanctionId))];
            if (ids.length > 0 && (await tx.countSanctions(ids)) !== ids.length) {
              return fail('invalid_input', 'One of the chosen sanctions does not exist.');
            }
          }

          const violationPatch: { violationType?: string; severity?: Severity; description?: string } = {};
          if (patch.name !== undefined) violationPatch.violationType = patch.name;
          if (patch.severity !== undefined) violationPatch.severity = patch.severity;
          if (patch.description !== undefined) violationPatch.description = patch.description;
          if (Object.keys(violationPatch).length > 0) await tx.updateViolation(entry.violationId, violationPatch);
          if (patch.section !== undefined) await tx.updateEntry(handbookEntryId, { section: patch.section });
          if (patch.sanctions !== undefined) await tx.replaceSanctions(handbookEntryId, patch.sanctions);
          return { ok: true as const };
        }),
      );
    },
  };
}
