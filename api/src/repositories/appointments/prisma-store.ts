import type { Prisma, PrismaClient } from '../../../generated/prisma/client.js';
import type { AppointmentStatus } from '@shared/types.js';
import {
  appointmentIdFromCode,
  emptyAppointmentCounts,
  matchesAppointmentFilter,
  pageAppointments,
  type AppointmentListFilter,
  type AppointmentQueries,
  type AppointmentRow,
} from './queries.js';
import type { AppointmentEventType, AppointmentRecord, AppointmentStore, AppointmentTx } from './types.js';

const LIVE = ['scheduled', 'rescheduled'];
const asDay = (date: Date): string => date.toISOString().slice(0, 10);
const toDate = (day: string): Date => new Date(`${day}T00:00:00Z`);

type Row = {
  appointment_id: number;
  student_id: string;
  employee_id: string;
  start_date: Date;
  end_date: Date;
  purpose: string;
  notes: string | null;
  status: string;
  cancel_reason: string | null;
  date_created: Date;
};

const toRecord = (row: Row): AppointmentRecord => ({
  appointmentId: row.appointment_id,
  studentId: row.student_id,
  employeeId: row.employee_id,
  startDate: asDay(row.start_date),
  endDate: asDay(row.end_date),
  purpose: row.purpose,
  notes: row.notes,
  status: row.status as AppointmentStatus,
  cancelReason: row.cancel_reason,
  dateCreated: row.date_created,
});

function createTx(db: Prisma.TransactionClient): AppointmentTx {
  return {
    async lockStudent(studentId) {
      await db.$queryRaw`SELECT student_id FROM student_accounts WHERE student_id = ${studentId} FOR UPDATE`;
    },
    async studentExists(studentId) {
      const found = await db.student_accounts.findUnique({ where: { student_id: studentId }, select: { student_id: true } });
      return found !== null;
    },
    async getAppointment(appointmentId) {
      const row = await db.appointments.findUnique({ where: { appointment_id: appointmentId } });
      return row ? toRecord(row) : null;
    },
    async listLiveForStudent(studentId) {
      const rows = await db.appointments.findMany({ where: { student_id: studentId, status: { in: LIVE } } });
      return rows.map(toRecord);
    },
    async insertAppointment(input) {
      const created = await db.appointments.create({
        data: {
          student_id: input.studentId,
          employee_id: input.employeeId,
          start_date: toDate(input.startDate),
          end_date: toDate(input.endDate),
          purpose: input.purpose,
          notes: input.notes,
          status: 'scheduled',
          date_created: input.date,
          date_updated: input.date,
        },
        select: { appointment_id: true },
      });
      return created.appointment_id;
    },
    async updateAppointment(appointmentId, patch) {
      await db.appointments.update({
        where: { appointment_id: appointmentId },
        data: {
          ...(patch.startDate !== undefined && { start_date: toDate(patch.startDate) }),
          ...(patch.endDate !== undefined && { end_date: toDate(patch.endDate) }),
          ...(patch.purpose !== undefined && { purpose: patch.purpose }),
          ...(patch.notes !== undefined && { notes: patch.notes }),
          ...(patch.status !== undefined && { status: patch.status }),
          ...(patch.cancelReason !== undefined && { cancel_reason: patch.cancelReason }),
          date_updated: patch.date,
        },
      });
    },
    async addHistory(input) {
      await db.appointment_history.create({
        data: {
          appointment_id: input.appointmentId,
          event_type: input.eventType,
          remarks: input.remarks,
          employee_id: input.employeeId,
          date_logged: input.date,
        },
      });
    },
    async addNotification(input) {
      // email_status stays 'pending' (the default); the in-API sweep sends it after the transaction commits.
      await db.notifications.createMany({
        data: [
          {
            recipient_type: 'student',
            student_id: input.studentId,
            kind: 'appt',
            title: input.title,
            message: input.message,
            link_type: 'appointment',
            link_id: input.appointmentId,
            idempotency_key: input.idempotencyKey,
          },
        ],
        skipDuplicates: true,
      });
    },
  };
}

/** Prisma-backed appointment store: one interactive transaction per service call. */
export function createPrismaAppointmentStore(prisma: Pick<PrismaClient, '$transaction'>): AppointmentStore {
  return {
    transaction: (work) => prisma.$transaction((db) => work(createTx(db)), { maxWait: 5_000, timeout: 15_000 }),
  };
}

