# UI polish SPEC, round 2 (build step 10)

Status: **draft for the human to accept** (2026-10-13). This replaces the first polish SPEC completely. It is a fresh, screen-by-screen comparison of what is built (`client/src`, branch `worktree-ui-polish` at `504cde7`) with the design package, down to buttons, modals, toasts, empty states and copy. Every UI difference is listed; every logic or API change is collected in section 7 and is **not** built until the human answers it.

## 1. Sources and how to read this file

| What | Where | Used for |
|---|---|---|
| Screens | `design-reference/SDO_Portal_UI.pptx` (199 slides). Screenshots are `ppt/media/image-<slide>-1.png` inside the file: web 924×540, mobile 390×844 | Layout, states, what each screen shows |
| Markup, styles, copy, logic | `design-reference/sdo-portal.source.html`: template lines 1 to 2160 (one block per screen, marked `<!-- ADMIN · CASES -->` and so on), logic 2160 to 3530 | Exact sizes, colours, wording of every toast, modal, error and empty state |
| Rules | `SPEC.md`, `FEATURE-RULES.md` | Wins over the package. Behaviour the source still carries but SPEC removed (in-person "Record compliance", student statement, hours, time slots, 10 h / 20 h options) stays removed |

- Labels: `W01` to `W89` are the web slides (`WEB · ROLE · NN`, slide number = NN + 3); `M01` to `M101` are mobile (`MOBILE · ROLE · NN`, slide number = NN + 93). `src 1977` means line 1977 of the source.
- "Deck" means the package (slides and source agree unless noted). "Built" means the current client.
- The deck is not committed on this branch; read it from the main checkout (`docs/sdao-handoff/design-reference/SDO_Portal_UI.pptx`).

## 2. Summary: what is most different

1. **The look of every control.** The deck uses pill buttons (radius 999, 42 to 50 px tall) with a 3 px focus ring and a spinner while busy; tinted alert boxes with an icon; chips with count bubbles; selected list rows with a 3 px left bar. The build uses 6 px rounded buttons, plain red text for errors, no spinner anywhere and `bg-primary/10` rows.
2. **No page headers.** The deck never shows a page title block; the breadcrumb in the top bar (`Staff › Cases`) is the title. Almost every built page starts with a `PageHeader` (title + subtitle + action) that is not in the deck.
3. **Chrome.** Sidebar width, gold right edge, group labels, active state, collapse toggle, full-width content area, bell popover (students only), account details and change password as **modals**, phone "More" as the blue sidebar sliding in from the left.
4. **Feedback.** Toast is a dark bar at the bottom right (gold check icon, 4.2 s). Modals carry a tone icon, tone-coloured confirm (red, green or blue), custom cancel labels ("Keep reviewing", "Keep open", "Keep it"), a confirm button that stays disabled until a required reason is typed, and turn into bottom sheets on a phone. Copy of nearly every toast and modal differs (catalogue in section 6).
5. **Files open in place.** The deck previews PDF and DOCX in a modal (with Return / Verify in the footer for staff). The build opens a new browser tab.
6. **Forms.** Live student lookup (Record violation, Make appointment), a custom calendar for the appointment window, year-level pills and violation cards on the gate form, inline field errors with an icon and a red border.
7. **Lists.** Numbered round pager instead of Previous / Next; list and detail panes of equal height that scroll independently; on a phone the panes stack on one page (no "Back to list" link).

## 3. Rules for every slice

- Tokens stay SPEC 9 / CLAUDE.md section 7; the extra shades the deck uses become named tokens in `client/src/index.css` (section 4.1). No raw hex in `.tsx` files.
- Build the shared pieces once (section 4) and use them everywhere; a page never restyles its own copy of a button, chip, tile or modal (CLAUDE.md section 7 "Design system rules", section 10).
- Copy comes verbatim from the source (section 6 and the per-screen tables), adapted only where our data differs (7-digit student IDs, no usernames, no time slots).
- One slice is one task: tests first for logic, then `npm test`, `npm run lint`, `npm run typecheck`, `npm run build`; Playwright at 390, 900 and 1280 px with the API mocked; the reviewer compares each screen with the slides named in the slice.
- API rules stay in the API. A UI change never moves a rule into the client.
- No new dependency without a `DEPENDENCY:` checkpoint. `mammoth` (DOCX preview) is already a client dependency.

## 4. Shared design system (what to build once)

### 4.1 Tokens to add (all from the source)

| Token | Value | Used for |
|---|---|---|
| `primary-hover` / `primary-press` / `primary-busy` | `#2A3376` / `#20285E` / `#4A5498` | Primary button hover, active, busy |
| `surface-2` | `#F7F9FA` | Stat tiles, list group heads, action footers, table heads |
| `line-soft` | `#EEF1F4` | Inner borders, segmented-tab track, count bubbles |
| `row-hover` / `row-selected` | `#EEF1F9` / `#E8EBF7` | List rows |
| `info-soft` / `info-ink` | `#E8EBF7` / `#2B347A` | Info alert, "Next step", sanction ladder, notification category "Appointments" |
| `danger-soft` / `danger-line` / `danger-ink` | `#FCEEEE` / `#F1C9C9` / `#8E1F17` | Error alert, danger hover |
| `bad-soft` / `bad-ink` | `#F7E6E6` / `#9B2C2C` | Major pill, flags ("Will escalate"), PDF file tile |
| `warn-soft` / `warn-ink` | `#FEF6D8` / `#7A5A00` | "Note from the SDO", due-date card, dashboard decision tile |
| `amber-soft` / `amber-ink` | `#FCE9C6` / `#7A4600` | "Escalated", "Treated as Major", escalation notes |
| `pending-soft` | `#FDF3D3` | Pending pills, notice icon |
| `success-strong` / `success-soft` / `success-line` | `#2E8B57` / `#E2F3E8` / `#CDE9D7` | Verify, Resolve, Mark completed buttons; done requirement rows |
| `neutral-soft` / `neutral-ink` | `#ECEEF1` / `#4A5260` | Not verified, Cancelled |
| `gold-line` / `gold-hover` | `#DDBB4A` / `#E8C75A` | Gold "View all" pill |
| `muted-2` / `disabled` | `#7B8592` / `#9AA6B2` | Inactive tab-bar items, input icons, disabled chevrons |
| `disabled-bg` / `disabled-ink` | `#EEF1F4` / `#6B7480` | Disabled buttons ("Saved", "Add a file to submit") |
| `skeleton` | `#E6EAEE` | Loading blocks |
| `scrim` | `rgba(16,22,52,.5)` | Modal and drawer backdrops |

Status pill colours already match the source; keep `utils/format.ts`.

### 4.2 Components (in `components/ui` and `components/feedback`, one file each, `cva` variants, `cn()`)

