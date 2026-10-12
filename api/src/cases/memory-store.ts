import type { Severity } from '@shared/types.js';
import type { HandbookSanctionRow } from '../sanctions/rules.js';
import type {
  CasePatch,
  CaseRecord,
  CaseSanctionRecord,
  CaseStore,
  CaseTx,
  HandbookEntryLite,
  HistoryInput,
  NotificationInput,
  SanctionHistoryInput,
  SanctionNotificationInput,
} from './types.js';

export interface MemoryState {
  cases: CaseRecord[];
  history: HistoryInput[];
  escalations: Array<{ majorCaseId: number; minorCaseId: number }>;
  notifications: NotificationInput[];
  students: Set<string>;
  handbook: HandbookEntryLite[];
  /** case id -> sanction statuses (a shortcut for the "all completed" rule; real rows live in caseSanctions). */
  sanctions: Map<number, Array<'assigned' | 'pending_verification' | 'returned' | 'completed'>>;
  nextCaseId: number;
  // sanctions and proof
  /** handbook entry id -> the sanctions the handbook allows, per offense number */
  handbookSanctions: Map<number, HandbookSanctionRow[]>;
  sanctionCatalog: Map<number, { sanctionId: number; sanctionType: string }>;
  caseSanctions: CaseSanctionRecord[];
  sanctionHistory: SanctionHistoryInput[];
  sanctionNotifications: SanctionNotificationInput[];
  nextCaseSanctionId: number;
  nextFileId: number;
  nextCaseSanctionFileId: number;
}

