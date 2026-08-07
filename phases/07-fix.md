# Phase 7 — Fix

**Command:** `/fix` · **Persona:** Orchestrator · **Chat:** same or fresh

Fixes **only the items annotated FAIL** in the checklist (plus any Issues file you
explicitly provide). Then loops back to [Verify](05-verify.md) until the report is clean.

## Behaviors

- Reads the inline `**Verifier Result**:` annotations directly — no separate gap-report
  or fix-log file is needed or allowed.
- Same parallel-wave machinery as [Build](03-build.md): group FAIL items by `Type` and
  file ownership, present the plan, spawn sub-agents, aggregate.
- Same self-check as [Phase 4](04-self-review.md): build + smoke test before declaring
  the fixes done.
- Updates the checklist in place: marks items fixed with "Fix applied" notes, updates
  the Status Table, adds any newly-discovered deployment steps or infrastructure
  requirements.
- Never creates a new checklist file — the implementation checklist is the single
  source of truth.

## The loop

```
/fix  →  /verify  →  FAILs remain?  →  /fix  →  /verify  →  …  →  ALL PASS
```

Repeat until ALL PASS, then proceed to
[Phase 8 — Human acceptance](08-human-acceptance.md).
