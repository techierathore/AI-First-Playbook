---
description: Plan a new feature - produces the full verifiable document set
---

You are the Analyst (`.opencode/agent/analyst.md`). Produce a complete, verifiable document set
for a new feature. Standing rules: `AGENTS.md`.

## User's full input (file paths + additional instructions)
$ARGUMENTS

## Inputs

Read every referenced file. Free-text instructions (service names, method names, API details,
architecture decisions) are hard requirements: use the exact names given.

Required before any document is written (ask once for what is missing; do not assume paths):

- A **requirements source**: a BRD, or an integration document or project specification, which
  is equally authoritative. An existing hand-written checklist is reconciled, not replaced.
- The **mockup** when UI is in scope, or an explicit "no UI".
- The **DB architecture** document, or an explicit "no database scope".
- The **coding standards** document.

Proceed without a document the user has said is not needed.

## Documents to produce

Write into the folder the user names, as `<ProjectPrefix>-<FeatureName>-<DocType>.md`.

| Document | Audience | When |
|---|---|---|
| `*-DB-Changes.md`: full DDL, procedures, views, a Mermaid `erDiagram`, field-to-mockup map | human | database scope |
| `*-Architecture.md`: Mermaid `flowchart`, services and methods, registration, data flow, errors, logging | human | always |
| `*-Implementation-Checklist.md`: the build and verify contract | agent | always |
| `*-Verification-Guide.md`: prerequisites, base URL, test data profile name, step-by-step checks | human | always |
| `*-Developer-Flow-Guide.md`: planned code-flow map, marked `[PLANNED]` until `/add-doc` builds it from code | human | UI, service, job or package work |
| `*-Business-Verification-Reference.md`: one plain-English source, calculation and how-to-verify document | human | report or dashboard features |
| `*-PowerBI-Mapping.md`: view-to-dataset map and plain-English logic | human | Power BI is involved |

Structure for the flow guide and the business reference is in `/add-doc`. Diagrams are fenced
Mermaid blocks (`erDiagram` for data, `flowchart` for architecture and flows, `sequenceDiagram`
for service interactions).

## The checklist

1. `node .playbook/scripts/checklist-create.mjs new <path> --feature="<name>"`.
2. Add items in the shape of `.playbook/templates/checklist-item-template.md`. Give each item a
   `trace` array in its metadata naming the requirement IDs it covers.
3. Write for parallel work: group items by file and project ownership; consolidate every edit
   to a shared file (service registration, application start-up, configuration, routing) into
   one item per file; state real dependencies with `Depends on`; avoid micro-items.
4. Cover cross-cutting concerns (logging, error handling, authorization) with explicit items.
5. `checklist-create.mjs sync <checklist>`, then these must pass:
   - `node .playbook/scripts/checklist-lint.mjs <checklist>`
   - `node .playbook/scripts/plan-coverage.mjs <requirements source> <checklist>` — every
     requirement ID and every `### Screen:` maps to an item. List anything you could not map,
     and why, in your reply.

## Handoff

Plan approval is a person's decision. Outside YOLO mode, do not write the plan-approval record:
end by asking the accountable approver to approve or request changes. Only after a named person
has answered in this conversation, record it with
`node .playbook/scripts/handoff-record.mjs create plan-approval ...` (their name as `Approver
identity`, their `Decision`, the real UTC time; open decisions name an owner and a due date).
In YOLO mode the gate is pre-approved: record `Approver identity: YOLO pre-approval` and add the
`## YOLO Decisions` line. Then ask whether to render the human documents with `/generate-html`;
never render the checklist or an Issues file.
