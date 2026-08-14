# Phase 6 — Verification Results Gate

**Output of:** `/verify` · **Type: GATE** (only an all-PASS result reaches the human)

There is **no separate results or gap-report file** — that pattern was deliberately retired (and is
mechanically blocked by a guardrails plugin that rejects
writes to `Gap-Report*.md`, `Verification-Report*.md`, etc.). The Verifier's findings
live inline, in the one place both agents and humans already look:

## Where the verdicts land

- Each checklist item gets a `**Verifier Result**:` line —
  `PASS` / `FAIL` / `PASS (code-audit)` / `FAIL (code-audit)` / `DATA-GAP` / `BLOCKED` —
  **with evidence** (what was executed, what was observed) and a one-line suggested fix
  for FAILs.
- The checklist's **Status Table** is updated to reflect reality.
- The `## Verifier Run Log` gets an appended entry: environment-probe results,
  deployment-step outcomes, chosen frontend environment (so verdicts have DB context),
  and the overall verdict. History is preserved across runs — a clean audit trail.

## Routing

`DATA-GAP` is an outcome, not a verdict tier. It means the behavior could not be
meaningfully exercised because the required seed or fixture data is absent. It never
silently passes acceptance or release.

| Outcome | Fix loop | Acceptance | Release | Required action |
|---|---:|---:|---:|---|
| `PASS` | continue | allowed | allowed | continue |
| `FAIL` | required | blocked | blocked | `/fix`, then re-verify |
| `PASS (code-audit)` | policy decision | exception required | blocked by default | obtain runtime evidence or signed exception |
| `FAIL (code-audit)` | required | blocked | blocked | fix |
| `DATA-GAP` | no code fix | blocked until resolved/accepted | blocked by default | seed data and re-verify |
| `BLOCKED` | blocked | blocked | blocked | resolve blocker or signed exception |

| Result | Goes to |
|---|---|
| Any `FAIL` items | [Phase 7 — Fix](07-fix.md), which reads the inline annotations directly |
| `DATA-GAP` | Seed the required data or record an expiring exception, then re-run `/verify` |
| `BLOCKED` | Fix the deployment/infrastructure issue, then re-run `/verify` |
| **ALL PASS** | [Phase 8 — Human acceptance](08-human-acceptance.md) |

An infrastructure need discovered missing (blob container, queue, secret not in
appsettings) is both a FAIL on the underlying item **and** a signal `/implement` forgot
to record it — the next `/fix` adds it to `## Infrastructure Requirements`.