export interface MemoryCaseStore extends CaseStore {
  state: MemoryState;
  /** Test hook: make the next transaction throw after `afterWrites` writes, to prove atomicity. */
  failAfterWrites(afterWrites: number | null): void;
  /**
   * Test hook: runs once, inside the first lock a transaction takes, against that transaction's working copy.
   * It stands in for "another transaction committed while we waited for the lock".
   */
  onFirstLock(hook: ((working: MemoryState) => void) | null): void;
  /** Names of the lock / read / write calls made, in order, across all transactions. */
  readonly calls: string[];
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
  handbookSanctions: new Map([...state.handbookSanctions].map(([id, rows]) => [id, rows.map((r) => ({ ...r }))])),
  sanctionCatalog: new Map([...state.sanctionCatalog].map(([id, s]) => [id, { ...s }])),
  caseSanctions: state.caseSanctions.map((s) => ({ ...s, files: s.files.map((f) => ({ ...f })) })),
  sanctionHistory: state.sanctionHistory.map((h) => ({ ...h })),
  sanctionNotifications: state.sanctionNotifications.map((n) => ({ ...n })),
  nextCaseSanctionId: state.nextCaseSanctionId,
  nextFileId: state.nextFileId,
  nextCaseSanctionFileId: state.nextCaseSanctionFileId,
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
    handbookSanctions: new Map(),
    sanctionCatalog: new Map(),
    caseSanctions: [],
    sanctionHistory: [],
    sanctionNotifications: [],
    nextCaseSanctionId: 1,
    nextFileId: 1,
    nextCaseSanctionFileId: 1,
    ...seed,
  };
  const store: MemoryCaseStore = {
    state: initial,
    failAfterWrites(afterWrites) {
      failAt = afterWrites;
    },
    onFirstLock(hook) {
      lockHook = hook;
    },
    calls: [],
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

      const runLockHook = () => {
        if (lockHook) {
          const hook = lockHook;
          lockHook = null;
          hook(working);
        }
      };

      /** A case sanction with the student and case status filled in from the live case row. */
      const withCase = (record: CaseSanctionRecord): CaseSanctionRecord => {
        const owner = working.cases.find((c) => c.caseId === record.caseId);
        return {
          ...record,
          studentId: owner?.studentId ?? null,
          caseStatus: owner?.status ?? record.caseStatus,
          files: record.files.map((f) => ({ ...f })),
        };
      };
      const keyTaken = (key: string) =>
        working.notifications.some((n) => n.idempotencyKey === key) ||
        working.sanctionNotifications.some((n) => n.idempotencyKey === key);

      const tx: CaseTx = {
        async lockStudent() {
          store.calls.push('lockStudent');
          runLockHook();
        },
        async lockSubmission() {
          store.calls.push('lockSubmission');
          runLockHook();
        },
        async getCase(caseId) {
          store.calls.push('getCase');
          const found = working.cases.find((c) => c.caseId === caseId);
          return found ? { ...found, severity: severityOf(found.handbookEntryId) } : null;
        },
        async listStudentCases(studentId) {
          store.calls.push('listStudentCases');
          return working.cases
            .filter((c) => c.studentId === studentId)
            .map((c) => ({ ...c, severity: severityOf(c.handbookEntryId) }));
        },
        async listSubmission(submissionRef) {
          store.calls.push('listSubmission');
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
          const legacy = working.sanctions.get(caseId) ?? [];
          const real = working.caseSanctions.filter((s) => s.caseId === caseId);
          return {
            total: legacy.length + real.length,
            completed: legacy.filter((s) => s === 'completed').length + real.filter((s) => s.status === 'completed').length,
          };
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
          store.calls.push('updateCase');
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
          if (keyTaken(input.idempotencyKey)) return;
          countWrite();
          working.notifications.push({ ...input });
        },

        // ---- sanctions and proof ----------------------------------------------------------------
        async listHandbookSanctions(handbookEntryId) {
          return (working.handbookSanctions.get(handbookEntryId) ?? []).map((row) => ({ ...row }));
        },
        async getSanction(sanctionId) {
          return working.sanctionCatalog.get(sanctionId) ?? null;
        },
        async listCaseSanctions(caseId) {
          return working.caseSanctions.filter((s) => s.caseId === caseId).map(withCase);
        },
        async getCaseSanction(caseSanctionId) {
          store.calls.push('getCaseSanction');
          const found = working.caseSanctions.find((s) => s.caseSanctionId === caseSanctionId);
          return found ? withCase(found) : null;
        },
        async getCaseSanctionByFile(caseSanctionFileId) {
          const found = working.caseSanctions.find((s) => s.files.some((f) => f.caseSanctionFileId === caseSanctionFileId));
          return found ? withCase(found) : null;
        },
        async insertCaseSanction(input) {
          countWrite();
          if (working.caseSanctions.some((s) => s.caseId === input.caseId && s.sanctionId === input.sanctionId)) {
            throw new Error('unique (disciplinary_case_id, sanction_id)');
          }
          const owner = working.cases.find((c) => c.caseId === input.caseId);
          const id = working.nextCaseSanctionId++;
          working.caseSanctions.push({
            caseSanctionId: id,
            caseId: input.caseId,
            studentId: owner?.studentId ?? null,
            caseStatus: owner?.status ?? 'validated',
            sanctionId: input.sanctionId,
            sanctionType: working.sanctionCatalog.get(input.sanctionId)?.sanctionType ?? 'Unknown',
            status: 'assigned',
            dueDate: input.dueDate,
            dateAssigned: input.date,
            dateSubmitted: null,
            dateCompleted: null,
            staffNote: input.staffNote,
            complianceNote: null,
            files: [],
          });
          return id;
        },
        async updateCaseSanction(caseSanctionId, patch) {
          store.calls.push('updateCaseSanction');
          countWrite();
          const index = working.caseSanctions.findIndex((s) => s.caseSanctionId === caseSanctionId);
          if (index === -1) throw new Error(`case sanction ${caseSanctionId} not found`);
          const next = { ...working.caseSanctions[index] };
          if (patch.status !== undefined) next.status = patch.status;
          if (patch.dateSubmitted !== undefined) next.dateSubmitted = patch.dateSubmitted;
          if (patch.dateCompleted !== undefined) next.dateCompleted = patch.dateCompleted;
          if (patch.staffNote !== undefined) next.staffNote = patch.staffNote;
          if (patch.complianceNote !== undefined) next.complianceNote = patch.complianceNote;
          // Mirrors the DB check: completed needs date_completed and verified_by_employee_id.
          if (patch.status === 'completed' && (next.dateCompleted === null || !patch.verifiedByEmployeeId)) {
            throw new Error('check violation: completed needs date_completed and verified_by_employee_id');
          }
          working.caseSanctions[index] = next;
        },
        async insertProofFile(input) {
          countWrite();
          const index = working.caseSanctions.findIndex((s) => s.caseSanctionId === input.caseSanctionId);
          if (index === -1) throw new Error(`case sanction ${input.caseSanctionId} not found`);
          const fileId = working.nextFileId++;
          const caseSanctionFileId = working.nextCaseSanctionFileId++;
          working.caseSanctions[index].files.push({
            caseSanctionFileId,
            fileId,
            storageKey: input.storageKey,
            originalName: input.originalName,
            mimeType: input.mimeType,
            sizeBytes: input.sizeBytes,
            uploadedByStudentId: input.uploadedByStudentId,
            dateUploaded: input.date,
            dateViewed: null,
            viewedByEmployeeId: null,
          });
          return { caseSanctionFileId, fileId };
        },
        async deleteProofFile(caseSanctionFileId) {
          countWrite();
          for (const record of working.caseSanctions) {
            record.files = record.files.filter((f) => f.caseSanctionFileId !== caseSanctionFileId);
          }
        },
        async markFileViewed(caseSanctionFileId, employeeId, date) {
          countWrite();
          for (const record of working.caseSanctions) {
            for (const file of record.files) {
              if (file.caseSanctionFileId === caseSanctionFileId) {
                file.dateViewed = date;
                file.viewedByEmployeeId = employeeId;
              }
            }
          }
        },
        async addSanctionHistory(input) {
          countWrite();
          if ((input.employeeId === null) === (input.studentId === null)) {
            throw new Error('check violation: exactly one of employee_id / student_id');
          }
          working.sanctionHistory.push({ ...input });
        },
        async addSanctionNotification(input) {
          if (keyTaken(input.idempotencyKey)) return;
          countWrite();
          working.sanctionNotifications.push({ ...input });
        },
      };

      const result = await work(tx);
      store.state = working;
      return result;
    },
  };
  let failAt: number | null = null;
  let lockHook: ((working: MemoryState) => void) | null = null;
  return store;
}
