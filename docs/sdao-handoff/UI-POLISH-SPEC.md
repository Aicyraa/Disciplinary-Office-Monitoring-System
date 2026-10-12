# UI polish SPEC (build step 10)

Status: draft for the human to accept. Rewritten 2026-10-12 against the new design package (section 1). It replaces the first draft, which was written from the older 48-slide state reference. Scope is the client **and** the logic changes the new package implies; every logic change is listed in section 5 and none is built until the human accepts it.

## 1. Sources (the design package)

| What | Where | Use it for |
|---|---|---|
| **Screens** | `docs/sdao-handoff/design-reference/SDO_Portal_UI.pptx` (199 slides, one screen or state per slide) | What every page, tab and state looks like, on web and on mobile |
| **Logic and copy** | `docs/sdao-handoff/design-reference/sdo-portal.source.html` (Claude Design `<x-dc>` source, about 3,500 lines) | The rules behind the screens: status ladders, validation messages, empty-state copy, notification text, sample data |

- The deck is organised as **Part 1 Web** (slides 4 to 92, labelled `WEB · ROLE · 01 to 89`) and **Part 2 Mobile** (slides 94 to 199, labelled `MOBILE · ROLE · 01 to 101`). Slide labels are used below as `W17` or `M20`.
- The deck file is git-ignored with the rest of `docs/` and about 12 MB, so it exists only in the human's main checkout and not in worktrees. To read it: copy it to a scratch directory, `soffice.py --headless --convert-to pdf`, then `pdftoppm -r 40` for contact sheets, or `python-pptx` for the text (each slide's notes repeat its caption).
- `SPEC.md` stays the source of truth for data and business rules. Where the package disagrees with `SPEC.md`, the disagreement is a question in section 6, and the package does **not** win until the human decides.
- The HTML source also carries behavior that `SPEC.md` already removed on purpose (in-person "record compliance", the student statement, hours tracking, 10 h / 20 h / referral sanction options). Those stay removed unless section 6 says otherwise.

## 2. Rules for every slice

- Tokens stay SPEC 9 / CLAUDE.md section 7 (primary `#35408E`, active nav `#262F73`, gold `#F2D46B`, ink `#1C2445`, muted `#5B6576`, page `#F2F5F5`, line `#DDE3E8`, danger `#B42318`, success `#1E6B3E`). Public Sans, Material Symbols Outlined.
- Three modes: phone under 720 (bottom tab bar, More drawer), rail 720 to 1100, full sidebar over 1100; 44 px minimum tap targets; visible focus; labelled controls.
- One slice is one task: tests first for logic, then `npm test`, lint, typecheck, build; Playwright at 390, 900 and 1280 px (the API answered by network mocks on `http://localhost:3000` only; never route patterns that match `/src/` modules); reviewer compares each screen with the slides named in the slice.
- API-enforced rules stay API-enforced. A UI change never moves a rule into the client. A logic change needs its own API tests and, when it touches data, a `SPEC CHANGE:` the human edits.
- No new dependency without a `DEPENDENCY:` checkpoint (a PDF generator for the clearance slip, an icon or QR library).

## 3. Screen inventory and comparison (deck vs what is built)

Legend: **OK** matches closely, **Part** exists but differs, **Missing** not built. "Logic" points to section 5.

### 3.1 App chrome (all signed-in pages)

| Deck | Built | Gap |
|---|---|---|
| W15 to W16, M15 to M18: breadcrumb top bar (`Staff > Dashboard`), bell with badge, initials avatar with menu (Account details, Change password, Sign out) | Name, role chip, bell, sign-out button | **Part**: no breadcrumb, no avatar menu, no account details page |
| Sidebar in groups: staff Overview / Create (Record violation, Make appointment, Add violation) / Manage (Cases, Students, Appointments, Clearance) / Handbook (Violations, Sanction templates); student Overview (Dashboard, Inbox) / My record (My violations, My sanctions, Appointments, Clearance) / Resources (Student handbook); count badges on Cases, Students, Inbox | Flat list, no groups, no badges, no Students, no Add violation entry | **Part** |
| M15 to M18: phone bottom bar of 5 (Home, Cases or Violations, Students or Sanctions, Schedule, More) plus a More drawer with the same groups and the create actions | One strip of every page | **Part** |
| W86 to W89, M98 to M101: loading placeholder cards, empty, load failed with Try again, **No access** | Text loading, empty, error with retry | **Part**; **No access** page missing |
| W16 and elsewhere: toast after a save; modal confirm with a reason where the rule needs one | Inline notices and inline reason forms | **Part** (G4) |

