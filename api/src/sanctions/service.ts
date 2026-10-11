import { displayCode } from '../codes.js';
import type { CaseSanctionRecord, CaseStore, CaseTx } from '../cases/types.js';
import { validateUpload, MAX_FILES_PER_SANCTION, type UploadErrorCode } from '../files/validate.js';
import { PRESIGN_TTL_SECONDS, proofKey, type ObjectStorage } from '../storage/types.js';
import { allowedSanctions, offenseNumber, type HandbookSanctionRow } from './rules.js';

export type SanctionFailureCode =
  | UploadErrorCode
  | 'not_found'
  | 'invalid_status'
  | 'invalid_input'
  | 'sanction_not_allowed'
  | 'already_assigned'
  | 'due_date_in_past'
  | 'upload_not_allowed'
  | 'already_reviewed'
  | 'last_file'
  | 'files_not_viewed';

export interface SanctionFailure {
  ok: false;
  code: SanctionFailureCode;
  message: string;
}

export type SanctionResult<T> = ({ ok: true } & T) | SanctionFailure;

export interface UploadedFile {
  name: string;
  mimeType: string;
  bytes: Uint8Array;
}

export interface AssignmentOptions {
  /** Computed by the API, never typed (decision 14). */
  offenseNumber: number;
  /** The offense number whose sanctions are offered (the highest defined one if `offenseNumber` has none). */
  offenseUsed: number | null;
  sanctions: Array<{ sanctionId: number; sanctionCode: string; type: string; alreadyAssigned: boolean }>;
}

const MAX_TEXT = 1000;
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

const fail = (code: SanctionFailureCode, message: string): SanctionFailure => ({ ok: false, code, message });

function cleanText(value: unknown, { required }: { required: boolean }): string | null | undefined {
  if (value === undefined || value === null || value === '') return required ? undefined : null;
  if (typeof value !== 'string') return undefined;
  const text = value.trim();
  if (text === '') return required ? undefined : null;
  return text.length <= MAX_TEXT ? text : undefined;
}

