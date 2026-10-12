import type { StaffCaseDetail, StaffCaseRow } from '@shared/types.js';
import { assignCaseCodes, formatSubmissionCode, parseCaseCode } from '../codes.js';
import type { MemoryCaseStore } from './memory-store.js';
import { toStaffSanctionView } from '../sanctions/views.js';
import { CASE_PAGE_SIZE, type CaseQueries } from './queries.js';
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
    };
  };

  return {
    async list(filter) {
      const needle = filter.q?.trim().toLowerCase() ?? '';
      const parsed = needle === '' ? null : parseCaseCode(needle);
      const rows = store.state.cases
        .map(toRow)
        .filter((row) => (filter.status ? row.status === filter.status : true))
        .filter((row) => (filter.severity ? row.severity === filter.severity : true))
        .filter((row) => {
          if (needle === '') return true;
          if (parsed !== null && row.code.toLowerCase() === `sdo-${parsed.year}-${String(parsed.ordinal).padStart(3, '0')}`) return true;
          return [row.student?.id, row.student?.name, row.claimed?.studentId, row.claimed?.name, row.violation].some((text) =>
            text?.toLowerCase().includes(needle),
          );
        })
        .sort((a, b) => {
          const byDate = a.caseDate.localeCompare(b.caseDate) || a.id - b.id;
          return filter.sort === 'newest' ? -byDate : byDate;
        });
      const start = (filter.page - 1) * CASE_PAGE_SIZE;
      return { rows: rows.slice(start, start + CASE_PAGE_SIZE), total: rows.length };
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
        sanctions: store.state.caseSanctions
          .filter((s) => s.caseId === caseId)
          .map((s) => toStaffSanctionView(s, today)),
      };
      return detail;
    },
  };
}
