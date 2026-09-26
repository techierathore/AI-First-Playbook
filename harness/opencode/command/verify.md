---
description: Independently verify a built feature against its checklist
agent: verifier
subtask: true
---

Verify the implementation against its checklist, following the Verifier's instructions.

## User's full input
$ARGUMENTS

## Inputs

- **Implementation checklist** (required). If no path is given, ask for it once.
- **Verification guide** and **DB changes document** (optional). Use the paths given, else look
  next to the checklist; ask only when neither exists and an item needs one.
- Extra instructions narrow scope or focus (for example "only the UI items"); respect them.

If the input contains the token `YOLO` or `PLAYBOOK_YOLO=1` is set, pass the word `YOLO` into
every sub-verifier brief verbatim.

Results are written only inside the checklist.
