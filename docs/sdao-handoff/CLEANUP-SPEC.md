# CLEANUP-SPEC — codebase organization (2026-10-13)

Short plan for the clean-up that comes **before** the next round of UI work. No behavior changes: same routes, same screens, same tests (1099 passing before and after).

## 1. Why
Code was grouped by feature folder with mixed layers inside (`cases/routes.ts`, `cases/service.ts`, `cases/prisma-store.ts` side by side), tests sat next to sources, the client had one flat `lib/` and `pages/`, and the same small helpers were copied between files. That is hard to scan and hard to extend.

## 2. Standard used (and its limits)
Layered Express API (routes → services → repositories, with middleware, config, lib, domain) and a React SPA grouped by role (pages by audience, components by purpose, hooks, context, utils, api). This follows the widely used Node/Express layered layout and the bulletproof-react style. **The web search tool was not available in this session**, so the layout comes from established conventions, not from freshly fetched pages; sources worth reading are listed in section 8.

Deliberate deviations: no `controllers/` layer (handlers stay in `*.routes.ts` because each is a few lines that call a service); tests live in one `tests/` folder per package (a project rule), not next to the source; no barrel files except `routes/index.ts` and `components/ui/index.tsx`.

## 3. ES modules
Both packages are ES modules already: `api/package.json` has `"type": "module"` with `NodeNext` resolution (imports end in `.js`), and the client is a Vite ESM app. (The request said "EJS"; it was read as ES modules, since EJS is a templating engine this app does not use.) The client gained an `@/` alias for `client/src`; the API keeps relative imports because Node does not resolve TypeScript path aliases at run time.

## 4. API layout (`api/`)
```
src/
  app.ts, server.ts       build the app (no listen) / start it
  config/                 db-url, prisma, gate, storage (env and client construction)
  routes/                 <feature>.routes.ts, one router each; index.ts mounts them all
  services/               <feature>.service.ts business rules; services/notifications/ delivery, scheduler, render, inbox
  repositories/<feature>/ prisma-*, memory-* (test fakes), queries, repo interfaces
  domain/                 pure rules: codes, escalation, appointment window, sanction rules, validators
  middleware/             auth guards, cors
  views/                  record -> response mappers
  integrations/           storage (s3, memory, unavailable), power-automate
  lib/                    http envelope (sendOk/sendError), params (parseId)
  types/                  <feature>.types.ts
tests/                    mirrors src/ (routes/, services/, domain/, ...); helpers/harness.ts
```

## 5. Client layout (`client/`)
```
src/
  main.tsx, App.tsx, index.css
  api/                    client.ts (axios + endpoints), baseUrl.ts, health.ts
  context/                AuthContext, UnreadContext
  hooks/                  useApi, useNavBadges
  utils/                  pure helpers: format, files, nav, inbox, caseView, studentView, ...
  components/
    ui/                   primitives (index.tsx), StageTracker, Pagination
    layout/               Shell, MasterDetail
    feedback/             toast, ConfirmModal, LockedButton, ReasonForm
    dashboard/ sanctions/ templates/   domain components
  pages/
    public/ account/ shared/ staff/ student/
tests/                    mirrors src/ (utils/, components/, pages/, context/)
```
Pages keep their exported names (`CasesPage` is now `pages/staff/Cases.tsx`, formerly `StaffCases.tsx`); only file locations changed.

## 6. Naming rules
- API: `<feature>.<layer>.ts` for routes, services, types, views (`cases.routes.ts`); other files keep a short kebab name inside their layer folder.
- Client: components and pages `PascalCase.tsx`; hooks `useX.ts`; utils `camelCase.ts`; one component per file unless tiny.
- Tests: same name as the file under test plus `.test.ts(x)`, in the mirrored folder under `tests/`.

## 7. What was done
1. Files moved and every relative import rewritten by a script (`api`: 132 files, `client`: 80 files); typecheck, lint, build and all 1099 tests green after each package.
2. Removed repetition: `parseId` copied in 9 routers is now `lib/params.ts`; the router wiring that sat in `app.ts` is `routes/index.ts` (`app.ts` is now 111 lines); four copies of the pagination bar are one `Pagination` component.
3. Config: `vitest.config.mjs`, `api/tsconfig.json` (tests excluded from the build), `client/tsconfig.json` and `client/vite.config.ts` (`@/` alias, `tests` included), the root lint script (adds both `tests/` folders) and the two `npm test` filters.

## 8. Not done (next, small)
- Segmented tabs, filter chips and stat tiles are still repeated in 5 to 6 pages; extract to `components/ui/` when the UI work touches them.
- `lib/api.ts` (now `api/client.ts`, 330 lines) could be split per domain; `pages/shared/Dashboard.tsx` holds the student and staff dashboards.
- Split `services/cases.service.ts` and the larger pages when they pass about 300 lines.
- Sources to read: bulletproof-react `docs/project-structure.md`; Express "Writing middleware" and Express 5 migration guide; TypeScript handbook "Modules reference" (NodeNext); Vite `resolve.alias`.
