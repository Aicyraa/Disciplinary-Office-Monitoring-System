import { randomUUID } from 'node:crypto';
import { manilaToday } from '../views/me.views.js';
import type { GateStore, GateTx } from '../types/gate.types.js';
import type { ParsedReport } from '../domain/gate/validate.js';

/** `submittedAt` is when the report was filed (for a repeat: the first one), ISO UTC. */
export type GateResult = { ok: true; reference: string; code: string; duplicate: boolean; submittedAt: string } | { ok: false };

export interface GateService {
  /**
   * Files a public report. Returns `{ ok: false }` for anything the caller must answer with the generic error
   * (unknown program or violation, the system violation). `duplicate` is true when every selected violation was
   * already reported today for the typed ID, in which case the existing reference is returned and nothing is written.
   */
  submit(report: ParsedReport): Promise<GateResult>;
}

/** True for a unique-constraint violation (Postgres 23505, Prisma P2002). */
export function isUniqueViolation(error: unknown): boolean {
  const text = [
    error instanceof Error ? error.message : '',
    typeof error === 'object' && error !== null && 'code' in error ? String((error as { code: unknown }).code) : '',
    typeof error === 'object' && error !== null && 'cause' in error ? JSON.stringify((error as { cause: unknown }).cause) : '',
  ].join(' ');
  return /unique constraint|duplicate key|\b23505\b|\bP2002\b/i.test(text);
}

export function createGateService({
  store,
  now = () => new Date(),
  newReference = randomUUID,
}: {
  store: GateStore;
  now?: () => Date;
  newReference?: () => string;
}): GateService {
  /** The reference of a report already filed today for this ID and any of these violations, if there is one. */
  async function existing(
    tx: GateTx,
    report: ParsedReport,
    day: string,
  ): Promise<{ reference: string; code: string; submittedAt: string } | null> {
    const found = await tx.findTodaysDuplicates(report.studentId, report.violationIds, day);
    if (found.length === 0) return null;
    return {
      reference: found[0].submissionRef,
      code: await tx.submissionCode(found[0].submissionRef),
      submittedAt: found[0].submittedAt.toISOString(),
    };
  }

  return {
    async submit(report) {
      const at = now();
      const day = manilaToday(at);

      try {
        return await store.transaction(async (tx): Promise<GateResult> => {
          const programs = await tx.listProgramNames();
          if (!programs.includes(report.program)) return { ok: false };

          const entries = await tx.getEntries(report.violationIds);
          if (entries.length !== report.violationIds.length || entries.some((entry) => entry.isSystem)) return { ok: false };

          // Violations already reported today for this typed ID are not filed twice (the unique index is the backstop).
          const duplicates = await tx.findTodaysDuplicates(report.studentId, report.violationIds, day);
          const already = new Set(duplicates.map((d) => d.handbookEntryId));
          const fresh = entries.filter((entry) => !already.has(entry.handbookEntryId));
          if (fresh.length === 0) {
            const existing = duplicates[0].submissionRef;
            return {
              ok: true,
              reference: existing,
              code: await tx.submissionCode(existing),
              duplicate: true,
              submittedAt: duplicates[0].submittedAt.toISOString(),
            };
          }

          const student = await tx.findStudent(report.studentId);
          const reference = newReference();
          const caseIds: number[] = [];
          for (const entry of fresh) {
            const caseId = await tx.insertGateCase({
              studentId: student?.studentId ?? null,
              handbookEntryId: entry.handbookEntryId,
              claimedStudentId: report.studentId,
              claimedName: report.name,
              claimedProgram: report.program,
              claimedYear: report.year,
              submissionRef: reference,
              caseDate: at,
            });
            caseIds.push(caseId);
            await tx.addHistory({ caseId, date: at });
          }

          const names = fresh.map((entry) => entry.violationType).join(', ');
          const short = await tx.submissionCode(reference);
          if (student) {
            await tx.addNotification({
              recipient: 'student',
              studentId: student.studentId,
              title: 'Violation report received',
              message: `A report was filed under your student ID (reference ${short}): ${names}. It is waiting for review by the SDO office.`,
              caseId: caseIds[0],
              idempotencyKey: `report:${reference}:student`,
            });
          }
          await tx.addNotification({
            recipient: 'staff',
            studentId: null,
            title: 'New gate violation report',
            message: `${report.name} (${report.studentId}) was reported for: ${names}.${
              student ? '' : ' The student ID is not on file; link it to a student or reject the report.'
            } Reference ${short}.`,
            caseId: caseIds[0],
            idempotencyKey: `report:${reference}:staff`,
          });
          return { ok: true, reference, code: short, duplicate: false, submittedAt: at.toISOString() };
        });
      } catch (error) {
        if (!isUniqueViolation(error)) throw error;
        // Lost a race with an identical request: answer with the report that won.
        const winner = await store.transaction((tx) => existing(tx, report, day));
        if (winner !== null) return { ok: true, ...winner, duplicate: true };
        throw error;
      }
    },
  };
}
