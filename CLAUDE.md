@AGENTS.md

# CLAUDE.md

`AGENTS.md` (imported above) and `docs/sdao-handoff/SPEC.md` are the source of truth for the product. This file only adds how the Claude Code parallel dev team works. If they disagree, stop and ask the human.

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
- Schema changes update `db/schema.sql` and the matching `SPEC.md` section in the same change (`AGENTS.md` section 1).

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