| Component | Deck anatomy (source line) | Built today |
|---|---|---|
| `Button` | Variants: primary, secondary (white + primary border, hover `#F0F2FA`), neutral (white + `#C9D1D9` border), danger-outline (`#C0392B` border, red text, hover `#FCEEEE`), success (`#2E8B57`), gold (`#F2D46B` + `#DDBB4A`), text (no border). All radius 999, sizes 34 / 42 / 44 / 48 / 50 px, 13 to 15 px / 600, focus ring `0 0 0 3px rgba(53,64,142,.35)`. `busy` swaps the label for a 16 px spinner + "Saving…" (or the given busy label) and locks the button. Disabled = `disabled-bg` with a `title` saying why (src 77 to 110, 685 to 726) | `buttonClass` string, radius 6, no variants, no spinner |
| `Field`, `Select`, `Textarea` | Label 13/600 ink, 6 px gap; 44 px (48 on the gate form), radius 8, border `#C9D1D9`, focus primary border + 3 px ring `.18`; invalid: border `#C0392B`, `aria-invalid`, message under the field 13/600 red with an `error` icon; select uses a custom chevron (src 61, 158) | `fieldClass` string, messages without icon or red border |
| `Alert` | tone error / info / warning / success: radius 8, padding 12×14, 13 px, 20 px icon (`error`, `info`, `wifi_off`…) (src 54, 74, 226) | none; plain `<p role="alert">` |
| `Chip` + `ChipGroup` | Pill, 34 to 40 px, 12 to 13 px / 600; selected primary fill + white, else white + `#C9D1D9`; optional count bubble 20 px (`rgba(255,255,255,.22)` / `#EEF1F4`); `role=tab` + `aria-selected` (src 2542) | Repeated per page, 44 px, count as `bg-black/10` |
| `SegmentedTabs` | Track `#EEF1F4` radius 999 pad 3; option 34 px, selected white + shadow `0 1px 2px rgba(28,36,69,.12)`; optional count (src 637) | Repeated per page (close) |
| `StatTile` | `surface-2` + `line-soft` border, radius 10, value 22 to 32 px / 800, label 12 `#6B7480` (src 441) | `Kpi` (bg-page, text-2xl bold) |
| `ClassTile` (clickable filter tile) | White, 1.5 px border (primary when selected, bg `#F5F7FB`), radius 12, 5 px accent bar at the left top, label 13/600, value 32 to 48 px / 800 in a class colour (src 1096) | Static `Tile` copied in 3 pages, full-height accent, not clickable |
| `Pill` | 11 px / 600, pad 2×10; tones from `pillTone`; plus `Tag` (amber) and `HighTag` (10 px / 800, radius 4, `bad`) (src 579) | `StatusPill` (fine); tags hand-coloured per page |
| `ListCard`, `GroupHead`, `SelectableRow` | Card radius 12; group head `surface-2`, 8 px coloured dot, uppercase 12/700 + count; row hover `row-hover`, selected `row-selected` + `inset 3px 0 0 primary` (src 573, 2543) | Rows with `bg-primary/10`, no bar, no dot |
| `DetailTable` | Bordered radius 10, rows of label (104 px, 12/600 muted, not uppercase) then value (14 ink), full-width rows for long values (src 643) | `<dl>` with uppercase labels in every page |
| `HistoryList` | Rows of date (96 px, 13 muted) then sentence (14 ink) with "by" (12 muted) under it, newest first (src 664) | Left-border timeline with `eventType → status` labels |
| `FileRow` | 40 px tile (PDF `picture_as_pdf` on `bad-soft`, DOCX `description` on `info-soft`), name 14/600, meta `PDF · 242 KB · Uploaded Oct 7, 2:28 PM`, optional green "Viewed" chip, actions View (secondary pill, `visibility`), Replace (neutral pill, `swap_horiz`), remove (40 px round icon, red hover) (src 706 to 711) | Plain text rows, underline links, small square buttons |
| `Pager` | Centred: round chevron prev / next (34 px, 40 on phone) and numbered round pages, current primary (src 601) | `Pagination`: Previous / "Page n of m · N cases" / Next |
| `SectionLabel` | `1 · STUDENT`: 12/700 uppercase `.06em` muted (src 745) | none |
| `EmptyBlock` | Icon 32 px `disabled`, title 600, text 13 muted, centred (src 594) | `EmptyState` (dashed card) |
| `ActionFooter` | Full-bleed band at the bottom of a detail card: `surface-2`, top border, pad 16×24 (src 679) | `bg-page/60` band (close) |
| `StudentLookup` | Input + live result line: green `person_check` "Name · BSIT 3rd Year" or red `error` "No student found with that ID." (src 748 to 754) | none |

### 4.3 Feedback (one implementation each)

| Piece | Deck | Built | Change |
|---|---|---|---|
| Toast (`src 2086`, `2368`) | Dark bar `#1C2445`, white 14 px, radius 10, pad 12×16; icon `check_circle` gold `#F2D46B` or `error` `#FF8A80`; bottom right 20 px on desktop, full width 16 px gutters above the tab bar on phone; **one at a time**, 4.2 s, `aria-live=polite` | White card with border, centred, up to 3 stacked, 5 s, errors stay until dismissed, close button | Restyle and reposition; keep a dismiss for errors |
| Confirm modal (`src 1977`, `3430`) | Max 460, pad 24, radius 14; header = 40 px tone icon circle (danger `warning`, ok `task_alt`, primary `help`) + title 20/700 + body muted; optional textarea (label 13/600, placeholder), code block (dashed, monospace 24 px), choice chips; buttons pill 42 px: cancel neutral with a **custom label**, confirm in the tone colour (danger `#B42318`, ok `#2E8B57`, primary); confirm **disabled** (`disabled-bg`, title "Add a reason first") until a required input has text; single-button variant; phone = **bottom sheet** (radius 18 18 0 0, safe-area padding, max 92vh); Escape and backdrop close | No icon, only red or blue confirm, cancel always "Cancel", validates on submit ("Enter a reason."), sheet on phone already | Rebuild per deck |
| File preview modal (`src 1952`) | Max 980, height min(88vh, 920), full screen on phone; header tile + name + meta + Download icon + Close; body `#E9ECF1`; PDF in an iframe, DOCX converted with mammoth in a sandboxed iframe, "Preparing preview…" spinner, error "This file could not be previewed here. Download it to open it in Word."; staff footer on a pending sanction: hint ("Open the other files before you verify." / "All files viewed. You can verify this sanction.") + Return to student + Verify sanction | Not built (new tab) | New component; see decision D7 for DOCX bytes |
| Page states (`src 386 to 422`, W86 to W89) | Loading: spinner + "Loading {Page}…" + grey blocks (3 × 96 px tiles, 2 panels 320 px); Empty: card, `inbox` 40 px, "Nothing here yet" 20/700 + page text; Error: card with red border, `cloud_off` red, "Couldn’t load {Page}", "The server didn’t respond. Nothing was changed. Check your connection and try again.", primary pill "Try again" with `refresh`; No access: `lock` amber, "You don’t have access to {Page}", "Your account role doesn’t include this page. If you think this is a mistake, contact the Student Discipline Office.", secondary pill "Go to dashboard" | Pulse cards; error shows the API message; generic texts | Restyle and use the exact copy; keep the API message as a second line on errors |
| Unread nudge (`src 2074`) | Student only, after sign-in, 7 s: card top right under the header (340 px), `notifications_active` in an `info-soft` circle, "You have N unread notifications.", small primary pill "Open inbox", close | Bottom card with an underlined "View" link | Restyle and move |

## 5. Screen by screen

Each table lists only what differs. "Fix" says what the slice changes; "(D#)" points to a decision in section 7.

### 5.1 App chrome (all signed-in pages) — W15, W16, W82, M15 to M18, M94

| Element | Deck | Built | Fix |
|---|---|---|---|
| Sidebar | 264 px (rail 80 px), primary, **4 px gold right border**; top block 72 px: seal 34 px (no white circle), "NU FAIRVIEW" 16/700, portal label 12 px `#F1DD9A` ("Student Discipline Office · Staff") | 240 / 64 px, no gold edge, seal in a white circle | Match |
| Group labels | 13/600 `rgba(255,255,255,.66)`, sentence case ("Overview"); rail shows a 1 px divider | 11 px uppercase | Match |
| Nav item | 44 px, radius 8, 14 px; active: `#262F73` + **3 px gold bar** at the left + icon **gold and filled** + 700; inactive `.88`, hover `rgba(255,255,255,.1)`; focus outline gold | Active bg only | Match |
| Badges | Gold pill 22 px inline; on the rail a small gold count at the top right (not a dot) | Gold inline; dot on rail | Count on rail |
| Collapse | Header button `left_panel_close` / `left_panel_open` collapses to the rail; 720 to 1100 px starts collapsed | None (rail forced by width) | Add toggle |
| Nav icons and labels | Staff: Dashboard `space_dashboard`; Record violation `add_circle`; Make appointment `edit_calendar`; Add violation `post_add`; Cases `gavel`; Students `school`; Appointments `calendar_month`; Clearance `task_alt`; Violations `menu_book`; Sanction templates `folder_managed`. Student: Dashboard, Inbox `inbox`, My Violations `report`, My Sanctions `assignment_late`, Appointments `calendar_month`, Clearance `task_alt`, Student Handbook `menu_book` | `dashboard`, `event`, `verified_user`, `folder_copy`, `gavel` / `assignment` for student pages; labels "My violations", "Student handbook" | Match icons and capitalisation. Staff also has Inbox and Notices (kept, D11) |
| Top bar | 64 px sticky, white, bottom border; desktop: collapse button + breadcrumb `Staff › Dashboard` (portal 14 muted, chevron, page title 600 ink); phone 56 px: seal 28 + "NU FAIRVIEW / Student Discipline Office", no menu button | ~44 px, no collapse button | Match |
| Bell | **Students only.** 42 px round, gold badge with a 2 px white ring; opens a **popover** (380 px; full width under the header on phone): "Notifications" + "Mark all as read", 5 latest rows (icon circle, title, 2-line message, time, unread dot), "No notifications yet.", footer "Also sent to your school email" + primary "Open inbox" | Link to /inbox for both roles, red badge | Popover for students; staff keep Inbox in the nav (D11) |
| Account menu | Gold initials 32 px + first name + `expand_more`; menu 248 px: name 700 + sub (staff "SDO Officer", student "2023-100123 · BSIT"), items as pills: `badge` Account details, `key` Change password, `logout` Sign out in red (hover `#FCEEEE`) | Same items, square, student sub = ID only, items navigate to pages | Items open **modals** (5.10) |
| Content area | Full width, padding 32 (16 on phone), sections 24 apart | `max-w-5xl` centred, `px-4 py-6` | Full width |
| Phone tab bar | 5 equal columns, 58 px, icon inside a 56×30 pill, **filled when active**, label 12 (700 active), active primary / inactive `#7B8592`, badge red `#C0392B` with a 2 px white ring at the icon's top right, shadow `0 -4px 16px`; "More" is active while the drawer is open or the page is not one of the four tabs; student "More" badge = unread | Close; no fill, More never active | Match |
| More drawer (M17) | The **blue sidebar** slides in from the left (284 px) over a scrim, with a close button, same groups and create actions | White bottom sheet with an extra "Account" group | Use the sidebar |
| Master-detail | List and detail are cards side by side when the content is ≥ 800 px wide, both as tall as the viewport minus 128 px and scrolling on their own; proportions per screen (Cases 1.2 : 1, Students 1 : 2, Clearance 1 : 2, Appointments 1.2 : 1, Handbook 1.4 : 1, Notices 1 : 1.2); below 800 px they **stack** on one page and selecting a row scrolls down to the detail (M19 to M37) | Fixed 16 to 22 rem list; on phone one pane at a time with a "Back" link | New `MasterDetail` (D9 for keeping URL selection) |

