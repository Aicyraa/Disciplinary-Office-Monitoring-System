import type { Prisma, PrismaClient } from '../../generated/prisma/client.js';
import type { CaseSanctionStatus, CaseStatus, Severity, StaffCaseDetail, StaffCaseRow } from '../../../shared/types.js';
import { displayCode } from '../codes.js';
import { CASE_PAGE_SIZE, parseCaseCode, type CaseListFilter, type CaseQueries } from './queries.js';
import type { CaseRecord, CaseStore, CaseTx, HandbookEntryLite } from './types.js';

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
      await db.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${submissionRef}))`;
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

    async detail(caseId) {
      const row = await db.disciplinary_cases.findUnique({
        where: { disciplinary_case_id: caseId },
        include: {
          ...listInclude,
          case_status_history: { orderBy: { date_updated: 'asc' }, include: { employee_accounts: employeeName } },
          [AS_MAJOR]: true,
          [AS_MINOR]: true,
          case_sanctions: { include: { sanctions: true }, orderBy: { case_sanction_id: 'asc' } },
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
        sanctions: row.case_sanctions.map((sanction) => ({
          id: sanction.case_sanction_id,
          sanctionCode: displayCode('S', sanction.sanction_id),
          type: sanction.sanctions.sanction_type,
          status: sanction.status as CaseSanctionStatus,
          dueDate: sanction.due_date.toISOString().slice(0, 10),
        })),
      };
      return detail;
    },
  };
}
