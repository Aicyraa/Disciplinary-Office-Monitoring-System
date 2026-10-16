# Performance SPEC (build step 11)

Status: **draft, not accepted** (2026-10-16). Written against branch `c_v1` at `b53daaa`. Nothing here is built until the human accepts it. Every slice that needs a new dependency, a schema change or a new endpoint says so and stops at a checkpoint (`DEPENDENCY:` / `SPEC CHANGE:`), per CLAUDE.md sections 3 and 9.

## 1. Goal and rules

Make the portal feel fast on a real network and cheap to run on the Neon free plan, without changing behavior and without making the code harder to debug.

- **Measure first.** No optimization is merged without a before and an after number in `CONTEXT.md` (section 3). A change that does not move a number is reverted.
- **Behavior does not change.** Every rule stays enforced by the API (CLAUDE.md section 1). Caching must never show a state the API would refuse.
- **Layering stays** (CLAUDE.md section 10). A cache or batch lives in a repository, service or hook, never in a route or a page.
- **No new dependency without a checkpoint.** Where the plain-code option is close to as good, it wins.
- **Out of scope:** realtime (WebSocket, SSE, LISTEN/NOTIFY: decided against on 2026-10-15, polling is enough), Redis or any second data store, microservices, rewriting the ORM, a CDN before hosting is known (D1), anything the spec marks parked or removed.

## 2. Sources and what was verified

| What | How it was checked |
|---|---|
| The `c_v1` code (`api/src/app.ts`, `server.ts`, `config/prisma.ts`, `services/notifications/scheduler.ts`, `repositories/cases/prisma-store.ts`, `repositories/notifications/prisma.ts`, `client/src/App.tsx`, `hooks/useApi.ts`, `hooks/useNavBadges.ts`, `vite.config.ts`, `pages/staff/Dashboard.tsx`, `db/schema.sql` indexes) | Read in this session. Findings in section 4 cite file and line. |
| The reference article (Medium, "Performance Optimization Techniques for Full-Stack Applications") | **Not read.** The fetch was denied in this session and no web search tool was available. Nothing in this file is quoted or taken from it. |
| Standard guidance (web.dev Core Web Vitals; Neon docs on pooling, autoscaling and scale-to-zero; Prisma docs on query optimization and connection pools; Express "performance best practices"; Vite build and chunking docs; React `lazy` and `Suspense`) | **Not looked up.** The techniques below are well-known, but the exact option names and defaults must be confirmed against these docs by the dev agent (Context7 for library APIs) before code is written. |

Open item: a human or a later session with web access reads the article and the pages above and adds anything missing as a new slice.

## 3. Phase 0: baseline (do this before any slice)

Slice **P0**. No behavior change. Output goes into one `CONTEXT.md` section "Performance baseline".

1. **Client bundle.** Run `npm --prefix client run build`; record each emitted JS/CSS file's raw and gzip size (the Vite output prints both) and the total JS loaded by `/login` and by a staff first load.
2. **API latency.** A dev-only timing middleware (`middleware/timing.ts`, off in production, no dependency) logs method, route pattern, status, milliseconds and the number of Prisma queries per request. Record median and p95 for: `GET /auth/me`, staff cases list (plain, with `q`, grouped), sanction queue, appointments list, clearance roster, notifications list, student dashboard reads, gate token + submit.
3. **Query plans.** On the **development branch only** (Neon MCP, read-only plus SQL), run `EXPLAIN (ANALYZE, BUFFERS)` for the slowest list queries in step 2 and for the notification sweep query. Record rows, scan type, time.
4. **Cold start.** Record the time of the first request after the dev branch has been idle more than 5 minutes (Neon wakes compute), and the time of the next request.
5. **Compute activity.** Record whether the API alone (no browser open) keeps the dev compute active (section 4, finding B5). Neon MCP: list branch computes and operations before and after one idle hour.
6. **Browser.** Lighthouse (Chrome devtools, no install) on `/login`, the staff dashboard and the student dashboard, mobile profile: LCP, INP, CLS, total transfer.

Proposed budgets (D5 to confirm): list endpoints p95 under 300 ms from the API host once warm; first load of `/login` under 150 KB gzip of JS; LCP 2.5 s or less, INP 200 ms or less, CLS 0.1 or less on a mid-range phone profile (these three are the usual Core Web Vitals "good" thresholds).

## 4. Findings in `c_v1` (what the code does today)

