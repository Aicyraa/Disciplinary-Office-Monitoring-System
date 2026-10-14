export interface TemplateFileRecord {
  fileId: number;
  storageKey: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  dateUploaded: Date;
}

/** One sanction with its template. `templateId` is null until staff first save text or upload a file. */
export interface TemplateRecord {
  sanctionId: number;
  sanctionType: string;
  sanctionDescription: string;
  templateId: number | null;
  title: string | null;
  description: string | null;
  requirements: string | null;
  dateUpdated: Date | null;
  files: TemplateFileRecord[];
}

export interface TemplateFileLookup {
  fileId: number;
  templateId: number;
  sanctionId: number;
  storageKey: string;
  originalName: string;
}

/** Everything the template workflow reads and writes, scoped to one database transaction. */
export interface TemplateTx {
  getSanction(sanctionId: number): Promise<{ sanctionId: number; sanctionType: string } | null>;
  /** The sanction's template with its files, or a record with `templateId: null` when none exists yet. */
  getTemplate(sanctionId: number): Promise<TemplateRecord | null>;
  /** Creates the template row if it is missing, then sets the text. Returns the template id. */
  saveText(input: {
    sanctionId: number;
    title: string | null;
    description: string | null;
    requirements: string | null;
    employeeId: string;
    date: Date;
  }): Promise<number>;
  /** The template id, creating an empty row if needed. */
  ensureTemplate(sanctionId: number, employeeId: string, date: Date): Promise<number>;
  insertFile(input: {
    templateId: number;
    storageKey: string;
    originalName: string;
    mimeType: string;
    sizeBytes: number;
    employeeId: string;
    date: Date;
  }): Promise<number>;
  getFile(fileId: number): Promise<TemplateFileLookup | null>;
  /** Removes the link and the files row. */
  deleteFile(fileId: number): Promise<void>;
  touch(templateId: number, employeeId: string, date: Date): Promise<void>;
}

export interface TemplateStore {
  /** Runs `work` atomically: every write commits together or none do. */
  transaction<T>(work: (tx: TemplateTx) => Promise<T>): Promise<T>;
}
