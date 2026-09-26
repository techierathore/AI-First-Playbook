# Phase 6 — Verification Results Gate

**Output of:** `/verify` · **Type: GATE** (only an all-PASS result reaches the human)

There is **no separate results or gap-report file** — that pattern was deliberately retired (and is
mechanically blocked by a guardrails plugin that rejects
writes to `Gap-Report*.md`, `Verification-Report*.md`, etc.). The Verifier's findings
live inline, in the one place both agents and humans already look:

## Where the verdicts land

`verification-result-writer.mjs` gives each item a `**Verifier Result**` line with its
outcome and evidence (a suggested fix on a FAIL), updates the metadata and the **Status
Table**, and appends a `## Verifier Run Log` entry; history is preserved across runs.

## Miss telemetry at the gate

- For every `FAIL`, `FAIL (code-audit)`, and `DATA-GAP`, the parent Verifier runs
  `PLAYBOOK_TELEMETRY=1 node scripts/playbook-miss.mjs open --if-new ...` **serially**.
  It appends the returned new ID, or the still-live collapsed ID, to the item's required
  append-only metadata `misses` array before moving to the next item.
- For `PASS` and `PASS (code-audit)`, after the independent check succeeds, the Verifier
  appends a `miss-fix` with `verdict_after=pass` for every linked still-live miss. IDs stay
  in item metadata forever. An exact run ID is supplied when known; otherwise it is
  omitted, never guessed.
- Parallel sub-verifiers return findings and telemetry candidates to the parent; they do
  not allocate IDs or write the stream concurrently.
- Every telemetry command is fire-and-forget. A refusal, malformed stream, or write error
  is logged in the Run Log but **never changes the item outcome or phase verdict**.

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

`node .playbook/scripts/gate-check.mjs verification-results <checklist> [--handoff=<record>]`
prints the route below from the latest verdicts and catches a results record that disagrees.

| Result | Goes to |
|---|---|
| Any `FAIL` items | [Phase 7 — Fix](07-fix.md), which reads the inline annotations directly |
| `DATA-GAP` | Seed the required data or record an expiring exception, then re-run `/verify` |
| `BLOCKED` | Fix the deployment/infrastructure issue, then re-run `/verify` |
| **ALL PASS** | [Phase 8 — Human acceptance](08-human-acceptance.md) |

An infrastructure need discovered missing (blob container, queue, secret not in
appsettings) is both a FAIL on the underlying item **and** a signal `/implement` forgot
to record it — the next `/fix` adds it to `## Infrastructure Requirements`.