| # | Finding | Evidence | Why it matters |
|---|---|---|---|
| B5 | **The server wakes the database every minute, all day.** The notification sweep runs on `setInterval` every 60 s and queries `notifications` for `email_status = 'pending'` even when nothing is pending. | `server.ts:44`, `scheduler.ts:52`, `repositories/notifications/prisma.ts:118` | Neon scales compute to zero after 5 minutes idle. A query every 60 s means it may never sleep, which can use up the free plan's compute hours and defeats scale-to-zero. The query itself is cheap (partial index `ix_notif_email`); the wake-up is the cost. **Must be measured (P0 step 5) before it is called a bug.** |
| B5b | Staff browsers poll two list endpoints every 60 s for sidebar badges, and they keep polling in a background tab. | `hooks/useNavBadges.ts:12-36` | Wakes the database and the API for numbers only; fetches a full case page and the full sanction queue (with joins) to read `total` and one count. |
| B1 | No response compression. | `app.ts` (no `compression`; `helmet`, `cors`, `json` only) | JSON lists are text and compress several times smaller. Unless the host already compresses (D1), every list is sent raw. |
| B2 | Staff case list makes up to 5 sequential or parallel database round trips per request: optional code lookup, page + count + status `groupBy` (parallel), then case codes, then submission codes (two more, sequential). | `repositories/cases/prisma-store.ts:501-531` | The database is in `aws-ap-southeast-1`; each round trip pays network latency. Fewer round trips beat faster SQL here. |
| B3 | Stage order and "focus" load every matching case key, sort in Node, then load the page. | `prisma-store.ts:487-498` | Fine at hundreds of rows (the comment says low thousands); cost grows with the table. Low priority until measured. |
| B6 | Two connection pools with default sizes: the Prisma `pg` adapter pool and a separate `pg` Pool for sessions. No timeouts or `max` set. | `config/prisma.ts:12`, `server.ts:79` | Unbounded by intent, easy to exhaust the pooled endpoint on a small plan; a hung connection has no timeout. |
| B7 | Case-insensitive `contains` searches (`ILIKE '%x%'`) on names, ids and violation types across several lists. | `prisma-store.ts:447-455`, `appointments/prisma-store.ts:178`, `clearance/prisma-store.ts:217,270`, `me/prisma-repo.ts:221` | A leading wildcard cannot use a normal index, so each search scans the table. Harmless at a few thousand rows; verify with `EXPLAIN` before adding anything. |
| B8 | Read-mostly lookups (handbook, violations, sanctions, programs, requirements) hit the database on every request. | `repositories/handbook/prisma-repo.ts`, `gate/prisma-store.ts` options | Changes only when staff edit the handbook; a good, safe cache candidate. |
| F1 | **Every page is imported eagerly**, so one bundle carries staff, student, public and account pages. | `client/src/App.tsx:1-26`, no `lazy`, no `manualChunks` in `vite.config.ts` | A student opening `/login` downloads staff screens. First load is the biggest, easiest client win. |
| F2 | `useApi` has no cache and no request cancellation; the staff dashboard fires 6 requests on mount, two of which (`staffCases` reported/validated) the badge hook also asks for. | `hooks/useApi.ts`, `pages/staff/Dashboard.tsx:27-33`, `useNavBadges.ts:23` | Duplicate and stale-response work; navigating back always shows a spinner. |
| F6 | `mammoth` is a client dependency with no import in `client/src`, `api/src` or `client/tests`. | `client/package.json`, grep | Dead weight in `npm ci`, and `UI-POLISH-SPEC.md` section 3 already says it is no longer needed (D7: PDF only). Removal needs a `DEPENDENCY:` checkpoint. |

Not yet inspected (audit items, no claim made): font and icon loading (`Material Symbols Outlined` is large unless subset), image sizes of `seal.png` / `hero.png`, search-box debouncing in `useStudentLookup`, the proof-upload path (buffered or streamed), and foreign-key columns without an index. Slice P0 or the slice that owns each item checks them first.

## 5. Slices

Order is by value over risk. Each slice is one task (CLAUDE.md section 3): tests first for logic, then `npm test`, `npm run lint`, `npm run typecheck`, `npm run build`, plus its before and after numbers.

### Client

**F1. Route-level code splitting.** Load each page with `React.lazy` and one `Suspense` boundary inside `Shell` that shows the existing spinner state; keep the login and the public gate form out of the staff and student chunks. Add `build.rollupOptions.output.manualChunks` for stable vendor chunks (react and router; `@base-ui/react`) so app-code deploys do not invalidate them. The `App` smoke test renders on the server with a memory router: keep it green (lazy pages are not rendered there; the test only needs the shell and routes). Done when: `/login` JS gzip is at or below the budget and the staff-only code is absent from it (the build report shows it); every route still renders (Playwright at 390, 900 and 1280 px with the API mocked). Expected files: `client/src/App.tsx` (hot), `client/vite.config.ts`, maybe `components/layout/Shell.tsx`. **Hot file: needs a merge order.**