// ---- staff read side -----------------------------------------------------------------------------

// Names only: never load an account row, which carries password_hashed.
const nameOnly = { select: { first_name: true, last_name: true } } as const;

const withNames = {
  // Name, program and year only: never the password hash.
  student_accounts: { select: { first_name: true, last_name: true, year_level: true, programs: { select: { program_name: true } } } },
  employee_accounts: nameOnly,
  appointment_history: { orderBy: { appointment_history_id: 'asc' }, include: { employee_accounts: nameOnly } },
} as const;

type FullRow = Row & {
  student_accounts: { first_name: string; last_name: string; year_level: number; programs: { program_name: string } };
  employee_accounts: { first_name: string; last_name: string };
  appointment_history: Array<{
    event_type: string;
    remarks: string | null;
    date_logged: Date;
    employee_accounts: { first_name: string; last_name: string };
  }>;
};

const fullName = (account: { first_name: string; last_name: string }): string => `${account.first_name} ${account.last_name}`;

function toRow(row: FullRow): AppointmentRow {
  return {
    ...toRecord(row),
    studentName: fullName(row.student_accounts),
    studentProgram: row.student_accounts.programs.program_name,
    studentYearLevel: row.student_accounts.year_level,
    assignedByName: fullName(row.employee_accounts),
    history: row.appointment_history.map((entry) => ({
      eventType: entry.event_type as AppointmentEventType,
      remarks: entry.remarks,
      date: entry.date_logged,
      by: fullName(entry.employee_accounts),
    })),
  };
}

/** Status and search in the database; bucket and dates are matched on the keys (`matchesAppointmentFilter`). */
function listWhere(filter: AppointmentListFilter): Prisma.appointmentsWhereInput {
  const and: Prisma.appointmentsWhereInput[] = [];
  if (filter.status) and.push({ status: filter.status });
  const needle = filter.q?.trim();
  if (needle) {
    const contains = { contains: needle, mode: 'insensitive' as const };
    const codeId = appointmentIdFromCode(needle);
    and.push({
      OR: [
        ...(codeId === null ? [] : [{ appointment_id: codeId }]),
        { student_id: contains },
        { purpose: contains },
        { student_accounts: { OR: [{ first_name: contains }, { last_name: contains }] } },
      ],
    });
  }
  return and.length > 0 ? { AND: and } : {};
}

/** Prisma-backed staff reads. Staff are one department and see every appointment. */
export function createPrismaAppointmentQueries(db: Pick<PrismaClient, 'appointments'>): AppointmentQueries {
  return {
    async list(filter) {
      // One office's appointments stay small: read the keys, filter and order them here, then load one page.
      const [keys, grouped] = await Promise.all([
        db.appointments.findMany({
          where: listWhere(filter),
          select: { appointment_id: true, status: true, start_date: true, end_date: true },
        }),
        db.appointments.groupBy({ by: ['status'], _count: { _all: true } }),
      ]);
      const statusCounts = emptyAppointmentCounts();
      for (const group of grouped) {
        if (group.status in statusCounts) statusCounts[group.status as AppointmentStatus] = group._count._all;
      }
      const matching = keys
        .map((k) => ({ id: k.appointment_id, status: k.status as AppointmentStatus, startDate: asDay(k.start_date), endDate: asDay(k.end_date) }))
        .filter((k) => matchesAppointmentFilter(k, filter));
      const { page, pageKeys, total, counts } = pageAppointments(matching, filter);
      const ids = pageKeys.map((k) => k.id);
      const loaded = await db.appointments.findMany({ where: { appointment_id: { in: ids } }, include: withNames });
      const byId = new Map(loaded.map((row) => [row.appointment_id, row]));
      return {
        rows: ids.flatMap((id) => (byId.has(id) ? [toRow(byId.get(id) as unknown as FullRow)] : [])),
        total,
        page,
        counts,
        statusCounts,
      };
    },
    async get(appointmentId) {
      const row = await db.appointments.findUnique({ where: { appointment_id: appointmentId }, include: withNames });
      return row ? toRow(row as unknown as FullRow) : null;
    },
  };
}
