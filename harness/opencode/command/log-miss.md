---
description: Classify and record a one-line process miss without booting, reproducing, building, testing, or editing product files
---

Record the user's one-line report. Read only the report and, when named, the checklist item.
Do not boot, reproduce, build, test or edit anything else.

## User's full input
$ARGUMENTS

Classify the report into the miss CLI's closed values (a wrong value is refused with the list),
then run one command:

- With a checklist item:
  `node .playbook/scripts/checklist-miss-coordinator.mjs open <checklist> <item-id> --miss-class=<v> --artifact=<v> --severity=<v> --found-by=<v> [--why-missed=<v>] [--origin-agent=<token>] [--fixed]`
- Without one:
  `PLAYBOOK_TELEMETRY=1 node .playbook/scripts/playbook-miss.mjs open --if-new` with the same flags.

Pass `--fixed` only when the input says so, and a run ID only when it is exactly known. Report the
classification and the `MISS-*` ID, or the refusal as printed; a refusal never changes a verdict.
