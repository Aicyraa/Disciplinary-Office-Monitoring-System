import { CLEARANCE_PAGE_SIZE, type ClearanceQueries, type ClearanceRow } from './queries.js';
import type {
  ClearanceHistoryInput,
  ClearanceNotificationInput,
  ClearanceRecord,
  ClearanceStore,
  ClearanceTx,
  RequirementRecord,
} from '../../types/clearance.types.js';

export interface MemoryClearanceState {
  students: string[];
  requirements: RequirementRecord[];
  clearances: ClearanceRecord[];
  history: ClearanceHistoryInput[];
  notifications: ClearanceNotificationInput[];
  /** Open cases per student, for the staff warning chip. */
  openCases: Record<string, number>;
  nextClearanceId: number;
  nextRequirementId: number;
}

export interface MemoryClearanceStore extends ClearanceStore {
  state: MemoryClearanceState;
}

/** The four standard requirements of `db/seed.sql`, with the ids the seed gives them. */
export const SEEDED_REQUIREMENTS: RequirementRecord[] = [
  { requirementId: 1, label: 'No active violations', isDefault: true },
  { requirementId: 2, label: 'All sanctions served', isDefault: true },
  { requirementId: 3, label: 'Guidance exit interview', isDefault: true },
  { requirementId: 4, label: 'SDO signature', isDefault: true },
];

/**
 * In-memory fake of the clearance tables, with their unique constraints. A transaction works on a copy and
 * commits only if it finishes without throwing, like the real one.
 */
export function createMemoryClearanceStore(seed: Partial<MemoryClearanceState> = {}): MemoryClearanceStore {
  const store: MemoryClearanceStore = {
    state: {
      students: seed.students ?? [],
      requirements: seed.requirements ?? SEEDED_REQUIREMENTS.map((r) => ({ ...r })),
      clearances: seed.clearances ?? [],
      history: seed.history ?? [],
      notifications: seed.notifications ?? [],
      openCases: seed.openCases ?? {},
      nextClearanceId: seed.nextClearanceId ?? 1,
      nextRequirementId: seed.nextRequirementId ?? 100,
    },
    async transaction(work) {
      const working = structuredClone(store.state);
      const result = await work(createTx(working));
      store.state = working;
      return result;
    },
  };
  return store;
}

/** Staff-side reads over the same fake data. Names come from the maps given here. */
export function createMemoryClearanceQueries(
  store: MemoryClearanceStore,
  names: { students?: Record<string, string>; staff?: Record<string, string> } = {},
): ClearanceQueries {
  const staffName = (id: string) => names.staff?.[id] ?? id;
  const toRow = (record: ClearanceRecord): ClearanceRow => ({
    ...structuredClone(record),
    studentName: names.students?.[record.studentId] ?? record.studentId,
    staffNames: Object.fromEntries(
      record.items.flatMap((item) =>
        item.completedByEmployeeId ? [[item.completedByEmployeeId, staffName(item.completedByEmployeeId)] as const] : [],
      ),
    ),
    openCases: store.state.openCases[record.studentId] ?? 0,
    history: store.state.history
      .filter((entry) => entry.clearanceId === record.clearanceId)
      .map((entry) => ({
        eventType: entry.eventType,
        requirementLabel:
          entry.requirementId === null
            ? null
            : (store.state.requirements.find((r) => r.requirementId === entry.requirementId)?.label ?? null),
        remarks: entry.remarks,
        date: entry.date,
        by: staffName(entry.employeeId),
      })),
  });
  return {
    async list({ status, q, page }) {
      const needle = q?.trim().toLowerCase();
      const matching = store.state.clearances
        .map(toRow)
        .filter((row) => (!status || row.status === status) && (!needle || row.studentId.toLowerCase().includes(needle) || row.studentName.toLowerCase().includes(needle)))
        .sort((a, b) => b.academicYear - a.academicYear || b.semester - a.semester || b.clearanceId - a.clearanceId);
      return { rows: matching.slice((page - 1) * CLEARANCE_PAGE_SIZE, page * CLEARANCE_PAGE_SIZE), total: matching.length };
    },
    async get(clearanceId) {
      const found = store.state.clearances.find((c) => c.clearanceId === clearanceId);
      return found ? toRow(found) : null;
    },
  };
}

