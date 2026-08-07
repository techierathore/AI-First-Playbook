# /archive-checklist

**Persona:** none · **Cost:** 🟢 — this command IS a token-saving lever

Rotate already-passing checklist items into a compact `## Verified History` section (or
restore them back). The highest-leverage token habit in the whole framework: a
4,000-line checklist is re-read by every `/implement`, `/fix`, and `/verify`.

## Usage

```
/archive-checklist @docs/CostDocs/App-CostDashboard-FullStack-Implementation-Checklist.md
/archive-checklist @<same path> restore item #12
```

## Safety rules (conservative by design)

- Only archives above **~2,000 lines AND at least 30 PASS items**.
- Never archives an item still referenced by a failing item or a deployment step.
- Items that establish reusable patterns (e.g. "base error middleware") stay active.
- Verified History keeps one line per item — the audit trail is preserved, and any item
  can be restored.

Run it after each feature reaches ALL PASS, and quarterly over the largest checklists.
