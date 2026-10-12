import type { Prisma, PrismaClient } from '../../generated/prisma/client.js';
import { CLEARANCE_PAGE_SIZE, type ClearanceListFilter, type ClearanceQueries, type ClearanceRow } from './queries.js';
import type {
  ClearanceEventType,
  ClearanceRecord,
  ClearanceStatus,
  ClearanceStore,
  ClearanceTx,
  RequirementRecord,
  RequirementStatus,
} from './types.js';

type ItemRow = {
  requirement_id: number;
  status: string;
  remarks: string | null;
  completed_by_employee_id: string | null;
  date_completed: Date | null;
  requirements: { requirement_label: string };
};

type ClearanceRowRaw = {
  clearance_id: number;
  student_id: string;
  academic_year: number;
  semester: number;
  status: string;
  clearance_requirements: ItemRow[];
};

const withItems = {
  clearance_requirements: { include: { requirements: true }, orderBy: { clearance_requirement_id: 'asc' } },
} as const;

function toRecord(row: ClearanceRowRaw): ClearanceRecord {
  return {
    clearanceId: row.clearance_id,
    studentId: row.student_id,
    academicYear: row.academic_year,
    semester: row.semester,
    status: row.status as ClearanceStatus,
    items: row.clearance_requirements.map((item) => ({
      requirementId: item.requirement_id,
      label: item.requirements.requirement_label,
      status: item.status as RequirementStatus,
      remarks: item.remarks,
      completedByEmployeeId: item.completed_by_employee_id,
      dateCompleted: item.date_completed,
    })),
  };
}

const toRequirement = (row: { requirement_id: number; requirement_label: string; is_default: boolean }): RequirementRecord => ({
  requirementId: row.requirement_id,
  label: row.requirement_label,
  isDefault: row.is_default,
});

function createTx(db: Prisma.TransactionClient): ClearanceTx {
  return {
    async lockStudent(studentId) {
      await db.$queryRaw`SELECT student_id FROM student_accounts WHERE student_id = ${studentId} FOR UPDATE`;
    },
    async studentExists(studentId) {
      return (await db.student_accounts.findUnique({ where: { student_id: studentId }, select: { student_id: true } })) !== null;
    },
    async getClearance(clearanceId) {
      const row = await db.clearances.findUnique({ where: { clearance_id: clearanceId }, include: withItems });
      return row ? toRecord(row as unknown as ClearanceRowRaw) : null;
    },
    async findClearance(studentId, academicYear, semester) {
      const row = await db.clearances.findUnique({
        where: { student_id_academic_year_semester: { student_id: studentId, academic_year: academicYear, semester } },
        include: withItems,
      });
      return row ? toRecord(row as unknown as ClearanceRowRaw) : null;
    },
    async listDefaultRequirements() {
      const rows = await db.requirements.findMany({ where: { is_default: true }, orderBy: { requirement_id: 'asc' } });
      return rows.map(toRequirement);
    },
    async findRequirementByLabel(label) {
      const row = await db.requirements.findFirst({ where: { requirement_label: { equals: label, mode: 'insensitive' } } });
      return row ? toRequirement(row) : null;
    },
    async insertRequirement(label) {
      const row = await db.requirements.create({ data: { requirement_label: label, is_default: false } });
      return toRequirement(row);
    },
    async insertClearance({ studentId, employeeId, academicYear, semester }) {
      const created = await db.clearances.create({
        data: { student_id: studentId, employee_id: employeeId, academic_year: academicYear, semester, status: 'pending' },
        select: { clearance_id: true },
      });
      return created.clearance_id;
    },
    async addItems(clearanceId, requirementIds) {
      await db.clearance_requirements.createMany({
        data: requirementIds.map((requirementId) => ({ clearance_id: clearanceId, requirement_id: requirementId })),
      });
    },
    async removeItem(clearanceId, requirementId) {
      await db.clearance_requirements.deleteMany({ where: { clearance_id: clearanceId, requirement_id: requirementId } });
    },
    async setItem(clearanceId, requirementId, patch) {
      await db.clearance_requirements.updateMany({
        where: { clearance_id: clearanceId, requirement_id: requirementId },
        data: {
          status: patch.status,
          remarks: patch.remarks,
          completed_by_employee_id: patch.completedByEmployeeId,
          date_completed: patch.dateCompleted,
        },
      });
    },
    async setClearanceStatus(clearanceId, status) {
      await db.clearances.update({ where: { clearance_id: clearanceId }, data: { status } });
    },
    async addHistory(input) {
      await db.clearance_history.create({
        data: {
          clearance_id: input.clearanceId,
          requirement_id: input.requirementId,
          event_type: input.eventType,
          remarks: input.remarks,
          employee_id: input.employeeId,
          date_logged: input.date,
        },
      });
    },
    async addNotification(input) {
      await db.notifications.createMany({
        data: [
          {
            recipient_type: 'student',
            student_id: input.studentId,
            kind: 'clr',
            title: input.title,
            message: input.message,
            link_type: 'clearance',
            link_id: input.clearanceId,
            idempotency_key: input.idempotencyKey,
          },
        ],
        skipDuplicates: true,
      });
    },
  };
}

