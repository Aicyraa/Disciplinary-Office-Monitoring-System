# SDO Portal (NU Fairview Student Discipline Office) — FINAL Spec v2

Sources: the Claude Design prototype (`design-reference/sdo-portal.source.html`) and your workbook `DO_SYSTEM_DB.xlsx`.
Companion files: `POWER-AUTOMATE.md` (the two flows and API contract), `db/schema.sql` (final PostgreSQL schema, tested on Postgres 16), `db/seed.sql` (handbook, sanctions, programs, requirements from your workbook), and the Lucidchart ERD "SDAO-SYSTEM-ERD (FINAL v3)".

The prototype is **front-end only**: state lives in memory, the date is fixed at 2026-10-09, passwords are plain text, and email is simulated. Every rule below must be enforced by the backend.

---

## 0. Decisions (settled)

| # | Question | Decision |
|---|---|---|
| 1 | Major sanctions | Follow your ERD: the `sanctions` table (Violation Slip, Written Warning, CATEGORY 1–5, Failed in course, Charged, Confiscate). Which ones are allowed per violation and offense number comes from `handbook_entry_sanctions`. The prototype's "10h / 20h / referral" options are dropped |
| 2 | Sanction due date | **Flexible.** Staff pick the due date when assigning (the UI may pre-fill +14 days, but it is editable; must be today or later) |
| 3 | Naming | snake_case everywhere. Ids are auto-increment except `student_accounts` and `employee_accounts` |
| 4 | Clearance | **Manual** (staff mark items). No auto-computation |
| 5 | Student statement | **Removed** from the case screen |
| 6 | Appointments | 6-working-day window (Mon–Sat, Sundays skipped), 7:00 AM–5:00 PM, starting on the date staff assign |
| 7 | Email / notifications | **Power Automate (Premium)** sends them from the flow owner's own mailbox (decision 15), not a shared mailbox. Two flows: Flow 1 (form → API), Flow 2 (one dynamic notification flow that takes parameters). See section 6.3 and `POWER-AUTOMATE.md` |
| 8 | Gate form | **Stays a web form in the app** (public). It posts to the API (bot protection per decision 12 + rate limit); after the commit the API triggers Power Automate **Flow 1**, which notifies the student and staff |
| 9 | Time zone | Asia/Manila. Store UTC (`timestamptz`), display in Manila time |
| 10 | Escalation | 3 minors of any kind; the 3rd converts into the Major "3 minor offense"; the 2 earlier minors are flagged escalated (section 4.2) |
| 11 | Power Automate trust | Power Automate only issues a **signed trigger URL** per flow (no secret exists). The URL is the credential (`PA_NOTIFY_URL`, `PA_GATE_URL`), kept server-side. **The flow never calls the API**: it answers in its HTTP Response (`sent` / `failed`) and the API sets `email_status`. No callback, no tunnel, no `x-api-key`, no `PA_SHARED_SECRET`, no `/integrations/*` endpoints. Every outbound body is `{ "type": ..., "payload": {...} }` (`POWER-AUTOMATE.md` section 4) |
| 12 | Gate-form protection | **No captcha and no third-party service.** The public endpoint is protected by a per-IP rate limit and a form-timing token (signed when the form opens; rejected if submitted under 3 seconds or over 30 minutes later), plus validation, a body-size limit and the duplicate unique index. All checks sit behind one `verifyHuman()` function so a captcha can be added later without changing the form flow |
| 13 | Accounts and ids | Accounts are **added manually** (SQL seed file with bcrypt hashes; no create-account screen in version 1). Student id format is `YYYY-NNNNNNN`: 4 digits, a dash, 7 digits (11 digits in total, regex `^\d{4}-\d{7}$`), e.g. `2023-1030333`. Display codes are a letter plus the numeric id padded to **3 digits** (`S001`, `V001`, `C001`); ids above 999 simply grow (`S1000`) |
| 14 | Offense number and retry cap | **Offense number** of a case = 1 + the number of the same student's earlier cases (by `case_date`, then id) for the same violation that are `validated`, `for_sanction` or `resolved`; `reported` and `rejected` never count. It selects the `handbook_entry_sanctions` rows offered to staff (4.3). **Notification retry cap:** the in-API sweep retries `pending` emails for 24 hours after `date_created`, then marks them `failed` (no schema change) |
| 15 | Email sender | The **flow owner's own account** sends every email (their mail connection in "Send an email (V2)"). No shared mailbox, no "send as", no NU IT request. All employee accounts **recieves** the notifications both in-app and outlook address
| 16 | Proof of sanctions | **Online only.** A student uploads files; staff open every file and then verify. No in-person "record compliance" path (4.3). Settled 2026-10-12 |
| 19 | Gate report email | **No separate Flow 1.** A gate report is stored by the API and delivered through the one notify flow (Flow 2, `type: "report"`): a "report received" email to the student when the typed ID matched, and one alert to every active employee account. `PA_GATE_URL` is not used. Settled 2026-10-12 |
| 17 | Appointment reminders | **None.** The student is notified only when staff create or change an appointment; students have no appointment actions; no holiday list (4.5). Settled 2026-10-12 |
| 18 | UI fidelity | The first UI passes (steps 2 to 9) use the design tokens and existing components; a **design-fidelity pass over every page is build step 10**. The screens are `design-reference/SDO_Portal_UI.pptx` (web and mobile, every state) and the logic and copy are `design-reference/sdo-portal.source.html`; the plan, the comparison and the logic changes it implies are in `UI-POLISH-SPEC.md`, and a logic change there is built only after the human accepts it. Settled 2026-10-12 | 

