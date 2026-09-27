# AI-First Playbook — Operating Guide

| | |
|---|---|
| Purpose | How a team runs the Playbook day to day: roles, gates, the environment profile, handoffs, security, telemetry, YOLO runs, releases, measures and troubleshooting. |
| Audience | Process owners, leads, developers, QA, release and operations owners. |
| Replaces | `Operating-Model`, `Handoffs`, `Environment-Profile`, `Release-And-Operations`, `Security`, `Adoption-Metrics`, `Troubleshooting`, `Usage`, `Installation` and the operating half of the old Getting Started (originals kept in `docs/archive/replaced/`). |
| Detail | Maintainer references live in [maintainer/](maintainer): [Telemetry-Guide](maintainer/Telemetry-Guide.md), [YOLO-Mode-Guide](maintainer/YOLO-Mode-Guide.md), [Model-Routing-Guide](maintainer/Model-Routing-Guide.md), [OpenCode-Guide](maintainer/OpenCode-Guide.md), [OpenCode-WSL-Setup-Guide](maintainer/OpenCode-WSL-Setup-Guide.md). |

Start with [Getting-Started.md](Getting-Started.md); the ten phases are explained in
[Playbook-How-It-Works.md](Playbook-How-It-Works.md) and [phases/](../phases).

## 1. Roles and feature states

Roles: Product/BA, Analyst, Orchestrator/Developer, Verifier, QA, Security, Release/Operations and
Process Owner. One person may hold several human roles, but each gate names its producer, consumer
and accountable approver.

Feature states run
`proposed -> planned -> plan-approved -> building -> self-reviewed -> verification-in-progress`
`-> verification-failed | data-gap | blocked -> human-accepted -> pr-ready -> pr-approved`
`-> release-ready -> deployed -> post-deploy-validated -> closed`, with `deferred` and `abandoned`
as exits and `incident-open -> incident-mitigated -> incident-resolved` and `operations-owned` for
operations. The closed lists live in `templates/checklist-metadata.yml`.

| Agent | Entry points | Responsibility | Must not do |
|---|---|---|---|
| Analyst | `/feature-plan`, `/legacy-audit`, `/analyze-fix`, `/create-issue-list`, `/add-doc`, `/refresh-doc`, `/upgrade-docs` | Ask for missing context; produce or amend documents and checklists | Guess context or write product code |
| Orchestrator | `/implement`, `/fix` | Plan waves, assign one owner per slice, self-test, persist the implementation summary | Leave items for "another run" or verify its own work |
| Builder | spawned per slice | Implement only its slice; report blockers and miss candidates | Edit other slices, the checklist or the miss stream |
| Verifier | `/verify` (fresh subagent) | Execute deployment steps and real behaviour; record inline verdicts | Edit product source, configuration or lockfiles |

Phases 2, 4, 6 and 8 have no command of their own: plan review and acceptance are human gates;
self-review runs inside `/implement` and `/fix`; the results gate is the output of `/verify`.

## 2. The environment profile

`.playbook/environment-profile.yml` is authoritative for topology, OS, shell, build, test, start,
stop and cleanup commands, application URLs, database method and config path, migration command,
browser endpoint, log paths, the allowed secret channels and retention. Replace every placeholder
and try each command by hand before the first run; a value nobody knows is resolved with its
owner, never guessed. `node .playbook/scripts/playbook-probe.mjs` shows each fact as `ok`,
`blocked` (placeholder) or `down` (declared but unreachable). Use a short stable `project_type`:
it appears in telemetry.

## 3. Gates and handoffs

Every gate persists a handoff record; chat can explain a decision but is not the record.
`node .playbook/scripts/handoff-record.mjs create <kind> --out=<path> --set "Label=value" ...`
refuses a record that is incomplete, and `validate` checks existing ones. All eight kinds carry
the ten standing rows (producer, consumer, accountable approver, approver identity, status
transition, evidence, open decisions, escalation owner, exception expiry, UTC time); their full
shapes are in [Playbook-Document-Schemas.md](Playbook-Document-Schemas.md) §4.

