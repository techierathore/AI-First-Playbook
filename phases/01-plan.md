# Phase 1 — Plan

**Command:** `/feature-plan` · **Persona:** Analyst · **Chat:** fresh

From the BRD, the UI mockup, and the reference docs, the analyst produces the feature's
full document set. The command's defining behavior: it **enforces context gathering** —
it ASKs for anything missing instead of guessing.

## Inputs (the command demands these)

- BRD — or, when there is no BRD, an integration doc / project specification / existing
  checklist (v2.5)
- UI mockup (e.g. a React mockup component), for UI features
- Coding standards document path
- DB architecture document path
- Output folder and project prefix (documents use your real naming convention:
  `<Prefix>-<Feature>-<DocType>.md`)

## Outputs — the feature document set

| Document | Audience |
|---|---|
| `*-DB-Changes.md` (+ Mermaid ER diagram) | dev, QA |
| `*-Architecture.md` / `*-DataSync-Architecture.md` | dev |
| `*-FullStack-Implementation-Checklist.md` — **the build and verify contract** | AI agents (never rendered to HTML) |
| `*-Developer-Flow-Guide.md` (created as `[PLANNED]`; built from running code later by `/add-doc`) | dev — debugging, onboarding |
| `*-Business-Verification-Reference.md` (report features; plain English, no internal names) | business + QA |
| `*-Verification-Guide.md` / `*-Dev-Testing-N-Deployment-Guide.md` | QA, dev |
| `*-PowerBI-Mapping.md` (only if a BI report is involved) | BI developer |

Every checklist item is written in the seven-field verifiable format —
Behavior / Location / UI ref / Logging / Acceptance / **Verify** / Coding Standards —
with a `Type` field so build and verify can parallelize cleanly
(see [checklist item template](../templates/checklist-item-template.md)).

## Self-checks before returning

- Checklist covers every BRD line.
- Every mockup element maps to a checklist field.
- Ends by asking: "HTML versions now, or markdown only?" (HTML is for human docs only.)

**Next:** [Phase 2 — Plan Review gate](02-plan-review-gate.md)
