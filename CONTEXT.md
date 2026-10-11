# CONTEXT

This file is the parallel dev team's only notes file. It records what changed (files, tests, commands, results, decisions), not plans. Agents edit only their own task's section, append rather than rewrite, keep each entry under about 15 lines, and write facts with evidence only. Lead writes the Task board and the empty sections before any worktree exists; dev and reviewer fill their section in their worktree; integrator writes the Integration section last.

## Task board

| slug | branch | worktree | goal | done when | expected files | depends on | merge order | status |
|---|---|---|---|---|---|---|---|---|
| foundation-storage | worktree-foundation-storage | .claude/worktrees/foundation-storage | Build step 1 (SPEC 6.1; FEATURE-RULES 3.7): storage interface, S3 impl, in-memory fake, pure upload validator | storage + validator tests green; lint, typecheck, test, build green; seed counts verified on dev | api/src/storage/*, api/src/files/validate*, vitest.config.mjs | none | 1 | reviewed (PASS) |
| auth | worktree-auth | .claude/worktrees/auth | Build step 2 (SPEC 4.8; FEATURE-RULES 3.1): passport-local login, sessions, role guards, change/reset password, login rate limit, CORS | API-level tests for login, generic error, domain gate, rate limit, guards, reset and forced change; lint, typecheck, test, build green | api/src/auth/*, api/src/app.ts, api/src/server.ts, shared/types.ts, vitest.config.mjs | none | 2 | reviewed (PASS after fixes) |

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

