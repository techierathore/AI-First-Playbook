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

The build phase ends when **every item in scope** is implemented, built, self-tested and
marked to-verify in the Status Table — or carries an explicit `[INFRA BLOCKER]` /
`[EXTERNAL BLOCKER]` note naming what is missing and who supplies it. Handing back
"run `/implement` again for the remaining items" is a phase violation: if the work does
not fit, the orchestrator plans **more waves** with smaller slices and keeps going. The
handoff to [Phase 5 — Verify](05-verify.md) happens once, with every item accounted for.

## YOLO mode — unattended build

Add the token `YOLO` to the command (`/implement YOLO @<checklist>`), or use the optional
supervisor from a full framework source checkout (which sets
`PLAYBOOK_YOLO=1`). Every
approval gate in this phase — the wave plan, the smoke-test start, deployment steps,
deletions — is then pre-approved; the orchestrator records each decision under
`## YOLO Decisions` in the checklist and does not stop until the completion contract is
met. Git history writes stay denied mechanically. Provider usage limits (5-hour / weekly)
are waited out by the supervisor, which resumes the same session after the reset plus a
15-minute buffer. Rules: `AGENTS.md` → "YOLO mode"; operator guide:
[`docs/YOLO-Mode-Guide.md`](../docs/YOLO-Mode-Guide.md).

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
