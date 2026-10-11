import type { PrismaClient } from '../../generated/prisma/client.js';
import type { Severity } from '../../../shared/types.js';
import type { HandbookEntryRecord, HandbookRepo } from './repo.js';

const include = {
  violations: true,
  handbook_entry_sanctions: { include: { sanctions: true } },
} as const;

type Row = {
  handbook_entry_id: number;
  handbook_section: string;
  violations: { violation_id: number; violation_type: string; severity: string; description: string; is_system: boolean };
  handbook_entry_sanctions: Array<{
    offense_number: number;
    sanction_id: number;
    sanctions: { sanction_type: string; description: string };
  }>;
};

function toRecord(row: Row): HandbookEntryRecord {
  return {
    handbookEntryId: row.handbook_entry_id,
    handbookSection: row.handbook_section,
    violation: {
      violationId: row.violations.violation_id,
      violationType: row.violations.violation_type,
      severity: row.violations.severity as Severity,
      description: row.violations.description,
      isSystem: row.violations.is_system,
    },
    sanctions: row.handbook_entry_sanctions
      .map((link) => ({
        offenseNumber: link.offense_number,
        sanctionId: link.sanction_id,
        sanctionType: link.sanctions.sanction_type,
        description: link.sanctions.description,
      }))
      .sort((a, b) => a.offenseNumber - b.offenseNumber || a.sanctionId - b.sanctionId),
  };
}

/** Prisma-backed handbook reads. Takes the client as a parameter so callers can pass a transaction. */
export function createPrismaHandbookRepo(db: Pick<PrismaClient, 'handbook_entries'>): HandbookRepo {
  return {
    async listEntries() {
      const rows = await db.handbook_entries.findMany({ include, orderBy: { handbook_entry_id: 'asc' } });
      return rows.map(toRecord);
    },
    async getEntry(handbookEntryId) {
      const row = await db.handbook_entries.findUnique({ where: { handbook_entry_id: handbookEntryId }, include });
      return row ? toRecord(row) : null;
    },
  };
}
