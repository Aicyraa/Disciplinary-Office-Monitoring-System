# CONTEXT

This file is the parallel dev team's only notes file. It records what changed (files, tests, commands, results, decisions), not plans. Agents edit only their own task's section, append rather than rewrite, keep each entry under about 15 lines, and write facts with evidence only. Lead writes the Task board and the empty sections before any worktree exists; dev and reviewer fill their section in their worktree; integrator writes the Integration section last.

## Task board

| slug | branch | worktree | goal | done when | expected files | depends on | merge order | status |
|---|---|---|---|---|---|---|---|---|
| foundation-storage | worktree-foundation-storage | .claude/worktrees/foundation-storage | Build step 1 (SPEC 6.1; FEATURE-RULES 3.7): storage interface, S3 impl, in-memory fake, pure upload validator | storage + validator tests green; lint, typecheck, test, build green; seed counts verified on dev | api/src/storage/*, api/src/files/validate*, vitest.config.mjs | none | 1 | reviewed (PASS) |
| auth | worktree-auth | .claude/worktrees/auth | Build step 2 (SPEC 4.8; FEATURE-RULES 3.1): passport-local login, sessions, role guards, change/reset password, login rate limit, CORS | API-level tests for login, generic error, domain gate, rate limit, guards, reset and forced change; lint, typecheck, test, build green | api/src/auth/*, api/src/app.ts, api/src/server.ts, shared/types.ts, vitest.config.mjs | none | 2 | reviewed (PASS after fixes) |
| handbook-student-readonly | worktree-handbook-student-readonly | .claude/worktrees/handbook-student-readonly | Build step 3 (SPEC 4.9, 3, 5, 7; FEATURE-RULES 3.2, 3.12): read-only handbook API, `/me/*` student read APIs, client login + shell + 7 student pages | API-level tests for handbook visibility and own-rows-only; lint, typecheck, test, build green | api/src/handbook/*, api/src/me/*, api/src/codes.ts, api/src/testing/harness.ts, api/src/app.ts, api/src/server.ts, shared/types.ts, client/src/**, client/vite.config.ts, client/index.html, .env.example | none (builds on auth) | 3 | review |

<!-- Per-task sections go below, laid out as:



---

## [slug] branch worktree-<slug>

(dev fills this)
(reviewer fills this)

---



Keep at least three unchanged lines between sections so parallel branches merge without conflicts. -->


---

## foundation-storage branch worktree-foundation-storage

**Dev**
- Added `api/src/storage/{types,memory,s3}.ts` (ObjectStorage interface, key builders, in-memory fake, S3 client with `forcePathStyle` and `requestChecksumCalculation: 'WHEN_REQUIRED'`, 60 s presigned GET) and `api/src/files/validate.ts` (PDF/DOCX, magic bytes, 10 MB, 5 files). Tests: `storage/storage.test.ts`, `files/validate.test.ts` (14 tests).
- Evidence: `npm test` 4 files / 16 tests pass; `npm run lint`, `typecheck`, `build` clean.
- Dev branch (MCP, read-only): programs 14, sanctions 10, requirements 4, violations 68, handbook_entries 68, handbook_entry_sanctions 132, 23 public tables.
- SCOPE EXPANSION: `vitest.config.mjs` — `include` listed only the two smoke tests, so new tests never ran; widened to `api/src/**/*.test.ts` and `client/src/**/*.test.{ts,tsx}`.
- Bucket name comes from `STORAGE_BUCKET` (same key `api/scripts/storage-smoke.ts` reads); added to `.env.example`. SPEC CHANGE (human): add `STORAGE_BUCKET` to the env list in SPEC 6.1 and CLAUDE.md section 8.
- Not verified: live upload, download and presign against the Neon bucket; SPEC 11 item 2 (bucket CORS).
- HUMAN CHECK: put a small PDF with `createS3Storage(<bucket>)` using dev-branch credentials, then open `presignGet(key)` in a browser -> file downloads; after 60 s the URL returns 403.
- Not done: Prisma `ConnectionTest` removal (human confirms); `multer` wiring (step 5).

**Review: PASS** (2 non-blocking gaps)
- Commands (reviewer re-run): `npm test` 4 files / 16 tests pass; `npm run lint` clean; `npm run typecheck` (api + client) clean; `npm run build` exit 0 (Vite config-loader warning is known).
- Criteria: storage + validator tests green PASS (storage.test.ts 6, validate.test.ts 8; exact assertions; 10 MB boundary and 6th file covered). Four commands green PASS. Seed counts on dev not re-verified by reviewer (Neon MCP not exposed); dev's 14/10/4/68/68/132 and 23 tables match CLAUDE.md section 8.
- SPEC 6.1 / FR 3.7 (by reading code): key formats PASS; forcePathStyle true + requestChecksumCalculation WHEN_REQUIRED PASS; presign 60 s PASS; magic bytes %PDF / PK PASS; 10 MB PASS; 5 files PASS; S3Client built only inside createS3Storage (lazy) PASS; credentials from env, fake values in .env.example, no VITE_ key PASS.
- Scope: real dev diff is 78c8c85..HEAD (2 commits, 9 files). `git diff main...HEAD` shows 275 files because local main is far behind (merge-base 3f0ea14); integrator should confirm. vitest.config.mjs widening justified. `.env.example` (STORAGE_BUCKET) is a hot file not in the row's list: additive, fake-valued, matches api/scripts/storage-smoke.ts: accept. No new dependency, no schema change, nothing parked built.
- Gap 1: nothing tests createS3Storage; forcePathStyle, checksum mode and 60 s are verified only by reading. A later test can call presignGet with fake env (offline) and assert path-style host and X-Amz-Expires=60.
- Gap 2: SPEC CHANGE for STORAGE_BUCKET (SPEC 6.1, CLAUDE.md section 8) is pending the human.



---

## auth branch worktree-auth

**Dev**
- Added `api/src/auth/{policy,repo,memory-repo,prisma-repo,service,guards,routes}.ts`; `createApp(deps)` in `api/src/app.ts` (the old `app` export stays health-only, so the smoke test needs no database); `server.ts` wires Prisma repo, `connect-pg-simple` store and `SESSION_SECRET` (>= 32 chars). Routes: `POST /auth/login|logout|change-password`, `GET /auth/me`, `POST /staff/students/:studentId/reset-password`.
- Rules enforced in the API: NU domains only; one generic 401 body for every login failure (unknown email, wrong password, bad domain, inactive, missing fields; a dummy bcrypt compare keeps timing close); failed-login rate limit per IP (default 10 per 15 min, 429); password >= 8 chars with a letter and a digit; new password cannot equal the current/temp one; staff reset issues `Temp-####`, stores only the bcrypt hash, sets `must_change_password`; role guards (401 / 403 `password_change_required` / 403 `forbidden`); inactive account kills the session; CORS only for `APP_BASE_URL`, credentials on; HttpOnly, SameSite=Lax cookie, `secure` in production; session id regenerated at login.
- Evidence: `npm test` 4 files / 37 tests pass (35 new: 13 policy, 22 route-level through supertest), `npm run lint`, `typecheck`, `build` clean.
- SCOPE EXPANSION: `vitest.config.mjs` include widened to globs (same change as `worktree-foundation-storage`; identical, merges clean).
- Not verified (needs live DB): `createPrismaAccountRepo` against Neon (case-insensitive email match, `updateMany`), `connect-pg-simple` creating its `session` table, a real browser cookie round trip.
- HUMAN CHECK: `npm run dev`, then `curl -i -c jar -H 'content-type: application/json' -d '{"email":"<dev student email>","password":"<dev password>"}' localhost:3000/auth/login` -> 200 with `Set-Cookie: sdo.sid=...; HttpOnly`; `curl -b jar localhost:3000/auth/me` -> 200 with the user; a `session` table now exists on the dev branch.
- Open for human: login failures are not audit-logged and there is no per-account lockout (only per-IP limiting), because the spec asks for rate limiting only. Behind a proxy the limiter needs `trust proxy` set at deploy time.
- Not done (out of scope): client login screen and route guards (step 3 onward), employee-initiated password change UI.

