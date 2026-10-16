import type { StaffCaseDetail, StaffCaseRow, StaffSanctionQueueRow } from '@shared/types.js';
import { assignCaseCodes, displayCode, formatSubmissionCode, parseCaseCode } from '../../domain/codes.js';
import type { MemoryCaseStore } from './memory-store.js';
import { toStaffSanctionView } from '../../views/sanctions.views.js';
import { lateByDays } from '../../domain/sanctions/rules.js';
import {
  ACTIVE_SANCTION_STATUSES,
  CASE_PAGE_SIZE,
  SANCTION_QUEUE_PAGE_SIZE,
  compareCases,
  emptyStatusCounts,
  pageFor,
  type CaseQueries,
} from './queries.js';
import type { CaseRecord } from './types.js';

/** In-memory fake of the staff query side, reading the same state as the memory store. */
export function createMemoryCaseQueries(
  store: MemoryCaseStore,
  /** student id -> display name */
  names: Map<string, string> = new Map(),
  /** employee id -> display name; the timeline shows names, as the Prisma queries do. */
  staffNames: Map<string, string> = new Map(),
): CaseQueries {
  const entryOf = (id: number) => store.state.handbook.find((h) => h.handbookEntryId === id);

  /** Codes derived the same way the database query does (year of the case date, then id; submissions by first case). */
  const codes = () => assignCaseCodes(store.state.cases.map((c) => ({ id: c.caseId, caseDate: c.caseDate })));
  const submissionCodeOf = (ref: string | null): string | null => {
    if (ref === null) return null;
    const firstIds = new Map<string, number>();
    for (const c of store.state.cases) {
      if (c.submissionRef !== null) firstIds.set(c.submissionRef, Math.min(firstIds.get(c.submissionRef) ?? Infinity, c.caseId));
    }
    const ranked = [...firstIds.entries()].sort((a, b) => a[1] - b[1]).map(([r]) => r);
    const rank = ranked.indexOf(ref) + 1;
    return rank > 0 ? formatSubmissionCode(rank) : null;
  };
  const toRow = (record: CaseRecord): StaffCaseRow => {
    const entry = entryOf(record.handbookEntryId);
    const original = record.originalHandbookEntryId === null ? null : entryOf(record.originalHandbookEntryId);
    return {
      id: record.caseId,
      code: codes().get(record.caseId) ?? '',
      status: record.status,
      severity: entry?.severity ?? 'Minor',
      violation: entry?.violationType ?? 'Unknown',
      section: `H${String(record.handbookEntryId).padStart(3, '0')}`,
      caseDate: record.caseDate.toISOString(),
      source: record.source,
      student: record.studentId === null ? null : { id: record.studentId, name: names.get(record.studentId) ?? record.studentId },
      claimed:
        record.source === 'gate'
          ? { studentId: record.claimedStudentId, name: record.claimedName, program: null, year: null }
          : null,
      submissionRef: record.submissionRef,
      submissionCode: submissionCodeOf(record.submissionRef),
      isEscalated: record.isEscalated,
      convertedFrom: original?.violationType ?? null,
      sanction: latestSanction(record.caseId),
      dateResolved: record.dateResolved?.toISOString() ?? null,
    };
  };
  function latestSanction(caseId: number): StaffCaseRow['sanction'] {
    const latest = store.state.caseSanctions.filter((s) => s.caseId === caseId).sort((a, b) => b.caseSanctionId - a.caseSanctionId)[0];
    return latest ? { code: displayCode('S', latest.sanctionId), status: latest.status } : null;
  }

  return {
    async list(filter) {
      const needle = filter.q?.trim().toLowerCase() ?? '';
      const parsed = needle === '' ? null : parseCaseCode(needle);
      const matching = store.state.cases
        .map(toRow)
        .filter((row) => (filter.severity ? row.severity === filter.severity : true))
        .filter((row) => {
          if (needle === '') return true;
          if (parsed !== null && row.code.toLowerCase() === `sdo-${parsed.year}-${String(parsed.ordinal).padStart(3, '0')}`) return true;
          return [row.student?.id, row.student?.name, row.claimed?.studentId, row.claimed?.name, row.violation].some((text) =>
            text?.toLowerCase().includes(needle),
          );
        })
      const statusCounts = emptyStatusCounts();
      for (const row of matching) statusCounts[row.status] += 1;
      const order = compareCases(filter);
      const rows = matching
        .filter((row) => (filter.status ? row.status === filter.status : true))
        .sort((a, b) => order({ id: a.id, status: a.status, time: Date.parse(a.caseDate) }, { id: b.id, status: b.status, time: Date.parse(b.caseDate) }));
      const page = pageFor(
        rows.map((row) => row.id),
        filter,
      );
      const start = (page - 1) * CASE_PAGE_SIZE;
      return { rows: rows.slice(start, start + CASE_PAGE_SIZE), total: rows.length, page, statusCounts };
    },

    async sanctionQueue({ filter, page, today }) {
      const caseCodes = codes();
      const toQueueRow = (s: (typeof store.state.caseSanctions)[number]): StaffSanctionQueueRow => ({
        id: s.caseSanctionId,
        caseId: s.caseId,
        caseCode: caseCodes.get(s.caseId) ?? '',
        sanctionCode: displayCode('S', s.sanctionId),
        type: s.sanctionType,
        status: s.status,
        student: s.studentId === null ? null : { id: s.studentId, name: names.get(s.studentId) ?? s.studentId },
        dueDate: s.dueDate,
        dateSubmitted: s.dateSubmitted ? s.dateSubmitted.toISOString() : null,
        lateByDays: lateByDays({ dueDate: s.dueDate, status: s.status, today }),
        overdue: s.status !== 'completed' && s.dueDate < today,
      });
      const active = store.state.caseSanctions
        .filter((s) => (ACTIVE_SANCTION_STATUSES as readonly string[]).includes(s.status))
        .map(toQueueRow);
      const pick = active.filter((row) =>
        filter === 'pending_verification' ? row.status === 'pending_verification' : filter === 'overdue' ? row.overdue : true,
      );
      pick.sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.id - b.id);
      const start = (page - 1) * SANCTION_QUEUE_PAGE_SIZE;
      return {
        sanctions: pick.slice(start, start + SANCTION_QUEUE_PAGE_SIZE),
        total: pick.length,
        page,
        pageSize: SANCTION_QUEUE_PAGE_SIZE,
        counts: {
          pendingVerification: active.filter((row) => row.status === 'pending_verification').length,
          overdue: active.filter((row) => row.overdue).length,
          active: active.length,
        },
      };
    },

    async summary(today) {
      const cases = emptyStatusCounts();
      for (const c of store.state.cases) cases[c.status] += 1;
      const active = store.state.caseSanctions.filter((s) => (ACTIVE_SANCTION_STATUSES as readonly string[]).includes(s.status));
      return {
        cases,
        sanctions: {
          pendingVerification: active.filter((s) => s.status === 'pending_verification').length,
          overdue: active.filter((s) => s.dueDate < today).length,
          active: active.length,
        },
      };
    },

    async detail(caseId, today) {
      const record = store.state.cases.find((c) => c.caseId === caseId);
      if (!record) return null;
      const links = store.state.escalations;
      const detail: StaffCaseDetail = {
        ...toRow(record),
        resolvedWithoutSanction: record.resolvedWithoutSanction,
        dateResolved: record.dateResolved?.toISOString() ?? null,
        timeline: store.state.history
          .filter((h) => h.caseId === caseId)
          .sort((a, b) => a.date.getTime() - b.date.getTime())
          .map((h) => ({
            eventType: h.eventType,
            statusAfter: h.statusAfter,
            remarks: h.remarks,
            date: h.date.toISOString(),
            by: h.employeeId === null ? 'System' : (staffNames.get(h.employeeId) ?? h.employeeId),
          })),
        createdFromCaseIds: links.filter((l) => l.majorCaseId === caseId).map((l) => l.minorCaseId),
        countedTowardCaseId: links.find((l) => l.minorCaseId === caseId)?.majorCaseId ?? null,
        siblingCaseIds:
          record.submissionRef === null
            ? []
            : store.state.cases.filter((c) => c.submissionRef === record.submissionRef && c.caseId !== caseId).map((c) => c.caseId),
        caseCodes: Object.fromEntries(
          [
            caseId,
            ...links.filter((l) => l.majorCaseId === caseId).map((l) => l.minorCaseId),
            ...(links.find((l) => l.minorCaseId === caseId) ? [links.find((l) => l.minorCaseId === caseId)!.majorCaseId] : []),
            ...(record.submissionRef === null
              ? []
              : store.state.cases.filter((c) => c.submissionRef === record.submissionRef && c.caseId !== caseId).map((c) => c.caseId)),
          ].map((id) => [String(id), codes().get(id) ?? '']),
        ),
        sanctions: store.state.caseSanctions
          .filter((s) => s.caseId === caseId)
          .map((s) => toStaffSanctionView(s, today)),
      };
      return detail;
    },
  };
}