/** Prisma-backed clearance store: one interactive transaction per service call. */
export function createPrismaClearanceStore(prisma: Pick<PrismaClient, '$transaction'>): ClearanceStore {
  return {
    transaction: (work) => prisma.$transaction((db) => work(createTx(db)), { maxWait: 5_000, timeout: 15_000 }),
  };
}

// ---- staff read side -----------------------------------------------------------------------------

// Names only: never load an account row, which carries password_hashed.
const nameOnly = { select: { first_name: true, last_name: true } } as const;
const fullName = (account: { first_name: string; last_name: string }): string => `${account.first_name} ${account.last_name}`;

const OPEN_CASE_STATUSES = ['validated', 'for_sanction'];

type FullRow = ClearanceRowRaw & {
  student_accounts: { first_name: string; last_name: string };
  clearance_requirements: Array<ItemRow & { employee_accounts: { first_name: string; last_name: string } | null }>;
  clearance_history: Array<{
    event_type: string;
    remarks: string | null;
    date_logged: Date;
    requirements: { requirement_label: string } | null;
    employee_accounts: { first_name: string; last_name: string };
  }>;
};

const detailInclude = {
  student_accounts: nameOnly,
  clearance_requirements: {
    include: { requirements: true, employee_accounts: nameOnly },
    orderBy: { clearance_requirement_id: 'asc' },
  },
  clearance_history: {
    include: { requirements: true, employee_accounts: nameOnly },
    orderBy: { clearance_history_id: 'asc' },
  },
} as const;

function toRow(row: FullRow, openCases: number): ClearanceRow {
  const staffNames: Record<string, string> = {};
  for (const item of row.clearance_requirements) {
    if (item.completed_by_employee_id && item.employee_accounts) {
      staffNames[item.completed_by_employee_id] = fullName(item.employee_accounts);
    }
  }
  return {
    ...toRecord(row),
    studentName: fullName(row.student_accounts),
    staffNames,
    openCases,
    history: row.clearance_history.map((entry) => ({
      eventType: entry.event_type as ClearanceEventType,
      requirementLabel: entry.requirements?.requirement_label ?? null,
      remarks: entry.remarks,
      date: entry.date_logged,
      by: fullName(entry.employee_accounts),
    })),
  };
}

function listWhere(filter: ClearanceListFilter): Prisma.clearancesWhereInput {
  const and: Prisma.clearancesWhereInput[] = [];
  if (filter.status) and.push({ status: filter.status });
  const needle = filter.q?.trim();
  if (needle) {
    const contains = { contains: needle, mode: 'insensitive' as const };
    and.push({
      OR: [{ student_id: contains }, { student_accounts: { OR: [{ first_name: contains }, { last_name: contains }] } }],
    });
  }
  return and.length > 0 ? { AND: and } : {};
}

/** Prisma-backed staff reads. Staff are one department and see every clearance. */
export function createPrismaClearanceQueries(
  db: Pick<PrismaClient, 'clearances' | 'disciplinary_cases'>,
): ClearanceQueries {
  async function openCaseCounts(studentIds: string[]): Promise<Map<string, number>> {
    if (studentIds.length === 0) return new Map();
    const groups = await db.disciplinary_cases.groupBy({
      by: ['student_id'],
      where: { student_id: { in: studentIds }, status: { in: OPEN_CASE_STATUSES } },
      _count: { _all: true },
    });
    return new Map(groups.flatMap((group) => (group.student_id ? [[group.student_id, group._count._all] as const] : [])));
  }

  return {
    async list(filter) {
      const where = listWhere(filter);
      const [rows, total] = await Promise.all([
        db.clearances.findMany({
          where,
          include: detailInclude,
          orderBy: [{ academic_year: 'desc' }, { semester: 'desc' }, { clearance_id: 'desc' }],
          skip: (filter.page - 1) * CLEARANCE_PAGE_SIZE,
          take: CLEARANCE_PAGE_SIZE,
        }),
        db.clearances.count({ where }),
      ]);
      const counts = await openCaseCounts([...new Set(rows.map((row) => row.student_id))]);
      return { rows: rows.map((row) => toRow(row as unknown as FullRow, counts.get(row.student_id) ?? 0)), total };
    },
    async get(clearanceId) {
      const row = await db.clearances.findUnique({ where: { clearance_id: clearanceId }, include: detailInclude });
      if (!row) return null;
      const counts = await openCaseCounts([row.student_id]);
      return toRow(row as unknown as FullRow, counts.get(row.student_id) ?? 0);
    },
  };
}
