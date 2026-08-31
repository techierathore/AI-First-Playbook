# Telemetry Guide — phase effort, time, tokens, models and outcome

**Audience:** anyone operating the playbook. **TL;DR:** schema-2 OpenCode records answer wall-clock phase time, observed active agent time, token/cost usage, actual model mix, and spawned/contributing subagents. A separate durable stream covers escaped/reworked defects. Values come from harness events or deterministic framework parsing, never model self-report. **TfLens phase contract:** [`Phase-Efficiency-TfLens-Contract.md`](Phase-Efficiency-TfLens-Contract.md) · **TfLens miss contract:** [`Miss-Telemetry-TfLens-From-AIFP.md`](Miss-Telemetry-TfLens-From-AIFP.md) · **capture evidence:** [`Telemetry-Hooks.md`](Telemetry-Hooks.md).

## 1. What you get

One schema-2 NDJSON record per phase execution:

```json
{"schema":2, "kind":"phase-metric", "phase_execution_id":"25ed...", "phase":"verify",
 "started_at":"2026-08-20T09:10:00Z", "ended_at":"2026-08-20T09:12:00Z",
 "elapsed_ms":120000, "complete":true, "end_reason":"idle",
 "model":"anthropic/claude-sonnet-5", "tier":"standard",
 "models":[{"model":"anthropic/claude-sonnet-5","turns":12,"tokens_in":45000,"tokens_out":8500,"cost_usd":0.38,"cost_status":"complete","active_ms":71000}],
 "tokens":{"input":31203,"output":7900,"reasoning":1220,"cache_read":16000,"cache_write":1010},
 "tokens_in":48213, "tokens_out":9120, "cost_usd":0.41,
 "attempt":2, "gate_verdict":"FAIL", "project_type":"dotnet-react",
 "timestamp":"2026-08-20T09:12:00Z", "session_id":"ses_…",
 "harness":"opencode", "granularity":"message", "turns":14,
 "observed_active_effort":{"assistant_elapsed_ms":78000,"tool_elapsed_ms":31000,"observed_active_ms":84000,"coverage":"complete"},
 "data_quality":{"valid":true,"issues":[],"token_status":"complete","cost_status":"complete"},
 "tokens_scope":"tree", "subagents":{"count":2,"spawned":3,"contributors":2,
 "tokens_in":9100,"tokens_out":1840,"cost_usd":0.06,"sessions":[...]}}
```

Field by field:

| Field | Meaning | Where it comes from |
|---|---|---|
| `schema` / `kind` | `2` / `phase-metric` | Joiner contract discriminator |
| `phase_execution_id` | Unique idempotency key for this command execution; legacy events get a deterministic `legacy-...` id | Plugin UUID at phase start or deterministic joiner fallback |
| `phase` | The command that ran (`verify`, `implement`, `fix`, …) | Harness — the plugin's `command.execute.before` hook |
| `started_at` / `ended_at` / `elapsed_ms` | Phase wall-clock boundary and duration. Incomplete EOF windows have null end/duration | Harness phase events |
| `complete` / `end_reason` | Whether a trustworthy end exists; `idle`, `superseded`, or `eof` | Joiner |
| `model` | Compatibility dominant model, selected by finalized turn count; lexical tie-break | Harness per-message model |
| `models` | Every observed model with turns, tokens, cost status and assistant-message elapsed time | Harness per-message data |
| `tier` | The tier that model reverse-maps to in `playbook/model-tiers.yml` | Framework — deterministic lookup |
| `tokens` | Exact `input`, `output`, `reasoning`, `cache_read`, and `cache_write` breakdown | Harness per-message usage |
| `tokens_in` / `tokens_out` | Σ input+cache / output+reasoning tokens over the phase | Harness — per-message token rollups |
| `cost_usd` | Σ provider-reported cost over the phase | Harness (see the v2-engine caveat in `Telemetry-Hooks.md`) |
| `attempt` | Which run this was for the checklist (1st, 2nd, …) | Framework — counted from the checklist's `### Run on` entries |
| `gate_verdict` | Worst verdict on the checklist: `BLOCKED` > `FAIL` > `DATA-GAP` > `PASS (code-audit)` > `PASS` | Framework — parsed from `**Verifier Result**:` lines |
| `project_type` | Your stack label | Framework — `playbook/environment-profile.yml` |
| `granularity` | `message` (OpenCode — exact per-phase) or `session` (Claude Code — see §5) | Capture path |
| `observed_active_effort` | Overlap-safe observed busy time plus diagnostic assistant/tool elapsed sums and `complete`, `partial`, or `unavailable` coverage | Assistant intervals and paired tool hooks |
| `data_quality` | Numeric validity plus separate token and provider-cost status. Invalid rows must be quarantined from aggregates | Joiner validation |
| `tokens_scope` | `tree` if the totals include turns from subagent (child) sessions spawned during the phase; `main` if only the phase's own session contributed | Harness — each turn's session and recursively recorded `parentID` chain |
| `subagents` | Child rollup and `sessions[]` detail. `spawned` includes zero-token/failed children; `contributors` and compatibility `count` include token-bearing children | Child lifecycle and turn events |

