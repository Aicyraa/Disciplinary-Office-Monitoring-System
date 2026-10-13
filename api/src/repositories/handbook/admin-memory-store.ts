import type { Severity } from '@shared/types.js';
import type { AdminEntryRecord, HandbookAdminStore, HandbookAdminTx, SanctionChoice } from '../../types/handbook-admin.types.js';

interface ViolationRow {
  violationId: number;
  violationType: string;
  severity: Severity;
  description: string;
  isSystem: boolean;
}

interface EntryRow {
  handbookEntryId: number;
  violationId: number;
  section: string;
  sanctions: SanctionChoice[];
}

export interface MemoryAdminState {
  violations: ViolationRow[];
  entries: EntryRow[];
  sanctionIds: number[];
  /** Cases per handbook entry id. */
  cases: Record<number, number>;
  nextViolationId: number;
  nextEntryId: number;
}

export interface MemoryHandbookAdminStore extends HandbookAdminStore {
  state: MemoryAdminState;
  /** The joined view of one entry, for assertions. */
  entry(handbookEntryId: number): AdminEntryRecord | null;
}

function join(state: MemoryAdminState, handbookEntryId: number): AdminEntryRecord | null {
  const entry = state.entries.find((e) => e.handbookEntryId === handbookEntryId);
  const violation = entry && state.violations.find((v) => v.violationId === entry.violationId);
  if (!entry || !violation) return null;
  return {
    handbookEntryId,
    violationId: violation.violationId,
    violationType: violation.violationType,
    severity: violation.severity,
    description: violation.description,
    isSystem: violation.isSystem,
    section: entry.section,
    sanctions: entry.sanctions.map((s) => ({ ...s })),
  };
}

/** In-memory fake of the handbook tables. A transaction works on a copy and commits only if it finishes. */
export function createMemoryHandbookAdminStore(seed: Partial<MemoryAdminState> & { records?: AdminEntryRecord[] } = {}): MemoryHandbookAdminStore {
  const violations: ViolationRow[] = seed.violations ?? [];
  const entries: EntryRow[] = seed.entries ?? [];
  for (const record of seed.records ?? []) {
    violations.push({
      violationId: record.violationId,
      violationType: record.violationType,
      severity: record.severity,
      description: record.description,
      isSystem: record.isSystem,
    });
    entries.push({
      handbookEntryId: record.handbookEntryId,
      violationId: record.violationId,
      section: record.section,
      sanctions: record.sanctions.map((s) => ({ ...s })),
    });
  }
  const store: MemoryHandbookAdminStore = {
    state: {
      violations,
      entries,
      sanctionIds: seed.sanctionIds ?? [1, 2, 3],
      cases: seed.cases ?? {},
      nextViolationId: seed.nextViolationId ?? 100,
      nextEntryId: seed.nextEntryId ?? 100,
    },
    entry: (handbookEntryId) => join(store.state, handbookEntryId),
    async transaction(work) {
      const working = structuredClone(store.state);
      const result = await work(createTx(working));
      store.state = working;
      return result;
    },
  };
  return store;
}

function createTx(state: MemoryAdminState): HandbookAdminTx {
  return {
    async getEntry(handbookEntryId) {
      return join(state, handbookEntryId);
    },
    async findViolationByName(name) {
      const found = state.violations.find((v) => v.violationType.toLowerCase() === name.toLowerCase());
      return found ? { violationId: found.violationId } : null;
    },
    async countSanctions(sanctionIds) {
      return new Set(sanctionIds.filter((id) => state.sanctionIds.includes(id))).size;
    },
    async countCases(handbookEntryId) {
      return state.cases[handbookEntryId] ?? 0;
    },
    async insertViolation({ violationType, severity, description }) {
      if (state.violations.some((v) => v.violationType.toLowerCase() === violationType.toLowerCase())) {
        throw new Error('duplicate key value violates unique constraint "violations_violation_type_key"');
      }
      const violationId = state.nextViolationId;
      state.nextViolationId += 1;
      state.violations.push({ violationId, violationType, severity, description, isSystem: false });
      return violationId;
    },
    async insertEntry({ violationId, section }) {
      const handbookEntryId = state.nextEntryId;
      state.nextEntryId += 1;
      state.entries.push({ handbookEntryId, violationId, section, sanctions: [] });
      return handbookEntryId;
    },
    async updateViolation(violationId, patch) {
      const violation = state.violations.find((v) => v.violationId === violationId);
      if (!violation) throw new Error(`No violation ${violationId}`);
      if (patch.violationType !== undefined) {
        const clash = state.violations.some(
          (v) => v.violationId !== violationId && v.violationType.toLowerCase() === patch.violationType!.toLowerCase(),
        );
        if (clash) throw new Error('duplicate key value violates unique constraint "violations_violation_type_key"');
        violation.violationType = patch.violationType;
      }
      if (patch.severity !== undefined) violation.severity = patch.severity;
      if (patch.description !== undefined) violation.description = patch.description;
    },
    async updateEntry(handbookEntryId, patch) {
      const entry = state.entries.find((e) => e.handbookEntryId === handbookEntryId);
      if (!entry) throw new Error(`No entry ${handbookEntryId}`);
      if (patch.section !== undefined) entry.section = patch.section;
    },
    async replaceSanctions(handbookEntryId, sanctions) {
      const entry = state.entries.find((e) => e.handbookEntryId === handbookEntryId);
      if (!entry) throw new Error(`No entry ${handbookEntryId}`);
      entry.sanctions = sanctions.map((s) => ({ ...s }));
    },
  };
}
