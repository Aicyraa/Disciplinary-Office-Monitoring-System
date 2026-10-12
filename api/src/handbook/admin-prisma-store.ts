import type { Prisma, PrismaClient } from '../../generated/prisma/client.js';
import type { Severity } from '@shared/types.js';
import type { AdminEntryRecord, HandbookAdminStore, HandbookAdminTx } from './admin-types.js';

const include = {
  violations: true,
  handbook_entry_sanctions: true,
} as const;

function createTx(db: Prisma.TransactionClient): HandbookAdminTx {
  return {
    async getEntry(handbookEntryId) {
      const row = await db.handbook_entries.findUnique({ where: { handbook_entry_id: handbookEntryId }, include });
      if (!row) return null;
      const record: AdminEntryRecord = {
        handbookEntryId: row.handbook_entry_id,
        violationId: row.violations.violation_id,
        violationType: row.violations.violation_type,
        severity: row.violations.severity as Severity,
        description: row.violations.description,
        isSystem: row.violations.is_system,
        section: row.handbook_section,
        sanctions: row.handbook_entry_sanctions.map((link) => ({ offenseNumber: link.offense_number, sanctionId: link.sanction_id })),
      };
      return record;
    },
    async findViolationByName(name) {
      const row = await db.violations.findFirst({
        where: { violation_type: { equals: name, mode: 'insensitive' } },
        select: { violation_id: true },
      });
      return row ? { violationId: row.violation_id } : null;
    },
    async countSanctions(sanctionIds) {
      return db.sanctions.count({ where: { sanction_id: { in: sanctionIds } } });
    },
    async countCases(handbookEntryId) {
      return db.disciplinary_cases.count({ where: { handbook_entry_id: handbookEntryId } });
    },
    async insertViolation({ violationType, severity, description }) {
      const row = await db.violations.create({
        data: { violation_type: violationType, severity, description, is_system: false },
        select: { violation_id: true },
      });
      return row.violation_id;
    },
    async insertEntry({ violationId, section }) {
      const row = await db.handbook_entries.create({
        data: { violation_id: violationId, handbook_section: section },
        select: { handbook_entry_id: true },
      });
      return row.handbook_entry_id;
    },
    async updateViolation(violationId, patch) {
      await db.violations.update({
        where: { violation_id: violationId },
        data: {
          ...(patch.violationType !== undefined && { violation_type: patch.violationType }),
          ...(patch.severity !== undefined && { severity: patch.severity }),
          ...(patch.description !== undefined && { description: patch.description }),
        },
      });
    },
    async updateEntry(handbookEntryId, patch) {
      await db.handbook_entries.update({
        where: { handbook_entry_id: handbookEntryId },
        data: { ...(patch.section !== undefined && { handbook_section: patch.section }) },
      });
    },
    async replaceSanctions(handbookEntryId, sanctions) {
      await db.handbook_entry_sanctions.deleteMany({ where: { handbook_entry_id: handbookEntryId } });
      if (sanctions.length > 0) {
        await db.handbook_entry_sanctions.createMany({
          data: sanctions.map((choice) => ({
            handbook_entry_id: handbookEntryId,
            sanction_id: choice.sanctionId,
            offense_number: choice.offenseNumber,
          })),
        });
      }
    },
  };
}

/** Prisma-backed handbook admin store: one interactive transaction per service call. */
export function createPrismaHandbookAdminStore(prisma: Pick<PrismaClient, '$transaction'>): HandbookAdminStore {
  return {
    transaction: (work) => prisma.$transaction((db) => work(createTx(db)), { maxWait: 5_000, timeout: 15_000 }),
  };
}