### 3.2 Public

| Deck | Built | Gap |
|---|---|---|
| W01 to W04, M01 to M04 Sign-in: brand hero panel, NU email, password with show/hide, Forgot password help, "Open the violation form" link, error, loading | One centred card, static help note | **Part**; link to `/report` and a show/hide control missing; the NU-email domain hint is client-side copy only |
| W05 to W06, M05 to M06 Set a new password: rule checklist, mismatch alert | `ChangePassword` exists | **Check** the live rule checklist and the mismatch alert wording |
| W07 to W14, M07 to M14 Gate form: header "Violation Form" with back arrow, steps **Details** (ID, full name, program, year-level pills), **Violations** (search and tick), **Review** (summary, Back, Submit report), then success with reference | Steps are Student, Program and year, Violations; no review step; "Not sent" state is a generic message | **Part**: Review step missing; step content regrouped; reference format (Logic 3) |

### 3.3 Staff

| Deck | Built | Gap |
|---|---|---|
| W15, M15 to M16 Dashboard | P1 built (cards from existing endpoints) | **Part**: no "Last checked" with refresh, no "Will escalate" chip, no Sanctions card (needs an endpoint), no Overdue tile |
| W17 to W32, M19 to M32 **Cases**: two-pane (queue left, case right); status dropdown with counts ("Needs review (6)"), All / Minor / Major chips, search over case id, student id, username, name, violation; groups ("NEEDS REVIEW"); pagination; case pane has the 4-stage tracker (Reported, Validated, Sanctioned, Resolved), Details / History tabs, Remarks for the student, **Validate report (N violations)** and **Reject** (modal with required reason), sanction picker with **Assign sanction** and **Resolve without sanction**, proof panel with **View** per file (preview in place), "Open each file before you verify", **Verify sanction**, **Return to student** (modal with required reason), **Resolve case** (modal) | List page, separate detail page, inline reason forms, filters by status and class, search | **Part**: layout, tracker, tabs, modals, file preview, grouping; behavior mostly exists in the API |
| W33 to W35, M33 to M37 **Students**: list with "All students / Sanctions to verify" chips and badges, record pane (Active cases, Resolved cases, Sanctions, Clearance tiles; Active cases list), **Reset password** (confirm modal, then temporary password shown once), **Record violation** | Missing (the reset API exists at `POST /staff/students/:studentId/reset-password`) | **Missing** (needs `GET /students` and `GET /students/:id`) |
| W36 to W38, M38 to M41 **Record violation**: student ID with a found-student confirmation (name, program), violation select, remarks the student sees on the new case | Student ID, violation | **Part**: lookup confirmation and remarks missing (Logic 6) |
| W39 to W46, M42 to M50 **Appointments**: two-pane; filters (status, date), groups Upcoming / Past and closed; detail with Details / History tabs; Mark completed, Edit or reschedule, Cancel (modal with required reason); **Make appointment** with a Review step and a summary | Single list with cards, inline forms, Make appointment is one form | **Part** |
| W47 to W49, M51 to M54 **Handbook violations**: list left, edit pane right (name, category, section, text, sanction per offense), Save changes and Discard, unsaved-changes state; **Add violation** page | Handbook page with Edit toggles on cards | **Part**; Discard and unsaved state missing |
| W50 to W52, M55 to M58 **Sanction templates**: own page; left list of sanctions (filters All, Minor, Major, Posted, Not posted); right editor with **one** template file, template name, short description, requirements and instructions, Save | A tab on the Handbook page, up to 5 files per template | **Part**: page, filters and wording; single file vs 5 (Logic 7) |
| W53 to W59, M59 to M66 **Clearance**: term chips ("1st Term 2026-2027", "3rd Term 2025-2026"); left list of every student with progress (1/4, Not set); right pane Requirements / Activity history tabs; **Record completion**, Reverse (modal, reason), Add requirement, Not set up with Set up, Cleared | List of set-up clearances with filter and a set-up form that needs a typed student ID | **Part**: needs the Students list and a term list (Logic 4) |

### 3.4 Student

