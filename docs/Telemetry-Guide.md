# Telemetry Guide — what each phase cost, on which model, with what outcome

**Audience:** anyone operating the playbook. **TL;DR:** opt-in per-phase records — model, tokens, cost, attempt, gate verdict — captured without ever asking a model to self-report. **Capture-point evidence and design:** [`Telemetry-Hooks.md`](Telemetry-Hooks.md) · **what to do with the numbers:** [`Model-Routing-Guide.md`](Model-Routing-Guide.md).

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
| `tokens_scope` | `tree` if the totals include turns from subagent (child) sessions spawned during the phase; `main` if only the phase's own session contributed | Harness — `parentID` on each turn row (or a sessionID different from the phase's) |
| `subagents` | `{count, tokens_out, cost_usd}` — how much of the total came from child sessions (`count` = distinct child sessions). Always present; all zeros when `tokens_scope` is `main` | Harness — same rows, attributed by `parentID` |

**Subagent tokens are always in the total.** A verifier that fans out sub-verifiers, or an implementer that delegates to a `subtask`, runs those in child sessions; the plugin records every assistant turn between phase-start and phase-end regardless of which session it belongs to, so `tokens_in`/`tokens_out`/`cost_usd` are the cost of the whole phase tree. `tokens_scope` and `subagents` make that explicit — `cost_usd - subagents.cost_usd` is what the main session alone spent — without changing the total.

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
- **"Two phases in one session?"** Each `command.execute.before` starts a new record; the joiner closes the previous one. Session-reuse across phases is fine.
- **"Can I commit events.ndjson?"** It's safe (no content, only counts/ids) but usually noise — most teams gitignore `verification/telemetry/` and keep the joined per-phase records instead.