const isRealDate = (value: string): boolean => {
  if (!DATE_ONLY.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
};

export interface SanctionService {
  getAssignmentOptions(caseId: number): Promise<SanctionResult<{ options: AssignmentOptions }>>;
  assignSanction(input: {
    employeeId: string;
    caseId: number;
    sanctionId: number;
    dueDate: unknown;
    staffNote: unknown;
    /** Asia/Manila calendar day, YYYY-MM-DD. */
    today: string;
  }): Promise<SanctionResult<{ caseSanctionId: number }>>;
  recordCompliance(input: { employeeId: string; caseSanctionId: number; note: unknown }): Promise<SanctionResult<unknown>>;
  uploadProof(input: {
    studentId: string;
    caseSanctionId: number;
    files: UploadedFile[];
    replaceCaseSanctionFileId?: number;
  }): Promise<SanctionResult<{ caseSanctionFileIds: number[] }>>;
  removeProof(input: { studentId: string; caseSanctionFileId: number }): Promise<SanctionResult<unknown>>;
  /** Download link for one proof file. Staff opening a file marks it viewed (verify needs every file viewed). */
  fileDownloadUrl(input: {
    requester: { role: 'student' | 'staff'; id: string };
    caseSanctionFileId: number;
  }): Promise<SanctionResult<{ url: string; expiresInSeconds: number }>>;
  verify(input: { employeeId: string; caseSanctionId: number }): Promise<SanctionResult<unknown>>;
  returnForRevision(input: { employeeId: string; caseSanctionId: number; reason: unknown }): Promise<SanctionResult<unknown>>;
}

export function createSanctionService({
  store,
  storage,
  now = () => new Date(),
}: {
  store: CaseStore;
  storage: ObjectStorage;
  now?: () => Date;
}): SanctionService {
  /** Lock the student, then read, so status checks cannot be stale (same rule as the case service). */
  async function loadLocked(tx: CaseTx, caseSanctionId: number): Promise<CaseSanctionRecord | null> {
    const first = await tx.getCaseSanction(caseSanctionId);
    if (!first) return null;
    if (first.studentId !== null) await tx.lockStudent(first.studentId);
    return tx.getCaseSanction(caseSanctionId);
  }

  async function loadByFileLocked(tx: CaseTx, caseSanctionFileId: number): Promise<CaseSanctionRecord | null> {
    const first = await tx.getCaseSanctionByFile(caseSanctionFileId);
    if (!first) return null;
    if (first.studentId !== null) await tx.lockStudent(first.studentId);
    return tx.getCaseSanctionByFile(caseSanctionFileId);
  }

  const caseCode = (caseId: number) => displayCode('C', caseId);

  /** Student-facing and staff-facing views of one sanction use the same record; `ownedBy` hides foreign rows. */
  const isOwnedBy = (record: CaseSanctionRecord, studentId: string) => record.studentId === studentId;

  return {
    async getAssignmentOptions(caseId) {
      return store.transaction(async (tx) => {
        const record = await tx.getCase(caseId);
        if (!record) return fail('not_found', 'Case not found.');
        if (record.studentId === null) return fail('invalid_status', 'This case is not linked to a student yet.');
        const studentCases = await tx.listStudentCases(record.studentId);
        const offense = offenseNumber(record, studentCases);
        const rows: HandbookSanctionRow[] = await tx.listHandbookSanctions(record.handbookEntryId);
        const { offenseUsed, sanctions } = allowedSanctions(rows, offense);
        const assigned = new Set((await tx.listCaseSanctions(caseId)).map((s) => s.sanctionId));
        return {
          ok: true as const,
          options: {
            offenseNumber: offense,
            offenseUsed,
            sanctions: sanctions.map((s) => ({
              sanctionId: s.sanctionId,
              sanctionCode: displayCode('S', s.sanctionId),
              type: s.sanctionType,
              alreadyAssigned: assigned.has(s.sanctionId),
            })),
          },
        };
      });
    },

    async assignSanction({ employeeId, caseId, sanctionId, dueDate, staffNote, today }) {
      if (typeof dueDate !== 'string' || !isRealDate(dueDate)) {
        return fail('invalid_input', 'Due date must be a valid date (YYYY-MM-DD).');
      }
      if (dueDate < today) return fail('due_date_in_past', 'The due date cannot be in the past.');
      const note = cleanText(staffNote, { required: false });
      if (note === undefined) return fail('invalid_input', `Instructions must be text up to ${MAX_TEXT} characters.`);

      return store.transaction(async (tx) => {
        const first = await tx.getCase(caseId);
        if (!first) return fail('not_found', 'Case not found.');
        if (first.studentId !== null) await tx.lockStudent(first.studentId);
        const record = await tx.getCase(caseId);
        if (!record || record.studentId === null) return fail('not_found', 'Case not found.');
        if (record.status !== 'validated' && record.status !== 'for_sanction') {
          return fail('invalid_status', 'A sanction can only be assigned to a validated case.');
        }

        const studentCases = await tx.listStudentCases(record.studentId);
        const rows = await tx.listHandbookSanctions(record.handbookEntryId);
        const { sanctions } = allowedSanctions(rows, offenseNumber(record, studentCases));
        if (!sanctions.some((s) => s.sanctionId === sanctionId)) {
          return fail('sanction_not_allowed', 'The handbook does not allow that sanction for this violation and offense.');
        }
        const existing = await tx.listCaseSanctions(caseId);
        if (existing.some((s) => s.sanctionId === sanctionId)) {
          return fail('already_assigned', 'That sanction is already assigned to this case.');
        }

        const at = now();
        const sanction = await tx.getSanction(sanctionId);
        const caseSanctionId = await tx.insertCaseSanction({
          caseId,
          sanctionId,
          dueDate,
          assignedByEmployeeId: employeeId,
          staffNote: note,
          date: at,
        });
        if (record.status === 'validated') await tx.updateCase(caseId, { status: 'for_sanction' });
        await tx.addHistory({
          caseId,
          eventType: 'sanction_assigned',
          statusAfter: 'for_sanction',
          remarks: `${sanction?.sanctionType ?? 'Sanction'}, due ${dueDate}.`,
          employeeId,
          date: at,
        });
        await tx.addSanctionHistory({
          caseSanctionId,
          eventType: 'assigned',
          remarks: note,
          employeeId,
          studentId: null,
          date: at,
        });
        await tx.addSanctionNotification({
          recipient: 'student',
          studentId: record.studentId,
          title: 'Sanction assigned',
          message: `${sanction?.sanctionType ?? 'A sanction'} was assigned for case ${caseCode(caseId)}. Due ${dueDate}.`,
          caseSanctionId,
          idempotencyKey: `san:${caseSanctionId}:assigned`,
        });
        return { ok: true as const, caseSanctionId };
      });
    },

    async recordCompliance({ employeeId, caseSanctionId, note }) {
      const text = cleanText(note, { required: true });
      if (!text) return fail('invalid_input', `A compliance note is required (up to ${MAX_TEXT} characters).`);
      return store.transaction(async (tx) => {
        const record = await loadLocked(tx, caseSanctionId);
        if (!record) return fail('not_found', 'Sanction not found.');
        if (record.status !== 'assigned' && record.status !== 'returned') {
          return fail('invalid_status', 'Compliance can only be recorded while the sanction is assigned or returned.');
        }
        const at = now();
        await tx.updateCaseSanction(caseSanctionId, {
          status: 'pending_verification',
          dateSubmitted: at,
          complianceNote: text,
        });
        await tx.addSanctionHistory({
          caseSanctionId,
          eventType: 'compliance_recorded',
          remarks: text,
          employeeId,
          studentId: null,
          date: at,
        });
        if (record.studentId !== null) {
          await tx.addSanctionNotification({
            recipient: 'student',
            studentId: record.studentId,
            title: 'Compliance recorded',
            message: `The SDO office recorded your compliance for ${record.sanctionType} (case ${caseCode(record.caseId)}). It is awaiting verification.`,
            caseSanctionId,
            idempotencyKey: `san:${caseSanctionId}:compliance:${at.getTime()}`,
          });
        }
        return { ok: true as const };
      });
    },

    async uploadProof({ studentId, caseSanctionId, files, replaceCaseSanctionFileId }) {
      if (files.length === 0) return fail('invalid_input', 'Choose at least one file.');
      if (files.length > MAX_FILES_PER_SANCTION) return fail('too_many_files', 'You can upload at most 5 files.');
      if (replaceCaseSanctionFileId !== undefined && files.length !== 1) {
        return fail('invalid_input', 'Replace one file with exactly one file.');
      }

      const stored: string[] = [];
      let removedKey: string | null = null;
      try {
        const outcome = await store.transaction(async (tx): Promise<SanctionResult<{ caseSanctionFileIds: number[] }>> => {
          const record = await loadLocked(tx, caseSanctionId);
          if (!record || !isOwnedBy(record, studentId)) return fail('not_found', 'Sanction not found.');
          if (record.status === 'completed') return fail('invalid_status', 'This sanction is already completed.');

          const replacing = replaceCaseSanctionFileId !== undefined;
          if (replacing) {
            if (record.status === 'assigned') return fail('not_found', 'There is no file to replace.');
            const target = record.files.find((f) => f.caseSanctionFileId === replaceCaseSanctionFileId);
            if (!target) return fail('not_found', 'File not found.');
            if (record.status === 'pending_verification' && record.files.some((f) => f.dateViewed !== null)) {
              return fail('already_reviewed', 'Staff already reviewed this proof, so it cannot be changed.');
            }
          } else if (record.status === 'pending_verification') {
            return fail('upload_not_allowed', 'Proof was already submitted. You can replace a file instead.');
          }

          // Validate every file before anything is stored (type, size, magic bytes, and the 5-file cap).
          const existingCount = replacing ? record.files.length - 1 : record.files.length;
          const extensions: Array<'pdf' | 'docx'> = [];
          for (const [index, file] of files.entries()) {
            const result = validateUpload({
              mimeType: file.mimeType,
              bytes: file.bytes,
              existingCount: existingCount + index,
            });
            if (!result.ok) return fail(result.code, uploadMessage(result.code, file.name));
            extensions.push(result.ext);
          }

          const at = now();
          const ids: number[] = [];
          for (const [index, file] of files.entries()) {
            const key = proofKey(caseSanctionId, extensions[index]);
            await storage.put(key, file.bytes, file.mimeType);
            stored.push(key);
            const inserted = await tx.insertProofFile({
              caseSanctionId,
              storageKey: key,
              originalName: file.name,
              mimeType: file.mimeType,
              sizeBytes: file.bytes.length,
              uploadedByStudentId: studentId,
              date: at,
            });
            ids.push(inserted.caseSanctionFileId);
            await tx.addSanctionHistory({
              caseSanctionId,
              eventType: replacing ? 'proof_replaced' : 'proof_uploaded',
              remarks: file.name,
              employeeId: null,
              studentId,
              date: at,
            });
          }

          if (replacing) {
            const old = record.files.find((f) => f.caseSanctionFileId === replaceCaseSanctionFileId);
            await tx.deleteProofFile(replaceCaseSanctionFileId as number);
            removedKey = old?.storageKey ?? null;
          } else {
            // First proof (assigned) or re-upload (returned): the sanction now waits for staff.
            await tx.updateCaseSanction(caseSanctionId, { status: 'pending_verification', dateSubmitted: at });
            await tx.addSanctionNotification({
              recipient: 'staff',
              studentId: null,
              title: 'Proof submitted',
              message: `Proof was submitted for ${record.sanctionType} (case ${caseCode(record.caseId)}). It is waiting for verification.`,
              caseSanctionId,
              idempotencyKey: `san:${caseSanctionId}:submitted:${at.getTime()}`,
            });
          }
          return { ok: true as const, caseSanctionFileIds: ids };
        });

        if (!outcome.ok) {
          await Promise.allSettled(stored.map((key) => storage.delete(key)));
          return outcome;
        }
        // Committed: only now remove the replaced object.
        if (removedKey) await storage.delete(removedKey);
        return outcome;
      } catch (error) {
        // The database rolled back: do not leave orphan objects behind.
        await Promise.allSettled(stored.map((key) => storage.delete(key)));
        throw error;
      }
    },

    async removeProof({ studentId, caseSanctionFileId }) {
      let removedKey: string | null = null;
      const outcome = await store.transaction(async (tx): Promise<SanctionResult<unknown>> => {
        const record = await loadByFileLocked(tx, caseSanctionFileId);
        if (!record || !isOwnedBy(record, studentId)) return fail('not_found', 'File not found.');
        if (record.status === 'completed') return fail('invalid_status', 'This sanction is already completed.');
        if (record.status === 'pending_verification') {
          if (record.files.some((f) => f.dateViewed !== null)) {
            return fail('already_reviewed', 'Staff already reviewed this proof, so it cannot be changed.');
          }
          if (record.files.length <= 1) return fail('last_file', 'You cannot remove the last file. Replace it instead.');
        }
        const target = record.files.find((f) => f.caseSanctionFileId === caseSanctionFileId);
        if (!target) return fail('not_found', 'File not found.');
        const at = now();
        await tx.deleteProofFile(caseSanctionFileId);
        await tx.addSanctionHistory({
          caseSanctionId: record.caseSanctionId,
          eventType: 'proof_removed',
          remarks: target.originalName,
          employeeId: null,
          studentId,
          date: at,
        });
        removedKey = target.storageKey;
        return { ok: true as const };
      });
      if (outcome.ok && removedKey) await storage.delete(removedKey);
      return outcome;
    },

    async fileDownloadUrl({ requester, caseSanctionFileId }) {
      const found = await store.transaction(async (tx): Promise<SanctionResult<{ storageKey: string }>> => {
        const record = await loadByFileLocked(tx, caseSanctionFileId);
        if (!record) return fail('not_found', 'File not found.');
        if (requester.role === 'student' && !isOwnedBy(record, requester.id)) return fail('not_found', 'File not found.');
        const file = record.files.find((f) => f.caseSanctionFileId === caseSanctionFileId);
        if (!file) return fail('not_found', 'File not found.');
        if (requester.role === 'staff' && file.dateViewed === null) {
          await tx.markFileViewed(caseSanctionFileId, requester.id, now());
        }
        return { ok: true as const, storageKey: file.storageKey };
      });
      if (!found.ok) return found;
      const url = await storage.presignGet(found.storageKey, PRESIGN_TTL_SECONDS);
      return { ok: true as const, url, expiresInSeconds: PRESIGN_TTL_SECONDS };
    },

    async verify({ employeeId, caseSanctionId }) {
      return store.transaction(async (tx) => {
        const record = await loadLocked(tx, caseSanctionId);
        if (!record) return fail('not_found', 'Sanction not found.');
        if (record.status !== 'pending_verification') {
          return fail('invalid_status', 'Only a sanction that is waiting for verification can be verified.');
        }
        const viewed = record.files.filter((f) => f.dateViewed !== null).length;
        if (viewed < record.files.length) {
          return fail('files_not_viewed', `Open every file before verifying (${viewed} of ${record.files.length} viewed).`);
        }
        const at = now();
        await tx.updateCaseSanction(caseSanctionId, {
          status: 'completed',
          dateCompleted: at,
          verifiedByEmployeeId: employeeId,
        });
        await tx.addSanctionHistory({
          caseSanctionId,
          eventType: 'verified',
          remarks: null,
          employeeId,
          studentId: null,
          date: at,
        });
        if (record.studentId !== null) {
          await tx.addSanctionNotification({
            recipient: 'student',
            studentId: record.studentId,
            title: 'Sanction verified',
            message: `Your ${record.sanctionType} (case ${caseCode(record.caseId)}) was verified as completed.`,
            caseSanctionId,
            idempotencyKey: `san:${caseSanctionId}:completed`,
          });
        }
        return { ok: true as const };
      });
    },

    async returnForRevision({ employeeId, caseSanctionId, reason }) {
      const text = cleanText(reason, { required: true });
      if (!text) return fail('invalid_input', `A reason is required (up to ${MAX_TEXT} characters).`);
      return store.transaction(async (tx) => {
        const record = await loadLocked(tx, caseSanctionId);
        if (!record) return fail('not_found', 'Sanction not found.');
        if (record.status !== 'pending_verification') {
          return fail('invalid_status', 'Only a sanction that is waiting for verification can be returned.');
        }
        const at = now();
        await tx.updateCaseSanction(caseSanctionId, { status: 'returned', staffNote: text });
        await tx.addSanctionHistory({
          caseSanctionId,
          eventType: 'returned',
          remarks: text,
          employeeId,
          studentId: null,
          date: at,
        });
        if (record.studentId !== null) {
          await tx.addSanctionNotification({
            recipient: 'student',
            studentId: record.studentId,
            title: 'Sanction returned',
            message: `Your ${record.sanctionType} (case ${caseCode(record.caseId)}) was returned. Reason: ${text}`,
            caseSanctionId,
            idempotencyKey: `san:${caseSanctionId}:returned:${at.getTime()}`,
          });
        }
        return { ok: true as const };
      });
    },
  };
}

function uploadMessage(code: UploadErrorCode, name: string): string {
  switch (code) {
    case 'unsupported_type':
      return `${name}: only PDF or DOCX files are accepted.`;
    case 'empty':
      return `${name} is empty.`;
    case 'too_large':
      return `${name} is larger than 10 MB.`;
    case 'too_many_files':
      return 'You can attach at most 5 files.';
    case 'content_mismatch':
      return `${name} does not look like a real PDF or DOCX file.`;
  }
}
