import { describe, expect, test } from 'vitest';
import { emailDetails } from '../../src/services/notifications/details.js';
import { buildNotifyPayload } from '../../src/services/notifications/render.js';

describe('emailDetails: one labelled block per service message', () => {
  test.each([
    [
      'CATEGORY - 2 was assigned for case SDO-2026-007. Due 2026-10-30.',
      null,
      [['Sanction', 'CATEGORY - 2'], ['Case', 'SDO-2026-007'], ['Due date', 'October 30, 2026']],
    ],
    [
      'Proof was submitted for Community service (case SDO-2026-007). It is waiting for verification.',
      'Proof was submitted and is waiting for verification.',
      [['Sanction', 'Community service'], ['Case', 'SDO-2026-007']],
    ],
    [
      'Your Community service (case SDO-2026-007) was verified as completed.',
      'Your sanction was verified as completed.',
      [['Sanction', 'Community service'], ['Case', 'SDO-2026-007']],
    ],
    [
      'Your Community service (case SDO-2026-007) was returned. Reason: The file is blurry.',
      'Your proof was returned. Please check the reason and upload again.',
      [['Sanction', 'Community service'], ['Case', 'SDO-2026-007'], ['Reason', 'The file is blurry.']],
    ],
    [
      'A report was filed under your student ID (reference GI-1005): Bypassing student entrance, No ID. It is waiting for review by the SDO office.',
      'A report was filed under your student ID. It is waiting for review by the SDO office.',
      [['Reference', 'GI-1005'], ['Violations', 'Bypassing student entrance, No ID']],
    ],
    [
      'Test Student (2025-0000001) was reported for: No ID. The student ID is not on file; link it to a student or reject the report. Reference GI-1006.',
      'The student ID is not on file; link it to a student or reject the report.',
      [['Student', 'Test Student'], ['Student ID', '2025-0000001'], ['Violations', 'No ID'], ['Reference', 'GI-1006']],
    ],
    [
      'Test Student (2025-0000001) was reported for: No ID. Reference GI-1006.',
      'A new gate report is waiting for review.',
      [['Student', 'Test Student'], ['Student ID', '2025-0000001'], ['Violations', 'No ID'], ['Reference', 'GI-1006']],
    ],
    [
      'Your third minor violation (case SDO-2026-009) is now treated as a Major offense. Linked cases: SDO-2026-001, SDO-2026-004.',
      'Your third minor violation is now treated as a Major offense.',
      [['Case', 'SDO-2026-009'], ['Linked cases', 'SDO-2026-001, SDO-2026-004']],
    ],
    [
      'A Minor violation, "No ID", was recorded (case SDO-2026-010).',
      null,
      [['Violation', 'No ID'], ['Category', 'Minor'], ['Case', 'SDO-2026-010']],
    ],
    ['Case SDO-2026-006 was validated by the SDO office.', 'The report was validated by the SDO office.', [['Case', 'SDO-2026-006']]],
    ['Case SDO-2026-006 could not be verified. Reason: Wrong ID.', 'The report could not be verified.', [['Case', 'SDO-2026-006'], ['Reason', 'Wrong ID.']]],
    ['Case SDO-2026-006 is resolved.', 'The case is resolved.', [['Case', 'SDO-2026-006']]],
    [
      'Case SDO-2026-006 was resolved without a sanction. Reason: First offense.',
      'The case was resolved without a sanction.',
      [['Case', 'SDO-2026-006'], ['Reason', 'First offense.']],
    ],
    [
      'The SDO office added a remark to case SDO-2026-006: Bring your ID.',
      'The SDO office added a remark to your case.',
      [['Case', 'SDO-2026-006'], ['Remark', 'Bring your ID.']],
    ],
    [
      'You have an appointment with the SDO office: Counselling. Visit any working day from Oct 19 to Oct 24, 2026 (7:00 AM to 5:00 PM).',
      'Visit the SDO office on any working day within this window.',
      [['Purpose', 'Counselling'], ['Window', 'Oct 19 to Oct 24, 2026'], ['Office hours', '7:00 AM to 5:00 PM']],
    ],
    [
      'Your SDO appointment was moved. New window: Oct 26 to Oct 31, 2026 (7:00 AM to 5:00 PM).',
      'Your appointment was moved.',
      [['New window', 'Oct 26 to Oct 31, 2026'], ['Office hours', '7:00 AM to 5:00 PM']],
    ],
    [
      'Your SDO appointment (Oct 19 to Oct 24, 2026) was cancelled. Reason: Office closed.',
      'Your appointment was cancelled.',
      [['Window', 'Oct 19 to Oct 24, 2026'], ['Reason', 'Office closed.']],
    ],
    [
      'Your clearance for 1st Term 2026–2027 is complete. "Library" was the last requirement marked done.',
      'Your clearance is complete.',
      [['Term', '1st Term 2026–2027'], ['Last requirement', 'Library']],
    ],
    [
      'The SDO office marked "Library" as done for your 1st Term 2026–2027 clearance. Note: Returned all books.',
      'A clearance requirement was marked done.',
      [['Requirement', 'Library'], ['Term', '1st Term 2026–2027'], ['Note', 'Returned all books.']],
    ],
    [
      'The SDO office reopened "Library" for your 1st Term 2026–2027 clearance; your clearance is pending again. Reason: Missing book.',
      'A clearance requirement was reopened. Your clearance is pending again.',
      [['Requirement', 'Library'], ['Term', '1st Term 2026–2027'], ['Reason', 'Missing book.']],
    ],
    [
      'Your clearance for 2026-2027, Semester 1 was set up with the standard requirements: No active violations, SDO signature. ' +
        'The SDO office marks each one done; you can follow your progress on the Clearance page.',
      'Your clearance checklist is ready. The SDO office marks each requirement done.',
      [['Term', '2026-2027, Semester 1'], ['Requirements', 'No active violations, SDO signature']],
    ],
    [
      'The automatic term set-up gave 2 of 3 active students a clearance for 2026-2027, Semester 1. 1 already had one.',
      'The automatic clearance set-up finished.',
      [['Term', '2026-2027, Semester 1'], ['New clearances', '2'], ['Already set up', '1'], ['Active students', '3']],
    ],
    ['Classes resume Monday.\n\nWhat to do: Wear your ID.', 'Classes resume Monday.', [['What to do', 'Wear your ID.']]],
  ])('%s', (message, lead, rows) => {
    expect(emailDetails(message)).toEqual({ lead, rows });
  });

  test('a message it does not know is kept whole', () => {
    expect(emailDetails('Your password was reset.')).toEqual({ lead: 'Your password was reset.', rows: [] });
  });
});

describe('the email shows the labelled details', () => {
  test('labels and values land in the message card, escaped, with no kind chip', () => {
    const body = buildNotifyPayload('sanction', {
      notificationId: 1,
      idempotencyKey: 'k',
      title: 'Sanction assigned',
      message: 'CATEGORY <2> was assigned for case SDO-2026-007. Due 2026-10-30.',
      linkUrl: null,
      to: ['a@example.invalid'],
      greetingName: null,
    }).html_body;
    expect(body).toContain('>Sanction</td>');
    expect(body).toContain('>CATEGORY &lt;2&gt;</td>');
    expect(body).toContain('>Due date</td>');
    expect(body).toContain('>October 30, 2026</td>');
    expect(body).toContain('border-radius:0 8px 8px 0');
    expect(body).not.toContain('border-radius:999px');
  });
});
