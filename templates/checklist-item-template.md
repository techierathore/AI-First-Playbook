# Checklist Item Template — the seven-field verifiable format

> The implementation checklist is not a to-do list — **it is the build and verify
> contract.** Every item must be independently verifiable by a fresh-context agent.

## The format

```markdown
<!-- metadata: {"schema":1,"id":"REQ-001","owner":"identity","priority":"P1","risk":"medium","status":"planned","created_at":"2026-08-14T00:00:00Z","updated_at":"2026-08-14T00:00:00Z","evidence":[]} -->
- [ ] <Item title>
  - Type: ui | backend-api | backend-service | db | logging | infrastructure | cross-cutting
  - Behavior: <what the user/system observes when this works>
  - Location: <exact file/project path where this lives>
  - UI ref: <mockup screen + position; existing style/pattern to reuse>   (UI items)
  - Logging: <required INFO/ERROR lines>
  - Acceptance: <the observable condition that means "done">
  - Verify: <the concrete method a fresh-context Verifier executes to prove it>
  - Coding Standards: <the specific standards-section this must follow>
  - Depends on: #<N>   (only when a real dependency exists)
```

## Worked example

```markdown
- [ ] Export to Excel button
  - Type: ui
  - Behavior: toolbar button labelled "Export"; downloads .xlsx of the
    current grid, respecting active filters
  - Location: src/frontend/src/Components/Reports/Cost/ExportButton.tsx
  - UI ref: mockup screen 3, top-right; uses existing .btn-toolbar style
  - Logging: INFO on start/finish with row count; ERROR + stack on failure
  - Acceptance: clicking Export downloads a file whose row count
    equals the visible grid row count
  - Verify: Playwright clicks Export, asserts a download; grep logs
    for "Export complete"
  - Coding Standards: follows the project button component pattern per coding-standards.md §4.2
```

## Rules that make parallelism work

- Every item carries a `Type` field — build and verify group waves by it.
- Cross-cutting edits (DI registration, `Program.cs`, `appsettings.json`) are
  **consolidated into one item per file** so parallel agents never collide.
- Explicit dependencies are stated as `Depends on: #N`.

## Mandated checklist sections

```markdown
## Status Table                 <- reality at a glance; every command updates it
## Infrastructure Requirements  <- external resources (containers, secrets, queues)
## Deployment Steps             <- see deployment-steps-template.md
## Verifier Run Log             <- appended per /verify run; history preserved
## Verified History             <- created by /archive-checklist past ~2,000 lines
```

The metadata comment is authoritative for item status; checkbox state is presentation only.
Use `templates/checklist-metadata.yml`. Exceptions require an approver, owner, reason and
expiry. Restored items reset to `planned` and require a new verification run.

Allowed verification outcomes are `PASS`, `FAIL`, `PASS (code-audit)`, `FAIL (code-audit)`,
`DATA-GAP`, and `BLOCKED`.
