import type { Severity } from '../../../shared/types.js';
import type {
  CasePatch,
  CaseRecord,
  CaseStore,
  CaseTx,
  HandbookEntryLite,
  HistoryInput,
  NotificationInput,
} from './types.js';

export interface MemoryState {
  cases: CaseRecord[];
  history: HistoryInput[];
  escalations: Array<{ majorCaseId: number; minorCaseId: number }>;
  notifications: NotificationInput[];
  students: Set<string>;
  handbook: HandbookEntryLite[];
  /** case id -> sanction statuses, for the "all completed" rule until step 5 adds real sanctions. */
  sanctions: Map<number, Array<'assigned' | 'pending_verification' | 'returned' | 'completed'>>;
  nextCaseId: number;
}

export interface MemoryCaseStore extends CaseStore {
  state: MemoryState;
  /** Test hook: make the next transaction throw after `afterWrites` writes, to prove atomicity. */
  failAfterWrites(afterWrites: number | null): void;
}

const clone = (state: MemoryState): MemoryState => ({
  cases: state.cases.map((c) => ({ ...c })),
  history: state.history.map((h) => ({ ...h })),
  escalations: state.escalations.map((e) => ({ ...e })),
  notifications: state.notifications.map((n) => ({ ...n })),
  students: new Set(state.students),
  handbook: state.handbook.map((h) => ({ ...h })),
  sanctions: new Map([...state.sanctions].map(([id, list]) => [id, [...list]])),
  nextCaseId: state.nextCaseId,
});

export function createMemoryCaseStore(seed: Partial<MemoryState> = {}): MemoryCaseStore {
  const initial: MemoryState = {
    cases: [],
    history: [],
    escalations: [],
    notifications: [],
    students: new Set(),
    handbook: [],
    sanctions: new Map(),
    nextCaseId: 1,
    ...seed,
  };
  const store: MemoryCaseStore = {
    state: initial,
    failAfterWrites(afterWrites) {
      failAt = afterWrites;
    },
    async transaction(work) {
      // Work on a copy and swap it in only if `work` succeeds: that is the atomicity the real store gives.
      const working = clone(store.state);
      let writes = 0;
      const countWrite = () => {
        writes += 1;
        if (failAt !== null && writes > failAt) throw new Error('simulated failure');
      };
      const severityOf = (handbookEntryId: number): Severity =>
        working.handbook.find((h) => h.handbookEntryId === handbookEntryId)?.severity ?? 'Minor';

      const tx: CaseTx = {
        async lockStudent() {},
        async getCase(caseId) {
          const found = working.cases.find((c) => c.caseId === caseId);
          return found ? { ...found, severity: severityOf(found.handbookEntryId) } : null;
        },
        async listStudentCases(studentId) {
          return working.cases
            .filter((c) => c.studentId === studentId)
            .map((c) => ({ ...c, severity: severityOf(c.handbookEntryId) }));
        },
        async listSubmission(submissionRef) {
          return working.cases
            .filter((c) => c.submissionRef === submissionRef)
            .map((c) => ({ ...c, severity: severityOf(c.handbookEntryId) }));
        },
        async studentExists(studentId) {
          return working.students.has(studentId);
        },
        async getHandbookEntry(handbookEntryId) {
          return working.handbook.find((h) => h.handbookEntryId === handbookEntryId) ?? null;
        },
        async getSystemHandbookEntry() {
          return working.handbook.find((h) => h.isSystem) ?? null;
        },
        async sanctionCounts(caseId) {
          const list = working.sanctions.get(caseId) ?? [];
          return { total: list.length, completed: list.filter((s) => s === 'completed').length };
        },
        async insertCase(input) {
          countWrite();
          const caseId = working.nextCaseId++;
          working.cases.push({
            caseId,
            caseDate: input.caseDate,
            status: input.status,
            severity: severityOf(input.handbookEntryId),
            isEscalated: false,
            studentId: input.studentId,
            handbookEntryId: input.handbookEntryId,
            originalHandbookEntryId: null,
            source: input.source,
            reportedByEmployeeId: input.reportedByEmployeeId,
            claimedStudentId: null,
            claimedName: null,
            submissionRef: null,
            resolvedWithoutSanction: false,
            dateResolved: null,
          });
          return caseId;
        },
        async updateCase(caseId, patch: CasePatch) {
          countWrite();
          const index = working.cases.findIndex((c) => c.caseId === caseId);
          if (index === -1) throw new Error(`case ${caseId} not found`);
          working.cases[index] = { ...working.cases[index], ...patch };
        },
        async insertEscalation(majorCaseId, minorCaseId) {
          countWrite();
          if (working.escalations.some((e) => e.minorCaseId === minorCaseId)) {
            throw new Error('a minor is used once (case_escalations.minor_case_id is unique)');
          }
          working.escalations.push({ majorCaseId, minorCaseId });
        },
        async addHistory(input) {
          countWrite();
          working.history.push({ ...input });
        },
        async addNotification(input) {
          if (working.notifications.some((n) => n.idempotencyKey === input.idempotencyKey)) return;
          countWrite();
          working.notifications.push({ ...input });
        },
      };

      const result = await work(tx);
      store.state = working;
      return result;
    },
  };
  let failAt: number | null = null;
  return store;
}
