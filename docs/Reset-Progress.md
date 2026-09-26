# Reset Progress

The running record of the Playbook reset (`docs/Playbook-Reset-Plan.md` §8). Resume from the
first session not marked Done. The headline is the grader's output after that session:
`node scripts/playbook-grade.mjs docs/Playbook-Requirements.md`.

| Session | Goal | Status | Grader headline after the session |
|---:|---|---|---|
| 1 | Requirement list, grader, shared rules | Done 2026-09-26 | 6 of 18 graded; pass 6, fail 0, ungraded 12 |
| 2 | Live OpenCode enforcement | Done 2026-09-26 (PB-04 allow half left for the owner) | 8 of 20 graded; pass 8, fail 0, ungraded 12 |
| 3 | Verifier core plus adapters | Done 2026-09-26 | 12 of 24 graded; pass 12, fail 0, ungraded 12 |
| 4 | Checklist and handoff schemas | Done 2026-09-26 | 15 of 24 graded; pass 15, fail 0, ungraded 9 |
| 5 | Plan, build, fix, analyze commands | Not started | — |
| 6 | Document tools | Not started | — |
| 7 | Reader navigation | Not started | — |
| 8 | Historical proof and retention | Not started | — |
| 9 | Grading campaign and CI | Not started | — |

## Word counts (prose removed or moved)

