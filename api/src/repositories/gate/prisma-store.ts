import type { Prisma, PrismaClient } from '../../../generated/prisma/client.js';
import { loadSubmissionCodes } from '../cases/code-sql.js';
import type { GateOptionsReader, GateStore, GateTx } from '../../types/gate.types.js';

const MANILA_OFFSET = '+08:00';

/** The instants a Manila calendar day (YYYY-MM-DD) starts and ends at. */
function manilaDayRange(day: string): { start: Date; end: Date } {
  const start = new Date(`${day}T00:00:00${MANILA_OFFSET}`);
  return { start, end: new Date(start.getTime() + 24 * 3_600_000) };
}

function createTx(db: Prisma.TransactionClient): GateTx {
  return {
    async findStudent(studentId) {
      const row = await db.student_accounts.findUnique({ where: { student_id: studentId }, select: { student_id: true } });
      return row ? { studentId: row.student_id } : null;
    },
    async listProgramNames() {
      const rows = await db.programs.findMany({ select: { program_name: true } });
      return rows.map((row) => row.program_name);
    },
    async getEntries(handbookEntryIds) {
      const rows = await db.handbook_entries.findMany({
        where: { handbook_entry_id: { in: handbookEntryIds } },
        include: { violations: true },
      });
      return rows.map((row) => ({
        handbookEntryId: row.handbook_entry_id,
        violationType: row.violations.violation_type,
        isSystem: row.violations.is_system,
      }));
    },
    async findTodaysDuplicates(claimedStudentId, handbookEntryIds, manilaDay) {
      const { start, end } = manilaDayRange(manilaDay);
      const rows = await db.disciplinary_cases.findMany({
        where: {
          source: 'gate',
          claimed_student_id: claimedStudentId,
          handbook_entry_id: { in: handbookEntryIds },
          case_date: { gte: start, lt: end },
        },
        select: { handbook_entry_id: true, submission_ref: true },
      });
      return rows.flatMap((row) =>
        row.submission_ref ? [{ handbookEntryId: row.handbook_entry_id, submissionRef: row.submission_ref }] : [],
      );
    },
    async insertGateCase(input) {
      const row = await db.disciplinary_cases.create({
        data: {
          student_id: input.studentId,
          handbook_entry_id: input.handbookEntryId,
          source: 'gate',
          status: 'reported',
          claimed_student_id: input.claimedStudentId,
          claimed_name: input.claimedName,
          claimed_program: input.claimedProgram,
          claimed_year: input.claimedYear,
          submission_ref: input.submissionRef,
          case_date: input.caseDate,
        },
        select: { disciplinary_case_id: true },
      });
      return row.disciplinary_case_id;
    },
    async submissionCode(submissionRef) {
      return (await loadSubmissionCodes(db, [submissionRef])).get(submissionRef) ?? '';
    },
    async addHistory({ caseId, date }) {
      // employee_id stays NULL: the gate form is the system, not a person (schema comment on the column).
      await db.case_status_history.create({
        data: {
          disciplinary_case_id: caseId,
          event_type: 'reported',
          status_after: 'reported',
          remarks: null,
          employee_id: null,
          date_updated: date,
        },
      });
    },
    async addNotification(input) {
      await db.notifications.createMany({
        data: [
          {
            recipient_type: input.recipient,
            student_id: input.studentId,
            kind: 'report',
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

/** Prisma-backed gate store: one interactive transaction per report. */
export function createPrismaGateStore(prisma: Pick<PrismaClient, '$transaction'>): GateStore {
  return {
    transaction: (work) => prisma.$transaction((db) => work(createTx(db)), { maxWait: 5_000, timeout: 15_000 }),
  };
}

/** What the public form may see: violation names and sections (never the system entry) and program names. */
export function createPrismaGateOptions(db: Pick<PrismaClient, 'handbook_entries' | 'programs'>): GateOptionsReader {
  return {
    async listOptions() {
      const [entries, programs] = await Promise.all([
        db.handbook_entries.findMany({
          where: { violations: { is_system: false } },
          include: { violations: { select: { violation_type: true } } },
          orderBy: { handbook_entry_id: 'asc' },
        }),
        db.programs.findMany({ select: { program_name: true }, orderBy: { program_name: 'asc' } }),
      ]);
      return {
        violations: entries.map((entry) => ({
          id: entry.handbook_entry_id,
          name: entry.violations.violation_type,
          section: entry.handbook_section,
        })),
        programs: programs.map((program) => program.program_name),
      };
    },
  };
}