| Record | Producer → consumer | Accountable owner |
|---|---|---|
| `plan-approval` | Analyst → Orchestrator | named plan approver |
| `implementation-summary` | Orchestrator → Verifier | engineering owner |
| `verification-results` | Verifier → QA/approver | accountable Verifier |
| `acceptance` | QA/BA → release owner | acceptance approver |
| `pr-evidence` | developer → reviewer | PR approver |
| `release-readiness` | release team → operations | release owner and rollback authority |
| `operations-transfer` | release owner → operations owner | incoming owner |
| `incident` | incident team → service and process owners | incident commander |

Ownership transfer is complete only when the receiving owner acknowledges the runbook, open work,
escalation route and next due date. Link evidence; never paste secrets or large unredacted output.

## 4. Operating flow

1. **Entry.** Greenfield: a BRD or project specification, the mockup when there is UI, standards,
   DB architecture, output folder and prefix. Brownfield: `/legacy-audit` first, to preserve
   behaviour, baselines, ownership, risks and safe seams. A known exact checklist edit:
   `/amend-checklist`. A bug, story or vague gap: `/analyze-fix` against the existing checklist.
2. **Plan.** `/feature-plan` in a fresh chat; the checklist must pass `checklist-lint.mjs` and
   `plan-coverage.mjs`.
3. **Approve.** A person reviews every requirement, mockup element and Verify method and records
   `plan-approval`. Implementation never starts from an unapproved checkbox or a chat statement.
4. **Build and self-review.** `/implement` in a fresh chat; it ends only when
   `phase-complete.mjs build` passes.
5. **Verify.** `/verify` in a fresh context; results are inline in the checklist.
6. **Fix.** `/fix -> fresh /verify` until ALL PASS. `DATA-GAP` needs approved seed data; `BLOCKED`
   needs the missing access or an authorised, expiring exception. Neither is ever PASS.
7. **Accept.** QA/BA/Product review the PASS checklist, evidence and human guides and record
   `acceptance`. A bug found here goes through `/analyze-fix` in escaped-bug mode, then `/fix` and
   `/verify`.
8. **Release.** Agents prepare changes; people stage, commit, push, tag and release. Record
   `pr-evidence` and `release-readiness`; after deployment run the recorded checks; a failed check
   pauses rollout or invokes rollback. Record `operations-transfer`.
9. **Incidents.** Preserve logs, traces, deployment metadata, impact and the reproduction before
   changing anything; follow the team's severity, communication and rollback authority; then run
   [Phase 10](../phases/10-production-bugs.md) and record `incident` with its regression item.

## 5. Security and secrets

The standing rule is in `AGENTS.md`: secrets come only from an approved secret manager, an
environment reference, protected stdin or a protected temporary file, and never appear in command
arguments, Markdown, logs, URLs or evidence. The profile names the channels, never values. Redact
tokens, passwords, connection strings, cookies, authorization headers and PII before evidence is
stored; `handoff-record.mjs` and the grader refuse secret-like values. Set `PLAYBOOK_CHECKLIST` to
restrict the Verifier's checklist writes to one file. A secret found in evidence is rotated, the
artifact removed, and the run repeated with redaction.

## 6. Command catalogue

| Command | Example | Use it for |
|---|---|---|
| `/feature-plan` | `/feature-plan @docs/BRDs/BRD-004.md @src/mockui/Dashboard.tsx` | The verifiable document set and checklist |
| `/legacy-audit` | `/legacy-audit @src/legacy-inventory/` | Baseline an unknown module before change |
| `/implement` | `/implement @docs/Cost/Cost-Implementation-Checklist.md` | Build the approved scope in waves, self-tested |
| `/verify` | `/verify @docs/Cost/Cost-Implementation-Checklist.md` | Fresh, executed verification with inline verdicts |
| `/fix` | `/fix @docs/Cost/Cost-Implementation-Checklist.md` | Repair failing items and return to `/verify` |
| `/analyze-fix` | `/analyze-fix @docs/Cost/Cost-Issues.md @src/` | Root cause and checklist patch for a bug, story or gap |
| `/create-issue-list` | `/create-issue-list PROJ-1234 PROJ-1235` | A transient Issues file from Jira or manual input |
| `/log-miss` | `/log-miss "export ignored the date filter" REQ-014` | Classify a one-line miss between phases |
| `/amend-checklist` | `/amend-checklist @<checklist>` then the exact edit | A known, surgical checklist change |
| `/add-doc` | `/add-doc developer flow guide @docs/Cost/ @src/` | Human companion documents built from running code |
| `/refresh-doc` | `/refresh-doc @docs/Cost/` | Reconcile documents with current code |
| `/upgrade-docs` | `/upgrade-docs @docs/Legacy/` | One-time conversion of legacy documents |
| `/generate-html` | `/generate-html @docs/Cost/` | Render human documents; never the checklist |
| `/archive-checklist` | `/archive-checklist @<checklist>` | Compact mature PASS history, restorably |

