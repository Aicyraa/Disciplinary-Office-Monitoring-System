/**
 * Splits a stored notification message into a short sentence and labelled rows for the email ("Sanction",
 * "Case", "Due date"...). Pure: it only reads the text the services wrote, so a message it does not recognise is
 * shown as it is, never dropped. Keep the patterns in step with the `message:` strings in the services.
 */

export type DetailRow = readonly [label: string, value: string];
export interface EmailDetails {
  /** One plain sentence above the rows, or null when the rows say it all. */
  lead: string | null;
  rows: DetailRow[];
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** `2026-10-30` -> `October 30, 2026`; anything else unchanged. */
function longDate(day: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  if (!match) return day;
  const month = MONTHS[Number(match[2]) - 1];
  return month ? `${month} ${Number(match[3])}, ${match[1]}` : day;
}

type Groups = Record<string, string | undefined>;
type Pattern = { re: RegExp; read: (g: Groups) => EmailDetails };

const row = (label: string, value: string | undefined): DetailRow[] => (value ? [[label, value.trim()]] : []);

const PATTERNS: Pattern[] = [
  // Sanctions (sanctions.service.ts).
  {
    re: /^(?<sanction>.+) was assigned for case (?<case>\S+)\. Due (?<due>\d{4}-\d{2}-\d{2})\.$/,
    read: (g) => ({ lead: null, rows: [...row('Sanction', g.sanction), ...row('Case', g.case), ...row('Due date', g.due && longDate(g.due))] }),
  },
  {
    re: /^Proof was submitted for (?<sanction>.+) \(case (?<case>[^)]+)\)\. It is waiting for verification\.$/,
    read: (g) => ({ lead: 'Proof was submitted and is waiting for verification.', rows: [...row('Sanction', g.sanction), ...row('Case', g.case)] }),
  },
  {
    re: /^Your (?<sanction>.+) \(case (?<case>[^)]+)\) was verified as completed\.$/,
    read: (g) => ({ lead: 'Your sanction was verified as completed.', rows: [...row('Sanction', g.sanction), ...row('Case', g.case)] }),
  },
  {
    re: /^Your (?<sanction>.+) \(case (?<case>[^)]+)\) was returned\. Reason: (?<reason>[\s\S]+)$/,
    read: (g) => ({
      lead: 'Your proof was returned. Please check the reason and upload again.',
      rows: [...row('Sanction', g.sanction), ...row('Case', g.case), ...row('Reason', g.reason)],
    }),
  },
  // Gate reports (gate.service.ts).
  {
    re: /^A report was filed under your student ID \(reference (?<ref>[^)]+)\): (?<names>.+)\. It is waiting for review by the SDO office\.$/,
    read: (g) => ({
      lead: 'A report was filed under your student ID. It is waiting for review by the SDO office.',
      rows: [...row('Reference', g.ref), ...row('Violations', g.names)],
    }),
  },
  {
    re: /^(?<name>.+) \((?<id>[^)]+)\) was reported for: (?<names>.+?)\.(?<unmatched> The student ID is not on file; link it to a student or reject the report\.)? Reference (?<ref>[^.]+)\.$/,
    read: (g) => ({
      lead: g.unmatched ? g.unmatched.trim() : 'A new gate report is waiting for review.',
      rows: [...row('Student', g.name), ...row('Student ID', g.id), ...row('Violations', g.names), ...row('Reference', g.ref)],
    }),
  },
  // Cases (cases.service.ts).
  {
    re: /^Your third minor violation \(case (?<case>[^)]+)\) is now treated as a Major offense\. Linked cases: (?<linked>.+)\.$/,
    read: (g) => ({ lead: 'Your third minor violation is now treated as a Major offense.', rows: [...row('Case', g.case), ...row('Linked cases', g.linked)] }),
  },
  {
    re: /^A (?<severity>Minor|Major) violation, "(?<violation>.+)", was recorded \(case (?<case>[^)]+)\)\.$/,
    read: (g) => ({ lead: null, rows: [...row('Violation', g.violation), ...row('Category', g.severity), ...row('Case', g.case)] }),
  },
  {
    re: /^Case (?<case>\S+) was validated by the SDO office\.$/,
    read: (g) => ({ lead: 'The report was validated by the SDO office.', rows: row('Case', g.case) }),
  },
  {
    re: /^Case (?<case>\S+) could not be verified\. Reason: (?<reason>[\s\S]+)$/,
    read: (g) => ({ lead: 'The report could not be verified.', rows: [...row('Case', g.case), ...row('Reason', g.reason)] }),
  },
  {
    re: /^Case (?<case>\S+) is resolved\.$/,
    read: (g) => ({ lead: 'The case is resolved.', rows: row('Case', g.case) }),
  },
  {
    re: /^Case (?<case>\S+) was resolved without a sanction\. Reason: (?<reason>[\s\S]+)$/,
    read: (g) => ({ lead: 'The case was resolved without a sanction.', rows: [...row('Case', g.case), ...row('Reason', g.reason)] }),
  },
  {
    re: /^The SDO office added a remark to case (?<case>[^:]+): (?<remark>[\s\S]+)$/,
    read: (g) => ({ lead: 'The SDO office added a remark to your case.', rows: [...row('Case', g.case), ...row('Remark', g.remark)] }),
  },
  // Appointments (appointments.service.ts).
  {
    re: /^You have an appointment with the SDO office: (?<purpose>[\s\S]+)\. Visit any working day from (?<range>.+) \((?<hours>[^)]+)\)\.$/,
    read: (g) => ({
      lead: 'Visit the SDO office on any working day within this window.',
      rows: [...row('Purpose', g.purpose), ...row('Window', g.range), ...row('Office hours', g.hours)],
    }),
  },
  {
    re: /^Your SDO appointment was moved\. New window: (?<range>.+) \((?<hours>[^)]+)\)\.$/,
    read: (g) => ({ lead: 'Your appointment was moved.', rows: [...row('New window', g.range), ...row('Office hours', g.hours)] }),
  },
  {
    re: /^Your SDO appointment \((?<range>[^)]+)\) was updated\. (?<changes>[\s\S]+)\.$/,
    read: (g) => ({ lead: 'Your appointment details were updated.', rows: [...row('Window', g.range), ...row('Changes', g.changes)] }),
  },
  {
    re: /^Your SDO appointment \((?<range>[^)]+)\) was marked completed\.$/,
    read: (g) => ({ lead: 'Your appointment was marked completed.', rows: row('Window', g.range) }),
  },
  {
    re: /^Your SDO appointment \((?<range>[^)]+)\) was cancelled\. Reason: (?<reason>[\s\S]+)$/,
    read: (g) => ({ lead: 'Your appointment was cancelled.', rows: [...row('Window', g.range), ...row('Reason', g.reason)] }),
  },
  // Clearance (clearance.service.ts).
  {
    re: /^Your clearance for (?<term>.+?) is complete\. "(?<label>.+)" was the last requirement marked done\.$/,
    read: (g) => ({ lead: 'Your clearance is complete.', rows: [...row('Term', g.term), ...row('Last requirement', g.label)] }),
  },
  {
    re: /^Your clearance for (?<term>.+?) is complete\. Every remaining requirement is done\.$/,
    read: (g) => ({ lead: 'Your clearance is complete.', rows: row('Term', g.term) }),
  },
  {
    re: /^The SDO office marked "(?<label>.+)" as done for your (?<term>.+?) clearance\.(?: Note: (?<note>[\s\S]+))?$/,
    read: (g) => ({ lead: 'A clearance requirement was marked done.', rows: [...row('Requirement', g.label), ...row('Term', g.term), ...row('Note', g.note)] }),
  },
  {
    re: /^The SDO office reopened "(?<label>.+)" for your (?<term>.+?) clearance(?<pending>; your clearance is pending again)?\. Reason: (?<reason>[\s\S]+)$/,
    read: (g) => ({
      lead: g.pending ? 'A clearance requirement was reopened. Your clearance is pending again.' : 'A clearance requirement was reopened.',
      rows: [...row('Requirement', g.label), ...row('Term', g.term), ...row('Reason', g.reason)],
    }),
  },
  {
    re: /^Your clearance for (?<term>.+?) was set up with the standard requirements: (?<labels>.+)\. The SDO office marks each one done; you can follow your progress on the Clearance page\.$/,
    read: (g) => ({
      lead: 'Your clearance checklist is ready. The SDO office marks each requirement done.',
      rows: [...row('Term', g.term), ...row('Requirements', g.labels)],
    }),
  },
  {
    re: /^The automatic term set-up gave (?<created>\d+) of (?<active>\d+) active students a clearance for (?<term>.+)\. (?<skipped>\d+) already had one\.$/,
    read: (g) => ({
      lead: 'The automatic clearance set-up finished.',
      rows: [...row('Term', g.term), ...row('New clearances', g.created), ...row('Already set up', g.skipped), ...row('Active students', g.active)],
    }),
  },
  // Important notices (notices.service.ts `inboxMessage`).
  {
    re: /^(?<message>[\s\S]+?)\n\nWhat to do: (?<todo>[\s\S]+)$/,
    read: (g) => ({ lead: g.message?.trim() ?? null, rows: row('What to do', g.todo) }),
  },
];

export function emailDetails(message: string): EmailDetails {
  const text = message.trim();
  for (const { re, read } of PATTERNS) {
    const match = re.exec(text);
    if (match) return read(match.groups ?? {});
  }
  return { lead: text, rows: [] };
}
