# CLAUDE.md — SDO Portal (NU Fairview Student Discipline Office)

This repo builds a real, database-backed version of the SDO Portal. A Claude Design prototype exists; it is a visual and behavioral reference only. **The spec is the source of truth.** If code, this file and the spec disagree, stop and ask the human.

Read order for every agent: this file, then your task row in `CONTEXT.md`, then the spec section and feature rules the row cites. Do not read the whole spec for one task.

## 1. Source of truth (read before any feature work)
All paths are under `docs/sdao-handoff/`.
- `SPEC.md` — final spec v2: decisions (section 0), data model (3), business rules (4), screens (5), storage/email (6), API sketch (7), design system (9), build order (10), open items (11).
- `FEATURE-RULES.md` — the per-feature rules (3.1 to 3.12), moved out of this file. Read the one for your feature before coding.
- `POWER-AUTOMATE.md` — the two Power Automate flows, payloads, API contract and shared-secret rules.
- `db/schema.sql` — final PostgreSQL schema (23 tables). `db/seed.sql` — handbook, sanctions, programs, requirements.
- `design-reference/sdo-portal.source.html` — prototype in Claude Design's `<x-dc>` format. Not React: re-implement in this stack. Use it for layout and behavior, never copy its in-memory state, fixed date or plain-text passwords.
- `assets/seal.png`, `assets/hero.png` — brand images.

Rules for working from the spec:
- Before building a feature, read its section in `SPEC.md` (`FEATURE-RULES.md` says which section, and lists the rules that must not be broken). Do not invent rules; if the spec is silent or ambiguous, ask.
- The prototype is front-end only, so **every rule must be enforced by the API**, never only by the UI.
- Settled decisions (SPEC section 0) are not reopened: snake_case, flexible sanction due date, manual clearance, no student statement, 6-working-day appointment windows (Mon–Sat, 7:00 AM–5:00 PM), Asia/Manila time (store UTC `timestamptz`), 3-minors-of-any-kind escalation, gate form stays a web form.
- Keep the schema and spec in sync: a schema change means updating `db/schema.sql` and the matching spec section in the same change.

## 2. What we are building
Three audiences, one app:
- **Student** — signs in with an NU student email; sees their own cases, sanctions, appointments, clearance, notifications, handbook. 7 pages.
- **Staff (SDO officer)** — signs in with an NU staff email; runs the whole workflow. 10 pages. All staff share one inbox (single department).
- **Public / gate** — a 3-step web "Violation Form", no login (captcha + rate limit).

Stack: Express 5 + TypeScript API, Prisma 7 on Neon Postgres, React 19 + Vite SPA, Neon Object Storage (S3-compatible, private bucket) for files, Power Automate Premium for email.

## 3. Working with the agent team (rules specific to this repo)
The generic flow, launch commands and the five roles are in the "Parallel dev team" section at the end of this file. These rules are about the SDO Portal itself.

**Tasks.** One task is one slice of one feature that fits in one session. Its row in `CONTEXT.md` cites the spec section and the feature rule (for example `SPEC 4.2; FEATURE-RULES 3.5`). The row is the whole brief.

**Hot files (conflict magnets).** `api/src/app.ts`, the API route registry, `api/prisma/schema.prisma`, `shared/types.ts`, the client router and `client/src/App.tsx`, `.env.example`, `CONTEXT.md`. Two tasks in one batch may both list a hot file only if lead gave them a merge order. Additive edits to a registry (one new route, one new type, one new env key) are resolved by keeping both sides.

**Files no team agent edits.**
- `docs/sdao-handoff/**` (spec, schema, seed). If a task needs a spec or schema change, write `SPEC CHANGE: <what and why>` in your CONTEXT.md section and stop. The human decides.
- `package.json` and the three lockfiles. If a task needs a dependency, write `DEPENDENCY: <package and why>` and stop.
- `.env`, `.env.local`, `api/generated/**`, `skills-lock.json`, `.claude/**`, `CLAUDE.md`.

**No live operations.** No agent runs `prisma:push`, `prisma:smoke`, migrations, SQL against Neon, Neon branch operations, bucket changes, or any call to a real Power Automate flow. Claude Code's permission rules deny them for every agent. Build and test against fakes. Whatever only a live database, bucket or flow can prove goes into the task's CONTEXT.md entry as `HUMAN CHECK: <exact command or click path> -> <expected result>` and under "Not verified".

**Shape code so tests need no database.**
- Queries live in small repository functions that take a client or transaction as a parameter.
- Business rules (escalation counting, sanction transitions, upload validation, appointment windows, notification idempotency) live in pure functions or services that tests run against in-memory fakes.
- Every rule from section 1 ("enforced by the API, never only by the UI") gets an API-level test, not only a component test.
- Test data is fake. Never real names, ids, emails or discipline records.

**Reviewer evidence for UI work.** Check three widths (under 720, 720 to 1100, over 1100) only for screens that render without the live API. State which screens could not be checked live.


