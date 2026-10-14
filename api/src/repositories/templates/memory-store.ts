import type { TemplateFileLookup, TemplateRecord, TemplateStore, TemplateTx } from './types.js';

export interface MemoryTemplateState {
  sanctions: Array<{ sanctionId: number; sanctionType: string; description: string }>;
  templates: Array<{
    templateId: number;
    sanctionId: number;
    title: string | null;
    description: string | null;
    requirements: string | null;
    updatedBy: string | null;
    dateUpdated: Date;
  }>;
  files: Array<{
    fileId: number;
    templateId: number;
    storageKey: string;
    originalName: string;
    mimeType: string;
    sizeBytes: number;
    uploadedBy: string;
    dateUploaded: Date;
  }>;
  nextTemplateId: number;
  nextFileId: number;
}

export interface MemoryTemplateStore extends TemplateStore {
  state: MemoryTemplateState;
  /** Every sanction with its template and files, like the read side the router uses. */
  readAll(): TemplateRecord[];
}

export const SEEDED_SANCTIONS = [
  { sanctionId: 1, sanctionType: 'Violation Slip', description: 'A written slip.' },
  { sanctionId: 2, sanctionType: 'Written Warning', description: 'A written warning.' },
  { sanctionId: 3, sanctionType: 'CATEGORY - 1', description: 'Category 1 sanction.' },
];

export function createMemoryTemplateStore(seed: Partial<MemoryTemplateState> = {}): MemoryTemplateStore {
  const store: MemoryTemplateStore = {
    state: {
      sanctions: seed.sanctions ?? SEEDED_SANCTIONS.map((s) => ({ ...s })),
      templates: seed.templates ?? [],
      files: seed.files ?? [],
      nextTemplateId: seed.nextTemplateId ?? 1,
      nextFileId: seed.nextFileId ?? 1,
    },
    readAll() {
      return store.state.sanctions.map((sanction) => toRecord(store.state, sanction.sanctionId)!);
    },
    async transaction(work) {
      const working = structuredClone(store.state);
      const result = await work(createTx(working));
      store.state = working;
      return result;
    },
  };
  return store;
}

function toRecord(state: MemoryTemplateState, sanctionId: number): TemplateRecord | null {
  const sanction = state.sanctions.find((s) => s.sanctionId === sanctionId);
  if (!sanction) return null;
  const template = state.templates.find((t) => t.sanctionId === sanctionId);
  return {
    sanctionId,
    sanctionType: sanction.sanctionType,
    sanctionDescription: sanction.description,
    templateId: template?.templateId ?? null,
    title: template?.title ?? null,
    description: template?.description ?? null,
    requirements: template?.requirements ?? null,
    dateUpdated: template?.dateUpdated ?? null,
    files: template
      ? state.files
          .filter((f) => f.templateId === template.templateId)
          .map((f) => ({
            fileId: f.fileId,
            storageKey: f.storageKey,
            originalName: f.originalName,
            mimeType: f.mimeType,
            sizeBytes: f.sizeBytes,
            dateUploaded: f.dateUploaded,
          }))
      : [],
  };
}

function createTx(state: MemoryTemplateState): TemplateTx {
  const ensure = (sanctionId: number, employeeId: string, date: Date): number => {
    const found = state.templates.find((t) => t.sanctionId === sanctionId);
    if (found) return found.templateId;
    const created = {
      templateId: state.nextTemplateId,
      sanctionId,
      title: null,
      description: null,
      requirements: null,
      updatedBy: employeeId,
      dateUpdated: date,
    };
    state.nextTemplateId += 1;
    state.templates.push(created);
    return created.templateId;
  };
  return {
    async getSanction(sanctionId) {
      const found = state.sanctions.find((s) => s.sanctionId === sanctionId);
      return found ? { sanctionId: found.sanctionId, sanctionType: found.sanctionType } : null;
    },
    async getTemplate(sanctionId) {
      return toRecord(state, sanctionId);
    },
    async saveText({ sanctionId, title, description, requirements, employeeId, date }) {
      const templateId = ensure(sanctionId, employeeId, date);
      const template = state.templates.find((t) => t.templateId === templateId)!;
      template.title = title;
      template.description = description;
      template.requirements = requirements;
      template.updatedBy = employeeId;
      template.dateUpdated = date;
      return templateId;
    },
    async ensureTemplate(sanctionId, employeeId, date) {
      return ensure(sanctionId, employeeId, date);
    },
    async insertFile(input) {
      const fileId = state.nextFileId;
      state.nextFileId += 1;
      state.files.push({
        fileId,
        templateId: input.templateId,
        storageKey: input.storageKey,
        originalName: input.originalName,
        mimeType: input.mimeType,
        sizeBytes: input.sizeBytes,
        uploadedBy: input.employeeId,
        dateUploaded: input.date,
      });
      return fileId;
    },
    async getFile(fileId): Promise<TemplateFileLookup | null> {
      const file = state.files.find((f) => f.fileId === fileId);
      if (!file) return null;
      const template = state.templates.find((t) => t.templateId === file.templateId)!;
      return {
        fileId,
        templateId: file.templateId,
        sanctionId: template.sanctionId,
        storageKey: file.storageKey,
        originalName: file.originalName,
      };
    },
    async deleteFile(fileId) {
      state.files = state.files.filter((f) => f.fileId !== fileId);
    },
    async touch(templateId, employeeId, date) {
      const template = state.templates.find((t) => t.templateId === templateId);
      if (template) {
        template.updatedBy = employeeId;
        template.dateUpdated = date;
      }
    },
  };
}
