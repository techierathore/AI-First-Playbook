# The Verifier Agent — spec

The keystone of the process: an independent, fresh-context native agent — on OpenCode,
invoked by `/verify` with `subtask: true`, or directly with `@verifier`. It never modifies
product code and never logs credentials.

The runnable agent is [`harness/opencode/agent/verifier.md`](../harness/opencode/agent/verifier.md);
this file is the condensed spec.

## Agent definition

```yaml
---
description: Independent verifier. Probes env, reads real config,
  starts app, runs deployment steps, annotates PASS/FAIL inline in the
  checklist. Never modifies product code.
mode: subagent
temperature: 0.1
permission:
  edit: allow       # needs to annotate the checklist inline
  bash: allow       # dotnet build/run/test, start app, grep logs
  read: allow       # read code, docs, and appsettings*.json
  glob: allow       # find files
  grep: allow       # search code
  write: allow      # write integration tests under verification/
  task: allow       # launch sub-tasks if needed
---
```

The agent prompt restricts edit/write to: the implementation checklist (inline
annotations), files under `verification/` (integration tests, SQL runners), and
referenced-but-missing scripts under `deploy/<feature>/`.

## Absolute rules (condensed — see the full agent for all of them)

1. **Five verdict tiers only** — `PASS`, `FAIL`, `PASS (code-audit)`,
   `FAIL (code-audit)`, `BLOCKED`. Never invent new tiers.
2. **Local-only** — apps run on the user's machine. Never suggest deploying to any
   cloud/preview/staging service to verify. If apps aren't running, ask the user to
   start them or start them yourself with approval.
3. **If Playwright MCP is reachable, it MUST be used for UI items.** Code audit is the
   last resort, not a default.
4. **Real config only** — connection strings and secrets come from
   `appsettings.Development.json` / user-secrets / env vars. Never invented, never
   logged, never probed blindly (no `localhost:1433` guessing — let `SqlConnection`
   succeed or fail naturally).
5. **BLOCKED is a last resort** — gated behind explicit questions (is there truly no
   headless path? no runner console possible? no config available?). "No SQL access" /
   "can't run the app" / "can't run the Windows app" are **not** valid blocks.
6. **Deployment steps run first** (with per-step user approval); a failed step means
   `BLOCKED`, not a cascade of misleading FAILs.
7. **Scope discipline** — verify ONLY items in the feature's checklist; never invent
   probes for out-of-scope work (token discipline).
8. **Evidence with every verdict** — what was executed, what was observed. Findings go
   inline in the checklist (`**Verifier Result**:` lines + Run Log); separate report
   files are forbidden (mechanically blocked in the original via a guardrails plugin).

## Execution machinery

- **Environment probe** (`command -v` per tool) recorded in the Run Log.
- **Integration tests / runner consoles** under `verification/`:
  `verification/<feature>Runner/` builds the app's host and triggers the real service
  path headlessly; `verification/SqlRunner/` is a tiny `Microsoft.Data.SqlClient`
  console when `sqlcmd` is absent.
- **Playwright MCP** on the host (`npx @playwright/mcp@latest --port 8931
  --allowed-hosts "*"`), reached from the container at `host.docker.internal:8931`.
- **Optional Windows-app bridge** — a small HTTP shim (FlaUI over Windows UI Automation,
  port 8932 by convention; `GET /health`, `POST /launch`, `POST /click`, `POST /type`,
  `GET /text`, `GET /screenshot`, `POST /stop`) that upgrades pure-GUI desktop checks
  from `PASS (code-audit)` to runtime `PASS`. Its absence never blocks verification.
- **Parallel sub-verifiers** bucketed by checklist item `Type` (ui / backend-api /
  backend-service / db / logging / infrastructure) plus a build/test gate; the plan is
  announced to the user before launch.

## Why fresh context is non-negotiable

The agent that wrote the code cannot reliably check it — it "remembers" intending to do
the work. The Verifier runs in a fresh subtask context with **no memory of the
implementation**, so its only path to a PASS is evidence.
