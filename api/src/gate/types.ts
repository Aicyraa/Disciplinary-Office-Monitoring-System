export interface GateEntry {
  handbookEntryId: number;
  violationType: string;
  isSystem: boolean;
}

export interface NewGateCase {
  /** The matched student, or null while the typed ID is not on file. */
  studentId: string | null;
  handbookEntryId: number;
  claimedStudentId: string;
  claimedName: string;
  claimedProgram: string;
  claimedYear: string;
  submissionRef: string;
  caseDate: Date;
}

export interface GateNotificationInput {
  recipient: 'student' | 'staff';
  /** Set for a student notification, null for the staff alert. */
  studentId: string | null;
  title: string;
  message: string;
  /** The first case of the submission: both audiences open it. */
  caseId: number;
  idempotencyKey: string;
}

/** Everything the gate report workflow reads and writes, scoped to one database transaction. */
export interface GateTx {
  findStudent(studentId: string): Promise<{ studentId: string } | null>;
  listProgramNames(): Promise<string[]>;
  getEntries(handbookEntryIds: number[]): Promise<GateEntry[]>;
  /** Gate cases already filed today (Asia/Manila) for the typed ID and these entries. */
  findTodaysDuplicates(
    claimedStudentId: string,
    handbookEntryIds: number[],
    manilaDay: string,
  ): Promise<Array<{ handbookEntryId: number; submissionRef: string }>>;
  insertGateCase(input: NewGateCase): Promise<number>;
  /** The display code of a submission (`GI-1042`): its rank among all submissions, by first case (codes.ts). */
  submissionCode(submissionRef: string): Promise<string>;
  addHistory(input: { caseId: number; date: Date }): Promise<void>;
  /** Idempotent: an existing key is left alone. */
  addNotification(input: GateNotificationInput): Promise<void>;
}

export interface GateStore {
  /** Runs `work` atomically: every write commits together or none do. */
  transaction<T>(work: (tx: GateTx) => Promise<T>): Promise<T>;
}

/** Read side for the public form's dropdowns. Only what a visitor needs: no descriptions, no sanctions. */
export interface GateOptionsReader {
  listOptions(): Promise<{
    violations: Array<{ id: number; name: string; section: string }>;
    programs: string[];
  }>;
}