| Deck | Built | Gap |
|---|---|---|
| W57, M67 to M68 Dashboard (+ unread prompt) | P1 built | OK apart from wording |
| W58 to W61, M69 to M72 **Inbox**: chips All, **Important notices**, Violations, Sanctions, Appointments with counts; Unread only; Mark all as read; refresh; pagination; message dialog with an Open action; note "Updates are also emailed to your school account" | Newest-first list, bell, toast | **Part**; chips and dialog missing; **Important notices** needs Logic 1 |
| W62 to W64, M73 to M75, M86 **My violations**: two-pane; tiles (All active cases, Minor, Major); status chips (Pending review, Validated, Sanction in progress); detail with tracker, Details / Timeline tabs, Remarks, **Next step** callout and the **proof upload inside the case** | Separate list and detail pages; upload lives on My sanctions | **Part**; upload placement changes (Logic 5) |
| W65 to W67, M76 to M79 **My sanctions**: tiles (All, Minor offense, Major offense), chips (All, In progress, Pending verification, Cleared); detail with 4 steps (Assigned, In progress, Complied, Verified), due date and days left, Details / Timeline, "Note from the SDO", "Next step: upload from the case in My violations" | List of cards with the proof panel | **Part** (Logic 5 and 8) |
| W68 to W76, M80 to M85 **Upload proof**: initial, files added, file removed, wrong type rejected inline (others stay), replace, **Submit for verification**, pending, returned with the SDO note | Built in steps 5 and polish (drop area, progress) | **Part**: location, "Next step" callout, per-file View, "View this offense in the Handbook" |
| W77 to W78, M87 to M88 **Appointments**: Upcoming / History, view only | Built | OK |
| W79, M89 to M90 **Clearance**: term chip, NOT YET CLEARED, progress bar, requirement rows (Completed / Remaining), locked **Download clearance slip**, "How to get cleared" steps | Term select, checklist | **Part**; slip is new (Logic 2) |
| W80 to W81, M91 to M93 **Student handbook**: list with category and section; entry pane with sanction per offense and the posted template to view or download (preview in place) | List with search; templates on another tab | **Part** |
| W82 to W85, M94 to M97 Account menu, **Account details** (read-only, "Corrections go through the SDO"), **Change password** (rules, empty-input alert) | Change password only when forced | **Missing**: account details and voluntary change password |

## 4. Slices (each is one task; order matters)

| Slice | Covers | Done when |
|---|---|---|
| **P0 Chrome and feedback** | 3.1 | Grouped sidebar with badges, breadcrumb bar, avatar menu, phone bar of 5 + More drawer; `Toast`, `ConfirmModal` (required reason option) and locked-button components; No access page; skeleton cards; account details and voluntary change password (client plus `GET /me/profile` if the human accepts it) |
| **P1 Dashboards** | 3.3 W15 | Built; follow-ups: Last checked and refresh, Sanctions card (needs P3b), Will escalate chip only if Logic 9 is accepted |
| **P2 Master-detail** | all two-pane screens | A shared list-and-detail layout that stacks on phone, with its keyboard and focus behavior and tests |
| **P3 Cases (staff)** | W17 to W32, M19 to M32 | Layout, tracker, Details / History tabs, modals, file preview; behavior stays as built; grouping and filter logic are pure and tested |
| **P3b Staff sanctions queue** | W15, Cases badges | Staff read endpoint for sanctions waiting for verification (API tests), nav badges |
| **P4 Students (staff)** | W33 to W35 | `GET /students`, `GET /students/:id` (staff only, no password hash, API tests), list, record pane, reset-password modal with the existing route |
| **P5 Appointments** | W39 to W46 | Master-detail, filters, Review step, History tab; logic unchanged unless Logic 6 is accepted |
| **P6 Handbook and templates** | W47 to W52 | Edit pane with Save/Discard, Add violation page, Sanction templates page with Posted / Not posted filters; template shape per Logic 7 |
| **P7 Clearance** | W53 to W59, W79 | Term list, student list with progress, Requirements / Activity history tabs; student slip per Logic 2 |
| **P8 Student pages** | W58 to W76 | Inbox chips and dialog, My violations and My sanctions two-pane, upload placement per Logic 5, handbook entry pane |
| **P9 Public** | W01 to W14 | Sign-in hero and links, gate form Details / Violations / Review, "Not sent" state, reference per Logic 3 |
| **P10 Notices** | W60 | Only if Logic 1 is accepted: notices model, staff editor with expiry, inbox category, email |
| **P11 PWA and accessibility** | M15 to M18 phone layout | Manifest and icons, reduced motion, 44 px audit with a test |

## 5. Logic changes implied by the package (none built yet)

