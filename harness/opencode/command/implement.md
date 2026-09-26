---
description: Build a planned feature from its checklist in parallel waves, then self-test it
---

You are the Orchestrator (`.opencode/agent/orchestrator.md`). Standing rules: `AGENTS.md`.
Read `.playbook/environment-profile.yml` before any build, migration or start command.

## User's full input
$ARGUMENTS

## Inputs

The implementation checklist (required; ask once if missing) and the coding standards document.
Read the checklist, standards, and the DB changes and architecture documents beside it. Extra
instructions in the input override the checklist where they conflict.

## Waves

1. Run `node .playbook/scripts/checklist-plan.mjs implement <checklist>` and show the plan.
   Wait for approval unless YOLO is on. A cycle or unknown dependency is fixed in the plan first.
2. Run each wave's slices in parallel with the `builder` subagent, one slice per builder. Give
   each builder only its items, the files it owns and the standards path. Builders implement
   into the existing structure and patterns, match the UI ref exactly, log start, completion,
   counts and errors, and report a miss candidate when the plan left required behaviour
   unspecified.
3. After each wave, record each genuine miss candidate serially:
   `node .playbook/scripts/checklist-miss-coordinator.mjs open <checklist> <item-id>
   --miss-class=unspecified-gap --artifact=<plan|checklist> --severity=<level>
   --found-by=agent-review --found-phase=build --harness=opencode`.

## Self-test

Building is not enough; prove the code runs.

1. `node .playbook/scripts/profile-gates.mjs all --run-id=<run-id>`; a failing gate stops the
   self-test and is annotated on its items.
2. `node .playbook/scripts/playbook-app-lifecycle.mjs start --run-id=<run-id>` (ask once unless
   YOLO). Declare one probe per changed endpoint, screen and data path, as its Verify line says,
   in `verification/runs/<run-id>/smoke.json`; a data-changing probe checks the data. Run
   `node .playbook/scripts/smoke-runner.mjs <smoke.json> --run-id=<run-id>`, then `... stop`.
3. `node .playbook/scripts/self-test-result-writer.mjs <checklist>
   --results=verification/runs/<run-id>/smoke-results.json` records each item (PASS moves it to
   `to-verify`); only the user may skip (`--skip=<IDs> --reason=…`). A defect found here is linked
   with `found-phase=self-review` and closed with `--verdict-after=deferred
   --fix-phase=self-review`.

## Checklist updates

Record external resources with `node .playbook/scripts/checklist-infra.mjs add|none <checklist>`
and deployment actions with `node .playbook/scripts/checklist-deploy.mjs add|none <checklist>`
(profile-declared tools only). An item you cannot finish carries
`[INFRA BLOCKER]` or `[EXTERNAL BLOCKER]` naming what is missing and who supplies it.

## Done

`node .playbook/scripts/phase-complete.mjs build <checklist>` must pass; if not, plan the next
wave. Then persist `node .playbook/scripts/handoff-record.mjs create implementation-summary ...`
and hand off: `/verify <checklist>`.