### 5.2 Public: sign-in and set a new password — W01 to W06, M01 to M06

| Element | Deck | Built | Fix |
|---|---|---|---|
| Layout | Two halves; hero: `hero.png` under `rgba(38,47,115,.72)`, seal 128 px with drop shadow (88 px on phone), "NU FAIRVIEW" 34/700, gold "Student Discipline Office" 16/600, "Violations · Sanctions · Clearance" 14; **6 px gold right border**; on phone the hero is a 260 px band with a 5 px gold bottom border above the card | Hero hidden on phone; seal in a white circle | Match |
| Card | Max 420, radius 14, pad 28, soft shadow; title 26/700 "Student Discipline Office Portal", sub 13 muted | `max-w-sm`, xl radius, 20 px title | Match |
| Wrong password (W02) | Error **alert above the fields**: "That NU email and password don't match. Check them and try again."; email stays filled | Red text under the password with the API message | Alert; keep the API's generic message as the text |
| Client checks | Non-NU address: "Use your NU email (ending in nu-fairview.edu.ph)."; empty: "Enter your NU email and password." | `required` only, no message | Add (UI only; API stays the authority) |
| Busy (W03) | Button `#4A5498` + spinner + "Signing in…" | Text only | Spinner |
| Forgot password (W04) | Text button right-aligned; **info alert** above Sign in: "Visit the SDO office (Room 204) with your school ID. Staff will give you a one-time temporary password, and you’ll choose a new one when you sign in." | Grey note with different copy | Match copy and style |
| Extra line | None | "Room 204 is open Mon to Sat, 7:00 AM to 5:00 PM." under the link | Remove |
| Violation form link | Pill text button, `qr_code_scanner`, hover `#E8EBF7` | Link | Restyle |
| Set a new password (W05, W06) | **Same two-half layout** as sign-in. "Set a new password"; "Hi Juan Dela Cruz. You signed in with a temporary password from the SDO. Choose a new password to continue."; **New password + Confirm only**; live rule list (`radio_button_unchecked` → green `check_circle`): "At least 8 characters", "Letters and at least one number"; errors in an alert above the form: "Your new password doesn’t meet the rules below." / "The passwords don’t match." / "Don’t reuse the temporary password."; "Save and continue" (busy "Saving…"); text button "Back to sign in" (signs out); toast "Password set. Welcome back." | App-style page with a "Temporary password" field, per-field errors, "Save new password" | Match (D1 for dropping the temporary-password field) |

### 5.3 Public: gate violation form — W07 to W14, M07 to M14

| Element | Deck | Built | Fix |
|---|---|---|---|
| Header | 64 px sticky white, content centred in the 560 px column: back arrow (on steps 2 and 3 it goes to the **previous step**, label "Back to the previous step"; else "Back to sign in"), seal 34 px, "Violation Form" 16/700, "Student Discipline Office" 12 | Left-aligned full width; back always goes to sign-in | Match |
| Stepper | 28 px numbered circles joined by a 2 px line, labels Details / Violations / Review (current 700) | `StageTracker` (check size) | Match |
| Step 1 | Card radius 12, pad 28×22, gap 22; "Your details"; Student ID (placeholder "e.g. 2025-1234567"), Full name ("First and last name"), Program select ("Choose your program"), **Year level as five pill radio buttons** 1st to 5th; full-width 50 px "Next: violations"; **each field shows its own error** with a red border: "Enter your student ID." / "Use the format 2025-1234567." / "Enter your full name." / "Choose your program." / "Choose your year level." | "Student details", year as a select, "Next", one message for the whole step | Match |
| Step 2 | "What were you stopped for?" + right "2 selected" / "None selected"; "Check every violation the guard named. They’re sent together as one report."; search with icon; **All / Minor / Major** full-width chips with counts; rows are 56 px checkbox **cards** (`check_box` icon, name 15/600, section 12 on a second line, category pill; selected `info-soft` + primary border); "No violation matches that search."; error "Pick at least one violation."; Back (1/3) + "Next: review" (2/3) | Plain checkbox list, "(section)" inline, "N chosen", no category | Match (D2: options need the category) |
| Step 3 | "Check and submit"; table with a 96 px key column; violation rows on `surface-2` with category pills; failure alert `wifi_off` "Your report wasn’t sent. Check your connection and tap Submit again. Nothing was saved."; busy "Submitting…" | Generic "We could not accept this report…" | Network failure → deck copy; a refusal by the API keeps the API's single message |
| Done (W14) | Centred card: 56 px green check circle, "Report received" 22/700 (duplicate: "We already have this report" + "You don’t need to submit it again."), dashed box "Reference" / `GI-1045` 28/800 / "Fri, Oct 9 · 10:40 AM", pill "Awaiting staff review", text "Show this screen to the guard. The SDO checks your identity and the report before anything is added to your record. You’ll get a notice in your student portal and school email.", full-width secondary "Start a new report" | Left aligned, different copy, "File another report", no time, no pill | Match (time = submission time from the API response, D2) |

### 5.4 Staff dashboard — W15, M15, M16

| Element | Deck | Built | Fix |
|---|---|---|---|
| Header | None | "Welcome, Name" + subtitle | Remove |
| Layout | Row 1: Reports to validate (1.6) beside a column [Awaiting decision, Upcoming appointments]; row 2: Sanctions (1.6) beside Clearance work (1) | Two equal columns | Match |
| Card head | Icon tile 40 px radius 10 (reports `qr_code_scanner` bad; decision `gavel` warn; appointments `calendar_month` info; sanctions `assignment_turned_in` warn; clearance `task_alt` success), title 17/700, sub 13, gold "View all ›" | Icons `flag`, `event`, `assignment`, `verified_user`; 16/600 | Match |
| Rows | Inside one bordered box; 56 px; title 14/600 + flag pill (`bad`); sub 12 "… · age"; action = **secondary pill** (primary border and text, fills on hover) | Grey-bordered action, no box | Match |
| Reports to validate | Sub "Last checked 10:40 AM" + 26 px refresh (busy: spinner "Checking…", toast "Up to date."); stats Reports to validate (red when > 0) / Awaiting decision / Sanctions to verify; **one row per gate submission**: "Juan Dela Cruz · 2023-100123", "GI-1042 · No ID, Inappropriate attire · 1 day", flags "Will escalate" / "No matching record", "Validate"; 5 rows; empty `check_circle` green "No reports waiting." | One row per case, 4 rows, no age | Match (D4) |
| Awaiting decision | Sub "1 case to decide" / "All clear"; row "Paolo Reyes · SDO-2026-012", "Unauthorised use of facilities · Minor · 38 days", flag "Major", "Decide"; empty "No cases awaiting a decision." | Title = name, meta "code · violation" | Match |
| Upcoming appointments | Sub "3 upcoming" / "Nothing scheduled"; row "Paolo Reyes · A-103", "reason · Sat, Oct 10 to Fri, Oct 16", flags "Window open" / "Rescheduled", "Open"; empty "No upcoming appointments." | Status pill instead of Open, no flags | Match |
| Sanctions | Sub "1 in progress · 1 to verify"; stats In progress / Overdue (red when > 0) / To verify; to-verify rows first, 4 rows: "Maria Santos · S-019", "Community service · Due Oct 20", flags "Overdue" / "Returned", "Verify" / "Open"; empty "No sanctions need attention." | 3 rows, "· N days late" text | Match |
| Clearance work | Sub "3 students not yet cleared" / "All cleared · 1st Term 2026–2027"; rows "Name · ID", "1 of 4 requirements done" / "Not set up for this term", flag "Not set", "Open"; empty "Every student is cleared this term." | Only set-up clearances, status pill | Match (D3) |

### 5.5 Staff Cases — W17 to W29, W74, W75, M19 to M32, M85

