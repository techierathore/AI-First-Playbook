# /analyze-fix
<!-- template-schema: {"produces":"/analyze-fix checklist changes","required":["Contract","usage","inputs","cause","checklist changes","gap analysis","handoff"],"optional":["Story and escaped-bug branches"],"budget":{"small":[350,500],"medium":[500,700],"large":[650,900]},"rows":"One issue; separate symptom, cause, checklist defect, and regression test."} -->

**Persona:** Analyst · **Cost:** 🟡 · **Chat:** fresh

Analyze a bug report, user story, or spotted gap ("something feels incomplete around X —
figure it out from BRD + code") and **fold the findings into the existing implementation
checklist** with root-cause analysis. The heavier-weight sibling of `/amend-checklist`.

## Usage

```
/analyze-fix @docs/CostDocs/Cost-Issues.md @src/backend/ @src/frontend/
/analyze-fix @docs/UserStories/US-101-MultiCloud.md @src/integrations/ @src/frontend/
```

## Key behaviors

- Requires BOTH the issues/story file AND the existing checklist (plus the associated
  projects); if no checklist exists yet, it ASKs — run `/feature-plan` first or point
  at an adjacent feature's checklist.
- Produces per bug: root cause; new/updated checklist items; updated Status Table. For
  user stories: impact analysis instead of root cause.
- **Post-verification mode** (bugs that escaped an ALL-PASS verify): additionally
  answers *why the Verifier missed it* (missing item? weak Verify method? code-audit
  limitation?) and patches the checklist so this class of bug becomes a FAIL on the
  next `/verify` — the "Verification Gap Analysis".
- Never creates a separate task/bug-fix checklist file; flags sibling docs that need
  updates.
