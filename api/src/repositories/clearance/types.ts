export type ClearanceStatus = 'pending' | 'cleared';
export type RequirementStatus = 'pending' | 'completed';
export type ClearanceEventType = 'set_up' | 'marked_done' | 'reversed' | 'requirement_added' | 'requirement_removed';

export interface RequirementRecord {
  requirementId: number;
  label: string;
  isDefault: boolean;
}

export interface ClearanceItemRecord {
  requirementId: number;
  label: string;
  status: RequirementStatus;
  remarks: string | null;
  completedByEmployeeId: string | null;
  dateCompleted: Date | null;
}

export interface ClearanceRecord {
  clearanceId: number;
  studentId: string;
  /** Start year of the school year: 2026 means 2026-2027. */
  academicYear: number;
  /** 1 to 3. */
  semester: number;
  status: ClearanceStatus;
  items: ClearanceItemRecord[];
}

export interface ClearanceHistoryInput {
  clearanceId: number;
  requirementId: number | null;
  eventType: ClearanceEventType;
  remarks: string | null;
  employeeId: string;
  date: Date;
}

export interface ClearanceNotificationInput {
  studentId: string;
  title: string;
  message: string;
  clearanceId: number;
  /** The same update is never stored twice (FEATURE-RULES 3.10). */
  idempotencyKey: string;
}

/** Everything the clearance workflow reads and writes, scoped to one database transaction. */
export interface ClearanceTx {
  /** Serialises changes for one student (SELECT ... FOR UPDATE on the account). */
  lockStudent(studentId: string): Promise<void>;
  studentExists(studentId: string): Promise<boolean>;
  getClearance(clearanceId: number): Promise<ClearanceRecord | null>;
  findClearance(studentId: string, academicYear: number, semester: number): Promise<ClearanceRecord | null>;
  /** The requirements with `is_default = true`: the standard checklist. */
  listDefaultRequirements(): Promise<RequirementRecord[]>;
  /** An existing requirement with exactly this label (case-insensitive), or null. */
  findRequirementByLabel(label: string): Promise<RequirementRecord | null>;
  /** A new custom requirement (`is_default = false`). */
  insertRequirement(label: string): Promise<RequirementRecord>;
  employeeExists(employeeId: string): Promise<boolean>;
  /**
   * The term set-up: every active student without a clearance for the term gets one, with the default items and
   * one `set_up` history row. Students who already have one are left alone (the unique key decides, so two runs
   * at once cannot double up).
   */
  setUpTermForActiveStudents(input: {
    academicYear: number;
    semester: number;
    employeeId: string;
    remarks: string;
    date: Date;
  }): Promise<{ activeStudents: number; created: number }>;
  insertClearance(input: { studentId: string; employeeId: string; academicYear: number; semester: number }): Promise<number>;
  addItems(clearanceId: number, requirementIds: number[]): Promise<void>;
  removeItem(clearanceId: number, requirementId: number): Promise<void>;
  setItem(
    clearanceId: number,
    requirementId: number,
    patch: {
      status: RequirementStatus;
      remarks: string | null;
      completedByEmployeeId: string | null;
      dateCompleted: Date | null;
    },
  ): Promise<void>;
  setClearanceStatus(clearanceId: number, status: ClearanceStatus): Promise<void>;
  addHistory(input: ClearanceHistoryInput): Promise<void>;
  /** Idempotent: an existing key is left alone. */
  addNotification(input: ClearanceNotificationInput): Promise<void>;
}

export interface ClearanceStore {
  /** Runs `work` atomically: every write commits together or none do. */
  transaction<T>(work: (tx: ClearanceTx) => Promise<T>): Promise<T>;
}
