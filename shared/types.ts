/** `GET /health` is a probe and keeps its documented plain body; it is the only route outside the envelope. */
export type HealthResponse = {
  status: 'ok';
};

// ---- The one API response shape ---------------------------------------------------------------
// Every JSON response of the API, success or failure, is one of these two types. The client unwraps
// them in one place (client/src/lib/api.ts) and the API builds them in one place (api/src/http.ts).

/** Every successful response: the payload is always under `data` (`null` when there is nothing to return). */
export type ApiSuccess<T> = {
  ok: true;
  data: T;
};

/**
 * Closed set of error codes. A code is stable and machine-readable; `message` is for people and may be shown
 * as it is. Adding a code means adding it here, so both sides see it.
 */
export type ApiErrorCode =
  // transport and infrastructure
  | 'route_not_found'
  | 'internal_error'
  | 'invalid_json'
  | 'payload_too_large'
  | 'server_not_configured'
  | 'storage_unavailable'
  | 'too_many_attempts'
  // identity and access
  | 'not_authenticated'
  | 'forbidden'
  | 'password_change_required'
  | 'invalid_credentials'
  | 'weak_password'
  | 'wrong_password'
  | 'same_password'
  // request and state
  | 'invalid_input'
  | 'not_found'
  | 'invalid_status'
  | 'not_cleared'
  // cases
  | 'student_not_found'
  | 'violation_not_found'
  | 'violation_not_allowed'
  | 'already_decided'
  | 'student_not_matched'
  | 'student_already_linked'
  | 'sanctions_incomplete'
  // appointments
  | 'invalid_date'
  | 'appointment_overlap'
  // handbook admin
  | 'violation_exists'
  | 'violation_in_use'
  // clearance
  | 'clearance_exists'
  | 'requirement_exists'
  // sanctions and proof files
  | 'sanction_not_allowed'
  | 'already_assigned'
  | 'due_date_in_past'
  | 'upload_not_allowed'
  | 'already_reviewed'
  | 'last_file'
  | 'files_not_viewed'
  | 'unsupported_type'
  | 'empty'
  | 'too_large'
  | 'too_many_files'
  | 'content_mismatch';

/** Every failed response (HTTP status 4xx or 5xx). */
export type ApiFailure = {
  ok: false;
  error: {
    code: ApiErrorCode;
    message: string;
  };
};

export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;

// ---- Notifications (SPEC 4.6, 6.3; POWER-AUTOMATE.md section 4) ---------------------------------

/**
 * The closed set of notification kinds: the `notifications.kind` values, and the `type` of every
 * Power Automate request. A new kind is a spec change, not an ad-hoc string.
 */
export type NotificationKind = 'report' | 'case' | 'esc' | 'sanction' | 'appt' | 'clr' | 'account' | 'newviol' | 'notice';

export type NotificationLinkType = 'case' | 'sanction' | 'appointment' | 'student' | 'clearance' | 'inbox';

export type NotificationView = {
  id: number;
  kind: NotificationKind;
  title: string;
  message: string;
  isRead: boolean;
  /** ISO timestamp (UTC). */
  dateCreated: string;
  /** The app page this notification points to, or null. Built by the API (one mapping for inbox and email). */
  href: string | null;
};

export type NotificationListResponse = {
  /** Newest first. */
  notifications: NotificationView[];
  unreadCount: number;
};

/** A notice the office broadcast to every student (UI-POLISH-SPEC decision 1). Staff manage them. */
export type NoticeView = {
  id: number;
  title: string;
  message: string;
  instructions: string | null;
  /** YYYY-MM-DD, or null when the notice does not expire. */
  expiresOn: string | null;
  expired: boolean;
  createdBy: string;
  dateCreated: string;
  dateUpdated: string;
  /** Students who received it. */
  recipients: number;
};

export type NoticeListResponse = { notices: NoticeView[] };

export type AccountRole = 'student' | 'staff';

/** The signed-in user as the API exposes it. Never carries a password hash. */
export type AuthUser = {
  role: AccountRole;
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  mustChangePassword: boolean;
  /** A short-lived link to the profile picture (SPEC 4.8), or null when none is set. Never the storage key. */
  avatarUrl: string | null;
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
  /** Cases whose current handbook entry is this one. Only staff receive it (SPEC 4.9, "used in N cases"). */
  usedInCases?: number;
};

export type SanctionTemplateFileView = {
  /** files.file_id, the id used to download or remove the file. */
  id: number;
  name: string;
  mimeType: string;
  sizeBytes: number;
  /** ISO timestamp (UTC). */
  dateUploaded: string;
};

