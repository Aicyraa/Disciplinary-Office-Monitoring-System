# FEATURE-RULES — SDO Portal

Per-feature rules, moved out of `CLAUDE.md` so each agent reads only the feature it is building. Location: `docs/sdao-handoff/FEATURE-RULES.md`. These rules are derived from `SPEC.md`; if the two disagree, the spec wins and you stop and ask the human. Section numbers (3.1 to 3.12) are referenced from `CLAUDE.md` and from task rows in `CONTEXT.md`.

## 3. Features, one by one
For each feature: the spec section to read, and the rules that must not be broken.

### 3.1 Authentication and accounts (SPEC 4.8)
- Two account tables with text ids (`student_accounts.student_id`, `employee_accounts.employee_id`). Passwords hashed (bcryptjs is already installed; Argon2id is also acceptable). ≥ 8 chars, at least one letter and one digit.
- Login accepts only `@students.nu-fairview.edu.ph` / `@nu-fairview.edu.ph` emails; one generic error message; rate-limit login.
- Staff reset creates a one-time `Temp-####`, stores only its hash, sets `must_change_password = true`, and shows it to staff once. The user must set a new password at next sign-in (cannot equal the temp one). "Forgot password" stays in person.
- Role guard on every route: students see only their own rows; staff see all. Seed has no accounts (the workbook had plain-text passwords): accounts are created through the app.

### 3.2 Handbook and violations (SPEC 4.9, 3)
- `violations` (name unique, category Minor/Major) and `handbook_entries` (section, description, allowed sanction per offense step via `handbook_entry_sanctions`).
- V068 / H068 "3 minor offense" is `is_system = true`: hidden from every picker and the handbook list; it appears only on converted cases. `handbook_section` is not unique.
- Staff can create/edit violations; show "used in N cases". Keyed by id, so renames never break cases.

### 3.3 Cases (SPEC 4.1, 4.10)
- One table, `disciplinary_cases`, holds every case. `source` is `'gate'` or `'staff'`. Status: `reported → validated → for_sanction → resolved`, plus `rejected` (shown as "Not verified").
- Staff-recorded cases start at `validated`. Gate cases start at `reported`.
- **Cannot validate without a matched `student_id`**; staff may only reject, or fix the student link first (the DB also enforces this).
- Resolve needs every `case_sanctions` row `completed`, or "resolve with no sanction" with a reason.
- Every transition appends `case_status_history` and notifies the student. Remarks are timeline entries.
- Staff cases list: filters, search, 6 per page, Details/History tabs.

### 3.4 Gate reports (SPEC 4.10, POWER-AUTOMATE 3)
- Public form → `POST /public/gate-reports` → API inserts **one `disciplinary_cases` row per selected violation directly** (no separate submissions table), sharing a `submission_ref`. Typed values go to `claimed_student_id/name/program/year`; `student_id` is filled only when the typed ID matches.
- Duplicate guard is a unique index: same typed ID + violation + Manila day. Return the existing reference.
- Validate/reject act on every case with the same `submission_ref`.
- Public endpoint hardening is required: captcha token verified server-side, per-IP `express-rate-limit`, `express-validator`, body-size limit, generic errors. Build the form last (SPEC 10 step 9).

### 3.5 Escalation (SPEC 4.2) — write unit tests first
- Count a student's cases that are validated or later, **Minor**, not rejected, `is_escalated = false`. Different violation types count together. The threshold lives in **one config function**.
- At 3, in the same transaction as the validation: convert the **3rd case** into the Major (H068; `original_handbook_entry_id` keeps what it was reported as), flag the first two `is_escalated = true`, insert two `case_escalations` rows, write timeline entries, notify. **No fourth case is ever created.** The counter then restarts.
- Staff see a preview before validating ("This will convert case #N into a Major").

### 3.6 Sanctions and proof (SPEC 4.3, 6.1)
- `case_sanctions.status`: `assigned → pending_verification → completed`, with `returned` (reason) looping back. Staff choose only sanctions the handbook allows for that violation and offense number, set a flexible `due_date` (today or later; UI may pre-fill +14 days), and optional `staff_note`.
- Student proof: PDF/DOCX only, ≤ 10 MB each, max 5 files; allowed while `assigned` or `returned`; while pending verification they may replace or remove a file but never the last one; rejected with "already reviewed" if staff already reviewed.
- **Verify is blocked until staff opened every file** (`date_viewed` set). "Late by N days" is derived, not stored.
- Verify sets `date_completed` and `verified_by_employee_id`.

