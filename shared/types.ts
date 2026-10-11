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