| Session | File | Before | After | What left the prose, and where it went |
|---:|---|---:|---:|---|
| 1 | `AGENTS.md` | 943 | 485 | WSL stale-metadata procedure moved to `docs/OpenCode-WSL-Setup-Guide.md` §10f; YOLO and completion text compressed with no rule dropped. |
| 1 | `playbook/environment-profile.yml` | 119 | 149 | Grew: names the four secret channels and the retention periods as machine values. |
| 2 | `AGENTS.md` | 485 | 451 | Git-history prose replaced by a pointer to the plugin block now proved by PB-05 and PB-19. |
| 2 | `harness/opencode/agent/orchestrator.md` | 124 | 119 | "git history writes stay denied" removed (PB-05, PB-19). |
| 2 | `harness/opencode/command/implement.md` | 3,956 | 3,939 | Git-denial bullet removed (PB-05, PB-19). |
| 2 | `harness/opencode/command/fix.md` | 2,706 | 2,701 | Git-denial clause removed (PB-05, PB-19). |
| 2 | `phases/03-build.md` | 541 | 535 | Git-denial sentence removed (PB-05, PB-19). |
| 3 | `harness/opencode/agent/verifier.md` | 8,508 | 484 | Probe, app start/stop, gates and item grouping became `playbook-probe.mjs`, `playbook-app-lifecycle.mjs`, `profile-gates.mjs`, `checklist-plan.mjs` (PB-21 to PB-24); YOLO repeat, Docker/Windows, cloud-CLI, NuGet, sqlcmd, progress-chat, forbidden-phrase and report-file blocks deleted per plan §4; UI, API, DB, logging/infra and desktop evidence moved to five conditional adapters (591 words, loaded only for present item kinds). (`wc -w`; the plan's 8,630 counted the file differently.) |
| 4 | `AGENTS.md` | 451 | 442 | The ten handoff field names now live in `handoff-schema.json` and are enforced by `handoff-record.mjs` (PB-07). |
| 4 | `templates/checklist-item-template.md` | 445 | 446 | Rules now in `checklist-lint.mjs` (Type required, misses-only IDs, field shape) shortened; gained the machine schema block and the plan's worked example, whose old free-form acceptance line failed the new rule. |
| 4 | `templates/handoffs/*.md` (8) | 468 | 1,195 | Grew on purpose: each now carries all 10 standing rows plus a schema block; generated from `handoff-schema.json` so the template and validator cannot drift. |
| 3 | `harness/opencode/command/verify.md` | 458 | 115 | Report and telemetry mechanics removed (the Verifier owns them); example paths removed. |

## Decisions taken

Decisions the run took alone, each the smaller reversible choice.

| Session | Decision | Why | How to reverse |
|---:|---|---|---|
| 1 | Supported OpenCode version recorded as 1.18.32 in `package.json` `opencode.supported`. | The owner's value was an unfilled placeholder; `opencode --version` from the current npm release `opencode-ai@1.18.32` printed it. It is a tested version, not a pin (Decisions 2026-08-20). | Change the field. |
| 1 | Grader verdicts go to `verification/telemetry/grades.ndjson`, committed like the miss stream; Session 8 sweeps records older than 365 days. | No external telemetry store is approved; GitHub artefacts cannot hold a year on a public repository. | Point `--telemetry` elsewhere and delete the file. |
| 1 | A check passes only on exit 0 plus a printed `<ID> pass` line; exit 77 plus `<ID> ungraded: <reason>` is ungraded (for example, OpenCode absent). | Makes "never infer PASS from missing output" mechanical. | Edit `scripts/playbook-grade.mjs`. |
| 1 | Live-model probes get their own ungraded IDs (PB-19 onward) with a runbook, instead of weakening PB-04/PB-05. | Keeps the 18 approved lines as written. | Merge the lines back. |
| 2 | The Verifier's missing live identity is repaired by a session → agent map fed from `chat.params`, `chat.message` and `message.updated`; proved live (PB-19). | OpenCode 1.18 passes only `sessionID` to `tool.execute.before`. | Revert `spec-guardrails.ts`. |
| 2 | Normal mode now blocks git history writes in `spec-guardrails.ts`; a human who starts OpenCode with `PLAYBOOK_GIT_APPROVED=1` lifts it outside YOLO; YOLO still denies. | PB-05 requires both modes; the env value is the only approval signal a plugin can see. | Remove the block in `spec-guardrails.ts`. |
| 2 | "Live" probes run a real `opencode run` against a scripted local model (`tests/live/mock-model.mjs`), graded as PB-19; the real-model probe is PB-20, ungraded with `docs/runbooks/live-model-probes.md`. | `models.opencode.ai` and every paid model are unreachable here; the scripted model still exercises OpenCode's own hooks and tools. Transcripts are real OpenCode logs, redacted. | Delete `tests/live/`, PB-19 and PB-20. |
| 2 | **Blocked, left for the owner:** the PB-04 half "allows safe test commands". Widening the Verifier shell policy so `npm test` passes was refused by this run's safety check as a security relaxation, so it was not attempted again. PB-04 stays review; `tests/plugin/run.mjs PB-04` and `tests/live/run.mjs PB-04` show the one failing case. | An unattended run must not weaken a guard. | Owner adds a test-command allowance to `write-policy.mjs` and moves PB-04 to `fixture`. |
| 2 | `harness/opencode/plugin/yolo-policy.mjs` was used through its exports only; this run's safety check refused a direct read of its source. | Respecting the check. | — |
| 3 | The desktop fixture item (INV-004) is synthetic and labelled so; UI comes from the brownfield owner filter, API and DB from the greenfield duplicate-tag import. | Neither case study has a desktop application. | Replace INV-004 with a real item. |
| 3 | `desktop` added to the checklist item `Type` values (`scripts/checklist-lib.mjs`). | The desktop adapter needs a bucket; Session 4's schema adopts the same list. | Remove it and route desktop items as `ui`. |
| 3 | Verifier adapters live in `harness/opencode/templates/verifier/` (installed as `.opencode/templates/verifier/`), not under `agent/`. | OpenCode discovers every `agent/**/*.md` as an agent; templates are not discovered. | Move the folder. |
| 3 | Run-time raw output of the new scripts goes to `verification/runs/<run-id>/`. | The folder Session 8 git-ignores and sweeps after 7 days. | Change `runDirectory()` in `profile-lib.mjs`. |
| 4 | Checklist metadata keys follow the plan's order (`schema, id, owner, priority, risk, status, created_at, updated_at, evidence, misses`); `title` left the metadata `required` list because the checkbox line carries it. | Plan §5 worked schema; the old template example never had a metadata title. | Restore `title` in `templates/checklist-metadata.yml` and the schema. |
| 4 | `to-verify` added to item statuses; `incident-open`, `incident-mitigated`, `incident-resolved`, `operations-owned` added to feature states. | `AGENTS.md` already names the to-verify state; incident and transfer handoffs need transitions. Additive only. | Remove them. |
| 4 | "Verb-led title" is enforced only as a ban on leading articles and filler words; true verb detection is not attempted. | A part-of-speech check would guess. | Replace with a verb list if misses show it matters. |
| 4 | The three checklists and eight handoff examples are INVENTED from the case studies and labelled so; they are generated or hand-written fixtures, not accepted real records. | No real accepted checklists or handoffs exist in the repository. | Replace with real ones when a team supplies them. |
| 1 | Local checks ran on Node 22.22.2 with npm 10.9.7 (the container's npm); npm 11.20.0 is installed for the Session 9 campaign. | The container ships npm 10; every existing check passes on it. | — |