## 7. Runtime scripts

All installed under `.playbook/scripts/`; each prints what it did and exits non-zero on a problem.

| Script | Does |
|---|---|
| `playbook-probe.mjs` | Resolve every profile fact; report placeholders and unreachable services by name |
| `playbook-app-lifecycle.mjs` | Start, poll, record and stop only the processes a run started |
| `profile-gates.mjs` | Run the profile's build and test commands as gates |
| `checklist-create.mjs` | Scaffold a checklist; sync its Status Table from metadata |
| `checklist-lint.mjs` | Check a checklist against its schema |
| `checklist-plan.mjs` | Waves for `/implement` and `/fix`; buckets and adapters for `/verify` |
| `phase-complete.mjs` | Recompute whether a build or fix phase is finished |
| `plan-coverage.mjs` | Map every requirement ID and screen to an item |
| `checklist-miss-coordinator.mjs` | Record a miss and link it to its item, serially |
| `handoff-record.mjs` | Create and validate gate records |
| `doc-scaffold.mjs`, `doc-check.mjs` | Write and check human documents against their schemas |
| `render-docs.mjs` | Render human documents to HTML safely |
| `doc-drift.mjs`, `reference-lint.mjs` | Name stale code references and broken links |
| `doc-upgrade.mjs` | Back up legacy documents before an upgrade |
| `playbook-miss.mjs`, `playbook-telemetry.mjs` | Miss records and telemetry export |
| `deployment-step-runner.mjs` | Plan, then after approval run, a checklist's Automated deployment rows |
| `verification-result-writer.mjs`, `verification-summary.mjs` | Write Verifier outcomes into the checklist; render the final summary from it |
| `secret-safe-config-resolver.mjs` | Hand a config value to a command through a 0600 file or stdin |
| `smoke-runner.mjs`, `self-test-result-writer.mjs` | Run declared self-test probes; record them per item |
| `checklist-infra.mjs`, `checklist-deploy.mjs` | Keep Infrastructure Requirements and Deployment Steps in shape |
| `checklist-amend.mjs`, `checklist-archive.mjs` | Exact checklist edits with stable IDs; archive and restore PASS items |
| `feature-context.mjs`, `checklist-ingest.mjs` | Find a feature's checklist and documents; fold bugs and stories into it |
| `escaped-bug-workflow.mjs`, `incident-workflow.mjs` | Track escaped bugs and incidents to verified, miss-linked closure |
| `gate-check.mjs` | Evidence for the plan-review and verification-results gates |
| `issues-file.mjs`, `jira-issues.mjs` | Render and check Issues files; fetch Jira tickets |
| `dotnet-restore-diagnostics.mjs`, `windows-app-bridge-client.mjs` | Optional .NET feed and Windows desktop adapters |

## 8. Telemetry

Start OpenCode with `PLAYBOOK_TELEMETRY=1 opencode`; the plugin appends best-effort events to the
transient `verification/telemetry/events.ndjson`, which is git-ignored and may be rotated after
consumers checkpoint every `phase_execution_id`. `verification/telemetry/misses.ndjson` is durable
and append-only; commit it and never rotate it. Never ignore `verification/telemetry/` as a whole. Raw run evidence (probe
results, app logs, gate logs) goes to the git-ignored `verification/runs/<run-id>/` and is removed
after the profile's `retention.raw_runs_days` (7) — automatically when a new run starts, or with
`node .playbook/scripts/playbook-sweep.mjs --apply`; grader verdicts are kept 365 days.