/** One sanction with its template page (SPEC 6.1, 5): written text and downloadable PDF/DOCX files. */
export type SanctionTemplateView = {
  sanctionId: number;
  /** Display code, S001 style. */
  sanctionCode: string;
  type: string;
  /** The sanction's own description from the handbook. */
  sanctionDescription: string;
  title: string | null;
  description: string | null;
  requirements: string | null;
  /** ISO timestamp (UTC), or null while staff have not written the template yet. */
  dateUpdated: string | null;
  files: SanctionTemplateFileView[];
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
  /** The officer who assigned it, by name (UI-POLISH-SPEC D15). */
  assignedBy: string;
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
  /** Display code, `SDO-2026-016`. */
  code: string;
  status: CaseStatus;
  caseDate: string;
  violation: string;
  severity: Severity;
  section: string;
  /** The handbook entry, for "View this offense in the Handbook". */
  handbookEntryId: number;
  /** This minor was counted into a 3-minor Major case. */
  isEscalated: boolean;
  /** Set on a converted Major case: the minor violation it started as. */
  convertedFrom: string | null;
  resolvedWithoutSanction: boolean;
  dateResolved: string | null;
};

export type StudentCaseDetailView = StudentCaseView & {
  /** "Gate report GI-1045" or "Recorded by SDO staff" (UI-POLISH-SPEC 5.15). */
  source: 'gate' | 'staff';
  submissionCode: string | null;
  /** On a counted minor: the Major case it counted toward. */
  countedTowardCode: string | null;
  /** On a converted Major: the minors it was created from. */
  linkedCaseCodes: string[];
  timeline: CaseTimelineEntry[];
  sanctions: StudentSanctionView[];
};

export type StudentAppointmentView = {
  id: number;
  /** Display code, `A-104`. */
  code: string;
  startDate: string;
  endDate: string;
  purpose: string;
  notes: string | null;
  status: AppointmentStatus;
  cancelReason: string | null;
  /** ISO timestamp of the last change. */
  dateUpdated: string;
  /** Upcoming: live status and the window has not ended (Asia/Manila date). Everything else is history. */
  bucket: 'upcoming' | 'history';
};

/** One row of an appointment's change log (SPEC 4.5): assigned, rescheduled, notes changed, completed, cancelled. */
export type AppointmentHistoryEntry = {
  eventType: 'assigned' | 'rescheduled' | 'remarks_updated' | 'completed' | 'cancelled';
  remarks: string | null;
  /** ISO timestamp (UTC). */
  date: string;
  /** The staff member's name. */
  by: string;
};

/** What staff see (SPEC 5): every appointment of every student, with its log. */
export type StaffAppointmentView = {
  id: number;
  /** Display code, `A-104`. */
  code: string;
  /** Program and year for the "BSIT · 3rd Year" line; null when unknown. */
  student: { id: string; name: string; program: string | null; yearLevel: number | null };
  startDate: string;
  endDate: string;
  purpose: string;
  notes: string | null;
  status: AppointmentStatus;
  cancelReason: string | null;
  bucket: 'upcoming' | 'history';
  assignedBy: string;
  /** ISO timestamp (UTC). */
  dateCreated: string;
  history: AppointmentHistoryEntry[];
};

export type StaffAppointmentListResponse = {
  appointments: StaffAppointmentView[];
  total: number;
  page: number;
  pageSize: number;
  /** Matches per group: "UPCOMING 3" and "PAST AND CLOSED 2". */
  counts: { upcoming: number; closed: number };
  /** Every appointment per status (the status menu counts the whole office). */
  statusCounts: Record<AppointmentStatus, number>;
};

/** One row of a clearance's change log (SPEC 4.4). */
export type ClearanceHistoryEntry = {
  eventType: 'set_up' | 'marked_done' | 'reversed' | 'requirement_added' | 'requirement_removed';
  /** The requirement the change was about, when there is one. */
  requirement: string | null;
  remarks: string | null;
  /** ISO timestamp (UTC). */
  date: string;
  by: string;
};

export type StaffClearanceItemView = {
  requirementId: number;
  label: string;
  status: 'pending' | 'completed';
  remarks: string | null;
  /** ISO timestamp (UTC), or null while pending. */
  dateCompleted: string | null;
  completedBy: string | null;
  /** True for "No active violations" marked done while the student still has open cases (a hint, never a block). */
  warning: boolean;
};

/** What staff see for one student's term (SPEC 4.4, 5). */
export type StaffClearanceView = {
  id: number;
  student: { id: string; name: string };
  academicYear: number;
  semester: number;
  status: 'pending' | 'cleared';
  items: StaffClearanceItemView[];
  /** The student's cases that are validated or for sanction, for the warning chip. */
  openCases: number;
  history: ClearanceHistoryEntry[];
};

