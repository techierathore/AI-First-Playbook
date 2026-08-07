# /refresh-doc

**Persona:** Analyst · **Cost:** Mode A 🟡 · Mode B 🟡–🔴 · **Owner:** process admin
(periodic), not the team's daily loop

Re-sync documentation with the **current code**. Two modes:

## Mode A — shared cross-module reference docs

```
/refresh-doc @docs/ArchDocs/App-DB-Architecture.md
```

Scans the codebase for discrepancies against a shared doc (DB architecture, models,
data-access), updates content, refreshes Mermaid diagrams, regenerates HTML for
publishing. Targeted edits, not full rewrites.

## Mode B — a whole feature's doc set (v2.4)

```
/refresh-doc @docs/CostDocs/
```

Run after `/implement`/`/fix` changed a flow, or after file renames/deletes. Reconciles
**every reference** in the feature's docs against the working tree: renamed references
updated, deleted ones flagged `[STALE]`, missing scripts flagged `[MISSING SCRIPT]`.
**Re-runs the code** (docs are verified by execution, not by reading other docs) — and
if that exposes a real bug, folds it into the checklist as a FAIL item so `/fix` picks
it up. Creates the Developer-Flow-Guide if missing.

This is the answer to "how does a doc get updated when the code changes" — prefer it
over re-running `/feature-plan`, which regenerates everything at full cost.
