---
description: Classify and record a one-line process miss without booting, reproducing, building, testing, or editing product files
---
Record the user's one-line report with the smallest possible scope.

## User's full input
$ARGUMENTS

## Hard scope — do not exceed it

1. Read only the one-line report and, if supplied, the referenced implementation
   checklist/item metadata. Do **not** read product source merely to validate the report.
2. Do not boot or reproduce the app. Do not run builds or tests.
3. Do not edit `src/`, tests, config, package/lock files, deployment steps,
   infrastructure, or product code.
4. The only allowed writes are:
   - append records through `scripts/playbook-miss.mjs` to the miss stream; and
   - append the returned/collapsed `MISS-*` ID once to the referenced checklist item's
     metadata `misses` array.
5. Do not add the report text to telemetry. Classify it using only these closed values:
   - miss class: `missed-requirement`, `partial-implementation`, `wrong-behaviour`,
     `regression`, `unspecified-gap`, `spec-contradiction`, `scope-creep`,
     `hallucinated-api`, `standards-violation`, `other`
   - artifact: `plan`, `checklist`, `mockup`, `src`, `tests`, `docs`, `config`,
     `deployment-steps`, `other`
   - severity: `blocker`, `major`, `minor`
   - why missed (optional): `missing-checklist-item`, `insufficient-verify-method`,
     `code-audit-limitation`, `ambiguous-acceptance`, `dependency-not-declared`,
     `instruction-ignored`, `other`
   - found by: `verifier`, `self-review`, `human`, `production`, `agent-review`
   - phases and gates must also use the CLI's closed vocabulary; omit unknown optional
     fields rather than inventing text.
6. `instruction-ignored` is allowed only when `origin_agent` identifies an agent that had
   loaded the ignored written rule. Never apply it to a human origin.

## Record it

Run exactly one `open --if-new` command, with flags selected from the closed vocabularies:

```bash
PLAYBOOK_TELEMETRY=1 node scripts/playbook-miss.mjs open --if-new \
  --miss-class=<value> --artifact=<value> --severity=<value> \
  --found-by=<value> [--why-missed=<value>] [--item-id=<id>] [--feature=<token>] \
  [--origin-phase=<value>] [--origin-agent=<token>] [--origin-run-id=<exact-id>] \
  [--found-phase=<value>] [--found-phase-gate=<value>] --harness=claude-code \
  [--fixed [--verdict-after=<value>] [--fix-run-id=<exact-id>] [--fix-phase=<value>]]
```

The harness value is mandatory and set explicitly above as `--harness=claude-code`. Never
rely on the CLI default. Include `--fixed` only when the user's input contains `--fixed`; omit
any run ID that is not exactly known.

Capture either `opened MISS-*` or `collapsed: MISS-*`. If an item was supplied, append
that ID once to its metadata `misses` array without changing any other item content.
Report the classification and ID. The CLI is fire-and-forget and exits zero even on
refusal: report a refusal honestly, make no substitute write, and never change a phase
verdict.