| Element | Deck | Built | Fix |
|---|---|---|---|
| Header | None; no "Record violation" button on the page (it is in the sidebar) | PageHeader + button | Remove |
| Queue head | Search with icon, placeholder "Case ID, student ID, username, name or violation", **filters while typing**; one row: "Status" + select "Needs review (6)" (Needs review / Awaiting decision / Sanction in progress / Resolved / All cases) + small All / Minor / Major chips (36 px) | Search needs a "Search" button; "All statuses"; chips on their own row | Match ("username" → email, D10) |
| Group head | Dot (`#9B2C2C`, `#7A5A00`, `#DDBB4A`, `#1E6B3E`) + "NEEDS REVIEW" + "6 cases" | No dot | Match |
| Row | 72 px, pad 10×24: left 108 px code 12/700 + date; middle: **HIGH** tag (open ≥ 1 day at "Pending review", or Major) + name 600 + ID 12; line 2 violation 13 + class pill + tag ("Escalated", "3rd minor · Major"); **line 3** "Open 1 day" / "Open Today" / "S-019 · Pending verification" / "Resolved Oct 9" / "No sanction"; status pill top right; selected bar | No HIGH, no line 3, no bar | Match (D5 for "HIGH") |
| Empty | `search_off`, "No cases in this queue", "Try another filter, name, student ID or case number." | "No cases match." | Match |
| Pager | 6 per page, numbered | Previous / Next | `Pager` |
| Case header | Violation 22/700; "Juan Dela Cruz · 2023-100123" + text link "View student"; status pill only | "Name (ID)", underlined link, severity and status pills | Match |
| Tracker | 24 px circles, 12 px labels Reported / Validated / Sanctioned / Resolved | Close | Keep |
| Escalation note | `amber-soft` box above the tabs: "Flagged as escalated. This minor counted toward SDO-2025-042. Handbook severity stays Minor." / "Treated as Major as the 3rd minor violation (Sec. VI.E.20). Linked cases: …" | Sentences inside Details | Move |
| Details tab | Rows: **Student** (name + "ID 2023-100123 · BSIT 3rd Year"), Case ID ("SDO-2026-016 · Gate report GI-1042" / "· Staff report"), Date reported, Violation (name + class pill + "Sec. VI.D.2"), Stage ("Stage 1 of 4 · Reported"), Resolved | No Student row, joined text, uppercase labels; extra "Typed on the form", "Originally" | Match; keep the extra rows in the new style |
| History tab | `HistoryList` with sentences: "Reported through gate intake GI-1042", "Report GI-1042 validated. Identity checked by staff.", "Sanction S-021 assigned: …", "Remarks updated: …", "Case resolved" | `eventType → status` | Sentences from the event data |
| Remarks | Details tab only: card "Remarks for the student" + current text on one line + 40 px round `edit_note` button → modal (6.1) | Same idea, different copy | Copy |
| Footer: reported | "Validate report (2 violations)" primary + "Reject" danger-outline; without a matching student the validate button is disabled with the title "Can’t validate without a matching student record." | Same, plus a "Link student" form | Keep "Link student" (D12), restyle |
| Footer: validated | "Decide on a sanction" 14/600; "Sanction" select (handbook options); full-width 48 px "Assign sanction"; centred green text button "Resolve without sanction" | "Assign sanction" opens an inline form (sanction, due date, instructions) | Inline in the footer: sanction select, due date and instructions stay (SPEC flexible due date), then the deck buttons |
| Footer: sanctioned | "Submitted proof" box (`attach_file`, "0 of 2 viewed"), `FileRow`s with View and a "Viewed" chip; no file: `hourglass_top` "Waiting for the student to upload proof."; amber `info` "Open each file before you verify this sanction."; note box `warn-soft` "Returned: …" / "Instructions: …"; buttons **Verify sanction (green)**, Return to student (danger-outline), Resolve case (green; disabled title "Resolve once the sanction is verified") | Separate "Sanctions" section of cards, verify in blue, plain file list, "Late by N days" chip | Match |
| Footer: closed | `check_circle` green "Resolved on Oct 9, 2026. Kept on file for history." / `block` grey "Report not verified. No action needed." | Nothing / tracker note | Match |
| View a file | **Preview modal** with Return / Verify in its footer (W24) | New tab | Preview (D7) |
| Resolve case | **Confirm modal** (W28) | Resolves at once | Add modal |

### 5.6 Record violation — W33 to W35, M38 to M41

| Element | Deck | Built | Fix |
|---|---|---|---|
| Layout | One full-width card, breadcrumb "Staff › Record violation", no header; sections "1 · STUDENT", "2 · VIOLATION", "3 · REMARKS" | PageHeader + card | Match |
| Student | Student ID ("e.g. 2025-1234567") with `StudentLookup` ("Maria Santos · BSN 2nd Year" / "No student found with that ID."), uses the staff `GET /students/:id` | Plain input | Add lookup |
| Violation | "Violation (from the handbook)"; grey head (search "Search violation or section" + All / Minor / Major chips with counts) joined to a 240 px scrolling list of radio rows "Improper uniform · Minor · Sec. VI.D.1" | Native select | Match |
| Remarks | "Remarks for the student", placeholder "e.g. Report to the SDO for validation within 3 days." | "Remarks (optional)" | Match |
| Footer | Help text left ("Enter a valid student ID, e.g. 2025-1234567." / "Pick a violation to save." / "Staff reports are saved as validated."; red after a failed try) + Cancel + "Save case"; invalid save → error toast "Enter a valid student ID before saving." / "Pick a violation before saving." | "Record violation" button | Match |
| After save | Opens the new case in Cases + toast "Case SDO-2026-020 recorded for Maria Santos." (+ " It is the 3rd minor and is treated as Major.") | Stays; inline "Recorded as case C001" (**old code format, a bug**) | Navigate + toast with the real code |

### 5.7 Staff Students — W30 to W32, M33 to M37

| Element | Deck | Built | Fix |
|---|---|---|---|
| Header | None | PageHeader | Remove |
| List | Search "Name or student ID"; chips "All students 3" / "Sanctions to verify 0" (34 px, 12 px, bubbles); rows: 36 px initials circle (`info-soft`), name 600, "2023-100456 · BSN", gold count badge = **sanctions to verify**; "No student matches." | Badge = "N open" cases (grey) | Match |
| Record head | Name 24/700, "2023-100456 · BSN · 2nd Year", email 12; secondary pill "Reset password" (`key`) and gold pill "Record violation" (`add`) | Square buttons | Match |
| Tiles | Four **clickable tiles that act as tabs**: Active cases (sub "Minor count 0 of 3", red bar), Resolved cases ("Kept on file", green `#3BA266`), Sanctions (open count; "1 to verify" in red or "1 cleared"; gold), Clearance ("2/4" or "—"; term or "Not set up"; primary; opens Clearance); 4 columns when wide, else 2; opens on Sanctions when proof waits | Static tiles; Clearance shows "Cleared" / "Not cleared" | Match |
| List under tiles | Box with head "Active cases" / "Resolved cases" / "Sanctions" + count; case rows: code + date, violation + class pill + tag, line "Sanction S-021 · In Progress" / "Resolved Oct 9, 2026" / "Not verified" / "No sanction yet", status pill; sanction rows: code + "Due Oct 20", title, "Case SDO-2026-011" link colour, pill; empty "No resolved cases yet." / "No active cases." / "No sanctions on record." | Active cases only | Match |
| Reset password | Modal **primary** tone: "Reset password for Maria Santos?" / "This creates a one-time temporary password. Their current password stops working, and they must choose a new one at next sign-in." / "Create temporary password" / "Cancel"; then ok tone "Temporary password created" / "Give this to Maria Santos in person. It works once and is not shown again." + code block + single green "Done"; no toast | Danger tone, "Reset password?", info toast after Done | Match |

### 5.8 Staff Appointments, Make and Edit — W36 to W43, M42 to M50

