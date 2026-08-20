# Telemetry Hook Points (Task 5)

Feeds the existing telemetry design. Target record, one per phase execution (NDJSON):

```json
{"phase": "verify", "command": "verify", "model": "anthropic/claude-sonnet-5",
 "tier": "standard", "tokens_in": 48213, "tokens_out": 9120, "attempt": 2,
 "gate_verdict": "FAIL", "project_type": "dotnet-react", "timestamp": "2026-08-20T09:12:00Z",
 "harness": "opencode", "session_id": "...", "cost_usd": 0.41}
```

A field-by-field principle first: **attempt number and gate verdict are framework data, not
harness data.** They live in the checklist the framework already maintains — one
`## Verifier Run Log` entry per run, one `**Verifier Result**:` line per item, a Status Table —
so they are captured identically in both harnesses by a deterministic parser
(`scripts/playbook-telemetry.mjs`), never by asking a model or a harness API. `project_type`
comes from `playbook/environment-profile.yml`; `tier` from `playbook/model-tiers.yml`
(reverse-mapped from the observed model). Only **phase, model, and tokens** are
harness-sourced, and that is where the two harnesses genuinely differ.

---

## OpenCode — everything needed is exposed (matrix row i)

Per-turn tokens+cost exist at three levels: `step-finish` parts, assistant-message rollup, and
session rollup, and subagents are child sessions with their own rollups — so per-phase *and*
per-sub-verifier accounting are both available without estimation.

| Signal | Capture point | Evidence |
|---|---|---|
| Phase start (phase = command name) | Plugin hook `command.execute.before` — receives `{command, sessionID, arguments}` | `packages/opencode/src/session/prompt.ts:1460-1464`; `packages/plugin/src/index.ts` (Hooks) |
| Model actually used | `message.updated` events — assistant `info.modelID`/`providerID` are per message (mixed-model sessions are real, so record per message, not per session) | `packages/opencode/src/session/prompt.ts:1196-1197`; event `packages/schema/src/v1/session.ts:597` |
| Tokens in/out (+ reasoning, cache) and cost | `message.part.updated` events with `part.type === "step-finish"` (`tokens{input,output,reasoning,cache}`, `cost`), or the assistant message rollup on `message.updated` | `packages/opencode/src/session/processor.ts:435-456`; `packages/schema/src/v1/session.ts:240-256` |
| Per-subagent split | Child sessions: filter events by `sessionID`; map children via `GET /session/{id}/children`; session totals on `GET /session/{childID}` | `packages/opencode/src/tool/task.ts:156-172`; `packages/core/src/session/projector.ts:89-109` |
| Phase end | `session.idle` event for the session (or child session for `subtask` commands) | `packages/schema/src/session-status-event.ts:44` |
| Offline backfill / audit | SQLite `~/.local/share/opencode/opencode.db`: `session` rollup columns; `json_extract(message.data, '$.tokens.input')` over message blobs (the exact recipe OpenCode's own backfill migration uses) | `packages/core/src/session/sql.ts:43-48`; `packages/core/src/database/migration/20260510033149_session_usage.ts:24-52` |

**Recommended carrier:** a second small plugin (`telemetry.ts`, sibling of the guardrail) using
`command.execute.before` + the `event` hook, appending NDJSON to
`verification/telemetry/events.ndjson`; `playbook-telemetry.mjs` then joins those rows with the
checklist-parsed attempt/verdict into the final record. The `event` hook is fire-and-forget
and error-isolated, so telemetry can never break a run
(`packages/opencode/src/plugin/index.ts:253-260`).

Two caveats. First, `opencode run --format json` also streams step-finish parts on stdout
(`packages/opencode/src/cli/cmd/run.ts:678-691`) — sufficient for launcher-scripted headless
phases without any plugin. Second, the v2 engine currently hardcodes `cost: 0`
(`packages/core/src/session/runner/llm.ts:332-343`); tokens are correct everywhere, but treat
`cost` as v1-only until that lands, or recompute cost from tokens × your price sheet — which
you need anyway for Claude Code parity.

## Claude Code — tokens are the constrained signal; here is the honest fallback chain

Confirmed constraints (matrix row i): hooks receive **no token counts**; subagent usage is
**not exposed**; per-message usage in transcript JSONL is **UNVERIFIED** as a stable interface.

| Signal | Capture point | Status |
|---|---|---|
| Phase start/end, session identity | `SessionStart` / `Stop` / `SessionEnd` hooks — receive `session_id`, `transcript_path`, `cwd` on stdin; the phase name comes from the launcher (session-per-phase, `Adapter-Design.md`) or a `UserPromptSubmit` hook matching `/command` text | Verified — https://code.claude.com/docs/en/hooks.md |
| Model | The launcher chose it (`claude --model` / `/model`), so record it at launch; OTel metrics also carry a `model` attribute | Verified — https://code.claude.com/docs/en/monitoring-usage.md |
| Tokens per phase — primary | **OpenTelemetry**: `claude_code.token.usage` and `claude_code.cost.usage` metrics to a local OTLP collector; with session-per-phase, session ≈ phase, so per-session aggregation ≈ per-phase tokens. Adding a `phase` dimension via `OTEL_RESOURCE_ATTRIBUTES=phase=verify` set by the launcher is standard OTel behaviour but **UNVERIFIED** for Claude Code's exporter — verify by launching once against a debug collector | Partially verified |
| Tokens per phase — fallback | Parse the transcript JSONL named by `transcript_path` in the `Stop` hook for per-message `usage` fields. The file exists and hooks hand you its path (verified); its **format is internal and undocumented (UNVERIFIED)** — pin the Claude Code version, and treat a parse failure as `tokens: null`, never as zero | Fragile by design |
| Tokens — headless phases only | `claude -p --output-format json` returns usage + `total_cost_usd` per run — exact, but only for non-interactive phases (P6 gate parsing, mechanical commands); the elicitation-heavy phases (P1, P9) are interactive by design and can't use it | Verified — https://code.claude.com/docs/en/headless.md |
| Per-subagent split | **Not available.** Record the phase total and set `subagent_breakdown: null` — do not estimate | Confirmed absence |
| Attempt, gate verdict, project_type | Checklist + profile parsing — identical to OpenCode | Framework-owned |

**Net:** in Claude Code the telemetry record is per-phase (session-level), with cost computed
from tokens × price sheet or taken from OTel `cost.usage`; the per-sub-verifier granularity
OpenCode gives is simply not reproducible there today, and the schema should carry
`granularity: "session" | "message"` so consumers know which they are reading.

## What the emit schema gains from this design

`phase`, `tier`, `attempt`, `gate_verdict`, `project_type`, `timestamp` — harness-independent,
one parser. `model`, `tokens_in`, `tokens_out`, `cost` — harness-sourced via the two capture
paths above. That split is the whole trick: the fragile, harness-specific surface is reduced
to three fields, and the fields that gate decisions (verdict, attempt) are read from durable
framework artifacts that survive harness upgrades.
