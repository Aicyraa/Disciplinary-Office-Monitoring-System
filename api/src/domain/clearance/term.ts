/**
 * The current term (UI-POLISH-SPEC D3). SPEC 8 item 3 leaves the real term calendar as launch data, so this is
 * an assumption until the SDO confirms it: 1st Term August to November, 2nd Term December to March, 3rd Term
 * April to July; the school year is named after the year it starts in (August).
 */
export interface Term {
  academicYear: number;
  semester: 1 | 2 | 3;
}

/** `date` is read in Asia/Manila (UTC+8, no daylight saving). */
export function currentTerm(date: Date): Term {
  const manila = new Date(date.getTime() + 8 * 3_600_000);
  const year = manila.getUTCFullYear();
  const month = manila.getUTCMonth() + 1;
  if (month >= 8 && month <= 11) return { academicYear: year, semester: 1 };
  if (month === 12) return { academicYear: year, semester: 2 };
  if (month <= 3) return { academicYear: year - 1, semester: 2 };
  return { academicYear: year - 1, semester: 3 };
}

/** Newest first, the current term always included, no repeats. */
export function termList(current: Term, withClearances: Array<{ academicYear: number; semester: number }>): Array<{ academicYear: number; semester: number }> {
  const all = [current, ...withClearances];
  const seen = new Set<string>();
  return all
    .filter((term) => {
      const key = `${term.academicYear}-${term.semester}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => b.academicYear - a.academicYear || b.semester - a.semester);
}