| Element | Deck | Built | Fix |
|---|---|---|---|
| Header | None | PageHeader with the window note | Remove |
| List head | Search "Student name, student ID, username or appointment ID"; filters "Status" (All statuses (5), Scheduled (2), …), "Dates" (All dates / Today / Next 7 days / Past), "On" date + clear | Search only ("Student name, ID or purpose") | Add filters (D6) |
| Groups | "UPCOMING 3" (primary dot) and "PAST AND CLOSED 2" (grey dot); 5 per page, numbered pager; empty `event_busy` "No appointments match" / "Try another status, date or search." | Groups; "Showing the newest…" note | Match |
| Row | 76 px: name 15/700 + ID; `schedule` "Sat, Oct 10 to Fri, Oct 16"; "A-103 · reason"; status pill | Check | Match |
| Detail | Title = the window 22/700; "Name · ID"; pill; Details / History; rows Student (name + "BSIT · 3rd Year"), Reason, Remarks for the student ("None"), Reason for cancelling, Appointment ID, Created, Last updated | Uppercase labels | `DetailTable` |
| Footer (open) | "Update this appointment"; green 48 px "Mark completed" (`event_available`) + secondary "Edit or reschedule" (`edit_calendar`); centred red text button "Cancel this appointment" (`event_busy`) | Inline "Reschedule" and "Edit purpose and notes" forms | Match |
| Footer (closed) | `check_circle` "Completed on Oct 9, 2026. Kept on file for history." / `event_busy` "Cancelled on … The slot is open again." | Check | Match |
| Edit | The Make form in the right pane with the list hidden, breadcrumb "Staff › Edit appointment", banner `info-soft` "Editing A-104. Change the date to reschedule.", student shown as a green lookup line | Two inline forms | One form |
| Make appointment | Appointments page with the list hidden, breadcrumb "Staff › Make appointment"; two columns: "1 · STUDENT" (`StudentLookup`, placeholder "e.g. 2025-1234567") + "2 · DETAILS" ("Reason for the appointment" 140 px, placeholder "e.g. Interview about case SDO-2026-012"; "Remarks for the student (optional)", "e.g. Bring your school ID."); "3 · SCHEDULE" with a **custom month calendar** (round prev / next, Su to Sa, 38 px cells: available green `#E2F3E8`/`#8FD0A8`, start primary, the 6-day window `info-soft`/`#AEB6E3`, unavailable grey for Sundays, past and > 60 days, today with a gold inset ring; legend Available / Start date / Visit window / Unavailable) + help "The student can visit any day from Mon, Oct 12 to Sat, Oct 17, 7:00 AM to 5:00 PM."; overlap alert `event_busy` "Juan Dela Cruz already has appointment A-103 (Sat, Oct 10 to Fri, Oct 16) in this period."; footer "Monday to Saturday, 7:00 AM to 5:00 PM" + Cancel + "Review appointment" | Own route with PageHeader, one column, native date input, "Review" | Match (calendar = window rule from `utils/workingDays.ts`; the API still decides) |
| Field errors | "No student found with that ID." / "Enter the student ID." / "Choose a start date." / "Choose today or a later date." / "Choose a start date before Dec 12, 2026." / "The office is closed on Sundays. Choose Monday to Saturday." / "Enter the reason for the appointment." | Different | Copy |
| Review | "REVIEW BEFORE SAVING" table on `surface-2`: Student, Student ID, Dates, Time "Any time during office hours, 7:00 AM to 5:00 PM", Reason, Remarks ("None"), Status; note "Saving assigns this appointment to Paolo Reyes. They get a portal notification and an email." (edit: "Saving moves the appointment and tells … the new date." / "Saving updates the appointment and notifies …"); "Back to edit" + "Save and assign" / "Save changes" | Close; different labels | Copy |

### 5.9 Staff Clearance — W50 to W56, M59 to M66

| Element | Deck | Built | Fix |
|---|---|---|---|
| Header | None; a row "Term" + term chips ("1st Term 2026–2027", "3rd Term 2025–2026") | PageHeader + "Set up a clearance" button and form | Match (D3) |
| List | Card "Students" (19/700, sticky): **every student** for the chosen term; row name 600 + "2023-100123 · BSIT 3rd Year", right "1 / 4" (green when complete) or "Not set" | Existing clearances of all terms with search and All / Not cleared / Cleared chips | Match (D3) |
| Head | Name 20/700, "2023-100123 · 1st Term 2026–2027", pill In progress / Cleared / Not set; Requirements / Activity history | Close | Match |
| Progress | "1 of 4 requirements complete" + "25%", 8 px bar in **primary** | Gold bar | Primary |
| Rows | As built (green row when done, `check_circle` filled, "Completed" / "Remaining" 12/700); "Record completion" primary pill is a **direct action** with toast "Marked “SDO signature” done for Juan Dela Cruz."; "Reverse…" neutral (red on hover) → modal; 36 px `delete` → modal | "Record completion" opens a modal with optional remarks | Direct action (D8) |
| Add requirement | Footer right, secondary pill with `add` → modal | Close | Copy |
| Not set up | `checklist` icon, "No clearance set for this term", "Add the standard requirements to start tracking.", primary "Set up clearance" (one click; toast "Clearance set up for Maria Santos.") | Separate form with typed ID, "School year (start)", "Semester 1/2/3" | Match (D3) |
| Activity history | `HistoryList` sentences: "Clearance set up with the standard requirements", "Marked “SDO signature” done", "Reversed “All sanctions verified”: Sanction S-015 was reopened.", "Added requirement “…”", "Removed requirement “…”"; empty "No changes recorded for this term." | "Marked done · X by … · date" | Match |
| Kept | "Open cases: N" warning chip on "No open cases" (SPEC 4.4) | | Restyle as a `bad` tag |

### 5.10 Account details and change password — W16, W82 to W85, M18, M94 to M97

| Element | Deck | Built | Fix |
|---|---|---|---|
| Account details | **Modal** (max 440): gold initials 44 px, name 20/700, "Account details", close X; rows (110 px keys) student: Username, Student ID, Program "BSIT · 3rd Year", School email, Notifications "In the app and by email (Outlook)"; staff: Username, Work email, Role; "To correct these details, contact the Student Discipline Office."; secondary "Change password" opens the password modal | Page `/account` with PageHeader and uppercase labels; staff "Employee ID", "Role SDO Officer" | Modal (D10 for "Username") |
| Change password | **Modal** (max 420): "Change password"; alert above; Current / New / Confirm; live rule list; Cancel + "Change password" (busy "Saving…"); errors "Enter your current password." / "Your current password is incorrect." / "Your new password doesn’t meet the rules below." / "The new passwords don’t match." / "Choose a password you haven’t just used."; toast "Password changed." | Page `/account/password`, per-field errors, "Save new password", returns home | Modal; keep the routes as redirects that open the modal |

### 5.11 Staff handbook Violations and Add violation — W44 to W46, M51 to M54

| Element | Deck | Built | Fix |
|---|---|---|---|
| Page | Own page "Violations" (breadcrumb "Staff › Violations"); no header; no Violations / Sanction templates switch | PageHeader "Handbook", tab chips, "Add violation" button | Match |
| List | Head "Handbook violations" + "10 violations · 2 major"; search "Search a violation or section…" and All / Minor / Major chips (bubbles) on one row; rows name + "Sec. VI.D.1 · description" + category pill | Close; "Used in N cases" line in the list | Match |
| Editor | Kicker "Edit violation", title 22/700, "Minor offense · Sec. VI.D.1 · Used in 2 cases"; "Violation name" ("e.g. Improper uniform"); "Category" + "Handbook section" ("e.g. VI.D.9") side by side; "What the handbook says"; box "Sanction per offense" + "Options follow the minor category." with rows "1st offense" / "2nd offense" / "3rd offense" each with **one select** | "Description"; per offense a checkbox for every sanction | Match (D13) |
| Buttons | "Discard changes" only when dirty; Save = disabled "Saved" when clean, "Save changes" when dirty, "Add violation" when new | "Unsaved changes" label, Discard always shown | Match |
| Errors | Inline with icon: "Enter the violation name." / "This violation is already in the handbook." / "Enter the handbook section." / "Enter what the handbook says." | One alert | Inline |
| Toasts | "Saved changes to Improper uniform." / "Added Littering to the handbook." | "Violation saved." / "Violation added." | Copy |
| Add violation | Same page, list hidden, kicker "New violation", heading follows the name ("Add a violation" when empty), "Cancel" + "Add violation" | Own page with PageHeader and a narrow card | Match |
| Kept | Category locked when cases use the entry (API rule): show as a hint under the select | | Keep |

### 5.12 Staff Sanction templates — W47 to W49, M55 to M58

| Element | Deck | Built | Fix |
|---|---|---|---|
| Page | Own page and nav item "Sanction templates" | Tab of the Handbook page (`?tab=templates`) | Own route |
| List | "All sanctions" + "1 of 5 have a template or requirements"; chips All / Minor / Major / Posted / Not posted with bubbles; rows: 36 px tile (`task` green = file, `checklist` blue = requirements only, `draft` grey = nothing), title, "Template posted · with requirements" / "Requirements only" / "Nothing posted yet", category pill | No Minor / Major chips, no category pill, no "Requirements only" | Match |
| Editor head | Kicker "Sanction template", title 22/700, "Minor offense sanction" | "S-001 · description" | Match |
| File | Box "Template and requirements" + "Students can view and download only" (`folder_managed`); "Template file": none → dashed drop zone "Upload a template" / "PDF or DOCX, up to 10 MB" that **uploads on pick** (spinner "Uploading…", inline error with icon); file → `FileRow` with View (preview), Replace, delete → modal | "Choose file" + "Upload" + "Clear"; "Remove" without confirm | Match |
| Fields | "Template name" ("Name students will see"), "Short description" ("What this file is for"), "Requirements and instructions" ("Documents, format and how to submit, as set by the SDO") + help "Shown to students when there is no template, or alongside it."; Discard + "Save details" when dirty, else disabled "Saved" | Check labels | Copy |
| Toasts | "Template uploaded for Violation slip issued by the SDO." / "Template replaced for …" / "Template file removed." / "Saved the template details for …" | Inline notices, "Template saved." | Toasts |

### 5.13 Staff Notices (not in the deck; built and kept)

