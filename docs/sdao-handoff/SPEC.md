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
| 7 | Email / notifications | **Power Automate (Premium)** sends them from an NU Microsoft 365 shared mailbox. Two flows: Flow 1 (form → API), Flow 2 (one dynamic notification flow that takes parameters). See section 6.3 and `POWER-AUTOMATE.md` |
| 8 | Gate form | **Stays a web form in the app** (public). It posts to the API (captcha + rate limit); after the commit the API triggers Power Automate **Flow 1**, which notifies the student and staff |
| 9 | Time zone | Asia/Manila. Store UTC (`timestamptz`), display in Manila time |
| 10 | Escalation | 3 minors of any kind; the 3rd converts into the Major "3 minor offense"; the 2 earlier minors are flagged escalated (section 4.2) |

---

## 1. What this system is

| Audience | Entry | Auth |
|---|---|---|
| **Student** | Login → student app (7 pages) | NU student email + password |
| **Staff (SDO officer)** | Login → staff app (10 pages) | NU staff email + password |
| **Gate guard / anyone** | Public web "Violation Form" (3 steps) → API → Flow 1 | none (captcha + rate limit) |

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
- **Display codes are derived, not stored**: the app formats them (`V` + id padded to 3, `S001`, `C0001`) when it needs to show one. The seed keeps workbook numbers (V001 → 1, S001 → 1), so the codes you already know stay the same.
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
assigned ──(student uploads proof OR staff records compliance)──▶ pending_verification
pending_verification ──verify──▶ completed
pending_verification ──return (reason)──▶ returned ──(student re-uploads)──▶ pending_verification
```
- Staff pick the sanction(s) from the ones the handbook allows for that violation and offense number, set a **due date** (flexible), and add optional instructions (`staff_note`).
- Student proof rules: PDF/DOCX only, ≤ 10 MB each, max **5** files; allowed while `assigned` or `returned`; while `pending_verification` the student may replace a file or remove one but **not the last one**; if staff already reviewed, those actions are rejected with "already reviewed".
- **Verify is blocked until every file has `date_viewed`** (staff opened it). The UI shows "n of m viewed".
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
- A scheduled job sends a reminder notification the day before the start date.

### 4.6 Notifications
- Helper: `notify({recipient, kind, title, message, link, idempotencyKey})`. If `idempotency_key` already exists, do nothing. Example keys: `san:12:completed`, `case:7:resolved`, `appt:3:new`.
- Student notifications use `recipient_type = 'student'` + `student_id`. All staff share **one** mailbox (`recipient_type = 'staff'`, `student_id` NULL), matching your "single department" rule.
- **Order: commit first, notify second.** The API writes the DB change and the `notifications` row (`email_status = 'pending'`) in one transaction, then calls Power Automate **Flow 2**. Flow 2 sends the email and calls the API back with `sent` or `failed`. Rows left `pending` are retried. Details and payloads in `POWER-AUTOMATE.md`.
- Inbox query for a student = their notifications, newest first.
- Deep link `link_type + link_id` maps to a page: case, sanction, appointment, student, clearance, inbox.

### 4.7 (removed)
There is no separate announcements feature. Notifications carry every admin update (sanction assigned or changed, appointment made or moved, case validated or resolved, clearance changes).

### 4.8 Accounts and passwords
- Hash with Argon2id (or bcrypt). Rules: ≥ 8 characters, at least one letter and one digit.
- Staff **reset** → generates a one-time `Temp-####`, stores its hash in `password_hashed`, sets `must_change_password = true`, shown to staff once. On next sign-in the user is forced to set a new password (it can't equal the temp one).
- "Forgot password" stays in-person: the SDO office (Room 204) issues a temp password.
- Login accepts only emails ending in `nu-fairview.edu.ph` / `students.nu-fairview.edu.ph`; generic error message on failure; add login rate limiting.

### 4.9 Handbook admin
Staff create or edit a violation (name unique, category Minor/Major, section, description, sanction per offense step). A violation is keyed by id, so renaming never breaks cases. Show "used in N cases".

