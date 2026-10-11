# AGENTS.md — SDO Portal (NU Fairview Student Discipline Office)

This repo builds a real, database-backed version of the SDO Portal. A Claude Design prototype exists; it is a visual and behavioral reference only. **The spec is the source of truth.** If code, this file and the spec disagree, stop and ask the human.

## 1. Source of truth (read before any feature work)
All paths are under `docs/sdao-handoff/`.
- `SPEC.md` — final spec v2: decisions (section 0), data model (3), business rules (4), screens (5), storage/email (6), API sketch (7), design system (9), build order (10), open items (11).
- `POWER-AUTOMATE.md` — the two Power Automate flows, payloads, API contract and shared-secret rules.
- `db/schema.sql` — final PostgreSQL schema (23 tables). `db/seed.sql` — handbook, sanctions, programs, requirements.
- `design-reference/sdo-portal.source.html` — prototype in Claude Design's `<x-dc>` format. Not React: re-implement in this stack. Use it for layout and behavior, never copy its in-memory state, fixed date or plain-text passwords.
- `assets/seal.png`, `assets/hero.png` — brand images.

Rules for working from the spec:
- Before building a feature, read its section in `SPEC.md` (the feature list in section 3 below says which). Do not invent rules; if the spec is silent or ambiguous, ask.
- The prototype is front-end only, so **every rule must be enforced by the API**, never only by the UI.
- Settled decisions (SPEC section 0) are not reopened: snake_case, flexible sanction due date, manual clearance, no student statement, 6-working-day appointment windows (Mon–Sat, 7:00 AM–5:00 PM), Asia/Manila time (store UTC `timestamptz`), 3-minors-of-any-kind escalation, gate form stays a web form.
- Keep the schema and spec in sync: a schema change means updating `db/schema.sql` and the matching spec section in the same change.

## 2. What we are building
Three audiences, one app:
- **Student** — signs in with an NU student email; sees their own cases, sanctions, appointments, clearance, notifications, handbook. 7 pages.
- **Staff (SDO officer)** — signs in with an NU staff email; runs the whole workflow. 10 pages. All staff share one inbox (single department).
- **Public / gate** — a 3-step web "Violation Form", no login (captcha + rate limit).

Stack: Express 5 + TypeScript API, Prisma 7 on Neon Postgres, React 19 + Vite SPA, Neon Object Storage (S3-compatible, private bucket) for files, Power Automate Premium for email.

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

## 4. Data model rules (SPEC 3, `db/schema.sql`)
- 23 tables. Primary keys are **numeric identity columns**; only `student_accounts` and `employee_accounts` use text ids. Workbook codes (V001, S001, C0001) are display codes derived in the app, never stored or typed by hand.
- Enums are CHECK constraints in SQL. Timestamps are `timestamptz` (UTC); display in Asia/Manila.
- Prisma cannot express the appointment exclusion constraint, the CHECK constraints or the partial/expression indexes. Keep them in `schema.sql` / hand-written migrations. **`prisma db push` must never overwrite them.** Flow: apply `schema.sql` + `seed.sql`, then `prisma db pull`, then maintain Prisma models to match.
- `connect-pg-simple` creates its own `session` table; it is infrastructure, not part of the ERD.
- The throwaway `ConnectionTest` model/table is setup scaffolding; remove it when the real models land (human confirms first).

## 5. Build order (SPEC 10)
1. Neon: schema + seed, bucket and credentials, one upload/download smoke test. 2. Auth. 3. Handbook + read-only student pages. 4. Case workflow + escalation (tests first). 5. Sanctions + proof. 6. Notifications + Power Automate (Flow 2, callback, retry). 7. Appointments → Clearance. 8. Templates + handbook admin. 9. Public gate form + captcha + Flow 1. 10. Polish.
Work one feature at a time; finish and verify it before the next.

## 6. Design and UI (from the prototype, SPEC 9)
- Fonts: Public Sans (text), Material Symbols Outlined (icons). Colors: primary `#35408E` (active nav `#262F73`), gold `#F2D46B`, text `#1C2445`, muted `#5B6576`, page `#F2F5F5`, borders `#DDE3E8`, danger `#B42318`, success `#1E6B3E`. Status pill colors are in SPEC section 9; reuse them exactly.
- This is an internal, data-heavy office tool: calm, dense, readable, not a marketing site.
- Client stack: React 19, Tailwind CSS v4 (`@tailwindcss/vite`), `@base-ui/react`, `class-variance-authority`, `clsx`/`tailwind-merge`, `lucide-react`, `react-hook-form`, `react-router-dom`. No `components.json` yet: initializing shadcn is a human decision.
- Accessibility floor: visible focus, keyboard operability, labelled controls, sufficient contrast, usable at phone width.