**Related subagent tokens are always in the total.** A verifier that fans out sub-verifiers, or an implementer that delegates to a `subtask`, runs those in child sessions. The joiner follows each session's recorded parent chain to the active phase root, so usage covers the whole phase tree without absorbing unrelated interleaved roots. `spawned - contributors` is the number of children that started but produced no retained token-bearing turn. Each `sessions[]` row carries lifecycle time, usage, models and optional harness-provided agent type.

**Wall time is not human effort.** `elapsed_ms` answers how long the operator waited. `observed_active_effort.observed_active_ms` is the union of observed assistant-message and tool intervals across the phase tree, so overlapping tools and parallel children are counted once. `assistant_elapsed_ms` and `tool_elapsed_ms` are diagnostic sums whose intervals can overlap; never add them. Use observed active time for comparisons only when `coverage:"complete"`; `partial` is a lower bound and `unavailable` is not zero.

The design principle behind the split: **attempt and verdict are framework data, not harness data** — they are parsed deterministically from the checklist the process already maintains, identically in any harness. Only phase, model and tokens are harness-sourced, which shrinks the fragile surface to three fields.

## 2. Quick start (OpenCode)

```bash
# 1. Start OpenCode with capture enabled (per shell, or export it in your profile):
PLAYBOOK_TELEMETRY=1 opencode

# 2. Work normally — run /implement, /verify, /fix …
#    Events append to verification/telemetry/events.ndjson (best-effort, never
#    interferes with a run; without the env var the plugin registers nothing).

# 3. Produce the per-phase records:
node scripts/playbook-telemetry.mjs --checklist=verification/MyFeature-Checklist.md
```

Each line is one phase execution. TfLens must upsert by `phase_execution_id`, because re-reading the transient event file re-emits previously seen windows.

## 3. Reading the numbers — three worked questions

**"What does a verify cost us?"**

```bash
node scripts/playbook-telemetry.mjs --checklist=… | \
  jq -s '[.[] | select(.phase=="verify")] | {runs: length, usd: (map(.cost_usd) | add)}'
```

**"Is the tier map right?"** Group `cost_usd` and `gate_verdict` by `tier`. The deciding signal: if items built on `standard` keep needing `fix` runs (`attempt` climbing, verdicts `FAIL`), the cheap tier is costing you rework — promote the builder agent. If everything passes first try, try demoting a phase and watch the same signal. Data corrects the map, not opinion.

**"When should fix escalate?"** The `escalation` policy in `model-tiers.yml` says frontier after 2 failed attempts. Your records show whether attempt-3-on-frontier actually converges faster than attempt-3-on-standard — tune `after_attempts` accordingly.

## 4. Trust rules

- **Never self-reported.** Models are never asked how many tokens they used; every number comes from the harness's own event stream or from deterministic parsing of the checklist.
- **Never estimated.** Missing time/cost signals produce `null`. A schema-2 turn missing required token components makes the row invalid/incomplete; sparse legacy events are `legacy-unverified`. Compatibility zeros on either status must not enter aggregates.
- **Never in the way.** The plugin is opt-in (`PLAYBOOK_TELEMETRY=1`), fire-and-forget, and error-isolated — a telemetry failure can lose a record, never break a run.
- **Coverage-labelled.** Incomplete windows and unpaired timing events are visible rather than converted to zero.
- **Reviewable before it leaves the repo.** `events.ndjson` lives in your project (`verification/telemetry/`); it carries ids, counts, event names and command names — no raw command arguments, prompt text or code. Rotate it only after a consumer has checkpointed all `phase_execution_id` values.

## 5. Claude Code — session-level, honestly

The Playbook is OpenCode-first; the Claude Code path is documented for parity but no Claude transcript parser is built or planned. Claude Code exposes less: hooks carry no token counts and per-subagent usage is not surfaced through hooks. The practical setup (full evidence chain in [`Telemetry-Hooks.md`](Telemetry-Hooks.md)):

- Run **session-per-phase** (the launcher records the phase name and model), then take tokens from OpenTelemetry (`claude_code.token.usage` to a local collector) or, for headless mechanical phases, from `claude -p --output-format json` (exact, includes `total_cost_usd`).
- Records get `granularity: "session"` so consumers know they are phase≈session totals rather than per-message sums. The schema-2 OpenCode effort/subagent contract is not currently emitted on that path.
- The checklist-parsed fields (`attempt`, `gate_verdict`, `project_type`) are identical to OpenCode — that half of every record never degrades.[^claude-subagents]

