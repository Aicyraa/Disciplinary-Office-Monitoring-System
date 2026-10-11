import type {
  AppointmentRecord,
  CaseHistoryRecord,
  CaseRecord,
  CaseSanctionRecord,
  ClearanceRecord,
  StudentViewRepo,
} from './repo.js';

type Owned<T> = { studentId: string } & T;

export interface MemoryStudentData {
  cases?: Array<Owned<CaseRecord> & { history?: CaseHistoryRecord[] }>;
  sanctions?: Array<Owned<CaseSanctionRecord>>;
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

  return {
    async listCases(studentId) {
      return cases
        .filter((row) => row.studentId === studentId)
        .map((row) => strip(row, 'history') as CaseRecord)
        .sort((a, b) => b.caseDate.getTime() - a.caseDate.getTime());
    },
    async getCase(studentId, caseId) {
      const row = cases.find((candidate) => candidate.studentId === studentId && candidate.caseId === caseId);
      if (!row) return null;
      const history = [...(row.history ?? [])].sort((a, b) => a.date.getTime() - b.date.getTime());
      return { ...(strip(row, 'history') as CaseRecord), history };
    },
    async listSanctions(studentId, options) {
      return sanctions
        .filter((row) => row.studentId === studentId && (options?.caseId === undefined || row.caseId === options.caseId))
        .map((row) => strip(row) as CaseSanctionRecord)
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
    async getClearance(studentId, academicYear, semester) {
      const row = clearances.find(
        (candidate) =>
          candidate.studentId === studentId && candidate.academicYear === academicYear && candidate.semester === semester,
      );
      return row ? (strip(row) as ClearanceRecord) : null;
    },
  };
}