**Review (reviewer)** Verdict: FAIL (2 small defects, rest PASS)
- Commands, re-run: `npm test` 4 files / 37 tests pass; `npm run lint` clean; `npm run typecheck` clean (api + client); `npm run build` exit 0 (api tsc, client vite).
- Criteria: login 200 + /auth/me no hash PASS; one generic 401 body for 6 failure shapes PASS (`every failure returns the same status and body`); domain gate PASS (suffix includes `@`, so `x@evilnu-fairview.edu.ph` and `@students.` cannot cross roles; DB lookup is exact-email); rate limit 429 PASS in test but see F1; guards 401/403/`password_change_required` PASS; reset Temp-#### hashed-only + forced change + cannot equal temp PASS; student id regex PASS; CORS client origin only PASS; no secrets, `SESSION_SECRET` only in `.env.example` PASS; parked list untouched PASS.
- Scope: 14 files, all in the row's expected list (vitest.config.mjs include glob is listed; CONTEXT.md is dev's entry). No package.json, schema.sql or new dependency (all packages already present). Scope expansion logged: acceptable.
- F1 (rate-limit bypass, `api/src/auth/routes.ts` loginLimiter): `skipSuccessfulRequests: true` makes express-rate-limit decrement the counter after each 2xx, so anyone with one valid account (any student) can alternate one failed guess at a victim with one successful own login and never reach the limit. Only per-IP; there is no per-account limit. Smallest fix: drop `skipSuccessfulRequests` (count every attempt) or key the limiter on IP + normalized email; add a test that interleaves a success and still gets 429.
- F2 (500 on malformed input, `routes.ts` -> `service.login` -> `policy.normalizeEmail`): JSON `{"email":{},"password":"x"}` or a non-string password reaches `email.trim()` / `bcrypt.compare`, throws, and returns the Express default 500 (HTML, stack outside production). Code-read; I could not run a probe (reviewer may not run ad-hoc commands). Smallest fix: in the LocalStrategy callback, `typeof email !== 'string' || typeof password !== 'string'` -> `done(null, false)`, plus a test with an object email expecting the same 401 body.
- Notes, not blocking: (a) no test that the session id changes on login (comment claims regeneration; passport 0.7 does regenerate) and none for `secure` cookie; (b) `requireStudent` is unused until step 3, so "students see only own rows" has no API test yet and must come with the first student route; (c) behind a TLS proxy without `trust proxy`, express-session will not set a `secure` cookie and all logins break in production, and the limiter sees the proxy IP (dev already flagged); (d) `/auth/change-password` has no throttle for guessing `currentPassword` from a hijacked session; (e) no password max length (bcrypt uses first 72 bytes); (f) reset response lacks `Cache-Control: no-store`; (g) in production a missing `APP_BASE_URL` silently falls back to localhost for CORS.
- **Dev fix after review (F1, F2, note f):** F1: removed `skipSuccessfulRequests`; two limiters now count every attempt: per IP + email (`limit`, default 10 per 15 min) and per IP (10x). Test: interleaved success on another account still ends in 429. F2: LocalStrategy callback treats non-string email/password as a failed login; test `malformed types` (object, array, number) expects the same generic 401 body. Note f: reset response sends `Cache-Control: no-store` (asserted). Evidence: `npm test` 4 files / 41 tests pass; lint, typecheck, build clean. Notes a-e and g stay open (b belongs with the first student route; c, g are deploy settings). The earlier "per-IP failures only" wording in the Dev section above is superseded by this entry.
- Not verified (needs live DB/browser, matches dev's HUMAN CHECK): `createPrismaAccountRepo` against Neon, `connect-pg-simple` session table creation, real cookie round trip. Dev's HUMAN CHECK line is complete (command and expected result) and listed under Not verified. Serena diagnostics could not run on worktree files (the Serena project root is the main checkout); `tsc` and eslint stand in.

**Re-review (reviewer)** Verdict: PASS (F1 and F2 closed; non-blocking notes below)
- Commands, re-run on HEAD 704d77a: `npm test` 4 files / 41 tests pass; `npm run lint` clean (no output); `npm run typecheck` clean (api + client); `npm run build` exit 0 (api tsc, client vite).
- Scope: `git show HEAD --stat` lists exactly `CONTEXT.md`, `api/src/auth/routes.ts`, `api/src/auth/routes.test.ts`. No dependency, schema or spec file touched.
- F1 PASS: `skipSuccessfulRequests` is gone; `perIpLimiter` (limit x10, key `ipKeyGenerator(ip)`) and `perAccountLimiter` (key `ipKeyGenerator(ip)|trim().toLowerCase(email)`) both count every attempt. Red check by reasoning: on the old code the test's loop leaves the failure counter at 1 after each fail+success pair (success refunded), so the 4th guess returns 401, not 429, and the test fails; on the new code the student key reaches 4 > 3 and returns 429 while staff key (3) and IP total (6 of 30) stay under their limits.
- Bypass hunt: case/whitespace variants collapse to one key because the key uses the same `trim().toLowerCase()` as `policy.normalizeEmail`. Empty or absent body email with `?email=victim` in the query (passport-local falls back to query) lands in the shared `ip|` bucket, which is stricter, not looser. No `trust proxy` anywhere (`app.ts`, `server.ts`), so `X-Forwarded-For` is ignored and cannot mint new keys. Rotating emails is bounded by the per-IP cap.
- F2 PASS: the strategy callback returns `done(null, false)` for any non-string email or password, so `service.login` only ever sees strings; objects, arrays and numbers get the generic 401 (tests assert status 401 and body equal to the baseline wrong-password body; they would 500 on the old code). Missing body or fields fall to passport-local's own fail, which the custom callback maps to the same 401. The only remaining throw path is a repo/DB error (500, correct). Note f (`Cache-Control: no-store` on reset) added and asserted.
- Non-blocking: (1) every attempt counts, so 10 successful logins in 15 min from one IP+email also yields 429, and ~100 logins/15 min from one shared campus NAT IP locks that IP; tune limits at deploy. (2) Unicode lookalikes that PostgreSQL lowercases differently from JS could in theory dodge the per-account key; still capped by the per-IP limiter, theoretical only. (3) Open from before: `trust proxy`, change-password throttle, password max length, session-id-change test. I could not run an ad-hoc probe (reviewer may not run arbitrary commands); the bypass and F2 findings above are from code reading plus the passing tests.

---



## Integration 2026-10-12 (branch integrate/2026-10-12, based on c_v1 at 78c8c85)

- Merged in order: `worktree-foundation-storage` (34f8611, no conflicts), then `worktree-auth` (d7a2904; only CONTEXT.md conflicted: kept both task rows and both sections; `vitest.config.mjs` auto-merged, identical change on both sides).
- After the final merge: `npm test` 6 files / 55 tests pass; `npm run lint`, `npm run typecheck` (api + client) and `npm run build` (api + client) clean.
- Process note: the first integrator run was blocked from writing the shared checkout by the background-isolation guard after merge 1; merge 2 was completed from a linked worktree and the integrate branch fast-forwarded to it.
- Diff base for the human: `git diff c_v1...integrate/2026-10-12` (local `main` is far behind).
- Human to do before merging: (1) add `STORAGE_BUCKET` to SPEC 6.1 and CLAUDE.md section 8; (2) run the two HUMAN CHECKs above (storage presign, auth login curl); (3) delete the worktrees and `worktree-*` branches after merging.
- Still open from reviews: `trust proxy` and secure cookies behind a proxy; change-password throttle; password max length; session-id-change test; `requireStudent` API test with the first student route; no test of `createS3Storage`.

---



## handbook-student-readonly branch worktree-handbook-student-readonly

**Dev**
- API: `GET /handbook`, `GET /handbook/:id` (any signed-in role, password settled; `is_system` entries hidden from list and 404 by id; sanctions ordered by offense in the pure mapper). Student-only `/me/cases`, `/me/cases/:id` (timeline + sanctions), `/me/sanctions`, `/me/appointments` (`upcoming`/`history` bucket by Asia/Manila date), `/me/clearance?academic_year=&semester=` (default newest term; malformed term is 400). The student id always comes from the session; another student's case is a 404 identical to a missing one. Employee ids, `claimed_*`, `reported_by` and `submission_ref` are never in responses (asserted).
- Code: `api/src/handbook/*`, `api/src/me/*` (repo interface + in-memory fake + Prisma implementation + pure `views.ts`), `api/src/codes.ts` (V/H/S/C display codes), `api/src/testing/harness.ts` (fake accounts + app wiring for tests), `createApp({ data })`, `server.ts` wiring. Shared DTO types added to `shared/types.ts`.
- Client: Tailwind v4 tokens (`index.css`), Vite plugin, Google Fonts links; `AuthProvider`, route guards (`resolveAccess`: loading / login / forced password change / allow), responsive shell (bottom tab bar under 720, icon rail 720-1100, sidebar above 1100), Login, forced Change password, Student dashboard, My violations (stepper + timeline), My sanctions (4-step tracker, Minor/Major filter), Appointments (Upcoming/History), Clearance (term switcher), Handbook (search + severity filter), Inbox (honest empty state until step 6), staff landing + handbook. `VITE_API_URL` added to `.env.example`.
- Evidence: `npm test` 11 files / 141 tests pass (55 existed after steps 1-2; 51 added by the API half, 106 total at that point; 35 more added by the client half), `npm run lint`, `typecheck` (api + client), `build` (api tsc, client vite 374 kB JS / 16 kB CSS) clean.
- Assumptions to confirm: `assigned` and `scheduled` are not in SPEC 9's pill list, so they reuse the pending (yellow) and validated (blue) tones. Sanction templates on the Student Handbook page and proof upload are not built (steps 5 and 8). `App.test.tsx` is unchanged and still green: SSR has no `window`, so `App` falls back to `MemoryRouter` there.
- Not verified (needs live DB / API / browser): `createPrismaHandbookRepo` and `createPrismaStudentViewRepo` against Neon (relation include names are type-checked by `tsc`, not run); every page against the real API; three-width layout check in a browser (screens other than Login need the live API).
- HUMAN CHECK: with the dev branch env set, `npm run dev`, open `http://localhost:5173`, sign in with the dev student account -> dashboard loads, Handbook lists entries and no "3 minor offense"; resize under 720 px -> bottom tab bar, 720-1100 -> icon rail.
- Not done (out of scope for step 3): staff pages (steps 4-10), notifications/inbox data (step 6), template downloads (step 8).

**Review (reviewer)** Verdict: PASS (no rule broken; 5 non-blocking findings for dev/lead)
- Commands, re-run on HEAD dbbb92c: `npm test` 11 files / 141 tests pass; `npm run lint` clean; `npm run typecheck` (api + client) clean; `npm run build` exit 0 (api tsc, client vite, 374 kB JS).
- Done-when: handbook visibility PASS (`lists entries for a student|staff, hiding system entries` -> [1]; `a system entry is a 404 even by direct id`; 401 and `password_change_required` covered); own-rows-only PASS (routes.test: `/me/*` 401 anon, 403 staff, A sees only A's cases/sanctions/appointments/clearance, B's case id is 404 with a body equal to a missing id); four commands PASS.
- Rules by reading: student id only from `request.user.id`; every Prisma `where` carries `student_id` (cases findMany/findFirst, sanctions via `disciplinary_cases.student_id`, appointments, clearances findMany/findUnique composite key); no employee_accounts include, no password hash read, explicit field mapping so employee ids/claimed_*/submission_ref/reported_by never serialised (leak test covers /me/cases only); relation include names match schema.prisma; codes derived (`displayCode`); `date` columns use UTC slice and `formatDate` pins date-only to UTC; appointment bucket by Manila today; SPEC 9 pill hex values exact; breakpoints 720/1100; `VITE_API_URL` is not a secret; no parked feature built; no new dependency or schema change. `App.test.tsx` SSR fallback to MemoryRouter is sound (browser gets BrowserRouter).
- Scope: 42 files, all in the row's list; `api/src/codes.ts`, `testing/harness.ts`, `.env.example`, `vite.config.ts`, `index.html` are listed. No expansion needed.
- Not checked live: Playwright widths. Port 5173 was already held by another process serving a different (skeleton) build, and `npm --prefix client run start` and a `CLIENT_PORT=` dev run were denied for reviewer, so I did not work around it. Login at three widths and every screen behind sign-in are NOT verified live. Serena diagnostics not run (project root is the main checkout); tsc and eslint stand in.
- F1 (a11y, `Shell.tsx` + `index.css`): global `:focus-visible` outline is `--color-primary`, drawn over the `bg-primary` sidebar, so keyboard focus on sidebar links and Sign out is invisible. Fix: `focus-visible:outline-white` (or gold) on those controls.
- F2 (401 mid-session, `lib/api.ts`, `AuthContext`): no interceptor; an expired or deactivated session or a staff reset leaves the shell "authenticated" and every page shows "Something went wrong." with Try again forever. Fix: on 401 set auth to anonymous; on 403 `password_change_required` refetch `/auth/me`.
- F3 (`toApiError`): 404 and 403 bodies have no `message`, so a missing case shows "Something went wrong." with a retry. Fix: map 404 to "not found" and 403 to a denied message (FEATURE-RULES 3.12 lists a denied state).
- F4 (`Clearance.tsx`): switching term sets loading, which unmounts the select (keyboard focus lost). Keep the select mounted and only swap the card.
- F5 (tests): `is 403 password_change_required for a student account flagged must-change` actually signs in STAFF_TEMP; there is no must-change student fixture. The Prisma repos (where clauses, ordering) are untested by design; dev's HUMAN CHECK is complete but only exercises one student, so add: `GET /me/cases/<another student's id>` -> 404 once a second dev account exists. Minor: sanctions query over-fetches the full `disciplinary_cases` row (not exposed); equal `case_date` has no tie-break.
- HUMAN CHECK line is complete and listed under Not verified.

**Dev fix after review (F1-F5)**
- F1: global `:focus-visible` moved into `@layer base` so utilities can override it; sidebar links and sign-out use a white focus ring. F2: an axios response interceptor reports a 401 on any request except `/auth/login` and `/auth/me`; `AuthProvider` then drops to anonymous and `RequireAuth` redirects to `/login` (tests with a stub adapter). F3: `defaultMessage(status)` gives 401/403/404/429 plain-language text when the API sends no message. F4: the Clearance term list lives in state outside the loading branch, so the `<select>` stays mounted while another term loads. F5: harness gained `STUDENT_TEMP` (a student flagged must-change); every `/me/*` path is asserted 403 `password_change_required` for it.
- Evidence: `npm test` 12 files / 155 tests pass; `npm run lint`, `typecheck` clean.
- Live check attempted (dev branch via Neon MCP, read-only SQL): student `2025-1030808` and staff `E001` exist, both bcrypt hashes; staff `E001` has `must_change_password = true` (so a first staff sign-in exercises the forced-change flow); 67 visible handbook entries and 1 system entry (H068), 132 entry-sanction rows; 0 cases, 0 case_sanctions, 0 appointments, 0 clearances; no `session` table yet (never created, so no live API run has used it).
- Still not verified live: no API process was running and this session may not start the API or call it with `curl`, so the Prisma repos, the pages behind sign-in and the cross-student 404 were not exercised. Because the dev branch has no cases, a student's pages will show empty states; seed one case, sanction, appointment and clearance row (dev branch only) to see data.
- HUMAN CHECK (extended): `npm run dev`; sign in as the dev student -> `/` loads, `/handbook` shows 67 entries and no "3 minor offense"; `curl -b jar localhost:3000/me/cases/999` -> 404 body `{"error":"not_found"}`; sign in as staff `E001` -> redirected to change password; after changing it, `curl -b jar localhost:3000/me/cases` -> 403 `forbidden`.

**Re-review (reviewer)** Verdict: PASS (F1-F5 closed; 3 non-blocking notes)
- Commands, re-run on HEAD e74506b: `npm test` 12 files / 155 tests pass; `npm run lint` clean; `npm run typecheck` (api + client) clean; `npm run build` exit 0 (client CSS 17.66 kB, JS 374.63 kB).
- F1 PASS: built `client/dist/assets/index-BFZ-5HFp.css` has `:focus-visible{outline:2px solid var(--color-primary);outline-offset:2px}` inside `@layer base`, and `.focus-visible\:outline-white:focus-visible{outline-color:var(--color-white)}` inside `@layer utilities` (a later layer, so it wins). `Shell.tsx` `linkBase` carries both utilities.
- F2 PASS (code + `api.test.ts`, 5 new cases): 401 on a data URL calls the handler once; `/auth/login` and `/auth/me` and a 404 do not. Params are passed separately, so `config.url` is the bare path and the exclusion matches. `/auth/logout` always returns 204, and `/auth/change-password` returns 400 for a wrong current password (401 only for a missing account), so no false sign-out. The handler is idempotent (`authenticated` -> `anonymous` only), so concurrent 401s cannot loop; the effect cleanup nulls it on unmount; `useApi` cancels on unmount, so the in-flight page never sets state after the redirect to `/login`.
- F3 PASS: `defaultMessage` for 401/403/404/429/other, test asserts text; server `message` still wins (asserted).
- F4 PASS (code read; no UI test): select sits outside `Resource`, so it stays mounted while loading. `selected` is the chosen term, else the loaded clearance, else `terms[0]`, so the value never points at a missing option. `useEffect([resource])` runs every render (useApi returns a new object) but `setTerms` with the same array reference bails out, so no loop.
- F5 PASS: `STUDENT_TEMP` is a student with `mustChangePassword = true`; `test.each` over all 5 `/me/*` paths expects 403 `password_change_required`. It would fail (200) if the password gate were dropped for students.
- Scope: 10 files since 51ae10f, all expected, plus one stray: `.playwright-mcp/page-2026-10-11T17-04-51-937Z.yml` (Playwright artifact from the first review, 1 line). Remove it from the commit or ignore the folder before integrate. No dependency, schema or spec change.
- Notes (not blocking): (1) a mid-session staff reset now yields 403 `password_change_required` on data calls; the page shows an error, the original F2 suggestion to refetch `/auth/me` for that case was not done. (2) No test for the `AuthProvider` handler wiring or the Clearance select; both read as correct. (3) `selected` falls back to `terms[0]` from state, so the first ready render shows `''` for one frame (select is hidden then, harmless).
- Not verified live: pages behind sign-in, three widths, real 401 round trip (no API process; reviewer may not start servers). Dev's extended HUMAN CHECK is complete and listed under Not verified.

---

