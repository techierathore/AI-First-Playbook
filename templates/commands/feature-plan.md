# /feature-plan

**Persona:** Analyst · **Cost:** 🔴 · **Chat:** fresh

Plan a new feature: produce the full verifiable document set (DB-Changes + ER diagram,
Architecture, Implementation Checklist, Developer-Flow-Guide as `[PLANNED]`,
Business-Verification-Reference for report features, Verification Guide, optional BI
mapping).

## Usage

```
/feature-plan @docs/BRDs/BRD-004-Cost-Dashboard.md @src/mockui/Components/Mockups/CostDashboardMockup.tsx
<free-form instructions: naming, placement, permissions, local-testing guide, …>
```

## Key behaviors

- **Asks for every missing input**: BRD (or integration doc / project spec / existing
  checklist — v2.5), mockup, coding standards path, DB architecture path, output
  folder, project prefix, full-stack vs data-sync-only, HTML or markdown-only.
- Documents use your real naming convention: `<Prefix>-<Feature>-<DocType>.md`.
- Writes checklist items in the seven-field verifiable format with `Type` fields and
  clean grouping (see [checklist item template](../checklist-item-template.md)).
- Self-checks BRD→checklist and mockup→checklist coverage before returning.
- Report features get **one** Business-Verification-Reference, not a separate business
  doc + QA doc (deliberate token/consistency decision).
- Ends by asking "HTML versions now, or markdown only?" — HTML for human docs only,
  never the checklist.