| # | Package says | Built / SPEC says | Needs |
|---|---|---|---|
| 1 | **Important notices**: staff publish a notice (title, message, instructions, optional expiry) that appears in every student's bell and inbox and is emailed; edit and remove; inbox category "Important notice" (HTML lines 1610 to 1664, 2238, 2259) | Parked in SPEC (notices/announcements) and CLAUDE.md section 9 | Human decision to un-park; then a `SPEC CHANGE`, a table, API, editor |
| 2 | **Clearance slip**: student downloads a slip once every requirement is done; locked until then | No slip | Decide content and format (PDF needs a library: `DEPENDENCY:`) |
| 3 | **Display codes**: cases `SDO-2026-016`, gate submissions `GI-1042`, sanctions `S-021`, appointments `A-104`, students `2023-100123` (6 digits) | Letter + 3 digits (`C016`, `S021`); student ID `YYYY-NNNNNNN` (7 digits, decision 13) | Decide whether display codes change (derivable, no schema change) and whether sample student ids are only samples |
| 4 | **Terms**: "1st Term 2026-2027", "3rd Term 2025-2026"; the term list is configured and staff pick a term chip; every student is listed with progress | `semester` 1 to 3, staff type a student ID to set up | Term list source (config or table); needs P4 |
| 5 | **Proof upload lives in My violations** (the case detail), and My sanctions is read-only with "Next step" pointing there | Upload on My sanctions | Move only the entry point; the API is unchanged |
| 6 | **Remarks** on a new case (Record violation) and a single editable "Remarks for the student" on the case | Remarks are an append-only log with a notification each; none at creation | Decide: single field or log; add optional remarks to `POST /cases` |
| 7 | **Template** is one file with name, short description and requirements; page shows Posted / Not posted | Up to 5 files, title, description, requirements | Keep 5 or cap at 1 |
| 8 | Sanction ladder labels **Assigned, In progress, Complied, Verified**; statuses shown In progress, Pending verification, Returned, Cleared | `assigned`, `pending_verification`, `returned`, `completed` | Label mapping only (assigned shows as In progress, pending_verification as Complied / Pending verification) |
| 9 | Staff dashboard: **Will escalate** chip, Last checked and refresh, Overdue tile | None | Optional; Will escalate costs one `escalation-preview` call per report |
| 10 | Staff Cases badge = reports needing review; Students badge = sanctions to verify; Inbox badge = unread | Only the bell | Needs P3b |
| 11 | Sign-in checks the email domain (`nu-fairview.edu.ph`) in the form | API validates the account only | Client copy only (the API stays the authority) |

## 6. Questions for the human

1. **Notices (Logic 1).** The deck's student inbox has an "Important notices" filter and the HTML has a full staff editor. SPEC and CLAUDE.md park notices. Un-park now (P10), later, or never?
2. **Clearance slip (Logic 2).** Build it? What does it show (student, term, requirements, date, officer) and is a PDF acceptable (a library needs your approval)?
3. **Display codes (Logic 3).** Switch to `SDO-2026-016`, `GI-1042`, `S-021`, `A-104`? Case numbers restart each year in the sample; do you want that, or just a prefix change on the existing ids?
4. **Student ID shape.** The deck's samples are `2023-100123` (6 digits) while decision 13 says 7 digits. Keep 7, or move to 6?
5. **Terms (Logic 4).** Where does the list of terms come from (a config list, or staff add a term)? Is the third term a regular term of the year?
6. **Remarks (Logic 6).** One editable "Remarks for the student" field per case, or keep the append-only log?
7. **Template files (Logic 7).** One file per template or up to five?
8. **Status wording (Logic 8).** Confirm the label mapping, data unchanged.
9. **Staff dashboard extras (Logic 9).** Build Will escalate, Last checked and Overdue, or leave them out?
10. **Students page (P4).** Confirm it belongs in this step (it is in SPEC 5 and was never built).
11. **Account details (P0).** `student_accounts` already holds name, email, `program_id` and `year_level` (1 to 6; the gate form offers 1st to 5th). Show name, student ID, email, program and year level read-only through a new `GET /me/profile`?
12. **Reset password route.** SPEC 7 sketches `POST /students/:id/reset-password`; the built route is `POST /staff/students/:studentId/reset-password`. Update SPEC 7 to the built path?
13. **Fidelity target.** Decision 18 names the old prototype; this SPEC makes the deck the screen reference and the HTML the logic reference. Confirm and update decision 18.

## 7. Out of scope

Dark mode, a design-system rewrite, shadcn initialisation (a human decision), any change to the escalation, sanction, appointment or clearance rules beyond section 5, and any behavior the HTML carries that SPEC removed (section 1).
