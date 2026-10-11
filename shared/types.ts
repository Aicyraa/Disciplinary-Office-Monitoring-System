export type HealthResponse = {
  status: 'ok';
};

export type AccountRole = 'student' | 'staff';

/** The signed-in user as the API exposes it. Never carries a password hash. */
export type AuthUser = {
  role: AccountRole;
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  mustChangePassword: boolean;
};

// ---- Handbook (SPEC 4.9, FEATURE-RULES 3.2) -------------------------------------------------

export type Severity = 'Minor' | 'Major';

export type HandbookSanctionView = {
  offenseNumber: number;
  sanctionId: number;
  /** Display code, S + id padded to 3 digits. */
  sanctionCode: string;
  type: string;
  description: string;
};

export type HandbookEntryView = {
  /** handbook_entries.handbook_entry_id */
  id: number;
  /** Display code, H001 style. */
  code: string;
  violationId: number;
  /** Display code, V001 style. */
  violationCode: string;
  violation: string;
  severity: Severity;
  section: string;
  description: string;
  sanctions: HandbookSanctionView[];
};

// ---- Student's own data (`/me/*`, SPEC 5 student pages) ---------------------------------------

export type CaseStatus = 'reported' | 'validated' | 'for_sanction' | 'resolved' | 'rejected';
export type CaseSanctionStatus = 'assigned' | 'pending_verification' | 'returned' | 'completed';
export type AppointmentStatus = 'scheduled' | 'rescheduled' | 'completed' | 'cancelled';

export type CaseTimelineEntry = {
  eventType: string;
  statusAfter: CaseStatus | null;
  remarks: string | null;
  /** ISO timestamp (UTC). */
  date: string;
};

export type SanctionHistoryEntry = {
  eventType: string;
  remarks: string | null;
  by: 'staff' | 'student';
  date: string;
};

export type ProofFileView = {
  /** Id for `GET /files/:id/url` and `DELETE /files/:id`. */
  id: number;
  name: string;
  mimeType: string;
  sizeBytes: number;
  dateUploaded: string;
};

export type StudentSanctionView = {
  /** case_sanctions.case_sanction_id */
  id: number;
  caseId: number;
  caseCode: string;
  sanctionId: number;
  sanctionCode: string;
  type: string;
  description: string;
  /** Severity of the case's violation, for the Minor/Major filter. */
  severity: Severity;
  status: CaseSanctionStatus;
  dateAssigned: string;
  /** Date only, YYYY-MM-DD. */
  dueDate: string;
  dateSubmitted: string | null;
  dateCompleted: string | null;
  staffNote: string | null;
  complianceNote: string | null;
  history: SanctionHistoryEntry[];
  files: ProofFileView[];
  /** Derived from the due date in Asia/Manila time; never stored. */
  lateByDays: number;
  /** Proof can be uploaded now (the sanction is assigned or returned). */
  canUpload: boolean;
  /** Files can be replaced or removed now (and staff have not reviewed them yet, when pending). */
  canChangeFiles: boolean;
};

export type StudentCaseView = {
  id: number;
  /** Display code, C001 style. */
  code: string;
  status: CaseStatus;
  caseDate: string;
  violation: string;
  severity: Severity;
  section: string;
  /** This minor was counted into a 3-minor Major case. */
  isEscalated: boolean;
  /** Set on a converted Major case: the minor violation it started as. */
  convertedFrom: string | null;
  resolvedWithoutSanction: boolean;
  dateResolved: string | null;
};

export type StudentCaseDetailView = StudentCaseView & {
  timeline: CaseTimelineEntry[];
  sanctions: StudentSanctionView[];
};

export type StudentAppointmentView = {
  id: number;
  startDate: string;
  endDate: string;
  purpose: string;
  notes: string | null;
  status: AppointmentStatus;
  cancelReason: string | null;
  /** Upcoming: live status and the window has not ended (Asia/Manila date). Everything else is history. */
  bucket: 'upcoming' | 'history';
};

export type ClearanceTermView = {
  academicYear: number;
  semester: number;
  status: 'pending' | 'cleared';
};

export type ClearanceItemView = {
  requirementId: number;
  label: string;
  status: 'pending' | 'completed';
  remarks: string | null;
  dateCompleted: string | null;
};

export type StudentClearanceView = ClearanceTermView & {
  id: number;
  items: ClearanceItemView[];
};

export type StudentClearanceResponse = {
  /** Newest first. */
  terms: ClearanceTermView[];
  clearance: StudentClearanceView | null;
};

// ---- Staff case workflow (SPEC 4.1, 4.2, 4.10; FEATURE-RULES 3.3, 3.5) -----------------------------

export type CaseSource = 'gate' | 'staff';

export type StaffCaseRow = {
  id: number;
  /** Display code, C001 style. */
  code: string;
  status: CaseStatus;
  severity: Severity;
  violation: string;
  section: string;
  caseDate: string;
  source: CaseSource;
  /** The matched student, or null while a gate report's ID is unmatched. */
  student: { id: string; name: string } | null;
  /** What the guard typed on the gate form (gate cases only). */
  claimed: { studentId: string | null; name: string | null; program: string | null; year: string | null } | null;
  /** Cases from one gate submit share this reference; validate and reject act on all of them. */
  submissionRef: string | null;
  /** This minor was counted into a 3-minor Major case. */
  isEscalated: boolean;
  /** Set on a converted Major case: the violation it was reported as. */
  convertedFrom: string | null;
};

export type StaffCaseListResponse = {
  cases: StaffCaseRow[];
  total: number;
  page: number;
  pageSize: number;
};

export type StaffTimelineEntry = CaseTimelineEntry & {
  /** Staff member's name, or "System". */
  by: string;
};

export type StaffCaseDetail = StaffCaseRow & {
  resolvedWithoutSanction: boolean;
  dateResolved: string | null;
  timeline: StaffTimelineEntry[];
  /** On a converted Major: the minors it was created from. */
  createdFromCaseIds: number[];
  /** On an escalated minor: the Major case it was counted toward. */
  countedTowardCaseId: number | null;
  /** Other cases from the same gate submission. */
  siblingCaseIds: number[];
  sanctions: StaffSanctionView[];
};

export type StaffProofFileView = ProofFileView & {
  /** A staff member has opened it; verify needs every file viewed. */
  viewed: boolean;
};

export type StaffSanctionView = {
  /** case_sanctions.case_sanction_id: the id used by `/case-sanctions/:id/*`. */
  id: number;
  sanctionCode: string;
  type: string;
  status: CaseSanctionStatus;
  dueDate: string;
  dateSubmitted: string | null;
  dateCompleted: string | null;
  staffNote: string | null;
  complianceNote: string | null;
  lateByDays: number;
  files: StaffProofFileView[];
};

export type SanctionAssignmentOptions = {
  /** Computed by the API: 1 + the student's earlier cases for the same violation. */
  offenseNumber: number;
  /** The offense number whose sanctions are offered (highest defined one when there is no exact match). */
  offenseUsed: number | null;
  sanctions: Array<{ sanctionId: number; sanctionCode: string; type: string; alreadyAssigned: boolean }>;
};

export type EscalationConversion = {
  majorCaseId: number;
  minorCaseIds: number[];
};
