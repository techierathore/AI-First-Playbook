# /implement

**Persona:** Orchestrator · **Cost:** 🔴 · **Chat:** fresh

Build a planned feature from its implementation checklist using parallel sub-agents,
with a build + smoke-test self-check before declaring done.

## Usage

```
/implement docs/CostDocs/App-CostDashboard-FullStack-Implementation-Checklist.md
/implement YOLO docs/CostDocs/App-CostDashboard-FullStack-Implementation-Checklist.md   # unattended
```

## Key behaviors

- **Completion contract**: the command ends only when every item in scope is
  implemented, built, self-tested and marked to-verify (or tagged `[INFRA BLOCKER]` /
  `[EXTERNAL BLOCKER]` with what is missing). It never hands back "run again for the
  remaining items" — it plans more waves instead, and hands off to `/verify` once.
- **YOLO mode** (token `YOLO` or `PLAYBOOK_YOLO=1`): every approval
  gate is pre-approved, decisions are logged under `## YOLO Decisions`, git history writes
  stay denied, and the run ends with `PLAYBOOK_RUN_COMPLETE:` / `PLAYBOOK_RUN_BLOCKED:` so
  the supervisor (`scripts/playbook-yolo.mjs`) can wait out usage limits and resume. See
  [`docs/YOLO-Mode-Guide.md`](../../docs/YOLO-Mode-Guide.md).
- Demands the checklist and coding-standards paths; reads sibling docs (DB changes,
  architecture) automatically.
- **Wave-based parallelism**: Wave 1 sequential foundations (DB migrations, shared
  models) → Wave 2 parallel (typically 4–6 sub-agents on independent item groups by
  `Type` and file ownership) → Wave 3 integration glue. Presents the wave plan for
  approval before spawning; each sub-agent gets **only its slice** of the checklist.
- Standing rules always in context (`AGENTS.md`): match the mockup exactly, implement
  into the existing UI structure, required logging, no silent failures.
- Populates `## Deployment Steps` and `## Infrastructure Requirements` as work creates
  them; updates the Status Table.
- Ends with the mandatory [self-review + smoke test](../../phases/04-self-review.md) —
  build, curl each new endpoint, query the real DB, Playwright-snapshot each new page,
  grep logs — and a smoke-test summary. Only the user may authorize skipping it.
