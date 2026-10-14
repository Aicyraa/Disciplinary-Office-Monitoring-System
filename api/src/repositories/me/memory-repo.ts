import { OPEN_CASE_STATUSES } from '../../domain/cases/status.js';
import { assignCaseCodes, unknownCaseCode } from '../../domain/codes.js';
import type {
  AppointmentRecord,
  CaseHistoryRecord,
  CaseRecord,
  CaseSanctionRecord,
  ClearanceRecord,
  StudentProfileRecord,
  StudentSummaryRecord,
  StudentViewRepo,
} from './repo.js';

type Owned<T> = { studentId: string } & T;

export interface MemoryStudentData {
  profiles?: StudentProfileRecord[];
  /** The display code is derived from the dates by the fake, like the real repository does. */
  cases?: Array<
    Owned<Omit<CaseRecord, 'code'>> & {
      history?: CaseHistoryRecord[];
      source?: 'gate' | 'staff';
      submissionCode?: string;
      countedTowardCaseId?: number;
      linkedCaseIds?: number[];
    }
  >;
  sanctions?: Array<Owned<Omit<CaseSanctionRecord, 'caseCode'>>>;
  appointments?: Array<Owned<AppointmentRecord>>;
  clearances?: Array<Owned<ClearanceRecord>>;
}

/** A copy without the owner field (and any listed extras), so owner ids never reach callers. */
function strip<T extends { studentId: string }, K extends keyof T = 'studentId'>(
  row: T,
  ...extra: K[]
): Omit<T, 'studentId' | K> {
  const copy: Partial<T> = { ...row };
  delete copy.studentId;
  for (const key of extra) delete copy[key];
  return copy as Omit<T, 'studentId' | K>;
}

/** In-memory fake for tests; filters by student id exactly as the real repository must. */
export function createMemoryStudentViewRepo(data: MemoryStudentData = {}): StudentViewRepo {
  const cases = data.cases ?? [];
  const sanctions = data.sanctions ?? [];
  const appointments = data.appointments ?? [];
  const clearances = data.clearances ?? [];
  const profiles = data.profiles ?? [];
  const codes = assignCaseCodes(cases.map((row) => ({ id: row.caseId, caseDate: row.caseDate })));
  const codeOf = (caseId: number): string => codes.get(caseId) ?? unknownCaseCode(caseId);

  return {
    async listCases(studentId) {
      return cases
        .filter((row) => row.studentId === studentId)
        .map((row) => ({ ...(strip(row, 'history') as Omit<CaseRecord, 'code'>), code: codeOf(row.caseId) }))
        .sort((a, b) => b.caseDate.getTime() - a.caseDate.getTime());
    },
    async getCase(studentId, caseId) {
      const row = cases.find((candidate) => candidate.studentId === studentId && candidate.caseId === caseId);
      if (!row) return null;
      const history = [...(row.history ?? [])].sort((a, b) => a.date.getTime() - b.date.getTime());
      return {
        ...(strip(row, 'history', 'source', 'submissionCode', 'countedTowardCaseId', 'linkedCaseIds') as Omit<CaseRecord, 'code'>),
        code: codeOf(row.caseId),
        history,
        source: row.source ?? 'staff',
        submissionCode: row.submissionCode ?? null,
        countedTowardCode: row.countedTowardCaseId === undefined ? null : codeOf(row.countedTowardCaseId),
        linkedCaseCodes: (row.linkedCaseIds ?? []).map(codeOf),
      };
    },
    async listSanctions(studentId, options) {
      return sanctions
        .filter((row) => row.studentId === studentId && (options?.caseId === undefined || row.caseId === options.caseId))
        .map((row) => ({ ...(strip(row) as Omit<CaseSanctionRecord, 'caseCode'>), caseCode: codeOf(row.caseId) }))
        .sort((a, b) => b.dateAssigned.getTime() - a.dateAssigned.getTime());
    },
    async listAppointments(studentId) {
      return appointments
        .filter((row) => row.studentId === studentId)
        .map((row) => strip(row) as AppointmentRecord)
        .sort((a, b) => b.startDate.getTime() - a.startDate.getTime());
    },
    async listClearanceTerms(studentId) {
      return clearances
        .filter((row) => row.studentId === studentId)
        .map((row) => ({ academicYear: row.academicYear, semester: row.semester, status: row.status }));
    },
    async getProfile(studentId) {
      const found = profiles.find((profile) => profile.studentId === studentId);
      return found ? { ...found } : null;
    },
    async searchStudents({ q, page, pageSize }) {
      const needle = q?.toLowerCase() ?? null;
      const matches = profiles
        .filter((p) =>
          needle === null
            ? true
            : [p.studentId, `${p.firstName} ${p.lastName}`, p.email, p.program].some((text) => text.toLowerCase().includes(needle)),
        )
        .sort((a, b) => a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName));
      const openStatuses: readonly string[] = OPEN_CASE_STATUSES;
      const activeStatuses = ['assigned', 'pending_verification', 'returned'];
      const rows: StudentSummaryRecord[] = matches.slice((page - 1) * pageSize, page * pageSize).map((p) => ({
        ...p,
        openCases: cases.filter((c) => c.studentId === p.studentId && openStatuses.includes(c.status)).length,
        activeSanctions: sanctions.filter((s) => s.studentId === p.studentId && activeStatuses.includes(s.status)).length,
      }));
      return { total: matches.length, rows };
    },
    async getClearance(studentId, academicYear, semester) {
      const row = clearances.find(
        (candidate) =>
          candidate.studentId === studentId && candidate.academicYear === academicYear && candidate.semester === semester,
      );
      return row ? (strip(row) as ClearanceRecord) : null;
    },
  };
}
