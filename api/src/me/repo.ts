import type {
  AppointmentStatus,
  CaseSanctionStatus,
  CaseStatus,
  Severity,
} from '../../../shared/types.js';

export interface CaseRecord {
  caseId: number;
  status: CaseStatus;
  caseDate: Date;
  isEscalated: boolean;
  resolvedWithoutSanction: boolean;
  dateResolved: Date | null;
  handbookSection: string;
  violationType: string;
  severity: Severity;
  /** The minor violation a converted 3-minor Major case started as. */
  originalViolationType: string | null;
}

export interface CaseHistoryRecord {
  eventType: string;
  statusAfter: CaseStatus | null;
  remarks: string | null;
  date: Date;
}

export interface CaseSanctionRecord {
  caseSanctionId: number;
  caseId: number;
  caseSeverity: Severity;
  sanctionId: number;
  sanctionType: string;
  description: string;
  status: CaseSanctionStatus;
  dateAssigned: Date;
  dueDate: Date;
  dateSubmitted: Date | null;
  dateCompleted: Date | null;
  staffNote: string | null;
  complianceNote: string | null;
  history: Array<{ eventType: string; remarks: string | null; byStaff: boolean; date: Date }>;
  /** Proof files; `dateViewed` is only used to decide whether the student can still change them. */
  files: Array<{
    caseSanctionFileId: number;
    originalName: string;
    mimeType: string;
    sizeBytes: number;
    dateUploaded: Date;
    dateViewed: Date | null;
  }>;
}

export interface AppointmentRecord {
  appointmentId: number;
  startDate: Date;
  endDate: Date;
  purpose: string;
  notes: string | null;
  status: AppointmentStatus;
  cancelReason: string | null;
}

export interface ClearanceTermRecord {
  academicYear: number;
  semester: number;
  status: 'pending' | 'cleared';
}

export interface ClearanceRecord extends ClearanceTermRecord {
  clearanceId: number;
  items: Array<{
    requirementId: number;
    label: string;
    status: 'pending' | 'completed';
    remarks: string | null;
    dateCompleted: Date | null;
  }>;
}

/**
 * Read-only views of one student's own data. Every method takes the student id from the signed-in
 * session (never from the request), and implementations must filter by it.
 */
export interface StudentViewRepo {
  listCases(studentId: string): Promise<CaseRecord[]>;
  getCase(studentId: string, caseId: number): Promise<(CaseRecord & { history: CaseHistoryRecord[] }) | null>;
  listSanctions(studentId: string, options?: { caseId?: number }): Promise<CaseSanctionRecord[]>;
  listAppointments(studentId: string): Promise<AppointmentRecord[]>;
  listClearanceTerms(studentId: string): Promise<ClearanceTermRecord[]>;
  getClearance(studentId: string, academicYear: number, semester: number): Promise<ClearanceRecord | null>;
}
