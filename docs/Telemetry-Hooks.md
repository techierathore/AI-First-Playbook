# Telemetry Hook Points (Task 5)

Feeds the existing telemetry design. The current target is schema 2, one record per phase execution (NDJSON):

```json
{"schema":2,"kind":"phase-metric","phase_execution_id":"...","phase":"verify",
 "started_at":"2026-08-20T09:10:00Z","ended_at":"2026-08-20T09:12:00Z","elapsed_ms":120000,
 "model":"anthropic/claude-sonnet-5","models":[...],"tokens":{"input":32000,"output":8000,
 "reasoning":1120,"cache_read":15000,"cache_write":1213},"tokens_in":48213,"tokens_out":9120,
 "observed_active_effort":{"assistant_elapsed_ms":78000,"tool_elapsed_ms":31000,
 "observed_active_ms":84000,"coverage":"complete"},"subagents":{"spawned":3,"contributors":2,"sessions":[...]}}
```

A field-by-field principle first: **attempt number and gate verdict are framework data, not
harness data.** They live in the checklist the framework already maintains — one
`## Verifier Run Log` entry per run, one `**Verifier Result**:` line per item, a Status Table —
so they are captured by a deterministic parser
(`scripts/playbook-telemetry.mjs`), never by asking a model or a harness API. `project_type`
comes from `playbook/environment-profile.yml`; `tier` from `playbook/model-tiers.yml`
(reverse-mapped from the observed model). Only **phase, model, and tokens** are
harness-sourced.

---

## OpenCode — everything needed is exposed (matrix row i)

Per-turn tokens+cost exist at three levels: `step-finish` parts, assistant-message rollup, and
session rollup, and subagents are child sessions with their own rollups — so per-phase *and*
per-sub-verifier accounting are both available without estimation.

