# Phase 3 — Build

**Command:** `/implement` · **Persona:** Orchestrator · **Chat:** fresh

The orchestrator implements the checklist with **parallel sub-agents**, with the standing
rules (`AGENTS.md`) and the coding standards always in context. The command demands the
checklist path and coding standards path before starting; sibling documents (DB changes,
architecture) are read automatically.

## Parallel execution — the orchestrator is a coordinator, not a worker

1. **Plan waves** by file/project independence and item `Type`
   (ui / backend-api / backend-service / db / logging / infrastructure / cross-cutting):
   - Wave 1 — sequential, foundational: DB migrations, shared models.
   - Wave 2 — parallel, typically 4–6 sub-agents on independent groups.
   - Wave 3 — integration glue.
2. **Present the plan for approval** ("Wave 2 has 4 parallel agents: A → items #6–#8,
   B → #9–#10, …") before spawning anything.
3. Spawn the wave's sub-agents in parallel; each gets **only its slice** of the
   checklist, not the whole thing (token discipline).
4. Aggregate results back into the checklist. Builders report telemetry candidates to
   the orchestrator; they never write the miss stream or checklist concurrently.

Cross-cutting edits (DI registration, `Program.cs`, `appsettings.json`) are consolidated
into **one item per file** so parallel agents never fight over the same file.

## Completion contract — the whole checklist in one run

`phase-complete.mjs build` recomputes completion from item metadata: every item in scope is
to-verify with a self-test line, or carries an owned `[INFRA BLOCKER]` / `[EXTERNAL BLOCKER]`.
Until it passes the orchestrator plans more waves; the handoff to
[Phase 5 — Verify](05-verify.md) happens once.

## YOLO mode — unattended build

Add the token `YOLO` to the command (`/implement YOLO @<checklist>`) or run the source-checkout
supervisor. Rules: `AGENTS.md` → "YOLO mode"; operator guide:
[`docs/maintainer/YOLO-Mode-Guide.md`](../docs/maintainer/YOLO-Mode-Guide.md).

## Standing obligations while building

- Match the mockup **exactly**; implement into the existing UI/component structure —
  never invent new patterns, styles, or layouts.
- DB migrations are raw SQL under `deploy/<feature>/`, run via `sqlcmd` —
  **never** `dotnet ef database update`.
- Populate the checklist's `## Deployment Steps` (Automated with runnable commands /
  Manual) and `## Infrastructure Requirements` sections as work creates them.
- Update the checklist's Status Table when done.
- When a builder discovers that the approved plan or checklist left required behavior
  unspecified, it reports an `unspecified-gap` candidate with artifact `plan` or
  `checklist`. The orchestrator records candidates **serially** with
  `PLAYBOOK_TELEMETRY=1 node scripts/playbook-miss.mjs open --if-new ...`, captures either
  the opened or collapsed `MISS-*` ID, and appends that ID to the related item's metadata
  `misses` array. These calls are fire-and-forget: refusal or telemetry failure is noted
  but never changes build, self-test, or phase status.

**Next:** [Phase 4 — Self-review](04-self-review.md) (mandatory before declaring done)
