# Repository facts

## Package boundaries
- Root, `api/`, and `client/` are separate npm packages, each with its own `package-lock.json`. Root has no npm workspace configuration.
- API uses Express 5 and TypeScript 7; client uses React 19, Vite 8 and TypeScript 5.9. Existing unrelated dependency declarations remain intact.
- `api/src/app.ts` exports the app without listening; `api/src/server.ts` owns startup. GET `/health` returns `{ "status": "ok" }` without a database.
- `client/src/main.tsx` mounts the minimal title-only App. `shared/types.ts` owns `HealthResponse`; API and client API boundary import it with `import type`, without runtime cross-package imports.
- API uses its own TypeScript `7.0.2` compiler; root lint tooling uses TypeScript `5.9.3` with typescript-eslint `8.71.1`. Do not load the API compiler into the root ESLint parser or assume TS7-only syntax is supported.

## Existing code and commands
- `neon.ts` is the existing Neon configuration; it registers `hello.ts` as a function. This pair does not establish runtime or deployment commands.
- Root commands: `npm test`, `npm run lint`, `npm run typecheck`, `npm run build`, `npm run dev`, `npm start`.
- Each child exposes `test`, `lint`, `typecheck`, `build`, `dev`, `start`; invoke with `npm --prefix api ...` or `npm --prefix client ...` from root. Child lint delegates the full scoped root lint check.
- Test dependencies are root-only (Vitest 4.1.6). Frozen smoke paths: `api/src/app.test.ts`, `client/src/App.test.tsx`; child test scripts filter the root runner. No browser/test database required.
- Root builds require both package commands to succeed; concurrently stops the other command on failure. Root dev/start terminate both owned processes on interruption or either command's exit.
- API dev runs TypeScript with tsx (no watcher) and loads the root `.env` via `--env-file-if-exists=../.env`; build uses API tsc, excludes smoke tests and emits `api/dist/api/src/server.js`. Shared types outside `src` require the wider compiler root; their imports are erased. API start runs that emitted server. Port comes from `SERVER_PORT` in the root `.env` (falls back to `PORT`, then 3000).
- Client dev uses strict loopback port from `CLIENT_PORT` in the root `.env` (default 5173); start uses Vite preview on strict loopback port 4173 after build. Preview is local verification, not production hosting. Vite reads the root `.env` (`envDir` is the repo root); only `VITE_`-prefixed keys reach browser code, so never put secrets under that prefix.
- Root ESLint checks authored API/client/shared TypeScript, smoke tests and setup JS/TS configs using recommended non-type-aware rules; node_modules, dist, generated output and handoffs are ignored. No auto-fix verification.
- README is a temporary description, not setup/run instructions.

## Local configuration
- The repo-root `.env` is the single source of environment variables for both `api/` and `client/`; do not create `api/.env` or `client/.env`. `.env.example` (root, fake values only) documents the keys: `CLIENT_PORT`, `SERVER_PORT`, `DATABASE_URL` (pooled), `DATABASE_URL_UNPOOLED` (direct). Variables supplied externally in the process environment take precedence, and a missing `.env` file is not an error.
- `.env` and `opencode.json` are ignored local configuration, not portable setup instructions. Never copy local credentials into documentation.

## Prisma and existing Neon
- API owns Prisma CLI/client/pg adapter, all pinned to 7.10.0 (Prisma 7 format; do not use 8.x release candidates or v6 syntax). The schema uses the `prisma-client` generator with `output = "../generated/prisma"` and a datasource block with `provider` only: connection URLs live in `prisma.config.ts` (`datasource.url` = `DATABASE_URL_UNPOOLED`, direct, for the CLI), never in `schema.prisma`. The only model is the throwaway `ConnectionTest` (`connection_test` table), created on the Neon branch with `db push` at the human's explicit request; no migrations or domain models.
- Root `.env.example` has fake Neon-shaped values only. Human owns actual values in the ignored root `.env`: pooled `DATABASE_URL` for the pg runtime adapter, direct `DATABASE_URL_UNPOOLED` (schema `directUrl`) for the Prisma CLI. API dev/start and Prisma scripts load it with `node --env-file-if-exists=../.env`.
- `api/prisma.config.ts` holds schema location and the CLI datasource URL. Prisma 7 does not load `.env` files; the package scripts load the root `.env` explicitly via `node --env-file-if-exists=../.env`.
- API scripts: `npm --prefix api run prisma:validate`, `prisma:generate`, `prisma:push` (live), `prisma:smoke` (live insert). Generate before API typecheck/build on a fresh clone: the client is generated source in ignored `api/generated/prisma`, not in node_modules.
- Generated client lives in ignored `api/generated/prisma`; do not hand-edit or commit it. `src/prisma.ts` imports it from `../generated/prisma/client.js` and builds the client with the pg adapter. Builds are ignored under each package's `dist`. No generated client source is shared with the browser.
- `api/src/prisma.ts:createPrismaClient` is an explicit lazy initializer; health/server do not import or construct it. Live connectivity was verified once via `prisma:smoke` (insert + count on `connection_test`). Live operations (`prisma:push`, `prisma:smoke`) run only when the human explicitly asks; preview with `prisma migrate diff` first and never accept data loss without confirmation.

