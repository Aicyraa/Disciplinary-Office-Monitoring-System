import type { Prisma, PrismaClient } from '../../generated/prisma/client.js';
import type { CaseSanctionStatus, CaseStatus, Severity, StaffCaseDetail, StaffCaseRow } from '../../../shared/types.js';
import { displayCode } from '../codes.js';
import { toStaffSanctionView } from '../sanctions/views.js';
import { CASE_PAGE_SIZE, parseCaseCode, type CaseListFilter, type CaseQueries } from './queries.js';
import type { CaseRecord, CaseSanctionRecord, CaseStore, CaseTx, HandbookEntryLite } from './types.js';

const CURRENT = 'handbook_entries_disciplinary_cases_handbook_entry_idTohandbook_entries';
const ORIGINAL = 'handbook_entries_disciplinary_cases_original_handbook_entry_idTohandbook_entries';
const AS_MAJOR = 'case_escalations_case_escalations_major_case_idTodisciplinary_cases';
const AS_MINOR = 'case_escalations_case_escalations_minor_case_idTodisciplinary_cases';

const withEntry = { [CURRENT]: { include: { violations: true } } } as const;

type CaseRow = {
  disciplinary_case_id: number;
  student_id: string | null;
  handbook_entry_id: number;
  original_handbook_entry_id: number | null;
  source: string;
  reported_by_employee_id: string | null;
  claimed_student_id: string | null;
  claimed_name: string | null;
  submission_ref: string | null;
  case_date: Date;
  status: string;
  is_escalated: boolean;
  resolved_without_sanction: boolean;
  date_resolved: Date | null;
  [CURRENT]: { violations: { severity: string } };
};

function toRecord(row: CaseRow): CaseRecord {
  return {
    caseId: row.disciplinary_case_id,
    studentId: row.student_id,
    handbookEntryId: row.handbook_entry_id,
    originalHandbookEntryId: row.original_handbook_entry_id,
    source: row.source as CaseRecord['source'],
    reportedByEmployeeId: row.reported_by_employee_id,
    claimedStudentId: row.claimed_student_id,
    claimedName: row.claimed_name,
    submissionRef: row.submission_ref,
    caseDate: row.case_date,
    status: row.status as CaseStatus,
    severity: row[CURRENT].violations.severity as Severity,
    isEscalated: row.is_escalated,
    resolvedWithoutSanction: row.resolved_without_sanction,
    dateResolved: row.date_resolved,
  };
}

const sanctionInclude = {
  sanctions: true,
  // The case's student and status only (never an account row).
  disciplinary_cases: { select: { student_id: true, status: true } },
  case_sanction_files: { include: { files: true }, orderBy: { case_sanction_file_id: 'asc' } },
} as const;

type SanctionRow = {
  case_sanction_id: number;
  disciplinary_case_id: number;
  sanction_id: number;
  status: string;
  date_assigned: Date;
  due_date: Date;
  date_submitted: Date | null;
  date_completed: Date | null;
  staff_note: string | null;
  compliance_note: string | null;
  sanctions: { sanction_type: string };
  disciplinary_cases: { student_id: string | null; status: string };
  case_sanction_files: Array<{
    case_sanction_file_id: number;
    file_id: number;
    viewed_by_employee_id: string | null;
    date_viewed: Date | null;
    files: {
      storage_key: string;
      original_name: string;
      mime_type: string;
      size_bytes: number;
      uploaded_by_student_id: string | null;
      date_uploaded: Date;
    };
  }>;
};