Export with `node .playbook/scripts/playbook-telemetry.mjs --checklist=<checklist>` (one
`phase-metric` row per command execution) and `--misses` (miss lifecycle, joined with exact fix
windows). The telemetry dimension is the **command** phase: `implement` covers phases 3 and 4,
`verify` phases 5 and 6; never split tokens between conceptual phases by estimate. `attempt` and
`gate_verdict` are snapshots at export time, not history.

Quality filters: aggregate duration, tokens and cost only from `complete:true` windows with valid
data quality; never turn a missing file, incomplete window or unknown cost into zero; child usage
is already included in phase totals. A miss is recorded with the four questions of
[Playbook-Requirements.md](Playbook-Requirements.md) §3 (`--protocol=...`), which store one
`protocol_outcome`. The full field and CLI contract is in
[maintainer/Telemetry-Guide.md](maintainer/Telemetry-Guide.md).

## 9. Measures

Review weekly and publish numerator, denominator, cohort, exclusions and quality status beside
every rate: verified features, gate compliance, handoffs acknowledged, adoption by role,
verification lead time, blocked and data-gap duration, redaction failures and runtime cost.

| Measure | Definition | Denominator |
|---|---|---|
| Miss rate | Distinct `miss` records for eligible checklist items | Item executions with a terminal verify result in the period; misses without an item are shown apart |
| Escape rate | Misses found by `human` or `production` | All misses of the same origin cohort; human and production also shown apart |
| Rework incidence | Item executions with at least one `miss-fix` | The miss-rate denominator; an item counts once |
| Rework intensity | `miss-fix` records to date | Misses with at least one fix; deferred, abandoned and open stay visible |
| Time to close | UTC from `miss.ts` to the first later `miss-fix` with `verdict_after: pass` | Misses that reached pass; median and p90 with `closed n / eligible N` |

Deduplicate by `miss_id`, fold valid `miss-amend` records first, and use the backlog predicate
(latest verdict neither `pass` nor `abandoned`) for outstanding work. Optional fields
(`why_missed`, `protocol_outcome`) show `n of N assessed` after their introduction date. Model
attribution uses only `origin_confidence: linked`; headline fix cost uses `sole` attribution.
`actor` is aggregate-only: no measure is broken down by person or used to rank people. Fewer than
three records is insufficient data. Certify one champion and one backup per team.

## 10. YOLO runs

YOLO (`YOLO` in the command, or `PLAYBOOK_YOLO=1` at launch) pre-approves every gate except git
history: the plugins deny commits, pushes, tags and history rewrites in both modes. Run it only on
a VM or container holding the working copy and development-scoped credentials, and commit your own
work first so the tree can be restored. Provider usage limits are waited out by the optional
supervisor (`scripts/playbook-yolo.mjs` in a source checkout), which resumes the same session
after the reset. A run ends with `PLAYBOOK_RUN_COMPLETE:` or `PLAYBOOK_RUN_BLOCKED:`. Supervisor
detail: [maintainer/YOLO-Mode-Guide.md](maintainer/YOLO-Mode-Guide.md).

## 11. Model routing

Routing ships OFF: every command runs on the model chosen in OpenCode. With routing on, each
command runs at its tier from `.playbook/model-tiers.yml` (Economy, Standard, Frontier), and a
command's `model:` front matter overrides the TUI choice by design. In a source checkout,
`node scripts/playbook-routing.mjs status | set-tier | off` manages it. Detail:
[maintainer/Model-Routing-Guide.md](maintainer/Model-Routing-Guide.md).

## 12. Releases of the Playbook itself

The owner releases the npm package; agents never publish or tag. CI
(`.github/workflows/validate.yml`) runs the four npm test scripts and the grader on every push, on
Node 22.14.0, npm 11.5.1 and each supported OpenCode (1.18.32 and 2.0.18), and keeps the grader
output as a `grader-output-oc<version>` artefact for 90 days; `platforms.yml` repeats them on macOS
and Linux in UTC and Asia/Kolkata; the release workflow runs the same checks before publishing.