---

## 1. What this system is

| Audience | Entry | Auth |
|---|---|---|
| **Student** | Login → student app (7 pages) | NU student email + password |
| **Staff (SDO officer)** | Login → staff app (10 pages) | NU staff email + password |
| **Gate guard / anyone** | Public web "Violation Form" (3 steps) → API → Flow 1 | none (rate limit + form-timing token) |

Core loop: report → staff validate → (3 minors roll into a Major) → staff assign sanction(s) with a due date → student uploads proof → staff open every file and verify (or return) → staff resolve the case → staff update the clearance checklist. **Every status change writes a timeline entry, creates an in-app notification, and sends an email.**

---

## 2. New features added by the prototype (not in your original ERD)

| Feature | What it does | Tables |
|---|---|---|
| **Notifications (inbox + email)** | Every admin update reaches the student as one in-app notification and one email: what was assigned (sanction, appointment), what changed (status, due date, moved appointment, returned proof), and violation or case updates. Categories: Violations, Sanctions, Appointments, Clearance, Account. Each has a deep link. An idempotency key stops duplicates. Unread badge and a 7-second "you have N unread" toast after student login | `notifications` |
| **Timelines (remarks + logs)** | Every case, sanction, appointment and clearance has a timeline of who did what and when. Staff remarks on a case are timeline entries of type `remark`, and the student sees the latest | `case_status_history` (extended), `case_sanction_history`, `appointment_history`, `clearance_history` |
| **Sanction templates** | Each sanction has a template page (title, description, written requirements) with downloadable PDF/DOCX file(s). Students download them from the Handbook and from their sanction. Staff manage them under Handbook › Sanction templates | `sanction_templates`, `sanction_template_files` |
| **Proof upload + verification** | Student uploads PDF/DOCX proof (≤ 10 MB, max 5 files); may replace or remove files while the sanction is pending. Staff must **open every file** before **Verify** unlocks; or **Return** with a reason | `case_sanction_files`, `files`, `case_sanctions.status` |
| **Gate reports** | Public 3-step web form → API inserts one `disciplinary_cases` row per selected violation directly (no separate table), duplicate guard, then Flow 1 notifies; staff then validate | `disciplinary_cases` (`source='gate'`, `claimed_*`, `submission_ref`) |
| **Escalation tracking** | Minor offenses roll into a Major case, with a preview shown to staff before they validate | `case_escalations`, `disciplinary_cases.is_escalated` |
| **Forced password change** | Staff reset creates a temp password; the student must set a new one at the next sign-in | `must_change_password` on both account tables |
| **Clearance change log** | Mark done, reverse (reason required), add or remove a requirement, all logged | `clearance_history`, `requirements.is_default` |
| **Appointment lifecycle** | Scheduled → Rescheduled → Completed / Cancelled (reason), each logged and notified. Overlap protection | `appointments`, `appointment_history` |
| **In-browser file preview** | PDF in an iframe, DOCX rendered with `mammoth` | frontend only |

---

## 3. Final data model

**23 tables** (see `db/schema.sql`; ERD in Lucidchart). Grouped:

| Group | Tables |
|---|---|
| Accounts | `programs`, `student_accounts`, `employee_accounts` |
| Handbook | `violations`, `handbook_entries`, `sanctions`, `handbook_entry_sanctions`, `sanction_templates`★, `sanction_template_files`★ |
| Files | `files`★ |
| Intake / cases | `disciplinary_cases`, `case_escalations`★, `case_status_history` |
| Sanctions on cases | `case_sanctions`, `case_sanction_files`★, `case_sanction_history`★ |
| Appointments | `appointments`, `appointment_history`★ |
| Clearance | `requirements`, `clearances`, `clearance_requirements`, `clearance_history`★ |
| Communication | `notifications`★ |

★ = new since your workbook (9 tables).