## 4. Features, one by one
The per-feature rules that must not be broken live in `docs/sdao-handoff/FEATURE-RULES.md`. Read the section for your feature before coding, and the matching `SPEC.md` section. If `FEATURE-RULES.md` and `SPEC.md` disagree, the spec wins: stop and ask the human.

| Feature | SPEC | FEATURE-RULES | Build step |
|---|---|---|---|
| Authentication and accounts | 4.8 | 3.1 | 2 |
| Handbook and violations | 4.9, 3 | 3.2 | 3 |
| Cases | 4.1, 4.10 | 3.3 | 4 |
| Gate reports (public form) | 4.10, POWER-AUTOMATE 3 | 3.4 | 9 |
| Escalation (tests first) | 4.2 | 3.5 | 4 |
| Sanctions and proof | 4.3, 6.1 | 3.6 | 5 |
| Files and sanction templates | 6.1 | 3.7 | 1 (smoke), 5, 8 |
| Appointments | 4.5 | 3.8 | 7 |
| Clearance (manual) | 4.4 | 3.9 | 7 |
| Notifications and timelines | 4.6, 6.3, POWER-AUTOMATE | 3.10 | 6 |
| Power Automate integration | POWER-AUTOMATE.md | 3.11 | 6, 9 |
| Students, dashboards, other screens | 5 | 3.12 | 3, 7, 10 |


## 5. Data model rules (SPEC 3, `db/schema.sql`)
- 23 tables. Primary keys are **numeric identity columns**; only `student_accounts` and `employee_accounts` use text ids. Workbook codes (V001, S001, C0001) are display codes derived in the app, never stored or typed by hand.
- Enums are CHECK constraints in SQL. Timestamps are `timestamptz` (UTC); display in Asia/Manila.
- Prisma cannot express the appointment exclusion constraint, the CHECK constraints or the partial/expression indexes. Keep them in `schema.sql` / hand-written migrations. **`prisma db push` must never overwrite them.** Flow: apply `schema.sql` + `seed.sql`, then `prisma db pull`, then maintain Prisma models to match.
- `connect-pg-simple` creates its own `session` table; it is infrastructure, not part of the ERD.
- The throwaway `ConnectionTest` model/table is setup scaffolding; remove it when the real models land (human confirms first).

## 6. Build order (SPEC 10)
1. Neon: schema + seed, bucket and credentials, one upload/download smoke test. 2. Auth. 3. Handbook + read-only student pages. 4. Case workflow + escalation (tests first). 5. Sanctions + proof. 6. Notifications + Power Automate (Flow 2, callback, retry). 7. Appointments → Clearance. 8. Templates + handbook admin. 9. Public gate form + captcha + Flow 1. 10. Polish.
Work one feature at a time; finish and verify it before the next.

## 7. Design and UI (from the prototype, SPEC 9)
- Fonts: Public Sans (text), Material Symbols Outlined (icons). Colors: primary `#35408E` (active nav `#262F73`), gold `#F2D46B`, text `#1C2445`, muted `#5B6576`, page `#F2F5F5`, borders `#DDE3E8`, danger `#B42318`, success `#1E6B3E`. Status pill colors are in SPEC section 9; reuse them exactly.
- This is an internal, data-heavy office tool: calm, dense, readable, not a marketing site.
- Client stack: React 19, Tailwind CSS v4 (`@tailwindcss/vite`), `@base-ui/react`, `class-variance-authority`, `clsx`/`tailwind-merge`, `lucide-react`, `react-hook-form`, `react-router-dom`. No `components.json` yet: initializing shadcn is a human decision.
- Accessibility floor: visible focus, keyboard operability, labelled controls, sufficient contrast, usable at phone width.

### UI skills (`.claude/skills`, copied from `.agents/skills`, which `skills-lock.json` pins)
- Load a skill only when the task matches. Never apply several competing visual-style skills to one screen.
- Default for client UI: `tailwind-design-system`, `shadcn` (only once `components.json` exists), `vercel-composition-patterns`, `typescript-advanced-types` (client TS 5.9, API TS 7: keep syntax valid for the package you edit), `vercel-react-best-practices` (React items only; ignore Next.js guidance).
- Visual direction, at most one per task: `minimalist-ui` (default) or `industrial-brutalist-ui` (only if asked). Use `redesign-existing-projects` when restyling existing screens.
- Not for this app unless asked: `design-taste-frontend`, `design-taste-frontend-v1`, `gpt-taste`, `high-end-visual-design`, `stitch-design-taste`, `brandkit`, `imagegen-frontend-web`, `imagegen-frontend-mobile`, `image-to-code`.
- `full-output-enforcement` may be applied when complete, unabridged files are needed. Neon skills describe platform features and never override the Prisma/Neon rules below. Skill examples may add dependencies; do not add or upgrade dependencies without a checkpoint.

## 8. Repository facts

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
- `.env`, `.claude/settings.local.json` and `.claude/worktrees/` are ignored local config. Never copy credentials into documentation or commits.
- CORS: configure the `cors` package on the Express API to allow only the client origin. (CORS is not a database setting.)

