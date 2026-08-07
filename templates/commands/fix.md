# /fix

**Persona:** Orchestrator · **Cost:** 🟡–🔴 · **Chat:** same or fresh

Fix the items annotated FAIL in the checklist's inline Verifier annotations, using
parallel sub-agents, then hand back to `/verify`. Loop until ALL PASS.

## Usage

```
/fix docs/CostDocs/App-CostDashboard-FullStack-Implementation-Checklist.md
```

(Optionally also pass an Issues file to fold in alongside the FAIL items.)

## Key behaviors

- Touches **only** FAIL items — reads the inline `**Verifier Result**:` annotations
  directly; no separate gap report or fix log exists.
- Same wave-based parallel machinery and the same build + smoke-test self-check as
  `/implement`.
- Updates the checklist in place: "Fix applied" notes, Status Table, any new deployment
  steps / infrastructure requirements discovered while fixing.
- Never creates a new checklist file.