function toSanctionRecord(row: SanctionRow): CaseSanctionRecord {
  return {
    caseSanctionId: row.case_sanction_id,
    caseId: row.disciplinary_case_id,
    studentId: row.disciplinary_cases.student_id,
    caseStatus: row.disciplinary_cases.status as CaseStatus,
    sanctionId: row.sanction_id,
    sanctionType: row.sanctions.sanction_type,
    status: row.status as CaseSanctionStatus,
    dueDate: row.due_date.toISOString().slice(0, 10),
    dateAssigned: row.date_assigned,
    dateSubmitted: row.date_submitted,
    dateCompleted: row.date_completed,
    staffNote: row.staff_note,
    complianceNote: row.compliance_note,
    files: row.case_sanction_files.map((link) => ({
      caseSanctionFileId: link.case_sanction_file_id,
      fileId: link.file_id,
      storageKey: link.files.storage_key,
      originalName: link.files.original_name,
      mimeType: link.files.mime_type,
      sizeBytes: link.files.size_bytes,
      uploadedByStudentId: link.files.uploaded_by_student_id,
      dateUploaded: link.files.date_uploaded,
      dateViewed: link.date_viewed,
      viewedByEmployeeId: link.viewed_by_employee_id,
    })),
  };
}

function createTx(db: Prisma.TransactionClient): CaseTx {
  const entryOf = (row: { handbook_entry_id: number; violations: { violation_type: string; severity: string; is_system: boolean } }): HandbookEntryLite => ({
    handbookEntryId: row.handbook_entry_id,
    violationType: row.violations.violation_type,
    severity: row.violations.severity as Severity,
    isSystem: row.violations.is_system,
  });

  return {
    async lockStudent(studentId) {
      // Serialises escalation counting for this student across concurrent validations.
      await db.$queryRaw`SELECT student_id FROM student_accounts WHERE student_id = ${studentId} FOR UPDATE`;
    },
    async lockSubmission(submissionRef) {
      // Transaction-scoped advisory lock keyed on the submission, released at commit or rollback.
      // $executeRaw, not $queryRaw: the function returns void, which some driver adapters cannot decode.
      await db.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${submissionRef}))`;
    },
    async getCase(caseId) {
      const row = await db.disciplinary_cases.findUnique({ where: { disciplinary_case_id: caseId }, include: withEntry });
      return row ? toRecord(row as unknown as CaseRow) : null;
    },
    async listStudentCases(studentId) {
      const rows = await db.disciplinary_cases.findMany({ where: { student_id: studentId }, include: withEntry });
      return rows.map((row) => toRecord(row as unknown as CaseRow));
    },
    async listSubmission(submissionRef) {
      const rows = await db.disciplinary_cases.findMany({
        where: { submission_ref: submissionRef },
        include: withEntry,
        orderBy: { disciplinary_case_id: 'asc' },
      });
      return rows.map((row) => toRecord(row as unknown as CaseRow));
    },
    async studentExists(studentId) {
      return (await db.student_accounts.count({ where: { student_id: studentId, is_active: true } })) > 0;
    },
    async getHandbookEntry(handbookEntryId) {
      const row = await db.handbook_entries.findUnique({ where: { handbook_entry_id: handbookEntryId }, include: { violations: true } });
      return row ? entryOf(row) : null;
    },
    async getSystemHandbookEntry() {
      const row = await db.handbook_entries.findFirst({ where: { violations: { is_system: true } }, include: { violations: true } });
      return row ? entryOf(row) : null;
    },
    async sanctionCounts(caseId) {
      const [total, completed] = await Promise.all([
        db.case_sanctions.count({ where: { disciplinary_case_id: caseId } }),
        db.case_sanctions.count({ where: { disciplinary_case_id: caseId, status: 'completed' } }),
      ]);
      return { total, completed };
    },

    // ---- sanctions and proof ----------------------------------------------------------------
    async listHandbookSanctions(handbookEntryId) {
      const rows = await db.handbook_entry_sanctions.findMany({
        where: { handbook_entry_id: handbookEntryId },
        include: { sanctions: true },
        orderBy: [{ offense_number: 'asc' }, { sanction_id: 'asc' }],
      });
      return rows.map((row) => ({
        offenseNumber: row.offense_number,
        sanctionId: row.sanction_id,
        sanctionType: row.sanctions.sanction_type,
      }));
    },
    async getSanction(sanctionId) {
      const row = await db.sanctions.findUnique({ where: { sanction_id: sanctionId } });
      return row ? { sanctionId: row.sanction_id, sanctionType: row.sanction_type } : null;
    },
    async listCaseSanctions(caseId) {
      const rows = await db.case_sanctions.findMany({
        where: { disciplinary_case_id: caseId },
        include: sanctionInclude,
        orderBy: { case_sanction_id: 'asc' },
      });
      return rows.map((row) => toSanctionRecord(row as unknown as SanctionRow));
    },
    async getCaseSanction(caseSanctionId) {
      const row = await db.case_sanctions.findUnique({ where: { case_sanction_id: caseSanctionId }, include: sanctionInclude });
      return row ? toSanctionRecord(row as unknown as SanctionRow) : null;
    },
    async getCaseSanctionByFile(caseSanctionFileId) {
      const link = await db.case_sanction_files.findUnique({
        where: { case_sanction_file_id: caseSanctionFileId },
        select: { case_sanction_id: true },
      });
      if (!link) return null;
      const row = await db.case_sanctions.findUnique({ where: { case_sanction_id: link.case_sanction_id }, include: sanctionInclude });
      return row ? toSanctionRecord(row as unknown as SanctionRow) : null;
    },
    async insertCaseSanction(input) {
      const created = await db.case_sanctions.create({
        data: {
          disciplinary_case_id: input.caseId,
          sanction_id: input.sanctionId,
          due_date: new Date(`${input.dueDate}T00:00:00Z`),
          assigned_by_employee_id: input.assignedByEmployeeId,
          staff_note: input.staffNote,
          date_assigned: input.date,
        },
        select: { case_sanction_id: true },
      });
      return created.case_sanction_id;
    },
    async updateCaseSanction(caseSanctionId, patch) {
      await db.case_sanctions.update({
        where: { case_sanction_id: caseSanctionId },
        data: {
          ...(patch.status !== undefined && { status: patch.status }),
          ...(patch.dateSubmitted !== undefined && { date_submitted: patch.dateSubmitted }),
          ...(patch.dateCompleted !== undefined && { date_completed: patch.dateCompleted }),
          ...(patch.verifiedByEmployeeId !== undefined && { verified_by_employee_id: patch.verifiedByEmployeeId }),
          ...(patch.staffNote !== undefined && { staff_note: patch.staffNote }),
          ...(patch.complianceNote !== undefined && { compliance_note: patch.complianceNote }),
        },
      });
    },
    async insertProofFile(input) {
      const file = await db.files.create({
        data: {
          storage_key: input.storageKey,
          original_name: input.originalName,
          mime_type: input.mimeType,
          size_bytes: input.sizeBytes,
          uploaded_by_student_id: input.uploadedByStudentId,
          date_uploaded: input.date,
        },
        select: { file_id: true },
      });
      const link = await db.case_sanction_files.create({
        data: { case_sanction_id: input.caseSanctionId, file_id: file.file_id },
        select: { case_sanction_file_id: true },
      });
      return { caseSanctionFileId: link.case_sanction_file_id, fileId: file.file_id };
    },
    async deleteProofFile(caseSanctionFileId) {
      const link = await db.case_sanction_files.findUnique({
        where: { case_sanction_file_id: caseSanctionFileId },
        select: { file_id: true },
      });
      if (!link) return;
      await db.case_sanction_files.delete({ where: { case_sanction_file_id: caseSanctionFileId } });
      await db.files.delete({ where: { file_id: link.file_id } });
    },
    async markFileViewed(caseSanctionFileId, employeeId, date) {
      await db.case_sanction_files.update({
        where: { case_sanction_file_id: caseSanctionFileId },
        data: { viewed_by_employee_id: employeeId, date_viewed: date },
      });
    },
    async addSanctionHistory(input) {
      await db.case_sanction_history.create({
        data: {
          case_sanction_id: input.caseSanctionId,
          event_type: input.eventType,
          remarks: input.remarks,
          employee_id: input.employeeId,
          student_id: input.studentId,
          date_logged: input.date,
        },
      });
    },
    async addSanctionNotification(input) {
      await db.notifications.createMany({
        data: [
          {
            recipient_type: input.recipient,
            student_id: input.studentId,
            kind: 'sanction',
            title: input.title,
            message: input.message,
            link_type: 'sanction',
            link_id: input.caseSanctionId,
            idempotency_key: input.idempotencyKey,
          },
        ],
        skipDuplicates: true,
      });
    },

    async insertCase(input) {
      const created = await db.disciplinary_cases.create({
        data: {
          student_id: input.studentId,
          handbook_entry_id: input.handbookEntryId,
          source: input.source,
          reported_by_employee_id: input.reportedByEmployeeId,
          status: input.status,
          case_date: input.caseDate,
        },
        select: { disciplinary_case_id: true },
      });
      return created.disciplinary_case_id;
    },
    async updateCase(caseId, patch) {
      await db.disciplinary_cases.update({
        where: { disciplinary_case_id: caseId },
        data: {
          ...(patch.studentId !== undefined && { student_id: patch.studentId }),
          ...(patch.status !== undefined && { status: patch.status }),
          ...(patch.isEscalated !== undefined && { is_escalated: patch.isEscalated }),
          ...(patch.handbookEntryId !== undefined && { handbook_entry_id: patch.handbookEntryId }),
          ...(patch.originalHandbookEntryId !== undefined && { original_handbook_entry_id: patch.originalHandbookEntryId }),
          ...(patch.resolvedWithoutSanction !== undefined && { resolved_without_sanction: patch.resolvedWithoutSanction }),
          ...(patch.dateResolved !== undefined && { date_resolved: patch.dateResolved }),
        },
      });
    },
    async insertEscalation(majorCaseId, minorCaseId) {
      await db.case_escalations.create({ data: { major_case_id: majorCaseId, minor_case_id: minorCaseId } });
    },
    async addHistory(input) {
      await db.case_status_history.create({
        data: {
          disciplinary_case_id: input.caseId,
          event_type: input.eventType,
          status_after: input.statusAfter,
          remarks: input.remarks,
          employee_id: input.employeeId,
          date_updated: input.date,
        },
      });
    },
    async addNotification(input) {
      // email_status stays 'pending' (the default); the in-API sweep that sends it is build step 6.
      await db.notifications.createMany({
        data: [
          {
            recipient_type: 'student',
            student_id: input.studentId,
            kind: input.kind,
            title: input.title,
            message: input.message,
            link_type: 'case',
            link_id: input.caseId,
            idempotency_key: input.idempotencyKey,
          },
        ],
        skipDuplicates: true,
      });
    },
  };
}

/** Prisma-backed case workflow store: one interactive transaction per service call. */
export function createPrismaCaseStore(prisma: Pick<PrismaClient, '$transaction'>): CaseStore {
  return {
    transaction: (work) => prisma.$transaction((db) => work(createTx(db))),
  };
}

// ---- staff read side -----------------------------------------------------------------------------

const listInclude = {
  [CURRENT]: { include: { violations: true } },
  [ORIGINAL]: { include: { violations: true } },
  // Names only: never load the account row, which carries password_hashed.
  student_accounts: { select: { first_name: true, last_name: true } },
} as const;

const employeeName = { select: { first_name: true, last_name: true } } as const;

type ListRow = CaseRow & {
  claimed_program: string | null;
  claimed_year: string | null;
  [CURRENT]: { handbook_section: string; violations: { violation_type: string; severity: string } };
  [ORIGINAL]: { violations: { violation_type: string } } | null;
  student_accounts: { first_name: string; last_name: string } | null;
};

function toRow(row: ListRow): StaffCaseRow {
  return {
    id: row.disciplinary_case_id,
    code: displayCode('C', row.disciplinary_case_id),
    status: row.status as CaseStatus,
    severity: row[CURRENT].violations.severity as Severity,
    violation: row[CURRENT].violations.violation_type,
    section: row[CURRENT].handbook_section,
    caseDate: row.case_date.toISOString(),
    source: row.source as StaffCaseRow['source'],
    student:
      row.student_id && row.student_accounts
        ? { id: row.student_id, name: `${row.student_accounts.first_name} ${row.student_accounts.last_name}` }
        : null,
    claimed:
      row.source === 'gate'
        ? { studentId: row.claimed_student_id, name: row.claimed_name, program: row.claimed_program, year: row.claimed_year }
        : null,
    submissionRef: row.submission_ref,
    isEscalated: row.is_escalated,
    convertedFrom: row[ORIGINAL]?.violations.violation_type ?? null,
  };
}

function listWhere(filter: CaseListFilter): Prisma.disciplinary_casesWhereInput {
  const and: Prisma.disciplinary_casesWhereInput[] = [];
  if (filter.status) and.push({ status: filter.status });
  if (filter.severity) and.push({ [CURRENT]: { violations: { severity: filter.severity } } });
  const needle = filter.q?.trim();
  if (needle) {
    const code = parseCaseCode(needle);
    const contains = { contains: needle, mode: 'insensitive' as const };
    and.push({
      OR: [
        ...(code === null ? [] : [{ disciplinary_case_id: code }]),
        { student_id: contains },
        { claimed_student_id: contains },
        { claimed_name: contains },
        { student_accounts: { OR: [{ first_name: contains }, { last_name: contains }] } },
        { [CURRENT]: { violations: { violation_type: contains } } },
      ],
    });
  }
  return and.length > 0 ? { AND: and } : {};
}

/** Prisma-backed staff queries. Staff see every case (one department), so there is no student scope here. */
export function createPrismaCaseQueries(
  db: Pick<PrismaClient, 'disciplinary_cases'>,
): CaseQueries {
  return {
    async list(filter) {
      const where = listWhere(filter);
      const [rows, total] = await Promise.all([
        db.disciplinary_cases.findMany({
          where,
          include: listInclude,
          orderBy: [{ case_date: filter.sort === 'newest' ? 'desc' : 'asc' }, { disciplinary_case_id: filter.sort === 'newest' ? 'desc' : 'asc' }],
          skip: (filter.page - 1) * CASE_PAGE_SIZE,
          take: CASE_PAGE_SIZE,
        }),
        db.disciplinary_cases.count({ where }),
      ]);
      return { rows: rows.map((row) => toRow(row as unknown as ListRow)), total };
    },

    async detail(caseId, today) {
      const row = await db.disciplinary_cases.findUnique({
        where: { disciplinary_case_id: caseId },
        include: {
          ...listInclude,
          case_status_history: { orderBy: { date_updated: 'asc' }, include: { employee_accounts: employeeName } },
          [AS_MAJOR]: true,
          [AS_MINOR]: true,
          case_sanctions: { include: sanctionInclude, orderBy: { case_sanction_id: 'asc' } },
        },
      });
      if (!row) return null;

      const siblings = row.submission_ref
        ? await db.disciplinary_cases.findMany({
            where: { submission_ref: row.submission_ref, NOT: { disciplinary_case_id: caseId } },
            select: { disciplinary_case_id: true },
            orderBy: { disciplinary_case_id: 'asc' },
          })
        : [];

      const asMajor = row[AS_MAJOR] as Array<{ minor_case_id: number }>;
      const asMinor = row[AS_MINOR] as { major_case_id: number } | null;
      const detail: StaffCaseDetail = {
        ...toRow(row as unknown as ListRow),
        resolvedWithoutSanction: row.resolved_without_sanction,
        dateResolved: row.date_resolved?.toISOString() ?? null,
        timeline: row.case_status_history.map((entry) => ({
          eventType: entry.event_type,
          statusAfter: entry.status_after as CaseStatus | null,
          remarks: entry.remarks,
          date: entry.date_updated.toISOString(),
          by: entry.employee_accounts ? `${entry.employee_accounts.first_name} ${entry.employee_accounts.last_name}` : 'System',
        })),
        createdFromCaseIds: asMajor.map((link) => link.minor_case_id),
        countedTowardCaseId: asMinor?.major_case_id ?? null,
        siblingCaseIds: siblings.map((sibling) => sibling.disciplinary_case_id),
        sanctions: row.case_sanctions.map((sanction) =>
          toStaffSanctionView(toSanctionRecord(sanction as unknown as SanctionRow), today),
        ),
      };
      return detail;
    },
  };
}