## Verification status and remaining gaps
- Builder observed both smoke tests green, lint/typecheck/build checks passing, model-free Prisma validate/generate passing with fake variables, and package/root dev/start HTTP smoke checks with owned-process cleanup. Independent QA and human full-diff review/acceptance remain required; see `.agent-work/initial-setup/04-build-notes.md` for exact evidence.
- Root ESLint 9.39.2 reports upstream end-of-support deprecation; tseslint.config has a deprecation hint. Vite currently builds/runs but warns that its future native config loader would require an ESM config/package declaration. Do not upgrade approved tooling or change versions without a checkpoint.
- This is setup only: no business UI, auth behavior, client API requests, deployment or live database verification. README remains temporary.

## UI skills (`.agents/skills`)
- Project skills live in `.agents/skills` and are pinned by `skills-lock.json`. Load a skill only when the task matches it; do not apply several competing visual-style skills to the same screen.
- Product context: this is an internal, data-heavy office monitoring tool (records, tables, forms, status views), not a marketing site. Prefer calm, dense, readable UI over showpiece landing-page design.
- Client stack for UI work: React 19, Tailwind CSS v4 (`@tailwindcss/vite`), `@base-ui/react`, `class-variance-authority`, `clsx`/`tailwind-merge`, `lucide-react`, `react-hook-form`, `react-router-dom`. The `shadcn` CLI is a client devDependency but there is no `components.json` yet; initializing it is a setup decision, not an automatic step.
- Use by default for client UI: `tailwind-design-system` (tokens, variants, responsive), `shadcn` (only once `components.json` exists), `vercel-composition-patterns` (component APIs), `typescript-advanced-types` (typing; client compiles with TS 5.9, API with TS 7 - keep syntax valid for the package being edited), `vercel-react-best-practices` (React items only; ignore Next.js/server-component guidance, this is a Vite SPA).
- Visual direction, choose at most one per task: `minimalist-ui` (default for forms, tables, dashboards) or `industrial-brutalist-ui` (only if the human asks for a data-terminal look). Use `redesign-existing-projects` when restyling screens that already exist.
- Not for this app unless the human explicitly asks: `design-taste-frontend` and `design-taste-frontend-v1` (landing pages/portfolios; v2 itself says not dashboards), `gpt-taste` (GSAP/AIDA marketing pages), `high-end-visual-design` (agency-style motion), `stitch-design-taste` (Google Stitch DESIGN.md), `brandkit`, `imagegen-frontend-web`, `imagegen-frontend-mobile` and `image-to-code` (require image generation, produce images or image-first workflows).
- `full-output-enforcement` may be applied to any task that needs complete, unabridged files.
- Neon skills (`neon*`) describe Neon platform features; they do not override the Prisma/Neon rules above. Never run live, migration or branch operations because a skill suggests it.
- Skill examples may add dependencies (GSAP, fonts, icon sets, Next.js, framer-motion). Do not add or upgrade dependencies without a checkpoint; build with what the client already has.
- Accessibility floor for every UI change: visible focus states, keyboard operability, labelled form controls, sufficient contrast, usable at phone width. Keep smoke tests (`client/src/App.test.tsx`) green; UI work does not by itself introduce client API requests, auth behavior or business logic.