The source has the screen (src 1609 to 1668) though the deck has no slide. Match it: master-detail; list head "Important notices" + "Shown in every student’s bell and inbox" + primary "New notice"; rows with a `campaign` circle (`pending-soft`), title, "Published Oct 5, 2026 · Until Oct 17, 2026" / "· No end date", pill Active / Expired; detail title + pill, table Published ("Oct 5, 2026 · 8:00 AM · Andrea Marcelo"), Visible until, Sent to ("All students (N), in the bell, the inbox and by school email"), Message, Instructions and reminders, Edited; buttons "Edit notice" (neutral) and "Remove notice" (danger-outline). Form: "New important notice" / "Edit notice" + sub ("Published notices appear in every student’s bell and inbox, and are emailed to their school account." / "Changes show up for students right away. No new notification is sent."); Title ("e.g. Uniform inspection week"), Message, "Instructions or reminders (optional)", "Expiration date (optional)" + help "Students stop seeing the notice after this date. Leave blank to keep it posted until you remove it."; errors "Enter a title." / "Enter the message students should read." / "Choose today or a later date, or leave it blank."; Cancel + "Publish notice" / "Save changes" (`campaign`). Built: one column of cards with PageHeader and different copy.

### 5.14 Student dashboard — W57, M67, M68

| Element | Deck | Built | Fix |
|---|---|---|---|
| Header | None (nudge instead) | "Welcome, Name" | Remove |
| Layout | Row 1: Active violations (1.6) beside [Next appointment, Active sanctions]; row 2: Clearance (1.6) beside **Student Handbook** (1) | 3 : 2 grid, no handbook card | Match |
| Active violations | Icon `report` (bad); sub "4 minor · 1 major"; stats Pending review / Validated / Sanction in progress; rows are **buttons** to the case ("Inappropriate attire", "SDO-2026-021 · Minor · Oct 9", pill); empty "No current violations on your record."; gold "View my violations ›" at the bottom right | Rows not clickable, pill at the top | Match |
| Next appointment | Sub "1 upcoming" / "Nothing scheduled"; clickable card: 58 px date tile, "Mon, Oct 12 to Sat, Oct 17" 700, reason, "Visit any day · 7:00 AM – 5:00 PM", pill; empty dashed "No upcoming appointments."; stats Upcoming / Completed / Cancelled | No pill, "No appointment is scheduled for you." | Match |
| Active sanctions | Icon `assignment_late` (warn); sub "2 active · 2 of 4 cleared"; stats In progress / Pending verification / Cleared (all ink); rows "Community service · 10 hours", "S-022 · Due Oct 23", pill; empty "No current sanctions." | "Nothing is waiting on you.", green Cleared tile | Match |
| Clearance | Sub = term; "2/4" 28/800 amber (green "Cleared") + "2 of 4 requirements done"; 8 px bar gold (green when cleared); gold "View progress ›" | Close | Match |
| Student Handbook | Icon `menu_book`, sub "Conduct rules and sanctions", gold "Read ›", text "The official guide to student conduct at the university. It lists each offense, whether it is minor or major, and the sanction that applies." | Missing | Add |

### 5.15 Student My violations and proof upload — W62 to W64, W68 to W73, W76, M73 to M75, M80 to M84, M86

| Element | Deck | Built | Fix |
|---|---|---|---|
| Header | None | PageHeader | Remove |
| Filters | Three **clickable** class tiles: All active cases / Minor / Major (values coloured ink, `#2B347A`, `#9B2C2C`); centred chips All / Pending review / Validated / Sanction in progress with counts; list shows **active cases only** | Static tiles; chips for other filters (incl. "Closed") | Match (D14) |
| Table | Desktop column heads "Case / Filed", "Violation", "Status"; 52 px rows: code + date, violation + tag ("Treated as Major" / "Escalated"), pill; phone rows violation + "SDO-2026-016 · Oct 8, 2026" + pill; 5 per page; "No violations match these filters." / "You have no violations on record." | List rows | Match |
| Detail | Title 22/700, code under; tracker inside a bordered card (32 px circles, 3 px line, 13 px labels); Details / Timeline; rows Case ID, Filed, Handbook (class pill + "Sec. VI.D.3"), Source ("Gate report GI-1045" / "Recorded by SDO staff"), Sanction ("S-021 · Violation slip and a written warning · Due Oct 16" + pill), Remarks | Uppercase labels, no Source, text-only handbook row | Match |
| Escalation | "This was your 3rd minor violation, so it is treated as a Major offense (Sec. VI.E.20). The handbook still lists it as Minor. Linked cases: …" / "This minor violation counted toward SDO-2025-042, which is treated as Major." | Check | Match |
| Next step | `info-soft` box "**Next step:** Complete sanction S-021, then upload your proof below as a PDF or DOCX file." (only when the student must act) | Similar, always shown | Match |
| Upload panel head | Box: `upload_file` tile + "Upload proof of completion" 15/700 (sent: "Submitted proof") + "Sanction S-021 · …" (or "Verified by the SDO." / "Sanction S-021 · The SDO is reviewing your files.") + status pill | Grey "Proof of completion" box, separate "Upload your proof" header | Match |
| Returned | `bad-soft` alert `undo` "Returned by the SDO: …" | Elsewhere | Match |
| Drop zone | Dashed `#AEB6E3` on `#F7F8FC`, `cloud_upload` 32, "Choose files to upload", "Click to choose or drag files here · PDF or DOCX, up to 10 MB each, 5 files max" (phone "Tap to choose · …") | Close | Restyle |
| Errors | Inline with icon, other files stay: "photo-of-letter.png is not a PDF or DOCX file." / "… is larger than 10 MB." / "You can upload up to 5 files." / "Keep at least one file for the SDO to review. Use Replace to swap it for another file." / "This sanction was already reviewed, so its files can no longer change." | `checkSelection` messages | Copy |
| Handbook link | Text button `menu_book` "View this offense in the Handbook" / "View the template for this sanction" | None (template block is on My sanctions) | Add |
| Chosen files | `FileRow`s with View (preview) and X; meta "PDF · 1 KB · Not submitted yet" | Plain list, "Remove" text | Match |
| Submit | Full-width 48 px "Submit for verification" / "Resubmit for verification"; disabled "Add a file to submit"; busy spinner "Uploading…" (keep the built percent if wanted inside the button) | "Upload N files", progress bar | Match |
| Pending / locked | `info` "You can replace or remove files until the SDO verifies them."; `lock` "This sanction is verified. Uploads are closed." / "Submitted Oct 7, 2:28 PM. You can upload again only if the SDO returns it." | Short notes | Copy |
| Removing a sent file | Modal danger "Remove “parent-acknowledgment.docx”?" / "The SDO will no longer see this file for sanction S-021. Your other files stay submitted." / "Remove file" / "Keep it" | No confirm | Add modal |
| Toasts | "Proof submitted for S-021." / "Removed {file}." / "Replaced {a} with {b}." / error "Replacement failed. Use a PDF or DOCX file." | Inline notices ("Proof uploaded. The office will review it.") | Toasts |
| Below | Secondary full-width "Open the sanction" | Same | Keep |

### 5.16 Student My sanctions — W65 to W67, M76 to M79

| Element | Deck | Built | Fix |
|---|---|---|---|
| Header | None | PageHeader | Remove |
| Filters | Clickable tiles All sanctions / Minor offense / Major offense; chips All / In progress / Pending verification / Cleared with counts | Static tiles | Match |
| Table | Column heads "ID", "Sanction", "Due", "Status"; rows "S-022", title + "Case No. SDO-2026-016", "Oct 23, 2026", pill | "S-022 · type" + "case · Due … · N days left" | Match |
| Detail | Title + code; tracker card (Assigned / In progress / Complied / Verified) with the due line inside: `schedule` "Due October 16, 2026 · 7 days left" (red when "Due today" / "Overdue by N days"; green `verified` "Verified") | Separate grey due line | Match |
| Details | Rows Sanction ID, Case No., Violation (name + class pill + Sec.), Assigned, Due, Proof ("Not submitted yet" / "2 files submitted · Oct 7"), Officer | Description paragraph only | Match (D15 for Officer) |
| Notes | `warn-soft` "**Note from the SDO:** …" ("Returned by the SDO" when returned); `info-soft` "**Next step:** …" with the four texts: "Complete this sanction, then upload your proof (PDF or DOCX) from the case in My Violations. The SDO reviews it and updates the status." / "The SDO returned this sanction. Fix what they asked for and upload your proof again from the case in My Violations." / "The SDO is reviewing the proof you uploaded. Nothing to do right now." / "Verified by the SDO. Nothing else to do." | Template block + "Upload proof in My violations" button | Match; keep one link to the case (the deck text points there) |
| Timeline | Sentences + by | Labels map | `HistoryList` |

### 5.17 Student Clearance — W79, M89, M90

| Element | Deck | Built | Fix |
|---|---|---|---|
| Header | None; a term chip (`calendar_month`, `#EEF1F4`) shows the current term | PageHeader + term selector chips | Keep a selector only when the student has more than one term, styled as chips |
| Status | "NOT YET CLEARED" / "CLEARED" 32/800 (26 on phone); pills "2 remaining" (pending) + "2 completed" (success); 8 px bar | Close; no pills | Match |
| Requirements | Label "Requirements" (sentence case), rows as staff | Uppercase label | Match |
| Slip | Disabled pill with `lock` "Download clearance slip" + "Unlocks once every requirement is completed."; primary with `download` when cleared (ours opens the print slip page) | `LockedButton` | Restyle |
| How to get cleared | 19/700; numbered 26 px circles: "Get every open case resolved by the SDO." / "Finish your sanctions and get each one verified." / "Attend your guidance exit interview." / "Get the final SDO signature at the SDO office."; bottom box "What to do next" (`arrow_forward`, `info-soft`) with the next requirement's help, "The SDO has not set up your clearance for this term yet." or "You’re cleared for this term. Download your slip." | Check wording | Copy |

