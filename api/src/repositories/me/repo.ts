import type {
  AppointmentStatus,
  CaseSanctionStatus,
  CaseStatus,
  Severity,
} from '@shared/types.js';

export interface CaseRecord {
  caseId: number;
  /** Display code, `SDO-2026-016` (derived, see codes.ts). */
  code: string;
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

/** What only the case detail needs (UI-POLISH-SPEC 5.15): where it came from and its escalation links, as codes. */
export interface CaseDetailExtras {
  source: 'gate' | 'staff';
  /** `GI-1045` for a gate report; null for a staff record. */
  submissionCode: string | null;
  /** On a counted minor: the code of the Major case it counted toward. */
  countedTowardCode: string | null;
  /** On a converted Major: the codes of the minors it was created from. */
  linkedCaseCodes: string[];
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
  /** Display code of the sanction's case. */
  caseCode: string;
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
  /** Name of the staff member who assigned it (D15); never the employee id. */
  assignedBy: string;
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

export interface StudentProfileRecord {
  studentId: string;
  firstName: string;
  lastName: string;
  email: string;
  program: string;
  yearLevel: number;
  isActive: boolean;
}

export interface StudentSummaryRecord extends StudentProfileRecord {
  openCases: number;
  activeSanctions: number;
}

/**
 * Read-only views of one student's own data. Every method takes the student id from the signed-in
 * session (never from the request), and implementations must filter by it.
 */
export interface StudentViewRepo {
  listCases(studentId: string): Promise<CaseRecord[]>;
  getCase(studentId: string, caseId: number): Promise<(CaseRecord & CaseDetailExtras & { history: CaseHistoryRecord[] }) | null>;
  listSanctions(studentId: string, options?: { caseId?: number }): Promise<CaseSanctionRecord[]>;
  listAppointments(studentId: string): Promise<AppointmentRecord[]>;
  listClearanceTerms(studentId: string): Promise<ClearanceTermRecord[]>;
  getClearance(studentId: string, academicYear: number, semester: number): Promise<ClearanceRecord | null>;
  getProfile(studentId: string): Promise<StudentProfileRecord | null>;
  /**
   * Staff directory (SPEC 5): newest ids last, optional text match on id, name, email or program. Only the staff
   * routes call it; the student routes never do.
   */
  searchStudents(input: { q: string | null; page: number; pageSize: number }): Promise<{ total: number; rows: StudentSummaryRecord[] }>;
}
