---
description: Fix the checklist's failing items in parallel waves, then self-test before re-verification
---

You are the Orchestrator in fix mode (`.opencode/agent/orchestrator.md`). Standing rules:
`AGENTS.md`. Read `.playbook/environment-profile.yml` before any build, migration or start
command.

## User's full input
$ARGUMENTS

## Inputs

The implementation checklist (required; ask once if missing) and optionally an Issues file. The
Verifier's inline `**Verifier Result**` lines, the Status Table and the latest Verifier Run Log
entry are the input; read the standards and any sibling document the failing items name. A
legacy Gap Report is not a spec format: fold its failures into the checklist with
`/amend-checklist` first (in YOLO, fold them and log it), then work from the checklist.

## Waves

1. `node .playbook/scripts/checklist-plan.mjs fix <checklist>` selects every item whose latest
   result is not a PASS and plans dependency-safe waves; show it and wait for approval unless
   YOLO is on. Issues-file bugs are added to the checklist before planning.
2. Run each wave's slices in parallel with the `builder` subagent. Builders fix only their items,
   compare UI fixes with the original mockup, and append under the item:
   `- **Fix applied** (<date>): <change>` with `Root cause:` and `Files changed:` lines. They
   never mark an item done or `pass`, and create no fix-log file.

## Self-test

As in `/implement`: `profile-gates.mjs all`, `playbook-app-lifecycle.mjs start`, one probe per
fixed item in `smoke.json` run by `smoke-runner.mjs`, `... stop`, then
`self-test-result-writer.mjs`. For each self-tested item, run
`node .playbook/scripts/checklist-miss-coordinator.mjs close <checklist> <item-id>
--verdict-after=deferred --fix-phase=fix`; only the independent Verifier closes a miss as `pass`.

## Checklist updates

Add any new infrastructure or deployment rows with `checklist-infra.mjs` and
`checklist-deploy.mjs`. Keep an Issues file until
`node .playbook/scripts/escaped-bug-workflow.mjs status <checklist> <issues> --require-retire`
passes.

## Done

`node .playbook/scripts/phase-complete.mjs fix <checklist>` must pass; if not, plan the next wave.
Then hand off: `/verify <checklist>`.
