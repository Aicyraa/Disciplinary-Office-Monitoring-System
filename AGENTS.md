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
- API dev runs TypeScript with tsx (no watcher); build uses API tsc, excludes smoke tests and emits `api/dist/api/src/server.js`. Shared types outside `src` require the wider compiler root; their imports are erased. API start runs that emitted server. Default port 3000; PORT may be supplied externally.
- Client dev uses strict loopback port 5173; start uses Vite preview on strict loopback port 4173 after build. Preview is local verification, not production hosting. Vite does not load `.env` files (`envDir: false`).
- Root ESLint checks authored API/client/shared TypeScript, smoke tests and setup JS/TS configs using recommended non-type-aware rules; node_modules, dist, generated output and handoffs are ignored. No auto-fix verification.
- README is a temporary description, not setup/run instructions.

## Local configuration
- `.env` and `opencode.json` are ignored local configuration, not portable setup instructions. Never copy local credentials into documentation.

## Prisma and existing Neon
- API owns Prisma CLI/client/pg adapter, all pinned to 6.19.2. The model-free PostgreSQL schema uses prisma-client-js with `engineType = "client"`; no migrations or domain models.
- `api/.env.example` has fake Neon-shaped values only. Human owns actual values in ignored `api/.env` and must supply variables externally: pooled `DATABASE_URL` for the pg runtime adapter, direct `DIRECT_URL` for CLI. Application and Prisma scripts deliberately do not auto-load real `.env` files.
- `api/prisma.config.ts` specifies schema location and causes Prisma 6 CLI to skip implicit environment-file loading; do not copy Prisma 7 datasource/config examples into this setup.
- API scripts: `npm --prefix api run prisma:validate`, `npm --prefix api run prisma:generate`. Offline checks can use fake example URLs in the process environment; these commands do not query the database. Generate before API typecheck/build on a fresh install when postinstall scripts were disabled.
- Generated client/engine output lives in ignored `api/node_modules` (`.prisma/client` and Prisma packages); do not hand-edit or commit it. Builds are ignored under each package's `dist`. No generated client source is shared with the browser.
- `api/src/prisma.ts:createPrismaClient` is an explicit lazy initializer; health/server do not import or construct it. Database connectivity remains unverified. Never run migration, introspection, db push or live checks under this initial-setup scope.

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