### 5.18 Student Appointments — W77, W78, M87, M88

| Element | Deck | Built | Fix |
|---|---|---|---|
| Header | None | PageHeader with the window note | Remove |
| Tabs | Segmented "Upcoming 1" / "History 1" | Small chips without counts | `SegmentedTabs` |
| Card | 58 px date tile (primary when upcoming, grey when past), "Mon, Oct 12 to Sat, Oct 17" 700, "Visit any day · 7:00 AM to 5:00 PM", "Reason" label + text, inner box "Remarks from the SDO" (or "Reason for cancelling"), meta "A-104 · Updated Oct 7, 2026", pill top right | Purpose as title, dates line, notes plain | Match |
| Empty | "No upcoming appointments" + "When the SDO sets an appointment for you, it shows up here and in your inbox." / "No past appointments" + "Completed and cancelled appointments show up here." | One line | Copy |

### 5.19 Inbox and message dialog — W58 to W61, M69 to M72

| Element | Deck | Built | Fix |
|---|---|---|---|
| Header | None; everything inside one card | PageHeader with Refresh and "Mark all as read" | Move into the card |
| Toolbar | Chips All / Important notices / Violations / Sanctions / Appointments with counts (always shown); toggle chip "Unread only" (`mark_email_unread`); text button "Mark all as read" (toast "All notifications marked as read."); 36 px round refresh at the far right (spinner while checking; toast "Up to date.") | Zero-count chips hidden; checkbox; primary button | Match |
| Rows | Fixed 80 px, 6 per page: unread dot, 36 px icon circle tinted by category, title (700 when unread) + category pill, one-line message, "Fri, Oct 9 · 10:40 AM", chevron; the **whole row opens the dialog** and marks it read | Bordered cards, "New" pill, "Open" and "Mark as read" buttons, expand icon, full text | Match |
| Category colours | Violations `bad`, Sanctions `amber`, Appointments `info`, Important notice `pending`, Account `neutral` | Check | Match |
| Footer | "Updates are also emailed to your school Outlook account." (staff: "Showing messages for SDO staff. Notices you publish appear here too."); numbered pager | Note above the list | Move |
| Empty | `notifications_off` + "No messages yet." / "No unread messages here." / "No violation updates." / "No sanction updates." / "No appointment updates." / "No important notices right now." | "Nothing matches." | Copy |
| Dialog | Max 520: 40 px category icon circle, category pill + "Wednesday, October 7, 2026 · 3:15 PM", title 20/700, body (line breaks kept), notice "Instructions and reminders" box (`pending-soft`), "Posted until Oct 17, 2026."; Close (neutral) + primary "Open appointment →" / "Open case" / "Open sanction" / "Open student record" | Generic ConfirmModal "Open" | New dialog |

### 5.20 Student handbook — W80, W81, M91 to M93

| Element | Deck | Built | Fix |
|---|---|---|---|
| Header | None; no Violations / Sanction templates switch for students | PageHeader + tabs (students see the templates tab) | Remove; templates appear inside each entry |
| Filters | Class tiles All offenses / Minor offenses / Major offenses | Chips | Tiles |
| List | Search "Search a violation, section or sanction…"; desktop **table** Violation / Category / Section / Sanction (first sanction, e.g. "Violation slip (1st)"), 52 px rows; phone rows name + "Sec · sanction" + pill; 6 per page; "No handbook entry matches your search." | List rows | Match |
| Entry | Kicker "Handbook entry", title 22/700, "Minor offense · Sec. VI.D.1"; "What the handbook says"; `info-soft` box "Sanction" with "1st offense / 2nd offense / 3rd offense" rows; box "Template and requirements" (`folder_open`): per posted sanction an uppercase sanction name, file tile 44 px + title 15/700 + description + "PDF · 1 KB · Posted Oct 9", secondary "View template" (preview) + primary "Download", "What to prepare" + requirements; none: `info` "The SDO has not posted a template for the sanctions under this offense. Follow the sanction above, and ask the SDO office if you are unsure what to prepare." | "Offense 1" grid, codes "V-001 / H-001" in the subtitle, grey "Template posted" block, link to the templates page | Match |

## 6. Copy catalogue: toasts and modals

### 6.1 Modals (title / body / input / confirm / cancel / tone)

| Action | Deck | Built today |
|---|---|---|
| Reject gate report | "Reject GI-1042?" / "Every violation in this submission is marked not verified. The student gets a short notice." / "Reason (saved to case history)", "e.g. The ID entered did not match the student at the gate." / "Reject submission" / "Keep reviewing" / danger | "Reject this report" / "Reason (required)" / "Reject" |
| Resolve without sanction | "Resolve SDO-2026-012 without a sanction?" / "The case closes with no sanction. Paolo Reyes is notified." / "Reason (saved to case history)", "e.g. First report, settled with a verbal reminder." / "Resolve case" / "Keep open" / ok (green) | "Resolve without a sanction" / "Resolve" |
| Resolve case | "Resolve SDO-2026-011?" / "Sanction S-019 is verified. The case closes and Maria Santos gets an email." / — / "Resolve case" / "Keep open" / ok | No modal |
| Return sanction | "Return S-019 to the student?" / "The sanction goes back to the student. Tell them what is missing." / "What the student needs to fix", "e.g. The service log is missing the supervisor’s signature." / "Return sanction" / "Cancel" / danger | "Return to student" / "Reason (required)" |
| Remarks for the student | "Remarks for the student" / "The student sees these remarks on case SDO-2026-016." / "Remarks", "e.g. Report to the SDO office within 3 days." / "Save remark" / "Cancel" / primary | "Remark" / "Add remark" |
| Reset password | "Reset password for Maria Santos?" / "This creates a one-time temporary password. Their current password stops working, and they must choose a new one at next sign-in." / — / "Create temporary password" / "Cancel" / primary | "Reset password?" / danger |
| Temporary password | "Temporary password created" / "Give this to Maria Santos in person. It works once and is not shown again." / code block / "Done" (single) / ok | Primary "Done" |
| Mark appointment completed | "Mark A-104 as completed?" / "Juan Dela Cruz attended the appointment on Mon, Oct 12 to Sat, Oct 17, 7:00 AM to 5:00 PM. The student is notified." / — / "Mark completed" / "Cancel" / ok | "Mark as completed?" |
| Cancel appointment | "Cancel A-104?" / "The appointment with Juan Dela Cruz on … is cancelled and the slot opens up again. The student is notified." / "Reason for cancelling (shown to the student)", "e.g. The officer is out of the office that day." / "Cancel appointment" / "Keep appointment" / danger | "Cancel this appointment" / "Reason (required)" |
| Reverse requirement | "Reverse “SDO signature”?" / "Reversals are saved to the change log with your name and reason." / "Reason", "e.g. Sanction S-021 was reopened." / "Reverse" / "Keep it" / danger | "Reverse: X" |
| Remove requirement | "Remove “X”?" / "It is removed from Juan Dela Cruz’s checklist for 1st Term 2026–2027. The change is saved to the log." / — / "Remove" / "Keep it" / danger | Different body |
| Add requirement | "Add a clearance requirement" / "It is added to Juan Dela Cruz’s checklist for 1st Term 2026–2027." / "Requirement", "e.g. Return borrowed laboratory equipment" / "Add requirement" / "Cancel" / primary | "Add requirement" / "A custom requirement for this student and term." |
| Remove template file | "Remove the template file?" / "Students will no longer be able to download “f” from the V entry. The written requirements stay." / — / "Remove file" / "Keep it" / danger | No modal |
| Remove a sent proof file | "Remove “f”?" / "The SDO will no longer see this file for sanction S-021. Your other files stay submitted." / — / "Remove file" / "Keep it" / danger | No modal |
| Remove notice | "Remove this notice?" / "“T” is taken down from every student’s bell and inbox. The removal is recorded." / — / "Remove notice" / "Cancel" / danger | Body differs ("Emails already sent cannot be taken back." is worth keeping as a second sentence) |

### 6.2 Toasts (deck wording; `{x}` is filled from the record)