### UI skills (`.agents/skills`, pinned by `skills-lock.json`)
- Load a skill only when the task matches. Never apply several competing visual-style skills to one screen.
- Default for client UI: `tailwind-design-system`, `shadcn` (only once `components.json` exists), `vercel-composition-patterns`, `typescript-advanced-types` (client TS 5.9, API TS 7: keep syntax valid for the package you edit), `vercel-react-best-practices` (React items only; ignore Next.js guidance).
- Visual direction, at most one per task: `minimalist-ui` (default) or `industrial-brutalist-ui` (only if asked). Use `redesign-existing-projects` when restyling existing screens.
- Not for this app unless asked: `design-taste-frontend`, `design-taste-frontend-v1`, `gpt-taste`, `high-end-visual-design`, `stitch-design-taste`, `brandkit`, `imagegen-frontend-web`, `imagegen-frontend-mobile`, `image-to-code`.
- `full-output-enforcement` may be applied when complete, unabridged files are needed. Neon skills describe platform features and never override the Prisma/Neon rules below. Skill examples may add dependencies; do not add or upgrade dependencies without a checkpoint.

## 7. Repository facts

### Package boundaries
- Root, `api/` and `client/` are separate npm packages with their own lockfiles; no workspaces.
- API: Express 5, TypeScript 7.0.2. Client: React 19, Vite 8, TypeScript 5.9. Root lint uses TypeScript 5.9.3 with typescript-eslint 8.71.1. Do not load the API compiler into root ESLint or assume TS7-only syntax in client/shared code.
- `api/src/app.ts` exports the app without listening; `api/src/server.ts` starts it. `GET /health` returns `{ "status": "ok" }` without a database.
- `shared/types.ts` holds types shared by API and client; import with `import type` only, no runtime cross-package imports.
- `neon.ts` is the existing Neon configuration (registers `hello.ts`); it does not define runtime or deployment commands.

### Commands
- Root: `npm test`, `npm run lint`, `npm run typecheck`, `npm run build`, `npm run dev`, `npm start`. Each child has the same scripts; run with `npm --prefix api ...` / `npm --prefix client ...`.
- Tests: Vitest 4.1.6 (root-only dependency). Smoke tests: `api/src/app.test.ts`, `client/src/App.test.tsx`. Keep them green. No browser or test database required.
- API dev: tsx with `--env-file-if-exists=../.env`; build emits `api/dist/api/src/server.js`; port from `SERVER_PORT` (then `PORT`, then 3000).
- Client dev: strict loopback `CLIENT_PORT` (default 5173); `start` is Vite preview on 4173 (local verification only). Vite reads the root `.env`; only `VITE_` keys reach the browser, so never put secrets there.
- Root ESLint checks authored API/client/shared TS and config files with recommended non-type-aware rules. ESLint 9.39.2 end-of-support and Vite config-loader warnings are known; do not upgrade tooling without a checkpoint.

### Configuration
- The repo-root `.env` is the single env source for both packages; do not create `api/.env` or `client/.env`. `.env.example` (fake values only) documents the keys. Externally supplied variables win; a missing `.env` is not an error.
- Keys in use: `CLIENT_PORT`, `SERVER_PORT`, `DATABASE_URL` (pooled), `DATABASE_URL_UNPOOLED` (direct). To add (fake values in `.env.example`): `PA_NOTIFY_URL`, `PA_SHARED_SECRET`, `SDO_STAFF_MAILBOX`, the S3 variables above, and the captcha secret.
- `.env` and `opencode.json` are ignored local config. Never copy credentials into documentation or commits.
- CORS: configure the `cors` package on the Express API to allow only the client origin. (CORS is not a database setting.)

### Prisma and Neon
- API owns Prisma CLI, client and pg adapter, all pinned to 7.10.0 (Prisma 7 format; no 8.x release candidates, no v6 syntax). Generator `prisma-client`, `output = "../generated/prisma"`; datasource block has `provider` only; connection URLs live in `api/prisma.config.ts` (`DATABASE_URL_UNPOOLED` for the CLI). Prisma 7 does not load `.env`; scripts use `node --env-file-if-exists=../.env`.
- Runtime uses the pooled `DATABASE_URL` through the pg adapter. `api/src/prisma.ts:createPrismaClient` is a lazy initializer; health/server do not construct it.
- Scripts: `npm --prefix api run prisma:validate`, `prisma:generate`, `prisma:push` (live), `prisma:smoke` (live). Run `prisma:generate` before API typecheck/build on a fresh clone. `api/generated/prisma` is generated and ignored: never hand-edit or commit it.
- **Live Prisma/Neon operations (`prisma:push`, `prisma:smoke`, migrations, applying SQL to Neon, branch operations, bucket changes) run only when the human explicitly asks.** Preview with `prisma migrate diff` first, and never accept data loss without confirmation. A skill suggesting a live operation is not permission.
- Neon free plan: 1 GB Postgres, 5 GB object storage, compute scales to zero after 5 minutes (expect a slow first request after idle; retry once on cold start).

## 8. Working agreements
- Do not add or upgrade dependencies without a checkpoint. The spec already approves `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`, `multer` and `mammoth`; confirm anything else.
- Do not store or log real credentials, student data or discipline records in tests, fixtures or docs. Use fake data.
- Small, reviewable changes. After each feature: run lint, typecheck, tests and build, and state what you could not verify (live DB, Power Automate, Neon bucket). Independent review and human acceptance remain required.
- Do not build anything the spec marks parked or removed: notices/announcements, the student statement, auto-clearance, the Power Automate growth path.
- README is a temporary description, not setup instructions.