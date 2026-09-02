# Brownfield Onboarding and Change Runbook

This OpenCode runbook brings an incompletely documented legacy module into AIFP, establishes an
evidence-backed baseline, and delivers a compatible change. **Legacy Inventory Owner Filter** is an
illustrative example only, not a shipped feature, fixture, architecture prescription, migration,
or reference implementation.

## Objective and safety

Characterize the current system, turn observations into a verifiable contract, change it through a
reversible seam, independently compare old and new behavior, and transfer enough knowledge for a
new owner to release, roll back, operate, and support it.

Observe before product edits. Discovery may read source, run profile-declared checks, and add
verification-side characterization assets. It must not silently clean up product code. Preserve
evidence of awkward behavior and known defects; unknowns are risks to investigate, not permission
to redesign.

## Roles

| Role | Accountability |
|---|---|
| Product and legacy owner | Define desired outcome, accepted quirks/differences, history, and ownership context. |
| Analyst | Audit the module and create the evidence-based implementation contract. |
| Orchestrator and builders | Implement approved items and perform embedded self-review. |
| Fresh Verifier | Execute old and new paths and record inline verdicts. |
| QA/business approver | Perform human acceptance and persist the decision. |
| Security/data steward | Approve classification, access, fixtures, redaction, and retention. |
| Release/Operations | Own rollout, rollback, monitoring, support, and incident routing. |

## Prerequisites and discovery pack

Install AIFP in the target, read `AGENTS.md`, and complete `playbook/environment-profile.yml` with
reviewed facts. Name Product, technical, data, security, release, operations, and escalation owners.
Obtain least-privilege observation access and approved synthetic or non-sensitive fixtures.

Collect the target boundary, real profile, requirements, current manuals/screenshots/contracts,
ownership, data controls, coding standards, release controls, known-defect decisions, and acceptance
intent. Do not infer a framework, API shape, flag, port, command, migration tool, database, or
secret source from this runbook.

## Discovery contract and audit

Before `/legacy-audit`, create or select a minimal discovery checklist containing:

- target, exclusions, owners, profile, and standards paths;
- the no-product-edits boundary and fixture controls;
- expected inventory, dependencies, ownership, behavior, characterization, classification, risks,
  and safe-seam evidence;
- every already-known behavior that must be preserved; and
- the exact evidence destination `verification/<feature>/legacy-audit-<run-id>/`.

Run the installed OpenCode command from the target root:

```text
/legacy-audit @playbook/environment-profile.yml @<discovery-checklist-path> <scope and constraints>
```

The guaranteed output is evidence under the selected verification directory plus checklist links.
Do not invent a named audit summary file.

## Product baseline

Before code changes, record with approved fixtures:

1. Human-recorded source revision and intentionally clean/dirty status.
2. Profile-defined build/test outcomes, including pre-existing failures.
3. UI routes, roles, visible states, accessibility observations, and redacted screenshots.
4. API request/response/status, authorization, and error behavior.
5. Data reads/writes, constraints, ordering, null/empty handling, and side effects.
6. Sanitized log events, levels, correlation, and failure signals.
7. Narrow characterization tests that preserve observed behavior.
8. Dependencies, consumers, deployment units, owners, and escalation paths.
9. Data classification, evidence restrictions, retention, and disposal owner.
10. Risks, unknowns, known defects, and preserve/fix/defer decisions.
11. Real extension points, optional parameters, flags, or additive seams that retain an old path.

Product performance and reliability observations are not agent-process measurements. Compare old
and new product behavior only with like fixtures and environments.

## Optional OpenCode instrumentation

When the onboarding exercise requires command-phase evidence, start OpenCode with
`PLAYBOOK_TELEMETRY=1` before the first Playbook command. Keep product baselines separate from
OpenCode command metrics: agent elapsed/active time is not product latency or human effort. Ignore
only transient events, preserve durable miss history, and retain quality/exclusion labels.

Unattended runs may use OpenCode YOLO mode after the owners approve the environment. The supervisor
can persist state and resume after provider rate limits, but it cannot authorize git-history or
publishing operations and does not weaken baseline/rollback evidence requirements.

## Lifecycle

