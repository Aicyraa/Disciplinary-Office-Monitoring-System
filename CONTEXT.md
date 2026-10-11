# CONTEXT

This file is the parallel dev team's only notes file. It records what changed (files, tests, commands, results, decisions), not plans. Agents edit only their own task's section, append rather than rewrite, keep each entry under about 15 lines, and write facts with evidence only. Lead writes the Task board and the empty sections before any worktree exists; dev and reviewer fill their section in their worktree; integrator writes the Integration section last.

## Task board

| slug | branch | worktree | goal | done when | expected files | depends on | merge order | status |
|---|---|---|---|---|---|---|---|---|
| foundation-storage | worktree-foundation-storage | .claude/worktrees/foundation-storage | Build step 1 (SPEC 6.1; FEATURE-RULES 3.7): storage interface, S3 impl, in-memory fake, pure upload validator | storage + validator tests green; lint, typecheck, test, build green; seed counts verified on dev | api/src/storage/*, api/src/files/validate*, vitest.config.mjs | none | 1 | reviewed (PASS) |

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

