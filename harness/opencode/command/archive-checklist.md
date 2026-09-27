---
description: Compact already-passing checklist items into a richer Verified History section to keep the active checklist manageable, or restore archived items when their context is needed again
---

Move mature PASS items out of a large checklist, or bring one back. Ask once for the checklist
path if it is missing, and ask which mode when the input does not say.

## User's full input
$ARGUMENTS

- **Archive**: run `node .playbook/scripts/checklist-archive.mjs candidates <checklist>`, show
  the eligible and kept items with their reasons, and after approval run `… archive <checklist>`
  (add `--ids=` for a subset, `--force` only when the user asks to archive a small checklist).
- **Restore**: `node .playbook/scripts/checklist-archive.mjs restore <checklist> <ID>`; the item
  returns as `planned` and needs `/verify` again.

Report what the script printed.