### ID strategy (workbook codes like V001 / S001)
- **Primary keys are numeric identity columns** the database maintains (`GENERATED ALWAYS AS IDENTITY`). Nothing is typed by hand, nothing collides, joins are fast, and renaming never matters. Hand-maintained text ids like `V001` break when two people add a row at once and when a number gets reused.
- **Display codes are derived, not stored**: the app formats them (letter + id padded to 3 digits: `V001`, `S001`, `C001`; see decision 13) when it needs to show one. The seed keeps workbook numbers (V001 → 1, S001 → 1), so the codes you already know stay the same.
- `student_id` and `employee_id` stay text because they are real-world identifiers (school ID numbers) that people type.

### Changes to your existing tables

| Table | Change | Why |
|---|---|---|
| all | ids become `integer GENERATED ALWAYS AS IDENTITY` (workbook codes `P009`, `V001`… keep their numbers in `seed.sql`); `student_accounts`/`employee_accounts` keep text ids | your auto-increment rule |
| accounts | + `must_change_password`, `is_active`, `date_created`; `password_hashed` must hold a real hash | forced reset flow. **Your workbook has plain-text passwords** (`DAGUMAN123`, `L123`), so don't import them |
| `disciplinary_cases` | `handbook_id` → `handbook_entry_id`; the two status columns (`status` + `validation_status`) merge into **one** `status`: `reported → validated → for_sanction → resolved`, plus `rejected`; + `source`, `claimed_student_id`, `claimed_name`, `claimed_program`, `claimed_year`, `submission_ref`, `original_handbook_entry_id`, `is_escalated`, `reported_by_employee_id`, `resolved_without_sanction`, `date_resolved`; `student_id` is nullable only while a gate report is unmatched | the two columns held the same information; prototype needs reject and gate intake |
| `case_status_history` | `validation_status` → `status_after`; + `event_type` (reported, validated, rejected, remark, sanction_assigned, escalated, flagged_escalated, resolved) | doubles as the remarks timeline |
| `case_sanctions` | status becomes `assigned / pending_verification / returned / completed`; + `due_date`, `date_submitted`, `verified_by_employee_id`, `staff_note`, `compliance_note`; `employee_id` → `assigned_by_employee_id`; one sanction type once per case | proof workflow and flexible due date |
| `appointments` | `appointment_date` + `appointment_time` → `start_date` + `end_date`; `purpose`, `notes` kept; status `scheduled / rescheduled / completed / cancelled`; + `cancel_reason`, `date_created`, `date_updated`; **exclusion constraint** blocks overlapping live appointments per student; Sundays blocked | 6-day window |
| `clearances` | unique `(student_id, academic_year, semester)`; `semester` 1–3; status `pending / cleared` | one clearance per term |
| `clearance_requirements` | + `completed_by_employee_id`, `date_completed`; unique per clearance and requirement | audit |
| `requirements` | + `is_default` | custom requirements per student |
| `violations` / `handbook_entries` | + `violations.is_system` (V068 "3 minor offense" is system-assigned only, kept from your workbook as H068); `handbook_section` no longer unique (H036 and H068 both are VI.E.20); `disciplinary_cases.original_handbook_entry_id` remembers what the converted 3rd case was reported as | the 3rd minor is converted, not duplicated |

### Row counts from your workbook (seeded)
14 programs · 10 sanctions · 4 requirements · 68 violations (incl. system V068) · 68 handbook entries (incl. H068) · 132 handbook-entry-sanction rows (H068 copies H036's two). Accounts, appointments, clearances and cases in the workbook are test data and are **not** seeded.

---

## 4. Business rules

### 4.1 Case lifecycle (`disciplinary_cases.status`)
```
reported ──validate──▶ validated ──assign sanction──▶ for_sanction ──resolve (all sanctions completed)──▶ resolved
   │                       └──resolve with no sanction (reason)───────────────────────────────────────────▶ resolved
   └──reject (reason)──▶ rejected   (shown to staff and students as "Not verified")
```
- Gate reports start at `reported`. Validate / reject act on the **whole submission** (every case with the same `submission_ref`).
- Staff-recorded cases skip `reported` and start at `validated`.
- **Cannot validate** unless the entered student ID matches a `student_accounts` row; only reject, or fix the ID.
- **Resolve** needs every `case_sanctions` row `completed`.
- Every transition appends a `case_status_history` row (timeline) and notifies the student.
- A case may have **several** sanctions (your workbook already has this: case C005 has two).

### 4.2 Escalation (decided: 3 minors of any kind → the 3rd becomes the Major)
- Counted: a student's cases that are `validated` or later, **Minor**, not rejected, `is_escalated = false`, and not already converted. Different violation types all count together.
- When a student reaches **3**, the system (in the same DB transaction as the validation that triggered it):
  1. **Converts the 3rd case** (ordered by `case_date`, then id) into the Major: `handbook_entry_id` → **H068 "3 minor offense"** (system-only violation V068, `violations.is_system = true`), and `original_handbook_entry_id` keeps the violation it was reported as.
  2. Sets `is_escalated = true` on the **first two** minors.
  3. Inserts two `case_escalations` rows (`major_case_id` = the converted case, `minor_case_id` = each earlier minor).
  4. Writes timeline entries on all three ("Treated as Major: 3rd minor violation. Linked cases #a and #b"), and notifies the student (`kind = 'esc'`).
- **Result for the student: 3 cases = 2 minors flagged as escalated + 1 Major ("3 minor offense").** No fourth case is created. The counter then restarts for later minors.
- Staff then pick the major sanction for the converted case from H068's allowed sanctions (seed copies H036's: CATEGORY 2 on the 1st offense, CATEGORY 3 on the 2nd; adjust as needed). Staff see a **preview** before validating ("This will convert case #N into a Major").
- UI: the Major case shows "Originally: <violation>" and "Created from cases #a, #b"; each escalated minor shows "Counted toward Major case #N".
- `V068`/`H068` are hidden from violation pickers and the handbook list (`is_system`); they only ever appear on converted cases. They share Sec. VI.E.20 with H036 "Habitual rule violation", so `handbook_section` is no longer unique.
- This matches the prototype's behavior. (The handbook text for VI.E.20 says 3 *same* or 4 *different* kinds; you chose 3 of any kind. Keep the threshold in one config function so it can change later.)

