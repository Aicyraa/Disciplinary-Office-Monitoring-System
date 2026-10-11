# CONTEXT

This file is the parallel dev team's only notes file. It records what changed (files, tests, commands, results, decisions), not plans. Agents edit only their own task's section, append rather than rewrite, keep each entry under about 15 lines, and write facts with evidence only. Lead writes the Task board and the empty sections before any worktree exists; dev and reviewer fill their section in their worktree; integrator writes the Integration section last.

## Task board

| slug | branch | worktree | goal | done when | expected files | depends on | merge order | status |
|---|---|---|---|---|---|---|---|---|
| foundation-storage | worktree-foundation-storage | .claude/worktrees/foundation-storage | Build step 1 (SPEC 6.1; FEATURE-RULES 3.7): storage interface, S3 impl, in-memory fake, pure upload validator | storage + validator tests green; lint, typecheck, test, build green; seed counts verified on dev | api/src/storage/*, api/src/files/validate*, vitest.config.mjs | none | 1 | review |

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
- OPEN QUESTION (human): the spec defines no env key for the bucket name. `createS3Storage(bucket)` takes it as an argument; needs a key (for example `AWS_S3_BUCKET`) in `.env.example`, or a SPEC decision.
- Not verified: live upload, download and presign against the Neon bucket; SPEC 11 item 2 (bucket CORS).
- HUMAN CHECK: put a small PDF with `createS3Storage(<bucket>)` using dev-branch credentials, then open `presignGet(key)` in a browser -> file downloads; after 60 s the URL returns 403.
- Not done: Prisma `ConnectionTest` removal (human confirms); `multer` wiring (step 5).

(reviewer fills this)

---

