import type { PrismaClient } from '../../../generated/prisma/client.js';
import type { AppointmentStatus, CaseSanctionStatus, CaseStatus, Severity } from '@shared/types.js';
import { loadCaseCodes } from '../cases/code-sql.js';
import type { CaseRecord, StudentProfileRecord, StudentViewRepo } from './repo.js';

type Db = Pick<
  PrismaClient,
  'disciplinary_cases' | 'case_sanctions' | 'appointments' | 'clearances' | 'student_accounts' | '$queryRaw'
>;

const CURRENT = 'handbook_entries_disciplinary_cases_handbook_entry_idTohandbook_entries';
const ORIGINAL = 'handbook_entries_disciplinary_cases_original_handbook_entry_idTohandbook_entries';

const caseInclude = {
  [CURRENT]: { include: { violations: true } },
  [ORIGINAL]: { include: { violations: true } },
} as const;

type CaseRow = {
  disciplinary_case_id: number;
  status: string;
  case_date: Date;
  is_escalated: boolean;
  resolved_without_sanction: boolean;
  date_resolved: Date | null;
  [CURRENT]: { handbook_section: string; violations: { violation_type: string; severity: string } };
  [ORIGINAL]: { violations: { violation_type: string } } | null;
};

function toCaseRecord(row: CaseRow, code: string): CaseRecord {
  return {
    caseId: row.disciplinary_case_id,
    code,
    status: row.status as CaseStatus,
    caseDate: row.case_date,
    isEscalated: row.is_escalated,
    resolvedWithoutSanction: row.resolved_without_sanction,
    dateResolved: row.date_resolved,
    handbookSection: row[CURRENT].handbook_section,
    violationType: row[CURRENT].violations.violation_type,
    severity: row[CURRENT].violations.severity as Severity,
    originalViolationType: row[ORIGINAL]?.violations.violation_type ?? null,
  };
}

type AccountRow = {
  student_id: string;
  student_email: string;
  first_name: string;
  last_name: string;
  year_level: number;
  is_active: boolean;
  programs: { program_name: string };
};

const toProfile = (row: AccountRow): StudentProfileRecord => ({
  studentId: row.student_id,
  firstName: row.first_name,
  lastName: row.last_name,
  email: row.student_email,
  program: row.programs.program_name,
  yearLevel: row.year_level,
  isActive: row.is_active,
});

/** Only the columns the profile needs: the password hash is never loaded. */
const ACCOUNT_SELECT = {
  student_id: true,
  student_email: true,
  first_name: true,
  last_name: true,
  year_level: true,
  is_active: true,
  programs: { select: { program_name: true } },
} as const;

const OPEN_CASE_STATUSES = ['reported', 'validated', 'for_sanction'];
const ACTIVE_SANCTION_STATUSES = ['assigned', 'pending_verification', 'returned'];