function createTx(state: MemoryClearanceState): ClearanceTx {
  const find = (clearanceId: number) => state.clearances.find((c) => c.clearanceId === clearanceId);
  const labelOf = (requirementId: number) => state.requirements.find((r) => r.requirementId === requirementId)?.label ?? '';
  return {
    async lockStudent() {},
    async studentExists(studentId) {
      return state.students.includes(studentId);
    },
    async getClearance(clearanceId) {
      const found = find(clearanceId);
      return found ? structuredClone(found) : null;
    },
    async findClearance(studentId, academicYear, semester) {
      const found = state.clearances.find(
        (c) => c.studentId === studentId && c.academicYear === academicYear && c.semester === semester,
      );
      return found ? structuredClone(found) : null;
    },
    async listDefaultRequirements() {
      return state.requirements.filter((r) => r.isDefault).map((r) => ({ ...r }));
    },
    async findRequirementByLabel(label) {
      const found = state.requirements.find((r) => r.label.toLowerCase() === label.toLowerCase());
      return found ? { ...found } : null;
    },
    async insertRequirement(label) {
      if (state.requirements.some((r) => r.label.toLowerCase() === label.toLowerCase())) {
        throw new Error('duplicate key value violates unique constraint "requirements_requirement_label_key"');
      }
      const record: RequirementRecord = { requirementId: state.nextRequirementId, label, isDefault: false };
      state.nextRequirementId += 1;
      state.requirements.push(record);
      return { ...record };
    },
    async insertClearance({ studentId, academicYear, semester }) {
      if (state.clearances.some((c) => c.studentId === studentId && c.academicYear === academicYear && c.semester === semester)) {
        throw new Error('duplicate key value violates unique constraint "clearances_student_id_academic_year_semester_key"');
      }
      const record: ClearanceRecord = {
        clearanceId: state.nextClearanceId,
        studentId,
        academicYear,
        semester,
        status: 'pending',
        items: [],
      };
      state.nextClearanceId += 1;
      state.clearances.push(record);
      return record.clearanceId;
    },
    async addItems(clearanceId, requirementIds) {
      const clearance = find(clearanceId);
      if (!clearance) throw new Error(`No clearance ${clearanceId}`);
      for (const requirementId of requirementIds) {
        if (clearance.items.some((item) => item.requirementId === requirementId)) {
          throw new Error('duplicate key value violates unique constraint "clearance_requirements_clearance_id_requirement_id_key"');
        }
        clearance.items.push({
          requirementId,
          label: labelOf(requirementId),
          status: 'pending',
          remarks: null,
          completedByEmployeeId: null,
          dateCompleted: null,
        });
      }
    },
    async removeItem(clearanceId, requirementId) {
      const clearance = find(clearanceId);
      if (!clearance) throw new Error(`No clearance ${clearanceId}`);
      clearance.items = clearance.items.filter((item) => item.requirementId !== requirementId);
    },
    async setItem(clearanceId, requirementId, patch) {
      const clearance = find(clearanceId);
      const item = clearance?.items.find((entry) => entry.requirementId === requirementId);
      if (!item) throw new Error(`No item ${requirementId} on clearance ${clearanceId}`);
      item.status = patch.status;
      item.remarks = patch.remarks;
      item.completedByEmployeeId = patch.completedByEmployeeId;
      item.dateCompleted = patch.dateCompleted;
    },
    async setClearanceStatus(clearanceId, status) {
      const clearance = find(clearanceId);
      if (!clearance) throw new Error(`No clearance ${clearanceId}`);
      clearance.status = status;
    },
    async addHistory(input) {
      state.history.push(input);
    },
    async addNotification(input) {
      if (state.notifications.some((n) => n.idempotencyKey === input.idempotencyKey)) return;
      state.notifications.push(input);
    },
  };
}
