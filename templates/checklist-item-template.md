# Checklist Item Template — the verifiable item format
<!-- template-schema: {"produces":"docs/<feature>/<Name>-Implementation-Checklist.md items","required":["Contract","item shape","example","parallel rules","required checklist sections","metadata/status","outcomes"],"optional":["Migration and compatibility notes"],"budget":{"small":[350,500],"medium":[400,550],"large":[450,600]},"rows":"Stable ID; one behavior; exact path; executable Verify; acceptance When/then sentence (checklist-lint.mjs)."} -->

> The implementation checklist is the build and verify contract. Every item must be
> independently verifiable by a fresh-context agent. `node .playbook/scripts/checklist-lint.mjs
> <checklist>` enforces this shape (`.playbook/checklist-schema.json`); a failing checklist does
> not leave planning.

## The format

```markdown
<!-- metadata: {"schema":1,"id":"REQ-001","owner":"<team>","priority":"P1","risk":"medium","status":"planned","created_at":"<UTC>","updated_at":"<UTC>","evidence":[],"misses":[]} -->
- [ ] <Verb-led title naming one behaviour>
  - Type: ui | backend-api | backend-service | db | logging | infrastructure | cross-cutting | desktop
  - Behavior: <one sentence naming an observable result>
  - Location: `<exact repository path>`
  - UI ref: <screen, position, reused pattern>   (ui and desktop items)
  - Logging: <start, completion, count and error signals, or None with a reason>
  - Acceptance: When <actor> <does what> on <screen>, then <a result a machine can observe>
  - Verify: <tool, action, assertion, retained evidence>
  - Coding Standards: `<document>`, section <n>
  - Depends on: <stable IDs>   (only for a real dependency)
```

Acceptance targets 20 words (maximum 30) and holds one behaviour; do not join outcomes with
"and" or use subjective words such as "correctly".

## Worked example

```markdown
<!-- metadata: {"schema":1,"id":"REQ-014","owner":"frontend-reports","priority":"P1","risk":"medium","status":"planned","created_at":"2026-09-07T00:00:00Z","updated_at":"2026-09-07T00:00:00Z","evidence":[],"misses":[]} -->
- [ ] Export the filtered Cost Report grid
  - Type: ui
  - Behavior: Selecting Export downloads a workbook containing the visible filtered rows.
  - Location: `src/frontend/src/Components/Reports/Cost/ExportButton.tsx`
  - UI ref: Cost Report screen, top-right toolbar; reuse the report toolbar button pattern.
  - Logging: INFO at start and completion with row count; ERROR with report ID on failure.
  - Acceptance: When a report user selects Export on the Cost Report screen, then the downloaded workbook row count equals the visible filtered grid row count
  - Verify: Playwright records the grid count, selects Export, parses the workbook, asserts equal row counts, and retains the trace and workbook hash.
  - Coding Standards: `docs/coding-standards.md`, section 4.2, Report toolbar actions.
```

## Parallel work

Consolidate edits to a shared file (service registration, application start-up, configuration)
into one item per file so parallel builders never collide.

## Required checklist sections

```markdown
## Status Table                 <- every item ID; every command updates it
## Infrastructure Requirements  <- external resources (containers, secrets, queues)
## Deployment Steps             <- see deployment-steps-template.md
## Verifier Run Log             <- appended per /verify run; history preserved
## Verified History             <- optional; created by /archive-checklist
```

The metadata comment is authoritative for item status (`templates/checklist-metadata.yml`);
checkbox state is presentation only. Exceptions require an approver, owner, reason and expiry.
Restored items reset to `planned` and need a new verification run. `misses` is append-only.

Verification outcomes: `PASS`, `FAIL`, `PASS (code-audit)`, `FAIL (code-audit)`, `DATA-GAP`,
and `BLOCKED`.
