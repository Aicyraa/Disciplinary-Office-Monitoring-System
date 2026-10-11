# CONTEXT

This file is the parallel dev team's only notes file. It records what changed (files, tests, commands, results, decisions), not plans. Agents edit only their own task's section, append rather than rewrite, keep each entry under about 15 lines, and write facts with evidence only. Lead writes the Task board and the empty sections before any worktree exists; dev and reviewer fill their section in their worktree; integrator writes the Integration section last.

## Task board

| slug | branch | worktree | goal | done when | expected files | depends on | merge order | status |
|---|---|---|---|---|---|---|---|---|
| auth | worktree-auth | .claude/worktrees/auth | Build step 2 (SPEC 4.8; FEATURE-RULES 3.1): passport-local login, sessions, role guards, change/reset password, login rate limit, CORS | API-level tests for login, generic error, domain gate, rate limit, guards, reset and forced change; lint, typecheck, test, build green | api/src/auth/*, api/src/app.ts, api/src/server.ts, shared/types.ts, vitest.config.mjs | none | 2 | review |

<!-- Per-task sections go below, laid out as:



---

## [slug] branch worktree-<slug>

(dev fills this)
(reviewer fills this)

---



Keep at least three unchanged lines between sections so parallel branches merge without conflicts. -->


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

(reviewer fills this)

---