/** Prisma-backed student views. Every query is scoped by the student id passed in from the session. */
export function createPrismaStudentViewRepo(db: Db): StudentViewRepo {
  return {
    async listCases(studentId) {
      const rows = await db.disciplinary_cases.findMany({
        where: { student_id: studentId },
        include: caseInclude,
        orderBy: { case_date: 'desc' },
      });
      const codes = await loadCaseCodes(db, rows.map((row) => row.disciplinary_case_id));
      return rows.map((row) => toCaseRecord(row as unknown as CaseRow, codes.get(row.disciplinary_case_id) ?? ''));
    },

    async getCase(studentId, caseId) {
      const row = await db.disciplinary_cases.findFirst({
        where: { disciplinary_case_id: caseId, student_id: studentId },
        include: { ...caseInclude, case_status_history: { orderBy: { date_updated: 'asc' } } },
      });
      if (!row) return null;
      const code = (await loadCaseCodes(db, [caseId])).get(caseId) ?? '';
      return {
        ...toCaseRecord(row as unknown as CaseRow, code),
        history: row.case_status_history.map((entry) => ({
          eventType: entry.event_type,
          statusAfter: entry.status_after as CaseStatus | null,
          remarks: entry.remarks,
          date: entry.date_updated,
        })),
      };
    },

    async listSanctions(studentId, options) {
      const rows = await db.case_sanctions.findMany({
        where: {
          disciplinary_cases: {
            student_id: studentId,
            ...(options?.caseId === undefined ? {} : { disciplinary_case_id: options.caseId }),
          },
        },
        include: {
          sanctions: true,
          disciplinary_cases: { include: { [CURRENT]: { include: { violations: true } } } },
          case_sanction_history: { orderBy: { date_logged: 'asc' } },
          case_sanction_files: { include: { files: true }, orderBy: { case_sanction_file_id: 'asc' } },
          // Name only (D15): never the account row, which carries password_hashed.
          employee_accounts_case_sanctions_assigned_by_employee_idToemployee_accounts: { select: { first_name: true, last_name: true } },
        },
        orderBy: { date_assigned: 'desc' },
      });
      const caseCodes = await loadCaseCodes(db, [...new Set(rows.map((row) => row.disciplinary_case_id))]);
      return rows.map((row) => {
        const entry = (row.disciplinary_cases as unknown as CaseRow)[CURRENT];
        return {
          caseSanctionId: row.case_sanction_id,
          caseId: row.disciplinary_case_id,
          caseCode: caseCodes.get(row.disciplinary_case_id) ?? '',
          caseSeverity: entry.violations.severity as Severity,
          sanctionId: row.sanction_id,
          sanctionType: row.sanctions.sanction_type,
          description: row.sanctions.description,
          status: row.status as CaseSanctionStatus,
          dateAssigned: row.date_assigned,
          dueDate: row.due_date,
          dateSubmitted: row.date_submitted,
          dateCompleted: row.date_completed,
          staffNote: row.staff_note,
          complianceNote: row.compliance_note,
          assignedBy: `${row.employee_accounts_case_sanctions_assigned_by_employee_idToemployee_accounts.first_name} ${row.employee_accounts_case_sanctions_assigned_by_employee_idToemployee_accounts.last_name}`,
          history: row.case_sanction_history.map((event) => ({
            eventType: event.event_type,
            remarks: event.remarks,
            byStaff: event.employee_id !== null,
            date: event.date_logged,
          })),
          files: row.case_sanction_files.map((link) => ({
            caseSanctionFileId: link.case_sanction_file_id,
            originalName: link.files.original_name,
            mimeType: link.files.mime_type,
            sizeBytes: link.files.size_bytes,
            dateUploaded: link.files.date_uploaded,
            dateViewed: link.date_viewed,
          })),
        };
      });
    },

    async listAppointments(studentId) {
      const rows = await db.appointments.findMany({
        where: { student_id: studentId },
        orderBy: { start_date: 'desc' },
      });
      return rows.map((row) => ({
        appointmentId: row.appointment_id,
        startDate: row.start_date,
        endDate: row.end_date,
        purpose: row.purpose,
        notes: row.notes,
        status: row.status as AppointmentStatus,
        cancelReason: row.cancel_reason,
      }));
    },

    async listClearanceTerms(studentId) {
      const rows = await db.clearances.findMany({
        where: { student_id: studentId },
        select: { academic_year: true, semester: true, status: true },
      });
      return rows.map((row) => ({
        academicYear: row.academic_year,
        semester: row.semester,
        status: row.status as 'pending' | 'cleared',
      }));
    },

    async getProfile(studentId) {
      const row = await db.student_accounts.findUnique({
        where: { student_id: studentId },
        select: ACCOUNT_SELECT,
      });
      return row ? toProfile(row as unknown as AccountRow) : null;
    },

    async searchStudents({ q, page, pageSize }) {
      const where = q
        ? {
            OR: [
              { student_id: { contains: q, mode: 'insensitive' as const } },
              { first_name: { contains: q, mode: 'insensitive' as const } },
              { last_name: { contains: q, mode: 'insensitive' as const } },
              { student_email: { contains: q, mode: 'insensitive' as const } },
              { programs: { program_name: { contains: q, mode: 'insensitive' as const } } },
            ],
          }
        : {};
      const [total, accounts] = await Promise.all([
        db.student_accounts.count({ where }),
        db.student_accounts.findMany({
          where,
          select: ACCOUNT_SELECT,
          orderBy: [{ last_name: 'asc' }, { first_name: 'asc' }, { student_id: 'asc' }],
          skip: (page - 1) * pageSize,
          take: pageSize,
        }),
      ]);
      const rows = await Promise.all(
        accounts.map(async (account) => {
          const [openCases, activeSanctions] = await Promise.all([
            db.disciplinary_cases.count({
              where: { student_id: account.student_id, status: { in: OPEN_CASE_STATUSES } },
            }),
            db.case_sanctions.count({
              where: {
                status: { in: ACTIVE_SANCTION_STATUSES },
                disciplinary_cases: { student_id: account.student_id },
              },
            }),
          ]);
          return { ...toProfile(account as unknown as AccountRow), openCases, activeSanctions };
        }),
      );
      return { total, rows };
    },

    async getClearance(studentId, academicYear, semester) {
      const row = await db.clearances.findUnique({
        where: {
          student_id_academic_year_semester: { student_id: studentId, academic_year: academicYear, semester },
        },
        include: {
          clearance_requirements: { include: { requirements: true }, orderBy: { clearance_requirement_id: 'asc' } },
        },
      });
      if (!row) return null;
      return {
        clearanceId: row.clearance_id,
        academicYear: row.academic_year,
        semester: row.semester,
        status: row.status as 'pending' | 'cleared',
        items: row.clearance_requirements.map((item) => ({
          requirementId: item.requirement_id,
          label: item.requirements.requirement_label,
          status: item.status as 'pending' | 'completed',
          remarks: item.remarks,
          dateCompleted: item.date_completed,
        })),
      };
    },
  };
}