**F2. Request layer: dedupe, short cache, cancel.** Inside `hooks/useApi.ts` (no library): an in-flight map so two hooks asking the same key share one request; an optional `staleMs` (default 0, so nothing changes unless a page opts in) that returns cached data instantly and refetches in the background (stale-while-revalidate); an `AbortController` per request passed to axios (`signal`) so leaving a page cancels it; mutations call an `invalidate(prefix)` so a saved case never shows old data. Opt in only for read-mostly data (handbook, programs, terms). Done when: a unit test proves two simultaneous identical loads make one call, a mutation invalidates, and an unmounted page cancels. If this grows past about 150 lines, stop and raise `DEPENDENCY: TanStack Query` as a decision instead.

**F3. Polling hygiene and counts-only badges.** `useNavBadges` and the unread count: poll only while `document.visibilityState === 'visible'`, refetch on tab focus, back off to 2 minutes when the tab was idle, never poll in parallel with a manual reload. Replace the two list calls with one counts call (B4). Done when: a hidden tab makes no requests (test with fake timers and a visibility stub) and one badge refresh is one request returning only numbers.

**F4. Staff dashboard requests.** Replace the 6 mount requests with the data the screen shows. Preferred: one `GET /staff/dashboard` summary (B4). Fallback with no API change: shared cache from F2 plus lazy-loading the below-the-fold panels. Done when: dashboard mount issues no more than 2 requests and its render count is flat in React Profiler (the recent render-loop fix, `d6b8a7a`, gets a regression test if it has none).

**F5. Assets and fonts (audit first).** Check how Public Sans and Material Symbols load. Targets: `font-display: swap`, self-hosted or `preconnect`ed font files, the icon font subset to the icons actually used (or replaced with the already-installed `lucide-react`, a UI decision), images resized and given `width`/`height`, `hero.png` only on the screens that show it. Done when: the Lighthouse report shows no render-blocking font and no layout shift from images.

**F7. Search inputs.** Debounce 250 to 300 ms, minimum length where the rule allows, cancel the previous request (F2). Done when: a test types five characters quickly and sees one request.

**F8. Remove unused dependency.** `DEPENDENCY: remove mammoth` (F6). Human approves; then it is a one-line `package.json` plus lockfile change by the human.

### API

**B1. Compression.** Prefer the host or reverse proxy (D1). If the API must do it: `DEPENDENCY: compression` and `app.use(compression())` after `helmet`, with a size threshold (about 1 KB) and not for the file download route. Done when: a staff cases list response shows `content-encoding` and the transferred size drops (record both).

**B2. Fewer round trips on list endpoints.** Start with the staff case list: fetch case codes and submission codes in the same `Promise.all` as the page query when they do not depend on it, or compute them in one raw query keyed by the page's ids; skip `findCaseIdByCode` unless the text looks like a code (it already does). Target: no more than 3 sequential database waits for a list request. Repeat for the sanction queue, appointments and clearance roster if P0 shows them above budget. Repositories only; memory fakes must return the same shapes so route tests are unchanged. Done when: the P0 query-count column drops and the existing route tests pass unmodified.

**B4. Counts and summary endpoints (new API).** `GET /staff/summary` (or fields added to an existing endpoint) returning only the numbers the sidebar and dashboard need (reported cases, pending sanction verifications, upcoming appointment count, and so on), computed with `count` / `groupBy` and no `include`. Needs `shared/types.ts` (hot) and the SPEC 7 API sketch updated: `SPEC CHANGE: add GET /staff/summary (counts only, staff-only, no new rule)`. Student side: no change.

**B5. Neon-friendly background work.** This is a decision (D2), not a code change, until P0 step 5 confirms the problem. Options, safest first:
  1. Keep the sweep but make it idle-aware: after a pass that found nothing, lengthen the interval (for example 60 s to 5 min), and return to 60 s on the next `kick` (every notification write already calls `scheduler.kick`). The sweep's job, retrying rows after an outage, still runs, just less often when quiet.
  2. Run the sweep only while the API has served an authenticated request in the last N minutes, plus once at boot.
  3. Leave it as is if the measured compute use fits the plan.
  Whatever is chosen: the pure scheduling rule lives in a tested function (`services/notifications/`), the interval constants stay in one place, and the notification idempotency rules (POWER-AUTOMATE.md section 5) do not change. Anything that lets a notification wait longer than the spec allows is a `SPEC CHANGE:`.