export type StaffClearanceListResponse = {
  clearances: StaffClearanceView[];
  total: number;
  page: number;
  pageSize: number;
};

/** A school term: `academicYear` is the start year (2026 = 2026-2027), `semester` 1 to 3 ("1st Term"). */
export type TermRef = { academicYear: number; semester: number };

/** `GET /clearances/terms` (UI-POLISH-SPEC D3): the current term and every term that has clearances. */
export type ClearanceTermsResponse = { current: TermRef; terms: TermRef[] };

/** One student of a term on the staff Clearance list; `clearance` is null while it is not set up ("Not set"). */
export type ClearanceRosterRow = {
  studentId: string;
  name: string;
  program: string;
  yearLevel: number;
  clearance: { id: number; status: 'pending' | 'cleared'; done: number; total: number } | null;
};

/** `GET /clearances/terms/:year/:semester/students`. `notCleared` counts every active student, before the search. */
export type ClearanceRosterResponse = {
  term: TermRef;
  students: ClearanceRosterRow[];
  total: number;
  page: number;
  pageSize: number;
  notCleared: number;
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

/** A student's own account details (read-only), and the head of a staff student record. */
export type StudentProfileView = {
  studentId: string;
  firstName: string;
  lastName: string;
  email: string;
  program: string;
  yearLevel: number;
  isActive: boolean;
};

/** One row of the staff Students list (SPEC 5). */
export type StaffStudentRow = StudentProfileView & {
  /** Cases that are reported, validated or for_sanction. */
  openCases: number;
  /** Sanctions that are assigned, pending verification or returned. */
  activeSanctions: number;
};

export type StaffStudentListResponse = {
  students: StaffStudentRow[];
  total: number;
  page: number;
  pageSize: number;
};

/** A student's record as staff see it: the same views the student sees, plus the account details. */
export type StaffStudentRecord = {
  profile: StudentProfileView;
  cases: StudentCaseView[];
  sanctions: StudentSanctionView[];
  appointments: StudentAppointmentView[];
  clearanceTerms: ClearanceTermView[];
};

/** What the printable clearance slip shows. Only produced for a cleared term (UI-POLISH-SPEC decision 2). */
export type ClearanceSlipView = {
  student: StudentProfileView;
  academicYear: number;
  semester: number;
  /** Date the last requirement was completed, YYYY-MM-DD (Asia/Manila). */
  clearedOn: string;
  items: Array<{ label: string; dateCompleted: string | null }>;
};

export type StudentClearanceResponse = {
  /** Newest first. */
  terms: ClearanceTermView[];
  clearance: StudentClearanceView | null;
};

// ---- Staff case workflow (SPEC 4.1, 4.2, 4.10; FEATURE-RULES 3.3, 3.5) -----------------------------

export type CaseSource = 'gate' | 'staff';

/** One sanction in the staff queue (SPEC 5: sanctions waiting for verification, overdue ones). */
export type StaffSanctionQueueRow = {
  id: number;
  caseId: number;
  caseCode: string;
  sanctionCode: string;
  type: string;
  status: CaseSanctionStatus;
  student: { id: string; name: string } | null;
  /** YYYY-MM-DD */
  dueDate: string;
  dateSubmitted: string | null;
  /** Derived, never stored: whole days past the due date (0 when on time). */
  lateByDays: number;
  /** Past its due date and not yet verified. */
  overdue: boolean;
};

export type StaffSanctionQueueResponse = {
  sanctions: StaffSanctionQueueRow[];
  total: number;
  page: number;
  pageSize: number;
  /** Whole-system counts, whatever the filter: for dashboard tiles and navigation badges. */
  counts: { pendingVerification: number; overdue: number; active: number };
};

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
  /** Display code of the gate submission, `GI-1042`; null for staff-recorded cases. */
  submissionCode: string | null;
  /** This minor was counted into a 3-minor Major case. */
  isEscalated: boolean;
  /** Set on a converted Major case: the violation it was reported as. */
  convertedFrom: string | null;
  /** The case's latest sanction, for the queue row's third line ("S-019 · Pending verification"). */
  sanction: { code: string; status: CaseSanctionStatus } | null;
  dateResolved: string | null;
};

export type StaffCaseListResponse = {
  cases: StaffCaseRow[];
  /** Cases matching every filter, status included. */
  total: number;
  /** Matches per status with the status filter left out (class and search still apply), for the status menu. */
  statusCounts: Record<CaseStatus, number>;
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
  /** Display codes of this case and the cases named above, keyed by case id. */
  caseCodes: Record<string, string>;
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