```mermaid
flowchart TD
    A[Legacy audit and baseline] --> B[/feature-plan]
    B --> C{Human plan gate}
    C -->|revise| B
    C -->|approved| D[/implement and self-review]
    D --> E[/verify old and new paths]
    E -->|FAIL or DATA-GAP| F[/fix]
    F --> E
    E -->|ALL PASS| G[Human acceptance]
    G --> H[Release readiness and rollback drill]
    H --> I[Deploy and post-deploy validation]
    I --> J[Operations transfer]
    I -->|issue| K[/analyze-fix]
    K --> F
```

### Plan and approve

Run `/feature-plan` with requirements, standards, reference docs, audit evidence, output folder,
and compatibility constraints. Every desired and preserved behavior needs a seven-field item,
dependencies, old-path expectations, selection mechanism, rollback, and executable evidence.

Product, Engineering, QA, Security, and Operations review coverage, compatibility, verification,
rollback, and ownership. Persist approval with `templates/handoffs/plan-approval.md`. Unknowns must
remain explicit and owner-assigned.

### Implement and self-review

Run `/implement` against the approved checklist and coding standards. Keep the old/default path,
use only approved selection controls, and create target-specific deploy/rollback changes only when
required. The Orchestrator runs profile build/tests and focused runtime, data-side-effect, and log
checks. Self-review never grants independent PASS.

### Verify, fix, and reverify

Run `/verify` in fresh context against the checklist, verification guide, product baseline, profile,
deployment steps, and fixture. Verify old/default and new/enabled paths, authorization, invalid
input, dependency failure, known defects, consumer compatibility, and rollback behavior. Findings
and evidence belong inline and under `verification/<feature>/<verify-run-id>/`.

For any FAIL, run `/fix` and then a fresh `/verify`. Resolve DATA-GAP/BLOCKED through the named
owner. Acceptance and release require all relevant items PASS.

### Accept, release, and operate

QA/Product records human acceptance and accepted differences. Release/Ops performs a timed
non-production rollback drill and records forward/reverse order, source and data recovery, old-path
proof, monitoring, thresholds, and contacts. Deploy with only approved target commands.

Post-deploy checks compare the released old/default and new/enabled paths to the baseline. Failure
pauses rollout or triggers rollback and incident handling. Use `/analyze-fix` against the existing
checklist, then return through fix, fresh verification, acceptance, and readiness.

Operations transfer is complete only when a successor can detect, triage, disable or roll back,
and escalate without the original developer's context.

## Compatibility matrix

| Scenario | Old/default proof | New/enabled proof | Gate |
|---|---|---|---|
| Selection absent/off | Baseline remains executable. | New path is not selected accidentally. | No unexplained difference. |
| Selection on | Old path remains recoverable. | Approved behavior works end to end. | Every mapped item passes. |
| Authorized/unauthorized roles | Existing allow/deny remains. | Approved authorization applies. | No privilege expansion. |
| Empty/null/invalid input | Baseline response is recorded. | Safe state/error and logs occur. | No crash or silent partial success. |
| Dependency failure | Existing behavior is known. | New path fails safely. | Response, side effect, and logs agree. |
| Known legacy defect | Preserve/fix/defer is reproduced. | Defect is not hidden or spread. | Decision is honored. |
| API/schema consumers | Existing consumer continues. | Additive contract works. | No unapproved break. |
| Rollback | Old path and data recover. | New path disables/reverses. | Timed drill passes. |

## Final acceptance

- [ ] Source revision and profile-driven product baseline are evidenced with approved fixtures.
- [ ] Audit evidence records dependencies, ownership, classification, risks, seams, and defects.
- [ ] Every preserved behavior maps to the checklist.
- [ ] Old/default and new/enabled paths pass the compatibility matrix.
- [ ] Embedded self-review and fresh verification passed; no FAIL, DATA-GAP, or BLOCKED remains.
- [ ] Acceptance, readiness, rollback drill, post-deploy checks, and operations transfer are durable.
- [ ] Evidence retention/disposal follows repository and data policy.
- [ ] If telemetry was enabled, phase/miss exports preserve quality, cohort, and attribution rules.
- [ ] If YOLO was used, decisions and same-session rate-limit resumes are reviewable.
