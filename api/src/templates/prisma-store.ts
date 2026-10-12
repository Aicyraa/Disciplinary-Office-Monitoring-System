import type { Prisma, PrismaClient } from '../../generated/prisma/client.js';
import type { TemplateReader } from './reader.js';
import type { TemplateRecord, TemplateStore, TemplateTx } from './types.js';

type SanctionRow = {
  sanction_id: number;
  sanction_type: string;
  description: string;
  sanction_templates: {
    sanction_template_id: number;
    title: string | null;
    description: string | null;
    requirements: string | null;
    date_updated: Date;
    sanction_template_files: Array<{
      files: {
        file_id: number;
        storage_key: string;
        original_name: string;
        mime_type: string;
        size_bytes: number;
        date_uploaded: Date;
      };
    }>;
  } | null;
};

const include = {
  sanction_templates: {
    include: { sanction_template_files: { include: { files: true }, orderBy: { file_id: 'asc' } } },
  },
} as const;

function toRecord(row: SanctionRow): TemplateRecord {
  const template = row.sanction_templates;
  return {
    sanctionId: row.sanction_id,
    sanctionType: row.sanction_type,
    sanctionDescription: row.description,
    templateId: template?.sanction_template_id ?? null,
    title: template?.title ?? null,
    description: template?.description ?? null,
    requirements: template?.requirements ?? null,
    dateUpdated: template?.date_updated ?? null,
    files: (template?.sanction_template_files ?? []).map((link) => ({
      fileId: link.files.file_id,
      storageKey: link.files.storage_key,
      originalName: link.files.original_name,
      mimeType: link.files.mime_type,
      sizeBytes: link.files.size_bytes,
      dateUploaded: link.files.date_uploaded,
    })),
  };
}

function createTx(db: Prisma.TransactionClient): TemplateTx {
  const ensure = async (sanctionId: number, employeeId: string, date: Date): Promise<number> => {
    const row = await db.sanction_templates.upsert({
      where: { sanction_id: sanctionId },
      create: { sanction_id: sanctionId, updated_by_employee_id: employeeId, date_updated: date },
      update: {},
      select: { sanction_template_id: true },
    });
    return row.sanction_template_id;
  };
  return {
    async getSanction(sanctionId) {
      const row = await db.sanctions.findUnique({ where: { sanction_id: sanctionId }, select: { sanction_id: true, sanction_type: true } });
      return row ? { sanctionId: row.sanction_id, sanctionType: row.sanction_type } : null;
    },
    async getTemplate(sanctionId) {
      const row = await db.sanctions.findUnique({ where: { sanction_id: sanctionId }, include });
      return row ? toRecord(row as unknown as SanctionRow) : null;
    },
    async saveText({ sanctionId, title, description, requirements, employeeId, date }) {
      const row = await db.sanction_templates.upsert({
        where: { sanction_id: sanctionId },
        create: {
          sanction_id: sanctionId,
          title,
          description,
          requirements,
          updated_by_employee_id: employeeId,
          date_updated: date,
        },
        update: { title, description, requirements, updated_by_employee_id: employeeId, date_updated: date },
        select: { sanction_template_id: true },
      });
      return row.sanction_template_id;
    },
    ensureTemplate: ensure,
    async insertFile(input) {
      const file = await db.files.create({
        data: {
          storage_key: input.storageKey,
          original_name: input.originalName,
          mime_type: input.mimeType,
          size_bytes: input.sizeBytes,
          uploaded_by_employee_id: input.employeeId,
          date_uploaded: input.date,
        },
        select: { file_id: true },
      });
      await db.sanction_template_files.create({
        data: { sanction_template_id: input.templateId, file_id: file.file_id },
      });
      return file.file_id;
    },
    async getFile(fileId) {
      const link = await db.sanction_template_files.findUnique({
        where: { file_id: fileId },
        include: { files: true, sanction_templates: { select: { sanction_id: true } } },
      });
      if (!link) return null;
      return {
        fileId,
        templateId: link.sanction_template_id,
        sanctionId: link.sanction_templates.sanction_id,
        storageKey: link.files.storage_key,
        originalName: link.files.original_name,
      };
    },
    async deleteFile(fileId) {
      await db.sanction_template_files.deleteMany({ where: { file_id: fileId } });
      await db.files.delete({ where: { file_id: fileId } });
    },
    async touch(templateId, employeeId, date) {
      await db.sanction_templates.update({
        where: { sanction_template_id: templateId },
        data: { updated_by_employee_id: employeeId, date_updated: date },
      });
    },
  };
}

/** Prisma-backed template store: one interactive transaction per service call. */
export function createPrismaTemplateStore(prisma: Pick<PrismaClient, '$transaction'>): TemplateStore {
  return {
    transaction: (work) => prisma.$transaction((db) => work(createTx(db)), { maxWait: 5_000, timeout: 15_000 }),
  };
}

/** Prisma-backed read side: every sanction with its template (if any) and files. */
export function createPrismaTemplateReader(db: Pick<PrismaClient, 'sanctions'>): TemplateReader {
  return {
    async list() {
      const rows = await db.sanctions.findMany({ include, orderBy: { sanction_id: 'asc' } });
      return rows.map((row) => toRecord(row as unknown as SanctionRow));
    },
  };
}