### Prisma and Neon
- API owns Prisma CLI, client and pg adapter, all pinned to 7.10.0 (Prisma 7 format; no 8.x release candidates, no v6 syntax). Generator `prisma-client`, `output = "../generated/prisma"`; datasource block has `provider` only; connection URLs live in `api/prisma.config.ts` (`DATABASE_URL_UNPOOLED` for the CLI). Prisma 7 does not load `.env`; scripts use `node --env-file-if-exists=../.env`.
- Runtime uses the pooled `DATABASE_URL` through the pg adapter. `api/src/prisma.ts:createPrismaClient` is a lazy initializer; health/server do not construct it.
- Scripts: `npm --prefix api run prisma:validate`, `prisma:generate`, `prisma:push` (live), `prisma:smoke` (live). Run `prisma:generate` before API typecheck/build on a fresh clone. `api/generated/prisma` is generated and ignored: never hand-edit or commit it.
- **Live Prisma/Neon operations (`prisma:push`, `prisma:smoke`, migrations, applying SQL to Neon, branch operations, bucket changes) run only when the human explicitly asks.** Preview with `prisma migrate diff` first, and never accept data loss without confirmation. A skill suggesting a live operation is not permission. Claude Code's permission rules deny these commands for every agent; the human runs them in their own terminal.
- Neon free plan: 1 GB Postgres, 5 GB object storage, compute scales to zero after 5 minutes (expect a slow first request after idle; retry once on cold start).

## 9. Working agreements
- Do not add or upgrade dependencies without a checkpoint. The spec already approves `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`, `multer` and `mammoth`; confirm anything else. Team agents cannot edit package files; they report `DEPENDENCY:` and stop.
- Do not store or log real credentials, student data or discipline records in tests, fixtures or docs. Use fake data.
- Small, reviewable changes. After each task: run lint, typecheck, tests and build, and state what you could not verify (live DB, Power Automate, Neon bucket). Independent review (the reviewer agent) and human acceptance (the human reads the integration branch) remain required.
- Do not build anything the spec marks parked or removed: notices/announcements, the student statement, auto-clearance, the Power Automate growth path.
- README is a temporary description, not setup instructions.
- Every agent ends its final chat message with "Concepts to check" (1 to 3 items, plain language, no formula-only explanations). It is chat output, not a file.

## Parallel dev team

### Project snapshot
- INSTALL_CMD: `npm ci`, `npm --prefix api ci`, `npm --prefix client ci`, then `npm --prefix api run prisma:generate` (local, no database access)
- TEST_CMD: `npm test` · LINT_CMD: `npm run lint` · TYPECHECK_CMD: `npm run typecheck` · BUILD_CMD: `npm run build`
- DEV_CMD: `npm run dev` (reviewer only)
- Not available to any agent: `prisma:push`, `prisma:smoke`, migrations, Neon, bucket and Power Automate operations. Only the human runs those.

### Flow
```
Main checkout:  claude --agent lead        then /batch task A; task B     writes the task board
Each task:      claude --worktree <slug> --agent dev   then /work <slug>  one terminal per task
Main checkout:  claude --agent integrator  then /integrate                merges reviewed branches
Human:          git diff main...integrate/<date>, then merge to main yourself
```

### Agents
| Agent | Where | Job |
|---|---|---|
| lead | main checkout | splits tasks, checks file overlap, writes the task board. Never edits code. |
| scout | subagent of lead | read-only file prediction, at most 10 lines |
| dev | one worktree | red/green TDD on one task, commits on `worktree-<slug>`, calls reviewer |
| reviewer | subagent of dev | re-runs everything, writes a Review block. Never edits code. |
| integrator | main checkout | merges PASSed branches into `integrate/<date>`, tests after each merge |

### Rules
- One task per worktree and one session per worktree. Dev works only in its worktree on its own `worktree-<slug>` branch.
- No agent pushes. No agent touches `main` or `master`. Commits only on `worktree-*` (dev) and `integrate/*` (integrator).
- "Done" needs evidence (command output), never a claim.
- Stay inside the task's expected files. If more are needed, stop and write `SCOPE EXPANSION: <file> - <why>` in `CONTEXT.md`.
- `CONTEXT.md` is the only notes file. No spec, plan, report or scratch markdown files.
- Team agents never edit `docs/sdao-handoff/**`. A needed schema or spec change is reported as `SPEC CHANGE:` (section 3) and the human edits `db/schema.sql` and the matching `SPEC.md` section together.

### MCP usage
- Serena symbol tools before reading whole files; `get_diagnostics_for_file` after edits. Only dev uses Serena editing tools.
- Context7 before using any third-party API. Playwright is for the reviewer only.
- Each new worktree needs its own `npm ci` runs and `serena project index`.

### Permissions
Permissions are allow or deny only (`.claude/settings.json`, `.claude/hooks/role-guard.mjs`). If an action is denied, do not look for a way around it; report it.

### Learning rule
Every agent ends its final chat message with "Concepts to check": 1-3 items, each in 2-4 plain-language steps, no formula-only explanations.

### Compounding rule
When an agent repeats a mistake, propose one line for this file and tell the human; the human edits it.