### 4.10 Gate reports (public web form → API → Flow 1)
Fields: student ID, name, program, year level; select ≥ 1 violation (picked from the handbook, `is_system` entries excluded). The form posts to `POST /public/gate-reports`, protected by a captcha token (Turnstile/hCaptcha), per-IP rate limit and validation.

**No separate table.** In one transaction the API inserts one `disciplinary_cases` row per selected violation with `source='gate'`, `status='reported'`, and a shared `submission_ref` (uuid) that groups the rows of one form submit (for the "report received" email and the staff view). Then it writes timeline entries and notifications and calls **Flow 1**.
- If the typed ID matches a student, `student_id` is filled. If not, `student_id` stays NULL and the typed values stay in `claimed_student_id`, `claimed_name`, `claimed_program`, `claimed_year`. The DB forbids `validated` or later without a matched `student_id`; staff can only reject such a case, or fix the student link first.
- Duplicate rule (enforced by a unique index): same `claimed_student_id` + same violation + same Manila calendar day → rejected; return the existing reference.
- Staff-recorded cases use `source='staff'` and `reported_by_employee_id`.

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
- Two flows: **Flow 1** (gate report submitted → notify student and staff) and **Flow 2** (dynamic notification: HTTP trigger, takes parameters, sends the email, calls the API back). Optional **Flow 3** (scheduled retry sweep) if your API host sleeps when idle.
- Power Automate **never writes to the database**; it calls the API (`POWER-AUTOMATE.md` section 1). The API pre-renders the subject and HTML body, so wording lives in your repo.
- Sending from an **NU shared mailbox** through Microsoft 365 also settles the sender-domain question: you don't need your own domain. You do need NU IT to create the mailbox and allow "send as" for the flow owner, and the flow should be owned by an office/service account, not a student account.
- Secrets: `PA_NOTIFY_URL` (Flow 2 trigger URL) and `PA_SHARED_SECRET` live in the root `.env`, never under a `VITE_` prefix.
- Your API can call Flow 2 from `localhost` (outbound). A tunnel is only needed for the calls into your API (Flow 2's result callback, and Flow 1); production needs a public HTTPS API address.

---

## 7. API surface (REST sketch)

```
POST /auth/login | /auth/change-password | /auth/force-password        GET /me
GET  /handbook   GET /handbook/:id   (student + staff)
POST|PATCH /handbook ...             PUT /handbook/sanctions/:id/template        (staff)

GET  /cases?status=&class=&q=&sort=&page=     (staff)     GET /me/cases (student)
POST /cases                                   (staff records violation)
POST /submissions/:id/validate | /reject      GET /submissions/:id/escalation-preview
POST /cases/:id/sanctions   (sanction_id, due_date, staff_note)
POST /cases/:id/resolve | /resolve-without-sanction | /remarks

GET  /sanctions   GET /me/sanctions
POST /files (multipart)   GET /files/:id/url   DELETE /files/:id
POST /case-sanctions/:id/submit | /record-compliance | /verify | /return

GET  /students  GET /students/:id   POST /students/:id/reset-password
GET|POST /clearances ...   POST /clearances/:id/requirements/:rid/complete | /reverse
GET|POST|PATCH /appointments ...   POST /appointments/:id/complete | /cancel
GET  /me/notifications     POST /me/notifications/:id/read

POST /public/gate-reports                          (public: captcha + rate limit; then triggers Flow 1)

# Power Automate only (shared-secret header, outside the login session)
POST /integrations/notifications/:id/result
POST /integrations/notifications/result
POST /integrations/run-reminders                    (scheduled flow: retries, reminders, overdue)
```
Authorization: a student reads only their own cases, sanctions, appointments, clearance and notifications. Staff are one department and see everything (your ERD rule).

---

## 8. Data to prepare before launch
1. Real **student accounts** (id, name, program, year, NU email) and **staff accounts**, created through the app so passwords are hashed.
2. Confirm the 67 handbook entries and the sanction mapping, and **write the sanction templates** (text and files) for each of the 10 sanctions.
3. Current **term** and the default clearance checklist.
4. Email sender setup (6.3) and the shared staff mailbox address.
5. Assets: `assets/seal.png`, `assets/hero.png`.

---

## 9. Design system (from the prototype)
- **Fonts:** Public Sans (text), Material Symbols Outlined (icons).
- **Colors:** primary `#35408E` (active nav `#262F73`), gold `#F2D46B`, text `#1C2445`, muted `#5B6576`, body `#2E3646`, page `#F2F5F5`, borders `#DDE3E8` / `#C9D1D9`, danger `#B42318`, success `#1E6B3E`.
- **Status pills (bg / fg):** pending/reported `#FDF3D3 / #7A5A00`; validated/Minor `#E8EBF7 / #2B347A`; for_sanction, pending_verification, rescheduled `#FCE9C6 / #7A4600`; resolved/completed/cleared `#E2F3E8 / #1E6B3E`; Major/returned `#F7E6E6 / #9B2C2C`; rejected/cancelled/expired `#ECEEF1 / #4A5260`.
- The prototype source is Claude Design's `<x-dc>` format, not React. Re-implement in your stack; use it as a visual and behavioral reference.

---

## 10. Build order
1. Neon: run `schema.sql` + `seed.sql`; set up the bucket and credentials; smoke-test one upload/download.
2. Auth (hashed passwords, sessions, role guard, forced password change).
3. Handbook + read-only student pages on real data.
4. Case workflow + escalation service. **Write unit tests for 4.2 first**, including the threshold.
5. Sanctions + proof upload/verify.
6. Notifications table + idempotency + the Power Automate integration (Flow 2, callback, retry); then Flow 1 with the gate form.
7. Appointments → Clearance.
8. Sanction templates and handbook admin.
9. Public gate form + captcha + rate limit + Flow 1 (last: needs the abuse protection).
10. Polish: empty/error states, accessibility, PWA manifest.

### Your existing repo (`Aicyraa/Disciplinary-Office-Monitoring-System`)
Already there: Express 5 + TypeScript 7 API, Prisma 7.10 (pg adapter) on Neon, React 19 + Vite + Tailwind v4 + react-hook-form + react-router, passport-local + express-session + connect-pg-simple + bcryptjs + helmet + express-rate-limit, a private bucket `assets` declared in `neon.ts`, root `.env` as the single config source. Not yet there: any domain model, auth behavior, or client API calls.
- **Use Prisma, not Drizzle.** Apply `db/schema.sql` + `db/seed.sql` to Neon, then run `prisma db pull` to generate the models (Prisma cannot express the appointment-overlap exclusion constraint, the CHECK constraints or partial indexes; keep them in the SQL file / a hand-written migration, and don't let `db push` overwrite them). Run live schema operations only when you decide to, as your `AGENTS.md` already requires.
- `connect-pg-simple` creates its own `session` table; it is infrastructure and not part of the ERD.
- Add `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner` and `multer` for files (section 6.1). Use one private bucket (`assets` already exists) with the key prefixes `proof/` and `templates/`.
- Add `PA_NOTIFY_URL`, `PA_SHARED_SECRET`, the S3 variables and `SDO_STAFF_MAILBOX` to `.env.example` (fake values), per your env rules.

---

## 11. Still open
1. **NU IT items** are for production hand-over only (`POWER-AUTOMATE.md` section 5); nothing blocks development.
2. **CORS + transfer limits** for Neon Object Storage (6.1): verify with a test upload.
3. Confirm the ERD (two attributes added since the Lucid version: `violations.is_system`, `disciplinary_cases.original_handbook_entry_id`).
4. **Parked for later (not in version 1):** the Power Automate growth path in `POWER-AUTOMATE.md` section 8 (scheduled reminders, backup export, Teams alerts, weekly digest, document generation, student import).