### 3.7 Files and sanction templates (SPEC 6.1)
- Bytes live in the Neon Object Storage **private** bucket; metadata in `files`. Keys: `proof/{case_sanction_id}/{uuid}.{ext}` and `templates/{sanction_id}/{uuid}.{ext}`.
- Upload goes **through Express** (`multer`, memory storage, 10 MB limit, check magic bytes: PDF `%PDF`, DOCX `PK`). Do not use browser presigned PUT (bucket CORS unconfirmed). Download via a ~60-second presigned GET after an authorization check (owner student or any staff). Opening a proof as staff sets `date_viewed` / `viewed_by_employee_id`.
- S3 client needs `forcePathStyle: true` and `requestChecksumCalculation: 'WHEN_REQUIRED'`. Env: `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_ENDPOINT_URL_S3`, `AWS_REGION`.
- Each sanction has a template page (title, description, written requirements) with downloadable PDF/DOCX. Students download; staff manage them.
- In-browser preview: PDF in an iframe, DOCX with `mammoth` (frontend only).

### 3.8 Appointments (SPEC 4.5)
- Staff pick a student, a start date (today … +60 days, not Sunday), purpose, optional notes. `end_date` = start + 5 more working days (Sundays skipped). 7:00 AM–5:00 PM is a UI display, not stored.
- Overlapping live (`scheduled`/`rescheduled`) windows for one student are rejected by the database exclusion constraint (`btree_gist`). Map that error to a friendly message.
- Status: `scheduled → rescheduled → completed / cancelled` (reason required). Everything is logged in `appointment_history` and notified. A reminder goes out the day before the start date (scheduled flow, later).

### 3.9 Clearance (SPEC 4.4) — manual
- One `clearances` row per student and term (`academic_year` = start year, `semester` 1–3). Default checklist = `requirements WHERE is_default`; staff can add/remove custom items per student.
- Staff mark done or reverse (**reason required**); each change is a `clearance_history` row. All items done → `status = 'cleared'`. No auto-computation.

### 3.10 Notifications and timelines (SPEC 4.6, 6.3, POWER-AUTOMATE)
- **There is no separate announcements/notices feature.** Notifications carry every admin update: sanction assigned or changed, appointment made or moved, case validated/rejected/resolved, clearance changes, password reset.
- Use one helper `notify({recipient, kind, title, message, link, idempotencyKey})`. If the `idempotency_key` exists, do nothing. Keys look like `san:12:completed`, `case:7:resolved`, `appt:3:new`. Students have `recipient_type='student'`; all staff share one mailbox (`recipient_type='staff'`, `student_id` NULL). Deep link = `link_type + link_id`.
- Student UI: inbox, unread badge, a "you have N unread" toast after login.
- Every case, sanction, appointment and clearance has a timeline of who did what and when (the `*_history` tables).

### 3.11 Power Automate integration (POWER-AUTOMATE.md)
- **The API is the only database writer.** Power Automate never gets DB credentials.
- **Commit first, notify second:** write the DB change and the `notifications` row (`email_status='pending'`) in one transaction, then POST to Flow 2 (`PA_NOTIFY_URL`). Flow 2 emails and calls back `…/integrations/notifications/:id/result` with `sent`/`failed`. Rows left `pending` are retried; nothing is lost if Power Automate is down or the Premium trial ends.
- Flow 1 = gate report submitted (called by the API after commit). Flow 2 = generic notify flow taking parameters; the API pre-renders subject and HTML, so wording lives in this repo.
- Integration endpoints sit outside the session login and require the `x-api-key` header (`PA_SHARED_SECRET`). Never put the flow URL or secret under a `VITE_` key or in Git.
- Growth ideas (reminders flow, backups, Teams alerts) are parked for later. Do not build them in version 1.

### 3.12 Students, dashboards and the rest of the screens (SPEC 5)
- Student pages: Dashboard · Inbox · My Violations (4-stage stepper, timeline, remarks, sanction card with proof upload) · My Sanctions (stats, Minor/Major filter, 4-step tracker) · Appointments (Upcoming/History) · Clearance (term switcher) · Student Handbook (+ templates).
- Staff pages: Dashboard · Record violation · Cases · Students (detail, reset password) · Appointments · Make appointment · Clearance · Handbook › Violations · Handbook › Sanction templates · Inbox (bell).
- Cross-cutting UI: three responsive modes (mobile < 720, rail 720–1100, full sidebar; bottom tab bar on mobile), confirm modals with a required reason, toasts, loading/empty/error/denied states, pagination.