**B6. Pools and timeouts.** Set `max`, `idleTimeoutMillis` and `connectionTimeoutMillis` explicitly for both pools (values from the Neon pooled-endpoint docs and the plan's connection limit; confirm with Context7 and the Neon skill before choosing). Keep the pooled `DATABASE_URL` for runtime. Keep the single "retry once on cold start" behavior and put it in one helper, not per query. Done when: a test with a fake pool proves a timeout surfaces as a clean 503 through `sendError`, and a cold-start first request succeeds in the manual check.

**B7. Indexes only where a plan proves it.** Using the P0 plans: add a foreign-key or filter index only for a query that is slow and scans. If trigram search is justified, it is `CREATE EXTENSION pg_trgm` plus a GIN index on the searched expressions. `SPEC CHANGE:` for every index: the human edits `db/schema.sql` and the matching `SPEC.md` section together, applies it to the dev branch first, then production. No agent runs DDL on production (CLAUDE.md section 8).

**B8. Cache read-mostly lookups.** In the repository (not the route): a small in-process cache with a TTL (for example 5 minutes) for handbook entries, violations, sanctions, programs and requirements, cleared by the handbook-admin and template write paths so staff never see their own edit missing. Safe only while there is one API instance (D1); with more than one, use a short TTL (30 to 60 s) or skip. Also send `Cache-Control: private, max-age=60` on those GETs. Never cache anything student-specific or any list that a rule filters per user. Done when: a test proves the second read makes no query and an admin write makes the next read fresh.

**B3 (conditional). Database-side ordering.** Only if P0 shows stage-order lists above budget: replace the in-memory key sort with `ORDER BY CASE status ...` in a raw query. The ordering rule (`compareCases`) is in `domain`; keep one copy of the order and test both against the same fixtures.

**B9 (audit). Files.** Check that proof uploads respect the size limit before buffering, and that downloads redirect to a short-lived signed URL or stream, instead of passing whole files through the API. Report; fix only if it is wrong.

### Infra and operations (human decisions, no agent runs these)

**I1.** Put the API in the same region as the database (`aws-ap-southeast-1`) or as close as the host allows. Round trips are the main per-request cost (B2); distance multiplies them.
**I2.** Confirm the client is served with long-lived caching for hashed assets (`/assets/*-<hash>.js`, `Cache-Control: public, max-age=31536000, immutable`) and no-cache for `index.html`; gzip or Brotli at the host.
**I3.** Production build for the API (`NODE_ENV=production`) is already required by `server.ts`; confirm the host sets it (Express is slower in development mode).

## 6. Order of work

1. **P0** baseline. Everything else waits for its numbers.
2. Quick wins that need no decision: **F1**, **F3** (without the new endpoint), **F7**.
3. After D1 and D3: **B1**, **I1**, **I2**.
4. After D2 and the compute measurement: **B5**.
5. **B2**, then **B4** with **F4**, then **F2**, **B6**.
6. Data-driven only: **B7**, **B3**, **B8**.
7. Audits **F5**, **B9** and the `mammoth` removal **F8** at any time.

Hot-file merge order for the batch: `client/src/App.tsx` (F1) then `shared/types.ts` (B4) then `api/src/routes/index.ts` (B4).

## 7. Decisions for the human

| # | Decision | Recommendation |
|---|---|---|
| D1 | Where are the API and the client hosted (and how many API instances)? | Needed for I1, I2, B1 and B8. Single instance keeps B8 simple. |
| D2 | Notification sweep policy (B5) after the compute measurement. | Option 1, idle-aware interval. |
| D3 | Compression at the host, or `DEPENDENCY: compression` in the API (B1)? | Host if it offers it; otherwise the dependency. |
| D4 | May an agent add indexes once a plan proves the need (B7)? | Yes, as `SPEC CHANGE:` only; the human applies the DDL. |
| D5 | Are the proposed budgets in section 3 right for this office's devices and network? | Accept as the starting point; tighten after P0. |
| D6 | Remove `mammoth` now (F8)? | Yes. |
| D7 | Allow a counts endpoint (B4)? | Yes: it removes the heaviest recurring request. |

## 8. Done for the whole step

- The P0 table in `CONTEXT.md` has a before and an after column for every slice built, and each shipped slice moved its number.
- All budgets in section 3 are met or a written reason says why not.
- `npm test`, `npm run lint`, `npm run typecheck`, `npm run build` are green; no route test or rule was weakened to make a slice pass.
- Not verified without the human: production latency, Neon compute hours over a full day, host compression and cache headers. Each is a `HUMAN CHECK:` line with the exact command or click path.
