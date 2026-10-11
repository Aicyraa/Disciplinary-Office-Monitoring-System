import type { CaseSanctionStatus, CaseStatus, Severity } from '../../../shared/types.js';
import type { HandbookSanctionRow } from '../sanctions/rules.js';
import type { EscalationCandidate } from './escalation.js';

export type CaseSource = 'gate' | 'staff';

/** A case plus the severity of its current handbook entry, as the domain needs it. */
export interface CaseRecord extends EscalationCandidate {
  studentId: string | null;
  handbookEntryId: number;
  originalHandbookEntryId: number | null;
  source: CaseSource;
  reportedByEmployeeId: string | null;
  claimedStudentId: string | null;
  claimedName: string | null;
  submissionRef: string | null;
  resolvedWithoutSanction: boolean;
  dateResolved: Date | null;
}

export interface HandbookEntryLite {
  handbookEntryId: number;
  violationType: string;
  severity: Severity;
  /** System-only entry (H068 "3 minor offense"): never selectable, only assigned by escalation. */
  isSystem: boolean;
}

export type CaseEventType =
  | 'reported'
  | 'validated'
  | 'rejected'
  | 'remark'
  | 'sanction_assigned'
  | 'escalated'
  | 'flagged_escalated'
  | 'resolved';

export interface HistoryInput {
  caseId: number;
  eventType: CaseEventType;
  statusAfter: CaseStatus | null;
  remarks: string | null;
  /** NULL means the system. */
  employeeId: string | null;
  date: Date;
}

export interface NotificationInput {
  studentId: string;
  kind: 'case' | 'esc' | 'newviol';
  title: string;
  message: string;
  /** Deep link to a case. */
  caseId: number;
  /** Same update is never stored twice (FEATURE-RULES 3.10). */
  idempotencyKey: string;
}

export interface NewCaseInput {
  studentId: string;
  handbookEntryId: number;
  source: CaseSource;
  reportedByEmployeeId: string;
  status: CaseStatus;
  caseDate: Date;
}

export interface CasePatch {
  studentId?: string | null;
  status?: CaseStatus;
  isEscalated?: boolean;
  handbookEntryId?: number;
  originalHandbookEntryId?: number | null;
  resolvedWithoutSanction?: boolean;
  dateResolved?: Date | null;
}

// ---- sanctions and proof files (SPEC 4.3, 6.1) ---------------------------------------------------

export interface ProofFileRecord {
  caseSanctionFileId: number;
  fileId: number;
  storageKey: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  uploadedByStudentId: string | null;
  dateUploaded: Date;
  /** Set when a staff member opened the file; verify is blocked until every file has it. */
  dateViewed: Date | null;
  viewedByEmployeeId: string | null;
}

export interface CaseSanctionRecord {
  caseSanctionId: number;
  caseId: number;
  /** The case's student; null only while a gate report is unmatched (no sanction can exist then). */
  studentId: string | null;
  caseStatus: CaseStatus;
  sanctionId: number;
  sanctionType: string;
  status: CaseSanctionStatus;
  /** YYYY-MM-DD */
  dueDate: string;
  dateAssigned: Date;
  dateSubmitted: Date | null;
  dateCompleted: Date | null;
  staffNote: string | null;
  complianceNote: string | null;
  files: ProofFileRecord[];
}

export interface CaseSanctionPatch {
  status?: CaseSanctionStatus;
  dateSubmitted?: Date | null;
  dateCompleted?: Date | null;
  verifiedByEmployeeId?: string | null;
  staffNote?: string | null;
  complianceNote?: string | null;
}

export type SanctionEventType =
  | 'assigned'
  | 'proof_uploaded'
  | 'proof_replaced'
  | 'proof_removed'
  | 'compliance_recorded'
  | 'returned'
  | 'verified';

export interface SanctionHistoryInput {
  caseSanctionId: number;
  eventType: SanctionEventType;
  remarks: string | null;
  /** Exactly one of employeeId / studentId is set (DB check). */
  employeeId: string | null;
  studentId: string | null;
  date: Date;
}

export interface SanctionNotificationInput {
  /** All staff share one mailbox (recipient_type 'staff', student_id NULL). */
  recipient: 'student' | 'staff';
  studentId: string | null;
  title: string;
  message: string;
  caseSanctionId: number;
  idempotencyKey: string;
}

export interface NewProofFileInput {
  caseSanctionId: number;
  storageKey: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  uploadedByStudentId: string;
  date: Date;
}

/** Everything the case workflow reads and writes, scoped to one database transaction. */
export interface CaseTx {
  // sanctions and proof
  /** Handbook-allowed sanctions for a violation, every offense number. */
  listHandbookSanctions(handbookEntryId: number): Promise<HandbookSanctionRow[]>;
  getSanction(sanctionId: number): Promise<{ sanctionId: number; sanctionType: string } | null>;
  listCaseSanctions(caseId: number): Promise<CaseSanctionRecord[]>;
  getCaseSanction(caseSanctionId: number): Promise<CaseSanctionRecord | null>;
  getCaseSanctionByFile(caseSanctionFileId: number): Promise<CaseSanctionRecord | null>;
  insertCaseSanction(input: {
    caseId: number;
    sanctionId: number;
    dueDate: string;
    assignedByEmployeeId: string;
    staffNote: string | null;
    date: Date;
  }): Promise<number>;
  updateCaseSanction(caseSanctionId: number, patch: CaseSanctionPatch): Promise<void>;
  insertProofFile(input: NewProofFileInput): Promise<{ caseSanctionFileId: number; fileId: number }>;
  /** Removes the link and the files row. */
  deleteProofFile(caseSanctionFileId: number): Promise<void>;
  markFileViewed(caseSanctionFileId: number, employeeId: string, date: Date): Promise<void>;
  addSanctionHistory(input: SanctionHistoryInput): Promise<void>;
  /** Idempotent, like addNotification. */
  addSanctionNotification(input: SanctionNotificationInput): Promise<void>;

  /** Serialises escalation counting per student (SELECT ... FOR UPDATE on the account). */
  lockStudent(studentId: string): Promise<void>;
  /** Serialises decisions on one gate submission (advisory lock), including unmatched ones with no student. */
  lockSubmission(submissionRef: string): Promise<void>;
  getCase(caseId: number): Promise<CaseRecord | null>;
  listStudentCases(studentId: string): Promise<CaseRecord[]>;
  listSubmission(submissionRef: string): Promise<CaseRecord[]>;
  studentExists(studentId: string): Promise<boolean>;
  getHandbookEntry(handbookEntryId: number): Promise<HandbookEntryLite | null>;
  /** The system "3 minor offense" entry (H068), or null if the seed is missing. */
  getSystemHandbookEntry(): Promise<HandbookEntryLite | null>;
  sanctionCounts(caseId: number): Promise<{ total: number; completed: number }>;
  insertCase(input: NewCaseInput): Promise<number>;
  updateCase(caseId: number, patch: CasePatch): Promise<void>;
  insertEscalation(majorCaseId: number, minorCaseId: number): Promise<void>;
  addHistory(input: HistoryInput): Promise<void>;
  /** Idempotent: an existing key is left alone. */
  addNotification(input: NotificationInput): Promise<void>;
}

export interface CaseStore {
  /** Runs `work` atomically: every write commits together or none do. */
  transaction<T>(work: (tx: CaseTx) => Promise<T>): Promise<T>;
}