OpenCode 1 and 2 load the same install: each guard plugin is a directory under
`.opencode/playbook-plugin/` with `index.ts` (1.x) and `server.ts` (2.x). On 2.x the `PLAYBOOK_*`
variables (`PLAYBOOK_YOLO`, `PLAYBOOK_TELEMETRY`, `PLAYBOOK_GIT_APPROVED`, `PLAYBOOK_CHECKLIST`) are
read by the OpenCode server: start it with `--standalone` from the shell that sets them, or set them
on the background service. `node .playbook/scripts/playbook-guards.mjs --config` checks the plugin
configuration before a session.
The procedure is in
[maintainer/Npm-Release-Guide.md](maintainer/Npm-Release-Guide.md).

## 13. Troubleshooting

| Symptom | Action |
|---|---|
| Plugin not loaded | Restart OpenCode; `opencode debug config` must list `spec-guardrails.ts` before `yolo.ts`. |
| Probe reports `blocked` | Replace that profile placeholder; never substitute a guess. |
| `DATA-GAP` | Seed approved synthetic data and verify again; do not release. |
| `BLOCKED` | Resolve the profile blocker or record an expiring exception. |
| Secret in evidence | Rotate it, remove the artifact and rerun with redaction. |
| Verifier write denied | Write only the selected checklist or `verification/<feature>/<run-id>/`. |
| Git command denied | Expected: people commit. Start OpenCode with `PLAYBOOK_GIT_APPROVED=1` only when a person wants the agent to commit outside YOLO. |
| `phase-complete.mjs` fails | Plan another wave; the remainder is never handed back. |
| A phase runs on an unexpected model | Command front matter overrides the TUI; check `playbook-routing.mjs status`. |
| Telemetry file empty | Start with `PLAYBOOK_TELEMETRY=1`; the Windows binary launched from WSL needs `WSLENV=PLAYBOOK_TELEMETRY`. |
| Playwright MCP never connects | Use `{env:PLAYWRIGHT_MCP_URL}` in `opencode.json`, set the variable, enable the server, restart. |
| Still prompted in YOLO | `PLAYBOOK_YOLO=1` did not reach OpenCode (WSL → Windows needs `WSLENV=$WSLENV:PLAYBOOK_YOLO`). |
| Supervisor slept past the reset | Set `PLAYBOOK_TZ=<IANA zone>` to the zone the provider prints. |
| TLS errors on a corporate network | Install the corporate CA into the OS trust store; never disable verification. See the WSL guide. |
| Windows `EACCES` under `/mnt/c` | [maintainer/OpenCode-WSL-Setup-Guide.md](maintainer/OpenCode-WSL-Setup-Guide.md) §10f. |

## 14. Adoption checklist and common mistakes

- [ ] A process owner and backup are named; product, engineering, QA, security, release,
  operations and escalation owners know their gates.
- [ ] Every profile placeholder is replaced and each command tested; `playbook-probe.mjs` is clean.
- [ ] Secret channels and redaction rules are approved.
- [ ] Only `events.ndjson` is ignored; misses are committed.
- [ ] The planted-defect smoke test in Getting Started gives an inline FAIL and no separate report.
- [ ] One pilot feature runs plan to post-deploy validation, then a second developer repeats it
  without the first driving.
- [ ] Weekly measures carry denominators, exclusions and quality labels.

Common mistakes: treating phase 4 or 6 as a measured command; reading `attempt` snapshots as
history; leaving profile placeholders; secrets in arguments or evidence; verifying in the build
context; accepting a green build or an HTTP 200 as proof of a side effect; creating a gap report or
a second checklist; treating DATA-GAP, BLOCKED or unknown cost as zero or PASS; ignoring the whole
telemetry folder; skipping plan approval, acceptance, rollback or post-deploy checks because
verification passed; deleting an Issues file before its facts and miss links are in the checklist.
