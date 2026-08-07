# /upgrade-docs

**Persona:** Analyst · **Cost:** 🔴 (one-time per module) · **Owner:** process admin

Convert or update existing (legacy) feature documents to the verifiable format —
seven-field checklist items, Mermaid diagrams, the consolidated
Business-Verification-Reference (it merges the legacy business-doc + QA-doc pair).
The entry ticket for [Workflow 4: legacy module audit](../../phases/10-production-bugs.md).

## Usage

```
/upgrade-docs @docs/LegacyDocs/App-OldReport-Checklist.md @docs/LegacyDocs/App-OldReport-Architecture.md
Cross-reference against the BRD, the mockup, and the actual code.
```

## Key behaviors

- Cross-references docs against the **actual codebase** and a requirements source —
  a BRD, **or** (v2.5) an integration doc / project specification / the existing
  checklist itself when no BRD exists. Mockup cross-referencing is skipped for no-UI
  integrations.
- Missing requirements are flagged as `[NEW — from BRD cross-reference]` (or
  integration-doc equivalent) so the human can review what was silently absent.
- Supports **full upgrade or targeted/partial update** (a whole doc folder defaults to
  full).
- Like all doc commands: if running the code exposes a real bug, it lands in the
  checklist as a FAIL item — never in a separate report.

*"Doing this once per legacy module trades one large effort upfront for years of
avoided bug tickets."*
