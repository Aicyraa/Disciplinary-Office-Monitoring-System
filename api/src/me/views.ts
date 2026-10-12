import type {
  CaseTimelineEntry,
  ClearanceTermView,
  StudentAppointmentView,
  StudentCaseDetailView,
  StudentCaseView,
  StudentClearanceView,
  StudentSanctionView,
} from '@shared/types.js';
import { displayCode } from '../codes.js';
import { lateByDays } from '../sanctions/rules.js';
import type {
  AppointmentRecord,
  CaseHistoryRecord,
  CaseRecord,
  CaseSanctionRecord,
  ClearanceRecord,
  ClearanceTermRecord,
} from './repo.js';

const iso = (date: Date): string => date.toISOString();
const isoOrNull = (date: Date | null): string | null => (date ? date.toISOString() : null);
/** `date` columns arrive as UTC midnight; the calendar day is the first ten characters. */
const dateOnly = (date: Date): string => date.toISOString().slice(0, 10);

export function toCaseView(record: CaseRecord): StudentCaseView {
  return {
    id: record.caseId,
    code: record.code,
    status: record.status,
    caseDate: iso(record.caseDate),
    violation: record.violationType,
    severity: record.severity,
    section: record.handbookSection,
    isEscalated: record.isEscalated,
    convertedFrom: record.originalViolationType,
    resolvedWithoutSanction: record.resolvedWithoutSanction,
    dateResolved: isoOrNull(record.dateResolved),
  };
}

export function toTimelineEntry(entry: CaseHistoryRecord): CaseTimelineEntry {
  return { eventType: entry.eventType, statusAfter: entry.statusAfter, remarks: entry.remarks, date: iso(entry.date) };
}

/** `today` is the Asia/Manila calendar day (see manilaToday); it only feeds the derived "late by" figure. */
export function toSanctionView(record: CaseSanctionRecord, today: string): StudentSanctionView {
  const staffReviewed = record.files.some((file) => file.dateViewed !== null);
  return {
    id: record.caseSanctionId,
    caseId: record.caseId,
    caseCode: record.caseCode,
    sanctionId: record.sanctionId,
    sanctionCode: displayCode('S', record.sanctionId),
    type: record.sanctionType,
    description: record.description,
    severity: record.caseSeverity,
    status: record.status,
    dateAssigned: iso(record.dateAssigned),
    dueDate: dateOnly(record.dueDate),
    dateSubmitted: isoOrNull(record.dateSubmitted),
    dateCompleted: isoOrNull(record.dateCompleted),
    staffNote: record.staffNote,
    complianceNote: record.complianceNote,
    // Employee ids are never exposed to students; only "staff" or "student".
    history: record.history.map((event) => ({
      eventType: event.eventType,
      remarks: event.remarks,
      by: event.byStaff ? 'staff' : 'student',
      date: iso(event.date),
    })),
    files: record.files.map((file) => ({
      id: file.caseSanctionFileId,
      name: file.originalName,
      mimeType: file.mimeType,
      sizeBytes: file.sizeBytes,
      dateUploaded: iso(file.dateUploaded),
    })),
    lateByDays: lateByDays({
      dueDate: dateOnly(record.dueDate),
      status: record.status,
      today,
      completedOn: record.dateCompleted ? manilaToday(record.dateCompleted) : null,
    }),
    // Mirrors the API rules (SPEC 4.3) so the screen only offers what the API will accept.
    canUpload: record.status === 'assigned' || record.status === 'returned',
    canChangeFiles:
      (record.status === 'returned' && record.files.length > 0) || (record.status === 'pending_verification' && !staffReviewed),
  };
}

export function toCaseDetailView(
  record: CaseRecord & { history: CaseHistoryRecord[] },
  sanctions: CaseSanctionRecord[],
  today: string,
): StudentCaseDetailView {
  return {
    ...toCaseView(record),
    timeline: record.history.map(toTimelineEntry),
    sanctions: sanctions.map((sanction) => toSanctionView(sanction, today)),
  };
}

/** Calendar day in Asia/Manila as YYYY-MM-DD (SPEC decision: display in Manila time). */
export function manilaToday(now: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

/** Upcoming = still live (scheduled/rescheduled) and its window has not ended; everything else is history. */
export function appointmentBucket(record: AppointmentRecord, today: string): 'upcoming' | 'history' {
  const live = record.status === 'scheduled' || record.status === 'rescheduled';
  return live && dateOnly(record.endDate) >= today ? 'upcoming' : 'history';
}

export function toAppointmentView(record: AppointmentRecord, today: string): StudentAppointmentView {
  return {
    id: record.appointmentId,
    code: displayCode('A', record.appointmentId),
    startDate: dateOnly(record.startDate),
    endDate: dateOnly(record.endDate),
    purpose: record.purpose,
    notes: record.notes,
    status: record.status,
    cancelReason: record.cancelReason,
    bucket: appointmentBucket(record, today),
  };
}

const termView = (term: ClearanceTermRecord): ClearanceTermView => ({
  academicYear: term.academicYear,
  semester: term.semester,
  status: term.status,
});

/** Newest term first (academic year, then semester). */
export function sortTerms(terms: ClearanceTermRecord[]): ClearanceTermView[] {
  return terms
    .map(termView)
    .sort((a, b) => b.academicYear - a.academicYear || b.semester - a.semester);
}

export function toClearanceView(record: ClearanceRecord): StudentClearanceView {
  return {
    ...termView(record),
    id: record.clearanceId,
    items: record.items.map((item) => ({
      requirementId: item.requirementId,
      label: item.label,
      status: item.status,
      remarks: item.remarks,
      dateCompleted: isoOrNull(item.dateCompleted),
    })),
  };
}