[^claude-subagents]: Verified 2026-08-20 on Claude Code 2.1.x: the `SubagentStop` hook payload carries `agent_transcript_path`, and subagent transcripts sit at `<transcript-dir>/<session-id>/subagents/agent-<id>.jsonl` in the same (undocumented) JSONL format with per-message `usage`, so a transcript-window parser *could* recover a subagent split there. Recorded for completeness only — the Playbook will not build that parser.

## 6. FAQ

- **"events.ndjson doesn't exist."** The plugin only registers when `PLAYBOOK_TELEMETRY=1` was set before OpenCode started. Set it and restart.
- **"Records show attempt: null."** Pass `--checklist=` pointing at the checklist the phases ran against; attempt/verdict are parsed from it.
- **"cost_usd is 0 on every record."** See the v2-engine caveat in `Telemetry-Hooks.md`. Non-zero-token zero cost is labelled `cost_status:"zero-unverified"` and excluded from measured-cost aggregates; compute a separately labelled rate-card estimate if needed.
- **"Two phases in one session?"** Each `command.execute.before` starts a new record for that session; the joiner closes only that session's previous window. Interleaved top-level sessions remain isolated, while recursively linked child sessions roll up only to their own active root. Session reuse across phases is fine.
- **"Why is elapsed null?"** The event file ended before a root `session.idle`, so the joiner emitted `complete:false`, `end_reason:"eof"` and incomplete token/cost status. Do not calculate a duration from the file modification time or aggregate its partial usage.
- **"Why do assistant and tool elapsed sums exceed observed active time?"** Their intervals overlap. `observed_active_ms` unions them and is the comparison value; do not add the diagnostic component sums.
- **"Why do spawned and contributors differ?"** A child session was created but produced no retained token-bearing assistant turn. This includes early failures and zero-token tasks; it is why the two counts are intentionally separate.
- **"Why is cost null?"** No valid provider cost was available for every retained turn. Check `data_quality.cost_status`; `unavailable`, `partial`, and `invalid` are never zero.
- **"Can I commit events.ndjson?"** It contains no prompt/code content, but it is transient capture noise. Ignore exactly `/verification/telemetry/events.ndjson`; do **not** ignore `verification/telemetry/`, because that would also discard the durable `misses.ndjson` stream described below.

## 7. Miss telemetry — durable defect and rework history

`verification/telemetry/misses.ndjson` is a second, append-only stream. Unlike the transient,
rotatable `events.ndjson`, **commit `misses.ndjson` and never rotate it**. The repository-root
ignore rule is deliberately selective:

```gitignore
/verification/telemetry/events.ndjson
```

Broader rules such as `verification/telemetry/` or `*.ndjson` are wrong: they silently erase
the history this feature exists to preserve.

### 7.1 The three schema-1 record kinds

All values below are JSON values on one NDJSON line. Identity and classifications are stored;
cost data is joined at read time and is never written back into the durable stream.

**`miss` — open a defect**

```json
{"kind":"miss","ts":"2026-08-28T11:04:19.000Z","schema":1,"miss_id":"MISS-20260828-03","item_id":"REQ-014","feature":"cost-report","miss_class":"partial-implementation","artifact":"src","severity":"major","why_missed":"insufficient-verify-method","origin_phase":"build","origin_agent":"builder","origin_run_id":"ses_123","origin_confidence":"linked","origin_model":"anthropic/claude-sonnet-5","actor":"a3f1","found_by":"verifier","found_phase":"verify","found_phase_gate":"FAIL","project_type":"dotnet-react","harness":"opencode"}
```

Required classifications are `miss_class`, `artifact`, `severity` and `found_by`. Item/feature,
origin, actor and phase-gate fields may be `null`; `why_missed: null` means **not assessed**.
`origin_model` and `origin_confidence` are emitter-derived from `origin_run_id`, never accepted
from the caller. Confidence is `linked`, `inferred` or `unknown`; only `linked` records may be
used for model/tier miss rates. `instruction-ignored` is a valid `why_missed` only when a written
rule was loaded by an **agent** and that agent did not follow it; it is never a human judgement.
`miss_id` keeps the schema-compatible `MISS-YYYYMMDD-<2+ digits>` shape, but the numeric suffix
is deliberately not a daily sequence: it combines the record timestamp with cryptographic
entropy. Existing-id collisions are detected and retried, so independent processes or machines
do not allocate the same predictable “next” id.

**`miss-fix` — append a lifecycle outcome**