### 4.3 Sanctions (`case_sanctions.status`)
```
assigned ──(student uploads proof)──▶ pending_verification
pending_verification ──verify──▶ completed
pending_verification ──return (reason)──▶ returned ──(student re-uploads)──▶ pending_verification
```
- Staff pick the sanction(s) from the ones the handbook allows for that violation and offense number, set a **due date** (flexible), and add optional instructions (`staff_note`).
- **Offense number (decision 14):** computed by the API when staff open the assign step, never typed: 1 + the count of the same student's earlier cases for the same violation with status `validated`, `for_sanction` or `resolved` (ordered by `case_date`, then id). A converted Major ("3 minor offense") counts against H068, not against the original violation. If a violation has no `handbook_entry_sanctions` row for that offense number, offer the highest defined offense number for it.
- Student proof rules: PDF/DOCX only, ≤ 10 MB each, max **5** files; allowed while `assigned` or `returned`; while `pending_verification` the student may replace a file or remove one but **not the last one**; if staff already reviewed, those actions are rejected with "already reviewed".
- **Online proof only (decision 16).** There is no in-person "record compliance" path: a sanction reaches `pending_verification` only when the student uploads at least one file (`POST /files` is the submission; there is no separate submit call). `case_sanctions.compliance_note` stays in the schema but is unused.
- **Verify needs at least one file, and is blocked until every file has `date_viewed`** (staff opened it). The UI shows "n of m viewed". A pending sanction with no file cannot be verified, only returned.
- "Late by N days" is derived from `due_date`, not stored.
- Verifying sets `date_completed` and `verified_by_employee_id` (enforced by a DB check).

### 4.4 Clearance (manual)
- One `clearances` row per student and term (`academic_year` = start year, `semester` 1–3).
- Default checklist from `requirements WHERE is_default` (No active violations, All sanctions served, Guidance exit interview, SDO signature). Staff can add/remove custom items for one student.
- Staff mark an item done, or reverse it (**reason required**). Every change is a `clearance_history` row. When all items are completed, set `clearances.status = 'cleared'`.
- No automatic checking. Optional: a warning chip if "No active violations" is marked done while the student has open cases.

### 4.5 Appointments
- Staff assign a student, a **start date** (today … +60 days, not Sunday), a purpose and optional notes. `end_date` = start + 5 more working days (Sundays skipped). Hours are 7:00 AM–5:00 PM for the whole window (shown in the UI, not stored).
- The database rejects overlapping live (`scheduled`/`rescheduled`) windows for the same student.
- Changing the start date → `rescheduled`; staff can mark `completed` or `cancelled` (reason required). All logged in `appointment_history` and notified.
- **No reminders (decision 17).** The student is notified only when staff set, move, edit, complete or cancel an appointment (keys `appt:<id>:new`, `appt:<id>:rescheduled:<ms>`, `appt:<id>:remarks:<ms>`, `appt:<id>:completed`, `appt:<id>:cancelled`). Students have no actions on appointments. There are no holidays: only Sundays are skipped.
- Staff routes: `GET /appointments?bucket=upcoming|history&q=&page=` (10 per page), `POST /appointments`, `PATCH /appointments/:id` (only `startDate`, `purpose`, `notes` are read; a new `startDate` = `rescheduled`, text-only = `remarks_updated`), `POST /appointments/:id/complete`, `POST /appointments/:id/cancel`. The end date is always computed by the API.