| Action | Toast |
|---|---|
| Validate gate report | "{GI} validated." + " {case} is now treated as Major." when it converts |
| Reject gate report | "{GI} marked not verified." |
| Assign sanction | "Sanction assigned for {case}." |
| Resolve (either way) | "{case} resolved." |
| Verify sanction | "{S} verified." |
| Return sanction | "{S} returned to {name}." |
| Save remark | "Remarks saved for {case}." |
| Record violation | "Case {case} recorded for {name}." (+ " It is the 3rd minor and is treated as Major.") |
| Record violation, invalid (error) | "Enter a valid student ID before saving." / "Pick a violation before saving." |
| Make / edit appointment | "{A} assigned to {name}. They were notified." / "{A} moved to {window}. {name} was notified." / "{A} updated. {name} was notified." / "No changes to save." |
| Complete / cancel appointment | "{A} completed. {name} was notified." / "{A} cancelled. {name} was notified." |
| Clearance | "Clearance set up for {name}." / "Marked “{item}” done for {name}." / "Reversed “{item}”." / "Requirement added." / "Removed “{item}”." |
| Handbook | "Saved changes to {V}." / "Added {V} to the handbook." |
| Templates | "Template uploaded for {S}." / "Template replaced for {S}." / "Template file removed." / "Saved the template details for {S}." |
| Notices | "Notice published to {N} students." / "Notice updated. Students see the new version." / "Notice removed." |
| Proof (student) | "Proof submitted for {S}." / "Removed {file}." / "Replaced {a} with {b}." / error "Replacement failed. Use a PDF or DOCX file." / error "Replacement failed. The file is over 10 MB." |
| Inbox | "All notifications marked as read." / "Up to date." |
| Account | "Password changed." / "Password set. Welcome back." |
| Dashboard refresh | "Up to date." |

A refused API call shows the API's message as an error toast (as today).

## 7. Decisions for the human (logic, API or deliberate differences)

Each has a recommendation. Nothing here is built until answered.

| # | Question | Recommendation |
|---|---|---|
| D1 | The deck's forced "Set a new password" screen has **no current / temporary password field**. Today `POST /auth/change-password` requires the current password. | Allow the API to skip the current password **only** when the session's account has `must_change_password` (the session itself proves the temporary password was just used); refuse reuse of the temporary password. API change + tests; no schema change. |
| D2 | Gate form step 2 filters and labels by Minor / Major, and the success card shows the submission time. Gate options return `{ id, name, section }` only; the submit response has no timestamp. | Add `category` to each gate option and `submittedAt` to the submit response (additive API change, no schema change). |
| D3 | Staff Clearance lists **every student** for a chosen term ("Not set" when none exists) with one-click "Set up clearance"; the dashboard card counts students not set up. Today the API lists only existing clearances. | New staff read `GET /clearance/terms/:year/:term/students` (students left-joined to that term's clearance, paged, searchable); set-up keeps the existing route. Term list = the current term plus terms that have clearances. Query change only, no schema change. |
| D4 | Dashboard "Reports to validate" shows **one row per gate submission** (all its violations in one line, age, "Will escalate"). | Group in the client from the existing reported-cases response (they carry `submissionRef`); no API change unless paging makes groups incomplete, then add `GET /cases/submissions?status=reported`. |
| D5 | "HIGH" tag on case rows: reported and at least 1 day old, or Major. | Build as a pure client rule (display only). |
| D6 | Staff appointment filters: Status, Dates (Today / Next 7 days / Past), On a day. | Add `status`, `range`, `on` query parameters to the staff appointment list (API change + tests). |
| D7 | In-place file preview. A PDF can show in an iframe from the presigned URL. A DOCX needs its bytes in the browser for `mammoth`, which needs CORS on the bucket (a bucket change, human only) or an API route that streams the file. | Add `GET /files/:id/content` and `GET /sanction-templates/files/:fileId/content` next to the existing `/url` routes (same auth and "viewed" rules, stream from storage); preview both types through them; keep Download on the presigned link. |
| D8 | Clearance "Record completion" is one click in the deck; the build asks for optional remarks first. | Follow the deck (one click + toast). The API keeps accepting remarks; the UI simply stops sending them. |
| D9 | Phone layout: the deck stacks list and detail on one page; the build shows one pane at a time and keeps the selection in the URL. | Stack like the deck **and** keep the URL selection (scroll to the detail on select). |
| D10 | The deck shows usernames ("jdelacruz") in search placeholders, the Students list and Account details. Our accounts have no username. | Drop "username"; show the school email where the deck shows a username; search accepts email. |
| D11 | Staff in the deck have **no bell and no Inbox**; SPEC has one shared staff inbox and the build has both, plus a Notices page the deck has no nav entry for. | Keep the staff Inbox nav item (with the unread badge) and Notices; no bell for staff (matches the deck). |
| D12 | Unmatched gate reports: the deck only disables Validate; the build lets staff link the right student first. | Keep "Link student" (SPEC 4.10), restyled into the footer. |
| D13 | Handbook editor: the deck has **one sanction per offense** (a select); the data model and build allow several sanctions per offense. | Keep the data model; show one select per offense and an "Add another sanction" text button that adds a second select for that offense (rarely used). Confirm. |
| D14 | Student My violations lists **active cases only** in the deck ("resolved cases are kept on file by the SDO"); the build also shows closed cases. | Follow the deck: active only, plus a small text link "Show resolved cases" under the list. Confirm. |
| D15 | Student sanction details show "Officer" (who assigned it). | Add `assignedBy` (name) to the student sanction view (additive API change). |
| D16 | The source scales the whole UI with the window width (`zoom` 0.8 to 1.3 from 1536 px). | Do not copy; use the responsive layout. |

### Carried over from the first round (settled, still valid)

Status wording per the deck (case: Pending review, Validated, Sanction in progress, Resolved, Not verified; sanction: In progress, Pending verification, Returned, Cleared; steps Assigned, In progress, Complied, Verified); display codes `SDO-<year>-<n>`, `GI-<1000+rank>`, `S-021`, `A-104`, `V-001` derived not stored; terms shown as "1st / 2nd / 3rd Term 2026–2027" with no term table; important notices with email; clearance slip as a print page, locked until cleared; proof upload lives in My violations; one file per sanction template; remarks are the append-only log; dashboard extras (Will escalate, Last checked, Overdue); student IDs `YYYY-NNNNNNN`.

### Kept on purpose (built differs from the source because SPEC says so)

No in-person "Record compliance", no student statement, no service-hours tracking, no appointment time slots (a 6-working-day window only), no 10 h / 20 h / referral sanction list; due date and instructions on Assign sanction; "Open cases" warning on the clearance requirement; staff Inbox and Notices; print slip page instead of a fake download.

## 8. Slices (each is one task; order matters)

| Slice | Covers | Done when |
|---|---|---|
| **U0 Tokens and primitives** | 4.1, 4.2 | Tokens in `index.css`; `utils/cn.ts`; `Button`, `Field`/`Select`/`Textarea`, `Alert`, `Chip`/`ChipGroup`, `SegmentedTabs`, `StatTile`, `ClassTile`, `Pill`/`Tag`, `ListCard`/`GroupHead`/`SelectableRow`, `DetailTable`, `HistoryList`, `FileRow`, `Pager`, `SectionLabel`, `EmptyBlock`, `ActionFooter`, `StudentLookup`, each with a test (keyboard, aria, variants). Old `buttonClass`/`fieldClass` kept until the last page moves, then removed. |
| **U1 Feedback** | 4.3 | Toast, ConfirmModal v2 (tone, custom cancel, disabled until reason, code block, sheet), page states with exact copy, nudge; FilePreview modal once D7 is answered. Tests for focus trap, Escape, timing. |
| **U2 Chrome** | 5.1, 5.10 | Sidebar, collapse, top bar, bell popover, account menu, Account and Password modals, phone header, tab bar, left drawer, full-width main, MasterDetail v2; no `PageHeader` on any app page (breadcrumb only); nav icons and labels. |
| **U3 Public** | 5.2, 5.3 | Sign-in, set a new password (D1), gate form (D2). |
| **U4 Staff dashboard** | 5.4 | Layout, cards, rows, copy (D3, D4). |
| **U5 Cases and Record violation** | 5.5, 5.6 | Queue, workspace, footers, preview use, Resolve modal, copy; Record violation page and the C### bug. |
| **U6 Students** | 5.7 | List, record, tile tabs, lists, reset flow. |
| **U7 Appointments** | 5.8 | Filters (D6), detail, Make / Edit form with the calendar and review. |
| **U8 Staff Clearance** | 5.9 | Term chips, all-students list (D3), detail, direct completion (D8), history. |
| **U9 Handbook and templates (staff)** | 5.11, 5.12 | Violations page, Add violation, Sanction templates page and route, per-offense selects (D13). |
| **U10 Student record pages** | 5.14, 5.15, 5.16 | Dashboard, My violations with the new upload panel (D14), My sanctions (D15). |
| **U11 Student info pages** | 5.17, 5.18, 5.19, 5.20 | Clearance, Appointments, Inbox and message dialog, Handbook. |
| **U12 Notices** | 5.13 | Master-detail notices page. |
| **U13 Final pass** | all | No raw hex in `.tsx`; copy audit against section 6; three widths for every screen; keyboard pass; delete unused components (`Kpi`, `RowItem`, per-page `Tile`, old `Pagination`). |

## 9. Out of scope

Dark mode; shadcn initialisation (a human decision); the source's viewport zoom (D16); any rule change beyond section 7; anything SPEC removed.