```json
{"kind":"miss-fix","ts":"2026-08-28T14:52:07.000Z","schema":1,"miss_id":"MISS-20260828-03","item_id":"REQ-014","fix_phase":"fix","fix_run_id":"ses_456","fix_attempt":1,"verdict_after":"pass","reopened":false,"cost_attribution":null,"actor":"a3f1"}
```

`verdict_after` reuses checklist status (`pass`, `fail`, `data-gap`, `blocked`, `deferred`,
`abandoned`). `fix_run_id` is omitted if it is not known—never replaced by a plausible run.
The reader enriches this record with `model`, `tier`, tokens, dollars, token scope and subagent
rollup from the transient event window:

- `sole`: exactly one miss points at that fix window; this is the measured cost-per-miss set.
- `shared:<n>`: one window fixed *n* misses; show the equally apportioned figure separately,
  explicitly labelled as apportioned. Never blend it into the sole headline.
- `none`: no resolvable window; token/cost fields are `null`, not zero or an estimate.

Window lookup explicitly maps framework phases to harness commands: `plan` → `feature-plan`,
`build`/`self-review` → `implement`, `verify`/`verification-results-gate` → `verify`, `fix` →
`fix`, and both bug-analysis phases → `analyze-fix`. It selects the latest matching window whose
start is at or before the miss/fix timestamp. Unmappable phases or absent exact windows yield
`null`/`none`. `shared:<n>` counts only closes resolving to that exact window, not every close
carrying the same reused session id. Usage and child token/cost values are apportioned; the
`subagents.count` field remains the integer count of child sessions in the measured window.

**`miss-amend` — complete a null classification**

```json
{"kind":"miss-amend","ts":"2026-08-29T09:00:00.000Z","schema":1,"miss_id":"MISS-20260828-03","field":"why_missed","value":"insufficient-verify-method"}
```

An amendment may complete an amendable closed-vocabulary judgement that is still `null`; it
may never overwrite an existing value. Observations and derived facts—verdicts, provenance,
models, tokens and costs—are not amendable. Orphans and overwrite attempts are invalid.

### 7.2 CLI and lifecycle

Writes are best-effort and opt-in under `PLAYBOOK_TELEMETRY=1`; the miss CLI prints refusals but
exits zero so telemetry cannot block delivery. Read commands work without the flag.

```bash
# Open (add --if-new to collapse the same still-live item/class; --fixed if already repaired)
PLAYBOOK_TELEMETRY=1 node scripts/playbook-miss.mjs open \
  --miss-class=wrong-behaviour --artifact=src --severity=major \
  --why-missed=insufficient-verify-method --found-by=verifier \
  --item-id=REQ-014 --found-phase=verify --found-phase-gate=FAIL --if-new

# Append a result; omit --fix-run-id if no exact repairing run is known
PLAYBOOK_TELEMETRY=1 node scripts/playbook-miss.mjs close \
  --miss-id=MISS-20260828-03 --verdict-after=pass --fix-run-id=ses_456

# Complete a null judgement; allocate an id; inspect records/backlog
PLAYBOOK_TELEMETRY=1 node scripts/playbook-miss.mjs amend \
  MISS-20260828-03 why_missed insufficient-verify-method
node scripts/playbook-miss.mjs next-id
node scripts/playbook-miss.mjs list
node scripts/playbook-miss.mjs list --item-id=REQ-014 --open

# Fold amendments and join fix costs without mutating misses.ndjson
node scripts/playbook-telemetry.mjs --misses
```

Lifecycle predicates intentionally differ. The **backlog** is records whose latest
`verdict_after` is neither `pass` nor `abandoned`; the `--if-new` **still-live** collapse check
only treats `pass` as closed. Thus `abandoned` is not outstanding work, but a later failure is
the same defect rather than a duplicate. `deferred` remains open in both.

### 7.3 Denominators, privacy and people

- Every optional-classification distribution reports **`n of N assessed`**. Null means not
  assessed, not membership in a zero/other bucket. `FIELD_SINCE` excludes records created before
  a field existed and reports that exclusion; adding a field must not make historical quality
  appear to fall overnight. `escapes_missing_why` likewise prints `n of N eligible escapes` and
  excludes historical escapes that predate `why_missed`.
- `misses.ndjson` is committed, so closed vocabularies are the privacy boundary. Store ids,
  enums and paths only—no issue title, reproduction prose, expected/actual text, source content,
  secrets or unredacted PII.
- `actor` is **aggregate-only**. It can support team-level coverage analysis, but no report,
  export or dashboard may show miss, amendment, rework or cost figures grouped by actor. There
  is no per-actor reporting or ranking.
- OpenCode captures provider-reported fix cost from event windows (subject to the v2 caveat in
  `Telemetry-Hooks.md`). Claude Code can still record the same closed-vocabulary classification,
  but when no compatible events exist origin linkage and fix cost honestly degrade to
  inferred/unknown and `null` / `none`.