### 4.6 Notifications
- Helper: `notify({recipient, kind, title, message, link, idempotencyKey})`. If `idempotency_key` already exists, do nothing. Example keys: `san:12:completed`, `case:7:resolved`, `appt:3:new`.
- Student notifications use `recipient_type = 'student'` + `student_id`. All staff share **one** in-app inbox (`recipient_type = 'staff'`, `student_id` NULL), matching your "single department" rule. A staff alert is emailed to **every active employee account** (there is no `SDO_STAFF_MAILBOX`).
- **Order: commit first, notify second.** The API writes the DB change and the `notifications` row (`email_status = 'pending'`) in one transaction, then, after commit and in the background, sends the `{ "type", "payload" }` envelope to Power Automate **Flow 2**. Flow 2 sends the email and answers in its HTTP Response with `sent` or `failed`; the API sets `email_status` from that reply (decision 11). Timeouts and non-2xx leave the row `pending`, and an in-API sweep retries it. Details and payloads in `POWER-AUTOMATE.md`.
- Inbox query for a student = their notifications, newest first.
- Deep link `link_type + link_id` maps to a page: case, sanction, appointment, student, clearance, inbox.

### 4.7 (removed)
There is no separate announcements feature. Notifications carry every admin update (sanction assigned or changed, appointment made or moved, case validated or resolved, clearance changes).

