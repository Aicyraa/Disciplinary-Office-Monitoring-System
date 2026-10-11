import type { CaseStatus, Severity } from '../../../shared/types.js';
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

/** Everything the case workflow reads and writes, scoped to one database transaction. */
export interface CaseTx {
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
