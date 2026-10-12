import type { GateEntry, GateNotificationInput, GateOptionsReader, GateStore, GateTx, NewGateCase } from './types.js';

export interface MemoryGateState {
  students: string[];
  programs: string[];
  entries: Array<GateEntry & { section: string }>;
  cases: Array<NewGateCase & { caseId: number }>;
  history: Array<{ caseId: number; date: Date }>;
  notifications: GateNotificationInput[];
  nextCaseId: number;
}

export interface MemoryGateStore extends GateStore, GateOptionsReader {
  state: MemoryGateState;
}

const manilaDay = (date: Date): string => new Date(date.getTime() + 8 * 3_600_000).toISOString().slice(0, 10);

/**
 * In-memory fake of the case tables with the duplicate index (same typed ID + violation + Manila day).
 * A transaction works on a copy and commits only if it finishes without throwing.
 */
export function createMemoryGateStore(seed: Partial<MemoryGateState> = {}): MemoryGateStore {
  const store: MemoryGateStore = {
    state: {
      students: seed.students ?? [],
      programs: seed.programs ?? ['BS Computer Science', 'BS Nursing'],
      entries: seed.entries ?? [
        { handbookEntryId: 1, violationType: 'Improper uniform', isSystem: false, section: 'VI.D.1' },
        { handbookEntryId: 2, violationType: 'No ID', isSystem: false, section: 'VI.D.2' },
        { handbookEntryId: 68, violationType: '3 minor offense', isSystem: true, section: 'VI.E.20' },
      ],
      cases: seed.cases ?? [],
      history: seed.history ?? [],
      notifications: seed.notifications ?? [],
      nextCaseId: seed.nextCaseId ?? 1,
    },
    async listOptions() {
      return {
        violations: store.state.entries
          .filter((entry) => !entry.isSystem)
          .map((entry) => ({ id: entry.handbookEntryId, name: entry.violationType, section: entry.section })),
        programs: [...store.state.programs],
      };
    },
    async transaction(work) {
      const working = structuredClone(store.state);
      // structuredClone keeps Dates, but keep the invariant explicit for readers.
      const result = await work(createTx(working));
      store.state = working;
      return result;
    },
  };
  return store;
}

function createTx(state: MemoryGateState): GateTx {
  return {
    async findStudent(studentId) {
      return state.students.includes(studentId) ? { studentId } : null;
    },
    async listProgramNames() {
      return [...state.programs];
    },
    async getEntries(ids) {
      return state.entries
        .filter((entry) => ids.includes(entry.handbookEntryId))
        .map(({ handbookEntryId, violationType, isSystem }) => ({ handbookEntryId, violationType, isSystem }));
    },
    async findTodaysDuplicates(claimedStudentId, ids, day) {
      return state.cases
        .filter(
          (c) => c.claimedStudentId === claimedStudentId && ids.includes(c.handbookEntryId) && manilaDay(c.caseDate) === day,
        )
        .map((c) => ({ handbookEntryId: c.handbookEntryId, submissionRef: c.submissionRef }));
    },
    async insertGateCase(input) {
      const clash = state.cases.some(
        (c) =>
          c.claimedStudentId === input.claimedStudentId &&
          c.handbookEntryId === input.handbookEntryId &&
          manilaDay(c.caseDate) === manilaDay(input.caseDate),
      );
      if (clash) {
        throw new Error('duplicate key value violates unique constraint "ux_cases_gate_dedupe"');
      }
      const caseId = state.nextCaseId;
      state.nextCaseId += 1;
      state.cases.push({ ...input, caseId });
      return caseId;
    },
    async addHistory({ caseId, date }) {
      state.history.push({ caseId, date });
    },
    async addNotification(input) {
      if (state.notifications.some((n) => n.idempotencyKey === input.idempotencyKey)) return;
      state.notifications.push(input);
    },
  };
}
