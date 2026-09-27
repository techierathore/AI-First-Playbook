# OpenCode Telemetry Guide

OpenCode telemetry is optional operational evidence. It measures command execution, model usage,
provider-reported cost, active operation intervals, and child-session contribution. It never
changes product behavior, checklist status, or a Verifier verdict.

## 1. Runtime boundary

The target installation contains:

- `.opencode/plugin/telemetry.ts` — best-effort OpenCode capture;
- `scripts/playbook-telemetry.mjs` — phase and miss exporter;
- `scripts/playbook-miss.mjs` and `scripts/miss-lib.mjs` — durable miss lifecycle CLI/library;
- `playbook/model-tiers.yml` — reverse mapping from observed OpenCode models to tiers; and
- `verification/telemetry/` — transient events plus durable miss history.

Source-only validation and routing tools are not required to export target telemetry.

## 2. Enable capture before OpenCode starts

From the target repository root:

```bash
PLAYBOOK_TELEMETRY=1 opencode
```

The plugin registers at process startup. Restart after changing the variable or plugin
configuration. Capture failure is fire-and-forget: delivery continues and missing signals remain
visibly unavailable.

## 3. Retention

The streams have different contracts:

| Path | Meaning | Retention |
|---|---|---|
| `verification/telemetry/events.ndjson` | High-volume OpenCode observations used to build command windows. | Transient. Ignore in Git and rotate only after approved consumers checkpoint completed execution IDs. |
| `verification/telemetry/misses.ndjson` | Append-only miss, fix, and amendment lifecycle. | Durable. Do not rewrite, broadly ignore, or rotate. |

Use this exact repository-root ignore rule for transient capture:

```gitignore
/verification/telemetry/events.ndjson
```

Do not ignore `verification/telemetry/` or `*.ndjson`; either pattern discards durable history.

## 4. Export command phases

```bash
node scripts/playbook-telemetry.mjs \
  --checklist=docs/<Feature>-Implementation-Checklist.md
```

The command reads event windows and emits one schema-2 `phase-metric` NDJSON row per command
execution to stdout. Diagnostics go to stderr. Consumers ingest stdout and upsert by repository
identity plus `phase_execution_id`; re-export is expected and must be idempotent.

### Command phase versus conceptual phase

| Command phase | Conceptual work included |
|---|---|
| `feature-plan` | Phase 1 Plan |
| `implement` | Phase 3 Build plus Phase 4 Self-review |
| `verify` | Phase 5 Verify plus Phase 6 Results Gate |
| `fix` | Phase 7 Fix and its self-review |
| `analyze-fix` | Phase 9/10 defect analysis |

Do not estimate token or cost shares for conceptual work inside one command window.

## 5. Phase record interpretation

| Field group | Meaning |
|---|---|
| `phase`, `phase_execution_id`, `harness`, `session_id` | Observed OpenCode command and stable execution identity. |
| `started_at`, `ended_at`, `elapsed_ms`, `complete`, `end_reason` | Wall-clock boundary and completion state. EOF/incomplete windows have null elapsed values. |
| `models[]`, `model`, `tier` | Full observed model mix, dominant compatibility label, and tier reverse-mapping. |
| `tokens` | Input, output, reasoning, cache-read, and cache-write usage. |
| `cost_usd` | Provider-reported measured cost. Missing or partial cost is null/partial, never estimated. |
| `observed_active_effort` | Union of observed assistant/tool/child intervals; partial coverage is a lower bound. |
| `tokens_scope`, `subagents` | Whether totals include the session tree and counts of spawned/contributing children. |
| `data_quality` | Validity, token status, cost status, and aggregation eligibility. |
| `attempt`, `gate_verdict`, `project_type` | Current checklist/profile snapshots at export time, not guaranteed historical values for the command window. |

## 6. Quality rules

- Duration aggregation requires `complete:true` and non-null `elapsed_ms`.
- Active-time comparison requires complete windows and complete coverage; partial is a lower bound.
- Token aggregation requires valid, complete token status.
- Measured-cost aggregation also requires complete cost status. Keep estimates in separately named
  fields/series.
- Attribute mixed-model usage from `models[]`, not only the dominant label.
- Parent phase totals already include linked child usage when scope is `tree`; do not add it again.
- Distinguish spawned children from usage contributors.
- Preserve nulls and quarantine invalid rows. Missing files, malformed events, incomplete windows,
  or unsupported observations are not zero.

## 7. Durable miss lifecycle

Open a classified miss through the CLI; never edit the stream directly:

```bash
PLAYBOOK_TELEMETRY=1 node scripts/playbook-miss.mjs open --if-new \
  --harness=opencode \
  --miss-class=wrong-behaviour \
  --artifact=src \
  --severity=major \
  --found-by=verifier \
  --item-id=REQ-014
```

Close only after the relevant workflow outcome, and let independent verification authoritatively
record `pass`. `miss-amend` may fill an eligible still-null classification field but may not
overwrite an existing value or observed usage/provenance.

Export folded miss lifecycle records:

```bash
node scripts/playbook-telemetry.mjs --misses
```

The exporter joins exact OpenCode origin/fix windows when retained. Missing windows produce
unknown/null provenance and cost rather than a plausible estimate.

### Reporting rules

- Deduplicate/fold by immutable `miss_id` and valid append order.
- Separate human and production escapes.
- Publish numerator, denominator, cohort, exclusions, and `n of N assessed` for optional fields.
- Use only linked observed origins for model/tier comparisons.
- Headline measured repair cost uses `sole`; show `shared:<n>` separately and exclude `none`.
- Never rank people or break miss, escape, rework, time, token, or cost metrics down by actor.

## 8. Privacy

Telemetry and miss records use repository/session/command identities and closed vocabularies. They
must not contain prompt text, source code, raw issue descriptions, secrets, credentials, customer
data, or unredacted PII. Store detailed runtime proof under the approved verification evidence
path and link it from checklist/handoff records.

## 9. Troubleshooting

| Symptom | Action |
|---|---|
| No event file | Confirm `PLAYBOOK_TELEMETRY=1` existed before OpenCode started, then restart. |
| Incomplete final window | Preserve it as incomplete; do not invent an end time. |
| Unknown model/tier | Keep the observed model if present and leave tier unknown when reverse mapping fails. |
| Null cost | Report unavailable/partial and exclude from measured-cost aggregates. |
| Duplicate export rows | Upsert by repository and `phase_execution_id`; export is intentionally repeatable. |
| Durable stream write refusal | Leave linkage visibly pending and continue the delivery/verdict path. |

See [Telemetry-Hooks.md](Telemetry-Hooks.md),
[Phase-Efficiency-TfLens-Contract.md](Phase-Efficiency-TfLens-Contract.md), and
[Miss-Telemetry-TfLens-From-AIFP.md](Miss-Telemetry-TfLens-From-AIFP.md).
