# UI polish SPEC (build step 10)

Status: draft for the human to accept. Written 2026-10-12 by reading `SDO_Portal_UI_State_Reference.pptx` (48 slides; the human's UI target) against the screens built in steps 2 to 9. Scope is the **client only**: no business rule, API contract or schema changes unless a slice says so. Where the reference disagrees with `SPEC.md`, `SPEC.md` wins and the disagreement is listed in section 6 for the human.

## 1. Goal and rules

- Make every built screen look and behave like the reference deck: calm, dense, mobile-first, with the same card layouts, stage trackers, response patterns (toast, confirm sheet, inline error, locked button, notification) and page states.
- Tokens stay the SPEC 9 / CLAUDE.md section 7 tokens (primary `#35408E`, active nav `#262F73`, gold `#F2D46B`, ink `#1C2445`, muted `#5B6576`, page `#F2F5F5`, line `#DDE3E8`, danger `#B42318`, success `#1E6B3E`). Public Sans and Material Symbols Outlined.
- Three responsive modes stay: under 720 bottom tabs, 720 to 1100 icon rail, over 1100 full sidebar. Minimum tap target 44 px on every screen.
- Each slice is one task: tests first for any logic, `npm test`, lint, typecheck, build, then Playwright at three widths (under 720, 720 to 1100, over 1100) for every screen the slice touches; screens needing the live API are listed under "Not verified".
- No new dependency without a `DEPENDENCY:` checkpoint. No parked feature (notices/announcements, student statement, auto-clearance).

## 2. Reference map (slide -> screen)

| Slides | Area | Screens |
|---|---|---|
| 5-7 | Sign-in, temporary password | Login, forced change-password, rules checklist |
| 8-10 | Public gate form | 3 steps: Details, Violations, Review; receipt |
| 12-13 | Staff dashboard, phone nav | Reports to validate, awaiting decision, sanctions to verify, appointments, clearance work; More drawer; account menu |
| 14-19 | Staff cases | Queue by stage, review, reject sheet, decide, verify proof, resolve, students, record violation |
| 20-22 | Staff appointments | List, detail, complete/cancel sheets, new, review step, reschedule |
| 23-25 | Staff handbook | Violations list/edit/add, sanction templates |
| 26-28 | Staff clearance | Per-term list, requirements, add, history, not set up, cleared |
| 30-32 | Student dashboard, inbox | Cards, unread prompt, inbox filters, message dialog, account |
| 33-37 | Student violations, sanctions | List, detail with stage tracker and Details/Timeline tabs, next step, proof upload states |
| 38-41 | Student appointments, clearance, handbook | Upcoming/History, clearance steps, handbook entry, template, change password |
| 43-44 | Page states and system responses | Loading, empty, failed, no access; toast, confirm sheet, inline error, locked button, notification |
| 45-46 | Lifecycles, workflow | Reference only |
| 47 | Phone layout | Bottom tabs, 44 px targets, installable PWA |

## 3. Gap analysis (what exists vs the reference)

| # | Area | Built today | Reference shows | Size |
|---|---|---|---|---|
| G1 | Staff home | A placeholder sentence ("tools are being added step by step") | Reports to validate card with counts and rows, awaiting decision, sanctions to verify, appointments, clearance work | M |
| G2 | Student home | Four stat tiles and a next-steps list | Active violations as the main card (counts plus rows), Next appointment card with date tile, Active sanctions card, Clearance progress bar, unread prompt | M |
| G3 | Shell chrome | Sidebar/rail/bottom strip of every page, bell, name, sign out | Top bar with breadcrumb, bell with badge, initials avatar with menu (Account details, Change password, Sign out); phone bottom bar of 5 (Home, Violations or Cases, Sanctions or Students, Schedule, More) and a More drawer with sections and create actions | M |
| G4 | Feedback | Inline text notices per card, inline reason forms | Toast after save, confirm sheet before notifying or undoing (reject, return, cancel, reverse, reset password), inline error, locked button with spinner | M |
| G5 | Inbox | Newest-first list | Type chips (All, Violations, Sanctions, Appointments), Unread only, Mark all as read, refresh, message dialog with an "Open ..." action | S |
| G6 | Case review (staff) | List with filters, detail with remarks | Queue grouped by stage, numbered stage tracker (Reported, Validated, Sanctioned, Resolved), Details and History tabs, escalation toast | M |
| G7 | Case detail (student) | List and detail | Stage tracker, Details/Timeline tabs, handbook link, escalated-case timeline | S |
| G8 | Proof upload | Drop area, list, progress, Upload | Same plus "Next step" callout, "View this offense in the Handbook" link, per-file View, rejected-file inline message, submitted state with Replace/Remove | S |
| G9 | Students page (staff) | Missing | List with "sanctions to verify" badges, profile with Reset password and Record violation, record summary (cases, sanctions, clearance) | L (needs `GET /students`, `GET /students/:id`) |
| G10 | Gate form | 3 steps: student, program and year, violations; receipt | Steps Details, Violations, Review; per-field messages; "Not sent" state; receipt to show the guard | S |
| G11 | Page states | Loading text, empty, error with retry | Placeholder cards while loading, plain empty, "Try again", **No access** page | S |
| G12 | Accessibility and PWA | Focus ring, labels | 44 px targets everywhere, manifest and icons (installable), reduced-motion respect | S |
| G13 | Status wording | Our status pills and labels | Reference wording (see section 6, item 3) | S |
| G14 | Remaining pages | Appointments, clearance, handbook lists | Card layouts, date tile, progress bar and requirement rows as in slides 21-28, 38-41 | M |

## 4. Slices (each is one task, in this order)

| Slice | Gaps | Done when |
|---|---|---|
| **P1 Dashboards** | G1, G2 | Staff and student dashboards render the card layouts of slides 12 and 30 from existing endpoints only; counts are pure functions with unit tests; empty and error states per card; phone, rail and full widths checked. **Known gap:** the staff third tile reads "With sanctions" (cases in `for_sanction`) because no endpoint lists sanctions waiting for verification; the deck's "Sanctions to verify" tile and Sanctions card need a new staff read endpoint (slice P1b, section 6 question 8) |
| **P1b Staff sanctions queue** | G1 | `GET /sanctions?status=pending_verification` (staff only, API tests, no storage keys) feeding the "Sanctions to verify" tile and card; only after the human accepts question 8 |
| **P2 Shell** | G3, G12 (tap targets) | Breadcrumb top bar, avatar menu with Account details (read-only) and Change password, bottom bar of 5 plus More drawer, gold active marker; keyboard operable; `navFor` tests updated |
| **P3 Feedback** | G4 | `Toast`, `ConfirmSheet` and `LockedButton` components; every notifying or undoing action uses a confirm sheet with a required reason where the rule says so; existing inline notices replaced; no behavior change in the API |
| **P4 Inbox** | G5 | Chips, unread-only, mark-all, message dialog; filter logic is a tested pure function |
| **P5 Cases** | G6, G7 | Stage tracker component shared by staff and student; queue grouped by stage; Details/History tabs; tests for the grouping function |
| **P6 Students (staff)** | G9 | New read endpoints with API tests (staff only, no password hash in any response), list, profile, reset-password sheet (uses the existing reset route), record summary |
| **P7 Gate form and sign-in** | G10 | Review step, per-field messages, "Not sent" state; sign-in link to the form only if the human answers question 1 of section 6 |
| **P8 Proof and remaining pages** | G8, G14 | Slides 17, 21-28, 36-41 matched; no layout shift while loading |
| **P9 States, wording, PWA** | G11, G12, G13 | Skeleton cards, No access page, `manifest.webmanifest` and icons, status labels per section 6 |

## 5. Verification per slice

1. Context7 for every third-party API used; Serena diagnostics on every edited file.
2. Unit tests for every pure helper; component tests for static markup of new components.
3. Playwright at 390, 900 and 1280 px: navigate, accessibility snapshot, exercise the changed interaction, read console messages. Signed-in screens need the live API and database; the dev branch accounts (`db/seed-dev-accounts.sql`) are the only ones to use.
4. Reviewer re-runs everything and compares each screen with the slide named in the slice.

## 6. Questions for the human (the reference disagrees with, or goes beyond, the spec)

1. **Gate form link on sign-in.** Slide 5 says the gate form link sits below the sign-in card; the human earlier said "just a route". Add the link or not?
2. **Clearance slip download.** Slides 38 and 39 show a slip that unlocks when all four requirements are done. `SPEC.md` has no slip. Build it (and what does it contain) or drop it from the reference?
3. **Status wording.** The reference uses Pending review, Sanctioned, In progress, Complied, Verified for display. The data statuses are `reported`, `validated`, `for_sanction`, `resolved`; `assigned`, `pending_verification`, `returned`, `completed`. Change labels only (recommended, data unchanged), or keep ours?
4. **"Important notices" inbox filter and the staff notices editor** (slides 31-32, 48) are the parked notices feature. Keep them out (recommended)?
5. **Students page (P6).** It is in SPEC 5 (Students: detail, reset password) but was never built, and needs two read endpoints. Confirm it belongs in this polish.
6. **Record summary.** Slide 18 shows cases, sanctions and clearance for one student on the staff side. Confirm it is read-only.
7. **Student account details.** Slide 32 shows a read-only account sheet; confirm which fields (name, student ID, email, program, year).
8. **Sanctions card for staff.** Slides 12 and 13 show a staff "Sanctions to verify" tile and card. No endpoint lists sanctions across cases (staff reach a sanction only through its case). Add a staff read endpoint (P1b), or keep the "With sanctions" tile?
9. **Extras on the staff dashboard.** The deck shows a "Will escalate" chip on reports that would convert a 3rd minor (the API has `GET /submissions/:id/escalation-preview`, one call per report), a "Last checked" time with a refresh button, and an Overdue tile. Build them (more requests per page) or leave them out?
10. **Fidelity target.** `SPEC.md` decision 18 names the Claude Design prototype (`design-reference/sdo-portal.source.html`) as the visual reference; this SPEC uses the newer deck. Confirm the deck replaces the prototype for the UI.
11. **Reset password route.** SPEC 7 sketches `POST /students/:id/reset-password`; the built route is `POST /staff/students/:studentId/reset-password`. P6 will use the built one and update SPEC 7 unless you want it moved.

## 7. Out of scope

Dark mode, a design-system rewrite, shadcn initialisation (a separate human decision), any change to the notification, escalation, sanction or clearance rules.
