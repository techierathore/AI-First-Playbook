# Telemetry Guide — what each phase cost, on which model, with what outcome

**Audience:** anyone operating the playbook. **TL;DR:** opt-in per-phase records plus a durable miss stream — model, tokens, cost, attempt, verdict and escaped/reworked defects — captured without ever asking a model to self-report numbers. **Capture-point evidence and design:** [`Telemetry-Hooks.md`](Telemetry-Hooks.md) · **what to do with the numbers:** [`Model-Routing-Guide.md`](Model-Routing-Guide.md).

## 1. What you get

One NDJSON record per phase execution:

```json
{"phase":"verify", "model":"anthropic/claude-sonnet-5", "tier":"standard",
 "tokens_in":48213, "tokens_out":9120, "cost_usd":0.41,
 "attempt":2, "gate_verdict":"FAIL", "project_type":"dotnet-react",
 "timestamp":"2026-08-20T09:12:00Z", "session_id":"ses_…",
 "harness":"opencode", "granularity":"message", "turns":14,
 "tokens_scope":"tree", "subagents":{"count":2, "tokens_out":1840, "cost_usd":0.06}}
```

Field by field:

| Field | Meaning | Where it comes from |
|---|---|---|
| `phase` | The command that ran (`verify`, `implement`, `fix`, …) | Harness — the plugin's `command.execute.before` hook |
| `model` | What **actually** ran (dominant model across the phase's turns) | Harness — per-message `providerID/modelID`; never self-reported by the model |
| `tier` | The tier that model reverse-maps to in `playbook/model-tiers.yml` | Framework — deterministic lookup |
| `tokens_in` / `tokens_out` | Σ input+cache / output+reasoning tokens over the phase | Harness — per-message token rollups |
| `cost_usd` | Σ provider-reported cost over the phase | Harness (see the v2-engine caveat in `Telemetry-Hooks.md`) |
| `attempt` | Which run this was for the checklist (1st, 2nd, …) | Framework — counted from the checklist's `### Run on` entries |
| `gate_verdict` | Worst verdict on the checklist: `BLOCKED` > `FAIL` > `DATA-GAP` > `PASS (code-audit)` > `PASS` | Framework — parsed from `**Verifier Result**:` lines |
| `project_type` | Your stack label | Framework — `playbook/environment-profile.yml` |
| `granularity` | `message` (OpenCode — exact per-phase) or `session` (Claude Code — see §5) | Capture path |
| `tokens_scope` | `tree` if the totals include turns from subagent (child) sessions spawned during the phase; `main` if only the phase's own session contributed | Harness — each turn's session and recursively recorded `parentID` chain |
| `subagents` | `{count, tokens_out, cost_usd}` — how much of the total came from child sessions (`count` = distinct child sessions). Always present; all zeros when `tokens_scope` is `main` | Harness — same rows, attributed by `parentID` |

**Related subagent tokens are always in the total.** A verifier that fans out sub-verifiers, or an implementer that delegates to a `subtask`, runs those in child sessions. The joiner follows each session's recorded parent chain to the active phase root, so `tokens_in`/`tokens_out`/`cost_usd` cover the whole phase tree without absorbing unrelated interleaved top-level sessions. `tokens_scope` and `subagents` make that explicit — `cost_usd - subagents.cost_usd` is what the main session alone spent — without changing the total.

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

Each line of output is one phase execution, ready for `jq`, a spreadsheet, or your dashboard of choice.

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
- **Never estimated.** A missing signal produces `null`, not a guess (see the Claude Code granularity note, §5).
- **Never in the way.** The plugin is opt-in (`PLAYBOOK_TELEMETRY=1`), fire-and-forget, and error-isolated — a telemetry failure can lose a record, never break a run.
- **Reviewable before it leaves the repo.** `events.ndjson` lives in your project (`verification/telemetry/`); it carries ids, counts and command names — no prompt text, no code. Rotate or delete it freely; the joiner only ever reads.

## 5. Claude Code — session-level, honestly

The Playbook is OpenCode-first; the Claude Code path is documented for parity but no Claude transcript parser is built or planned. Claude Code exposes less: hooks carry no token counts and per-subagent usage is not surfaced through hooks. The practical setup (full evidence chain in [`Telemetry-Hooks.md`](Telemetry-Hooks.md)):

- Run **session-per-phase** (the launcher records the phase name and model), then take tokens from OpenTelemetry (`claude_code.token.usage` to a local collector) or, for headless mechanical phases, from `claude -p --output-format json` (exact, includes `total_cost_usd`).
- Records get `granularity: "session"` so consumers know they are phase≈session totals rather than per-message sums; `tokens_scope`/`subagents` are not produced on that path.
- The checklist-parsed fields (`attempt`, `gate_verdict`, `project_type`) are identical to OpenCode — that half of every record never degrades.[^claude-subagents]

[^claude-subagents]: Verified 2026-08-20 on Claude Code 2.1.x: the `SubagentStop` hook payload carries `agent_transcript_path`, and subagent transcripts sit at `<transcript-dir>/<session-id>/subagents/agent-<id>.jsonl` in the same (undocumented) JSONL format with per-message `usage`, so a transcript-window parser *could* recover a subagent split there. Recorded for completeness only — the Playbook will not build that parser.

## 6. FAQ

- **"events.ndjson doesn't exist."** The plugin only registers when `PLAYBOOK_TELEMETRY=1` was set before OpenCode started. Set it and restart.
- **"Records show attempt: null."** Pass `--checklist=` pointing at the checklist the phases ran against; attempt/verdict are parsed from it.
- **"cost_usd is 0 on every record."** See the v2-engine caveat in `Telemetry-Hooks.md` — tokens are correct everywhere; recompute cost from tokens × your price sheet until provider cost lands, which you need for Claude Code parity anyway.
- **"Two phases in one session?"** Each `command.execute.before` starts a new record for that session; the joiner closes only that session's previous window. Interleaved top-level sessions remain isolated, while recursively linked child sessions roll up only to their own active root. Session reuse across phases is fine.
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
