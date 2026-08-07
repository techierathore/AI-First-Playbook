# Phase 5 — Verify (the keystone) — GATE

**Command:** `/verify` · **Agent:** Verifier (native agent, fresh context, `subtask`) ·
**Chat:** fresh — *the Verifier must have no memory of the build*

A fresh-context agent audits the code **and the running app** against every checklist
item. It did not write the code, so it has no reason to believe the work is done. It
never modifies product code; its writes are restricted to the checklist (inline
annotations) and `verification/` (integration tests and runners).

Full agent spec: [`templates/verifier-agent.md`](../templates/verifier-agent.md).

## Step 0 — Deployment Steps first

Before verifying anything, the Verifier reads the checklist's `## Deployment Steps`:

- **Automated** steps: for each, it ASKs "run `<command>`? (yes/no/skip)" — never runs
  silently. A failed step **stops verification** with verdict `BLOCKED` (no misleading
  FAILs are reported for items that never had a chance).
- **Manual** steps: recorded in the Run Log as deferred to the user.

This eliminates the "did anyone remember to run the migration?" failure mode.

## How it verifies

- **Environment probe:** `command -v` for every tool it might need (dotnet, node, npm,
  sqlcmd, …); results recorded — missing tools become known constraints, not silent
  assumptions.
- **Real config only:** connection strings and credentials from
  `appsettings.Development.json` / user-secrets — never invented, never logged.
- **UI items:** Playwright MCP against the running app — every mockup element checked
  via the accessibility tree, with screenshots. If Playwright is reachable it MUST be
  used; code audit (`PASS (code-audit)` / `FAIL (code-audit)`) is the last resort.
- **Backend/DB/sync items — the five-step check:** discover the real connection → find
  how the sync is triggered → run the real path via an integration test or runner
  console under `verification/` → assert the target view/table actually populated
  (`COUNT(*)` over a real `SqlConnection`) → prove the required log lines fired.
- **Starts the app itself if needed** (with approval), waits for the port, kills it
  cleanly afterward. Verification is **local-only** — it never suggests deploying
  anywhere to verify.
- **Parallel sub-verifiers:** items grouped by `Type` (ui / backend / db / logging /
  infrastructure) plus a build/test-gate sub-verifier; plan announced before launching.

## Forbidden excuses (v2.4)

| Excuse | Required workaround |
|---|---|
| "No SQL Server access" | `sqlcmd`, or a small `Microsoft.Data.SqlClient` console under `verification/SqlRunner/` |
| "Can't run the web app" | `dotnet run --project <Api>` + the project's real `npm run start:*` script |
| "Can't run the Windows app" | Run the .NET library logic headlessly via a `verification/<feature>Runner/` console; optional Windows-app bridge for true GUI E2E |

Only the human may authorize a skip.

**Next:** [Phase 6 — Gap report](06-gap-report-gate.md)