### 4.8 Accounts and passwords
- Hash with Argon2id (or bcrypt). Rules: ≥ 8 characters, at least one letter and one digit.
- Staff **reset** → generates a one-time `Temp-####`, stores its hash in `password_hashed`, sets `must_change_password = true`, shown to staff once. On next sign-in the user is forced to set a new password (it can't equal the temp one).
- "Forgot password" stays in-person: the SDO office (Room 204) issues a temp password.
- Login accepts only emails ending in `nu-fairview.edu.ph` / `students.nu-fairview.edu.ph`; generic error message on failure; add login rate limiting. **The role is the account table the address is found in**, not the domain: the address's own domain is looked up first, then the other table, so a staff account may use a student-domain address (the demo admin does). Accounts are added by hand, so the two tables never hold the same address.

### 4.9 Handbook admin
Staff create or edit a violation (name unique, category Minor/Major, section, description, sanction per offense step). A violation is keyed by id, so renaming never breaks cases. Show "used in N cases".

### 4.10 Gate reports (public web form → API → Flow 1)
Fields: student ID, name, program, year level; select ≥ 1 violation (picked from the handbook, `is_system` entries excluded). The form posts to `POST /public/gate-reports`, protected by `verifyHuman()` (decision 12): a signed form-start token that must be between 3 seconds and 30 minutes old (`GET /public/gate-form-token` issues it when the form opens), a per-IP rate limit, field validation and a body-size limit. Every failure returns the same generic error. Student-ID format is an open item (section 11).

**No separate table.** In one transaction the API inserts one `disciplinary_cases` row per selected violation with `source='gate'`, `status='reported'`, and a shared `submission_ref` (uuid) that groups the rows of one form submit (for the "report received" email and the staff view). Then it writes timeline entries and notifications and calls **Flow 1**.
- If the typed ID matches a student, `student_id` is filled. If not, `student_id` stays NULL and the typed values stay in `claimed_student_id`, `claimed_name`, `claimed_program`, `claimed_year`. The DB forbids `validated` or later without a matched `student_id`; staff can only reject such a case, or fix the student link first.
- Duplicate rule (enforced by a unique index): same `claimed_student_id` + same violation + same Manila calendar day → rejected; return the existing reference.
- Staff-recorded cases use `source='staff'` and `reported_by_employee_id`.

**Form-timing token (stateless).** `GET /public/gate-form-token` returns `{ token }`, an HMAC-signed timestamp (signed with `SESSION_SECRET`, nothing stored). The form sends it back with the submit. The API rejects a missing, tampered, too-fresh (under 3 s) or expired (over 30 min) token with the same generic error. Rate limit: per IP, for example 5 submits per 10 minutes, and a looser limit on the token endpoint.

---

## 5. Screens and features

**Student (7):** Dashboard · Inbox · My Violations (case list/detail, 4-stage stepper, timeline, remarks, sanction card with proof upload) · My Sanctions (stats, filter Minor/Major, 4-step tracker) · Appointments (Upcoming / History) · Clearance (term switcher, checklist) · Student Handbook (+ sanction templates to download).

**Staff (10):** Dashboard · Record violation · Cases (filters, search, 6 per page, Details/History tabs, validate/reject/assign/resolve/remarks) · Students (detail, reset password) · Appointments · Make appointment · Clearance · Handbook › Violations · Handbook › Sanction templates · Inbox via bell.

**Public:** Gate violation form (3 steps + confirmation with reference), as designed in the prototype.

**Cross-cutting UI:** three responsive modes (mobile < 720, rail 720–1100, full sidebar) with bottom tab bar on mobile; confirm modals with required-reason field; toast; loading / empty / error / denied page states; pagination; PDF/DOCX preview.

---

## 6. Storage, email, hosting

### 6.1 Where files are stored
**Not in Postgres.** The bytes go to **Neon Object Storage** (S3-compatible, the feature you enabled), and Postgres keeps only metadata in `files` (`storage_key`, name, mime, size, who/when).

Facts from Neon's docs ([overview](https://neon.com/docs/storage/overview), [get started](https://neon.com/docs/storage/get-started), [authentication](https://neon.com/docs/storage/authentication), [free plan limits](https://neon.com/faqs/free-plan-limits-and-quotas)):
- Free plan: **5 GB object storage per project**; Postgres is a separate **1 GB per project**, with 100 compute-hours/month, and compute **scales to zero after 5 minutes** (first request after idle is slower).
- Works with any S3 SDK. Buckets are `private` or `public_read`. Use **private** for everything here (proof files are personal discipline records).
- Credentials are scoped to a branch with `storage:read` / `storage:write`. The secret is shown **once**. Env vars: `AWS_ACCESS_KEY_ID` (= `token_id`), `AWS_SECRET_ACCESS_KEY`, `AWS_ENDPOINT_URL_S3` (from the branch storage API), `AWS_REGION`.
- S3 client needs `forcePathStyle: true` and `requestChecksumCalculation: 'WHEN_REQUIRED'` (also affects presigned PUT).
- Regions: Ohio, N. Virginia, Frankfurt, **Singapore (`aws-ap-southeast-1`, closest to the Philippines)**. A Neon project's storage follows its region; check yours in the console.
- Each branch has its own storage namespace, so a dev branch won't touch production files.
- **Two buckets, both private and created by the human in Neon (the API never creates buckets):** `STORAGE_BUCKET_FILES` (default name `assets-files`) holds student proof files; `STORAGE_BUCKET_TEMPLATES` (default `assets-sanction-templates`) holds the sanction template files staff upload (build step 8). Templates never fall back to the files bucket. Older spellings `BUCKET_STORAGE_FILES`, `BUCKET_STORAGE` and `STORAGE_BUCKET` are still read for the files bucket.

Suggested flow (keeps files private, needs no bucket CORS):
1. **Upload (through the API):** the client sends `POST /files` as `multipart/form-data` (sanction id + file). The server validates (mime, ≤ 10 MB, ≤ 5 files, status allows upload; use `multer` with memory storage and a 10 MB limit), checks the first bytes (PDF starts with `%PDF`, DOCX is a ZIP starting with `PK`), uploads to the key `proof/{case_sanction_id}/{uuid}.{ext}`, then inserts `files` + `case_sanction_files` + a timeline entry + notifications in one transaction. If the insert fails, delete the object.
2. **Download / preview:** `GET /files/:id/url` returns a **presigned GET URL valid ~60 seconds**, after an authorization check (the owning student, or any staff). Opening it is a normal browser navigation or `<a>`/`<iframe>` load, which does not need CORS. When staff open a proof file, set `date_viewed` and `viewed_by_employee_id`.
3. **Delete / replace:** delete the object, delete the DB rows, and write a timeline entry. Run a nightly job to remove orphan objects.
4. Templates use the key `templates/{sanction_id}/{uuid}.{ext}`; any signed-in student can download them.

Why server-side upload instead of a presigned PUT from the browser: a browser PUT to the bucket needs bucket CORS, which I could not confirm Neon exposes. At 10 MB files and a small user count, proxying through Express is simple and fine (check your host's request-size cap).

Note on CORS and egress (from your Neon search): the CORS text applies to the **Express API** (the `cors` package, allowing your client origin), not to the database. The free plan's 5 GB/month public network transfer counts data leaving the Postgres endpoint (query results); at this scale it is far from a limit. Whether bucket downloads count toward it is unverified; test early.

### 6.2 Database hosting
Neon Postgres, run `db/schema.sql` then `db/seed.sql` in the SQL editor (or via migrations). `btree_gist` is used by the appointment-overlap rule. If your ORM cannot express the exclusion constraint, keep it in a raw SQL migration.

### 6.3 Notifications and email (decision 7: Power Automate Premium)
- One flow in use: **Flow 2** (dynamic notification: HTTP trigger, takes parameters, sends the email, answers with a Response), for every kind including gate reports (decision 19). The old Flow 1 is not built. The retry sweep runs inside the API.
- Power Automate **never writes to the database and never calls the API** (`POWER-AUTOMATE.md` sections 0 and 1). The API pre-renders the subject and HTML body, so wording lives in your repo. Every request body is `{ "type", "payload" }`.
- **Sender (decision 15):** emails are sent by the flow owner's own account, through that account's mail connection in the flow ("Send an email (V2)"). No shared mailbox and no NU IT request are needed. Consequences: recipients see the owner's name and address in `From`, replies go to that mailbox, and if the account loses its license, is disabled or graduates, emails stop (notifications stay `pending`, then `failed` after 24 hours). Add a co-owner and plan a handover to an office account before real use.
- Secrets: `PA_NOTIFY_URL` (the Flow 2 trigger URL, the only flow in use; `PA_GATE_URL` is unused, decision 19) lives in the root `.env`, never under a `VITE_` prefix. The signed URL is the only credential Power Automate provides; there is no shared secret.
- Your API calls the flows from `localhost` (outbound only). No tunnel is needed because nothing calls into your API.

---

## 7. API surface (REST sketch)

```
POST /auth/login | /auth/change-password | /auth/force-password        GET /me
GET  /handbook   GET /handbook/:id   (student + staff)
POST /handbook   PATCH /handbook/:id          (staff: create and edit a violation; the category locks once cases use it)
GET  /sanction-templates                      (any signed-in user: every sanction with its template text and file names)
PUT  /sanction-templates/:sanctionId          (staff: title, description, requirements)
POST /sanction-templates/:sanctionId/files    (staff, multipart, max 5 files)   DELETE /sanction-templates/files/:fileId
GET  /sanction-templates/files/:fileId/url    (any signed-in user: 60 s download link)

GET  /cases?status=&class=&q=&sort=&page=     (staff)     GET /me/cases (student)
GET  /cases/:id                               (staff)     GET /me/cases/:id (student)
POST /cases                                   (staff records violation)
POST /submissions/:id/validate | /reject      GET /submissions/:id/escalation-preview
PATCH /cases/:id/student                      (staff links a reported case to a student id)
GET  /cases/:id/sanction-options              (staff: offense number + allowed sanctions, computed by the API)
POST /cases/:id/sanctions   (sanction_id, due_date, staff_note)
POST /cases/:id/resolve | /resolve-without-sanction | /remarks
# Free text (reasons, remarks, notes, instructions) is capped at 1000 characters everywhere.

GET  /me/sanctions
POST /files (multipart; this one request IS the submission)   GET /files/:id/url   DELETE /files/:id
#   `:id` is the `case_sanction_files` id. A replace sends `replaceFileId` with exactly one file.
POST /case-sanctions/:id/verify | /return       # no /submit and no /record-compliance (online proof only)

GET  /students  GET /students/:id   POST /students/:id/reset-password
GET  /clearances?status=&q=&page=   GET /clearances/:id   POST /clearances (studentId, academicYear, semester)
POST /clearances/:id/requirements (label)   DELETE /clearances/:id/requirements/:rid
POST /clearances/:id/requirements/:rid/complete (remarks) | /reverse (reason)   GET /me/clearance (student)
#   A clearance always keeps at least one requirement (the last cannot be removed).
GET  /appointments?bucket=&q=&page=   POST /appointments   PATCH /appointments/:id
POST /appointments/:id/complete | /cancel        GET /me/appointments (student)
GET  /me/notifications   POST /me/notifications/:id/read | /read-all
GET  /notifications      POST /notifications/:id/read | /read-all      (staff: the one shared inbox)

GET  /public/gate-form-token                       (public: issues the signed form-timing token)
POST /public/gate-reports                          (public: verifyHuman + rate limit; then triggers Flow 1)

# No /integrations/* endpoints: Power Automate never calls the API (decision 11).
# Email retries run as an in-API sweep. There are no reminder jobs (decision 17).
# Every response is { ok: true, data } or { ok: false, error: { code, message } } (shared/types.ts), except GET /health.
```
Authorization: a student reads only their own cases, sanctions, appointments, clearance and notifications. Staff are one department and see everything (your ERD rule).

---

## 8. Data to prepare before launch
1. Real **student accounts** (id, name, program, year, NU email) and **staff accounts**, added manually with bcrypt-hashed passwords (decision 13). `db/seed-dev-accounts.sql` holds two **development-only** accounts; copy its pattern for real ones and never run it on production.

2. Confirm the 67 handbook entries and the sanction mapping, and **write the sanction templates** (text and files) for each of the 10 sanctions.
3. Current **term** and the default clearance checklist.
4. Email sender setup (6.3, decision 15) and the address that re
eives staff alerts are all employee accounts inside the employee table.
5. Assets: `assets/seal.png`, `assets/hero.png`.

---

## 9. Design system (from the prototype)
- **Fonts:** Public Sans (text), Material Symbols Outlined (icons).
- **Colors:** primary `#35408E` (active nav `#262F73`), gold `#F2D46B`, text `#1C2445`, muted `#5B6576`, body `#2E3646`, page `#F2F5F5`, borders `#DDE3E8` / `#C9D1D9`, danger `#B42318`, success `#1E6B3E`.
- **Status pills (bg / fg):** pending/reported `#FDF3D3 / #7A5A00`; validated/Minor `#E8EBF7 / #2B347A`; for_sanction, pending_verification, rescheduled `#FCE9C6 / #7A4600`; resolved/completed/cleared `#E2F3E8 / #1E6B3E`; Major/returned `#F7E6E6 / #9B2C2C`; rejected/cancelled/expired `#ECEEF1 / #4A5260`.
- The prototype source is Claude Design's `<x-dc>` format, not React. Re-implement in your stack; use it as a visual and behavioral reference. The screens of every page and state, on web and on a phone, are in `design-reference/SDO_Portal_UI.pptx`; see `UI-POLISH-SPEC.md` for how the two relate to this SPEC.

---

## 10. Build order
1. Neon: run `schema.sql` + `seed.sql`; set up the bucket and credentials; smoke-test one upload/download.
2. Auth (hashed passwords, sessions, role guard, forced password change).
3. Handbook + read-only student pages on real data.
4. Case workflow + escalation service. **Write unit tests for 4.2 first**, including the threshold.
5. Sanctions + proof upload/verify.
6. Notifications table + idempotency + the Power Automate integration (Flow 2, the `{type, payload}` helper, in-API retry sweep); then Flow 1 with the gate form.
7. Appointments → Clearance.
8. Sanction templates and handbook admin.
9. Public gate form + `verifyHuman()` (form-timing token + rate limit) + Flow 1 (last: needs the abuse protection).
10. Polish: a **prototype-fidelity pass over every page** (layout, components, copy and the three widths, matched to `design-reference/sdo-portal.source.html`; decision 18), then empty/error states, accessibility, PWA manifest.

### Your existing repo (`Aicyraa/Disciplinary-Office-Monitoring-System`)
Already there: Express 5 + TypeScript 7 API, Prisma 7.10 (pg adapter) on Neon, React 19 + Vite + Tailwind v4 + react-hook-form + react-router, passport-local + express-session + connect-pg-simple + bcryptjs + helmet + express-rate-limit, a private bucket `assets` declared in `neon.ts`, root `.env` as the single config source. Not yet there: any domain model, auth behavior, or client API calls.
- **Use Prisma, not Drizzle.** Apply `db/schema.sql` + `db/seed.sql` to Neon, then run `prisma db pull` to generate the models (Prisma cannot express the appointment-overlap exclusion constraint, the CHECK constraints or partial indexes; keep them in the SQL file / a hand-written migration, and don't let `db push` overwrite them). Run live schema operations only when you decide to, as your `AGENTS.md` already requires.
- `connect-pg-simple` creates its own `session` table; it is infrastructure and not part of the ERD.
- Add `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner` and `multer` for files (section 6.1). Use one private bucket (`assets` already exists) with the key prefixes `proof/` and `templates/`.
- Add `PA_NOTIFY_URL`, `PA_GATE_URL`, `APP_BASE_URL` and the S3 variables to `.env.example` (fake values), per your env rules.

---

## 11. Still open
1. ~~NU IT items~~ **Settled (decision 15):** the flow owner's own account is the sender; no shared mailbox. Remaining production hand-over risk: moving ownership off a personal account (`POWER-AUTOMATE.md` section 6).
2. **Bucket smoke test (6.1), run 2026-10-12 on the dev branch** (`api/scripts/storage-smoke.ts`): upload, direct read, 60 s presigned GET, private-bucket refusal and cleanup all passed. The bucket answers `Access-Control-Allow-Origin: *` on GET and on the OPTIONS preflight, so a browser can `fetch` a presigned URL directly (DOCX preview with `mammoth` needs no API proxy). Still unverified: the 60 s expiry (`--expiry` not run), whether bucket downloads count toward the free plan's transfer limit (check the console usage page after real traffic), and a real in-browser `fetch` from `localhost:5173`.
3. Confirm the ERD (two attributes added since the Lucid version: `violations.is_system`, `disciplinary_cases.original_handbook_entry_id`).
4. ~~Student ID format~~ **Settled (decision 13):** `YYYY-NNNNNNN`, regex `^\d{4}-\d{7}$`. The prototype's 6-digit regex is wrong; the gate form, API validation and `varchar(20)` column all use the 11-character format.
5. ~~Offense number~~ **Settled (decision 14, rule in 4.3).**
6. ~~Account creation~~ **Settled (decision 13):** accounts are added manually through SQL (`db/seed-dev-accounts.sql` pattern, bcrypt hashes). No create-account screen or endpoint in version 1. The temp-password reset flow (4.8) still applies.
7. ~~Notification retry cap~~ **Settled (decision 14, `POWER-AUTOMATE.md` section 5).**
8. **Parked for later (not in version 1):** the Power Automate growth path in `POWER-AUTOMATE.md` section 8 (scheduled reminders, backup export, Teams alerts, weekly digest, document generation, student import).
