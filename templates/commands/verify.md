# /verify

**Agent:** Verifier (native agent, `subtask: true` — fresh context) · **Cost:** 🔴 ·
**Chat:** fresh, always

Independently verify a built feature against its checklist. The command file itself is a
thin wrapper — the logic lives in the [Verifier agent spec](../verifier-agent.md).

## Usage

```
/verify docs/CostDocs/App-CostDashboard-FullStack-Implementation-Checklist.md
```

## Key behaviors

- **Fresh context is the point**: the Verifier has no memory of the build, so its only
  path to PASS is evidence from executing the real code.
- Runs `## Deployment Steps` first (per-step approval; failure ⇒ `BLOCKED`).
- Probes the environment, reads real config, starts apps with approval, drives the UI
  via Playwright MCP, proves backend paths via `verification/` integration
  tests/runners, asserts DB writes with real queries, greps real logs.
- Spawns parallel sub-verifiers by item `Type`; announces the plan first.
- Writes verdicts **inline in the checklist** (`**Verifier Result**:` + evidence),
  updates the Status Table, appends to the Run Log. No separate report file.
- Scope-limited to the checklist's items; never invents probes for out-of-scope work.