| Signal | Capture point | Evidence |
|---|---|---|
| Phase start (phase = command name) | Plugin hook `command.execute.before` — records command/session plus a generated execution UUID; raw `arguments` are deliberately discarded | `packages/opencode/src/session/prompt.ts:1460-1464`; `packages/plugin/src/index.ts` (Hooks) |
| Wall-clock end | Root `session.idle`; a new command supersedes an open window; EOF remains incomplete with no invented end | `packages/schema/src/session-status-event.ts:44` |
| Model actually used | `message.updated` events — assistant `info.modelID`/`providerID` are per message (mixed-model sessions are real, so record per message, not per session) | `packages/opencode/src/session/prompt.ts:1196-1197`; event `packages/schema/src/v1/session.ts:597` |
| Tokens in/out (+ reasoning, cache) and cost | `message.part.updated` events with `part.type === "step-finish"` (`tokens{input,output,reasoning,cache}`, `cost`), or the assistant message rollup on `message.updated` | `packages/opencode/src/session/processor.ts:435-456`; `packages/schema/src/v1/session.ts:240-256` |
| Assistant interval | Valid assistant `info.time.created`/`completed`; this envelope can contain tool time, so consumers union intervals instead of adding tool time again | Assistant message schema |
| Tool-active time | Paired plugin `tool.execute.before` / `tool.execute.after` hooks keyed by session and call ID | Plugin Hooks API |
| Spawned subagents | `session.created` with a `parentID`; child `session.idle` closes lifecycle. This counts children even when no tokens are emitted | Session events |
| Per-subagent split | Filter turns/tools by `sessionID` and recursively resolve the recorded parent chain | `packages/opencode/src/tool/task.ts:156-172`; `packages/core/src/session/projector.ts:89-109` |
| Offline backfill / audit | SQLite `~/.local/share/opencode/opencode.db`: `session` rollup columns; `json_extract(message.data, '$.tokens.input')` over message blobs (the exact recipe OpenCode's own backfill migration uses) | `packages/core/src/session/sql.ts:43-48`; `packages/core/src/database/migration/20260510033149_session_usage.ts:24-52` |

**Recommended carrier:** a second small plugin (`telemetry.ts`, sibling of the guardrail) using
`command.execute.before` + the `event` hook, appending NDJSON to
`verification/telemetry/events.ndjson`; `playbook-telemetry.mjs` then joins those rows with the
checklist-parsed attempt/verdict into the final record. The `event` hook is fire-and-forget
and error-isolated, so telemetry can never break a run
(`packages/opencode/src/plugin/index.ts:253-260`).

Three caveats. First, observed active time is the union of assistant and tool intervals, not human
effort, CPU utilization or additive compute. Assistant and tool component sums overlap and must not
be added. Second, `opencode run --format json` also streams step-finish parts on stdout
(`packages/opencode/src/cli/cmd/run.ts:678-691`) — sufficient for launcher-scripted headless
phases without any plugin. Third, the v2 engine currently hardcodes `cost: 0`
(`packages/core/src/session/runner/llm.ts:332-343`); tokens are correct everywhere, but treat
`cost` as v1-only until that lands. The joiner labels non-zero-token zero cost `zero-unverified`;
compute a separately labelled token × rate-card estimate when needed.

## OpenCode fallback and data-quality behavior

The primary capture path is the project plugin. Headless JSON output and SQLite are audit or
recovery sources, not parallel writers to the same event stream.

| Condition | Required result |
|---|---|
| Plugin disabled | No event file is created; framework execution proceeds normally |
| Event append fails | The run continues; the affected telemetry window may be absent |
| Root session never becomes idle | Emit an incomplete EOF window with null elapsed time |
| Child lifecycle exists without a token-bearing turn | Count it in `spawned`, not `contributors` |

Do not merge offline backfill into a live window unless execution and session identity prove
that both sources describe the same phase. Duplicate observations must be deduplicated before
aggregation rather than averaged or added.

Cost validity is independent of token validity. A valid token record with missing or known-zero
provider cost remains useful for effort analysis but must not enter measured-cost aggregates.
Consumers inspect `data_quality.token_status` and `data_quality.cost_status` separately.
That separation is part of the schema contract, not a presentation preference.

## What the emit schema gains from this design

`phase`, `tier`, `attempt`, `gate_verdict`, `project_type`, `timestamp` — framework-owned,
one parser. `model`, `tokens_in`, `tokens_out`, `cost` — sourced from OpenCode events.
That split is the whole trick: the fragile, runtime-specific surface is reduced
to three fields, and the fields that gate decisions (verdict, attempt) are read from durable
framework artifacts that survive harness upgrades.

## Miss stream — source and derived boundaries

Miss telemetry uses the same boundary rather than extending harness authority. The plugin
continues to write only transient phase events; it does **not** write durable miss records.
`scripts/playbook-miss.mjs` appends classifications to
`verification/telemetry/misses.ndjson`, and `scripts/playbook-telemetry.mjs --misses` joins
that stream to event windows without mutating either input.

| Data | Source / owner | Boundary |
|---|---|---|
| `miss_class`, `artifact`, `severity`, `origin_phase`, `origin_agent`, `why_missed`, `found_by` | Agent-authored classification at the phase/log-miss front door | Closed vocabularies only; an agent may classify but may not author a number or provenance verdict |
| `item_id`, `found_phase`, `found_phase_gate`, lifecycle verdict | Framework/checklist context | Existing framework vocabulary; no harness inference |
| `origin_model`, `origin_confidence` | Miss emitter lookup of the exact `origin_run_id` event window | Derived even if the caller supplies values; failed lookup forces model `null` and confidence `inferred`/`unknown` |
| Fix model/tier, tokens, provider cost, token scope, subagent rollup | Joiner lookup of the exact `fix_run_id` event window | Read-time output only; never persisted back to `misses.ndjson` |
| `cost_attribution` | Joiner count of closes sharing an exact fix window | `sole`, `shared:<n>`, or `none`; no window means null costs, never an estimate |
| `miss-amend` | Later agent/human classification | May complete a null closed-vocabulary judgement only; cannot alter observed or derived facts |

OpenCode's event carrier captures provider cost, so an exact linked fix window can produce
measured `sole` cost. Without compatible `events.ndjson` rows, model provenance and cost
degrade honestly to inferred/unknown and `null`/`none`; classification does not depend on cost
capture.
