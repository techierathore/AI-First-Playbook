# Greenfield Project Runbook: Team Inventory

Use this OpenCode runbook to repeat the AIFP lifecycle in a new repository. The illustrative Team
Inventory feature lets an authorized operations user locate a synthetic asset and import synthetic
CSV records. The duplicate-tag scenario is a controlled training defect. No app, fixture,
credential, database, or defect patch is shipped with the Playbook.

## Roles and prerequisites

| Role | Responsibility |
|---|---|
| Facilitator | Owns synthetic safety, the controlled defect, pacing, and debrief. |
| Product owner | Supplies intent and resolves requirement questions. |
| Engineering owner | Owns repository, architecture, standards, and profile validity. |
| Analyst | Runs `/feature-plan` and produces the traceable document set. |
| Orchestrator and builders | Run `/implement` and `/fix` in scoped waves. |
| Fresh Verifier | Runs `/verify` and writes evidence and verdicts inline. |
| QA/Product | Performs human acceptance. |
| Release and Operations | Own release, rollback, monitoring, support, and transfer. |

Before starting, provide an authorized disposable repository, OpenCode, a fully populated
`playbook/environment-profile.yml`, coding standards, approved DB architecture decisions,
non-production resources, named gate owners, and approved synthetic fixtures. Secrets must use an
approved manager, protected stdin, or protected temporary file.

## Input pack

Do not plan until these are available:

1. Authoritative BRD/spec covering actors, authorization, audit, import/error behavior, retention,
   constraints, and acceptance.
2. UI mockup when UI is in scope, or an explicit no-UI decision.
3. Coding-standards path, including tests, logging, security, errors, and naming.
4. Approved data/migration/compatibility/rollback architecture, or an explicit no-database decision.
5. Validated environment profile.
6. Naming and output decisions for docs, checklist, evidence, and deployment paths.

Never copy production data. Mark the environment non-production, record fixture provenance, and
define duplicate behavior explicitly. The facilitator retains an organization-owned way to
introduce and reverse the training defect.

## Lifecycle

```mermaid
flowchart TD
    A[Prepare inputs and profile] --> B[/feature-plan]
    B --> C{Human plan gate}
    C -->|changes| B
    C -->|approved| D[/implement and self-review]
    D --> E[Plant controlled defect]
    E --> F[/verify in fresh context]
    F -->|FAIL| G[/fix]
    G --> F
    F -->|ALL PASS| H[Human acceptance]
    H --> I[Release readiness and deploy]
    I --> J[Post-deploy validation and operations transfer]
```

### 1. Prepare

Install AIFP into the target, restart OpenCode, validate every profile command, and record the
starting revision/status. An empty scaffold reports unavailable checks honestly; it does not claim
PASS. Create a unique run ID and evidence location under `verification/team-inventory/<run-id>/`.

When the exercise includes phase metrics, launch with `PLAYBOOK_TELEMETRY=1 opencode` before any
Playbook command. Preserve the durable miss stream and rotate transient events only after the
approved consumer checkpoints completed execution IDs. Missing observations remain unavailable,
not zero.

If the facilitator approves unattended execution, use OpenCode YOLO mode as documented in
[YOLO-Mode-Guide.md](YOLO-Mode-Guide.md). It does not relax synthetic-data, evidence, checklist,
secret, or no-git-history rules.

### 2. Plan

Run `/feature-plan` with the complete input pack. Require a seven-field-plus-Type checklist,
traceable architecture, DB changes where applicable, verification guide, Infrastructure
Requirements, Deployment Steps, and Verifier Run Log. Every unresolved decision needs an owner and
due date.

### 3. Approve

Product, Engineering, QA, and Security review requirement coverage, synthetic controls,
authorization, logging, rollback, and executable Verify methods. Persist the decision using
`templates/handoffs/plan-approval.md`. Only approved work enters build.

### 4. Implement and self-review

Run `/implement` with the approved checklist and standards. Builders receive exclusive item/file
slices. The Orchestrator finishes the full scope, runs profile-defined build/tests, executes touched
paths, confirms required side effects and logs, cleans up, and writes the implementation handoff.
Every item becomes ready to verify or names a genuine external blocker and supplier.

### 5. Plant the controlled defect

After self-review, the facilitator applies the reviewed reversible change so duplicate CSV import
reports success while writing zero rows. Record the UTC time and affected item privately; do not
reveal the fix to builders or the Verifier.

### 6. Verify

Run `/verify` in fresh context with the checklist, verification guide, DB guide where relevant, and
profile. The expected training outcome is inline `FAIL` with runtime evidence under the selected
run directory. `DATA-GAP` or `BLOCKED` also prevents acceptance but does not prove the planted
defect was found.

### 7. Fix and reverify

Run `/fix` for the full active FAIL set. Preserve duplicate atomicity, self-test, and leave repaired
items awaiting verification. Then run a fresh `/verify` with a new run ID. Repeat until every item
and the overall result are PASS; never overwrite prior failed evidence.

### 8. Accept, release, and transfer

QA/Product executes the human verification guide and records acceptance. Release/Ops records exact
deployment order, compatibility, flags, rollback, recovery, monitoring signals and thresholds,
post-deploy checks, escalation, and ownership acknowledgement. This runbook supplies no application
command, port, migration tool, or target; use only the profile and approved checklist.

If post-deploy validation fails, pause or roll back, preserve evidence, run `/analyze-fix` against
the existing checklist, then return through `/fix`, fresh `/verify`, acceptance, and readiness.

## Expected final state

- The latest independent verdict is PASS and prior FAIL evidence remains.
- Runtime evidence is under repository-root `verification/team-inventory/<run-id>/`.
- Plan, implementation, verification, acceptance, release, and operations handoffs are durable.
- Deployment and rollback use only approved target-specific instructions.
- No production data, credential, invented command, or invented port appears.
- A successor can find monitoring, escalation, rollback, and the next action without hidden chat.
- When telemetry was enabled, phase exports are quality-filtered/checkpointed and durable miss
  lifecycle records remain append-only.

## Failure routes

| Condition | Route |
|---|---|
| Missing requirements authority | Product supplies it before planning. |
| UI scope without mockup | Obtain it or record an owner decision; do not invent UI. |
| Invalid profile | Engineering fixes it before operational commands. |
| External implementation dependency | Finish independent work; name the missing supply and owner. |
| Verify FAIL | `/fix` the full FAIL set, then fresh `/verify`. |
| Verify DATA-GAP/BLOCKED | Supply data/infrastructure and rerun; do not accept. |
| Acceptance rejected | Amend through the approved path, fix, and reverify. |
| Deploy/post-deploy fails | Pause or roll back, preserve evidence, analyze, and loop. |
| Telemetry absent/incomplete | Report unavailable/incomplete and continue delivery; never backfill a plausible zero. |
| YOLO supervisor pauses on a usage limit | Preserve state and resume the same OpenCode session after the buffered reset time. |
