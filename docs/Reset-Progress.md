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
| 5 | Plan, build, fix, analyze commands | Done 2026-09-26 | 21 of 28 graded; pass 21, fail 0, ungraded 7 |
| 6 | Document tools | Done 2026-09-26 | 25 of 32 graded; pass 25, fail 0, ungraded 7 |
| 7 | Reader navigation | Done 2026-09-26 | 27 of 32 graded; pass 27, fail 0, ungraded 5 |
| 8 | Historical proof and retention | Done 2026-09-26 | 29 of 32 graded; pass 29, fail 0, ungraded 3 |
| 9 | Grading campaign and CI | Done 2026-09-26 | 31 of 34 graded; pass 31, fail 0, ungraded 3 |

## Session 9 campaign

- Package: `techierathore-ai-first-playbook-0.1.0.tgz`, 95 files, sha256
  `c7febe36b0ae90f7685ab1bf01d14e3d2baa0b1196c692e5b3bfc87e22383121` (not published; version not
  bumped). The same hash came out on every run.
- Grader run `campaign-s9` (in `verification/telemetry/grades.ndjson`): Node 22.22.2, npm 11.20.0,
  OpenCode 1.18.32 — **31 of 34 graded; pass 31, fail 0, ungraded 3; 16 of 34 proved by a script.**
- Repeated at the declared minimums: Node 22.14.0 with npm 11.20.0 gave the same 31 of 34 (scratch
  stream, not kept); `tests/campaign/run.mjs PB-33` passed on Node 22.14.0 with npm 11.5.1.
- The campaign found one real defect: the probe read the profile's path template
  `verification/<feature>/<run-id>` as an unfilled placeholder, so every real project would have
  probed as blocked. Recorded as `MISS-20260926-01` (protocol outcome `weak-check`: PB-21's check
  existed and missed it), fixed in `profile-lib.mjs`, PB-21 given the missing case, closed `pass`.
- Misses from the reset recorded through the CLI: `MISS-20260926-02` (the Verifier's live identity,
  `weak-check`, fixed in Session 2 and closed `pass` by PB-19) and `MISS-20260926-03` (the Verifier
  blocks safe test commands, `ignored-rule`, **open** — the owner decision on PB-04).
- CI: `.github/workflows/validate.yml` now runs the four npm test scripts and the grader on every
  push with Node 22.14.0, npm 11.5.1 and the supported OpenCode, and uploads `grader-output/` as an
  artefact; `release.yml` runs `test:install` and the grader before publishing. No Actions run
  could be observed from this session.

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
| 5 | `harness/opencode/command/implement.md` | 3,939 | 385 | Waves (`checklist-plan.mjs implement`), gates, app start/stop, miss linkage (`checklist-miss-coordinator.mjs`), Status Table (`checklist-create.mjs sync`) and completion (`phase-complete.mjs`) became scripts; YOLO repeat, progress-chat, "no excuses", sqlcmd/.NET/npm stack rules and the deployment tutorial deleted per plan §4 (deployment shape now in the template). |
| 5 | `harness/opencode/command/fix.md` | 2,702 | 314 | Same scripts in fix mode; Gap-Report handling cut to one sentence; stack rules and progress chat deleted. |
| 5 | `harness/opencode/command/feature-plan.md` | 2,534 | 482 | Checklist scaffold, lint and requirement/screen coverage became `checklist-create.mjs`, `checklist-lint.mjs`, `plan-coverage.mjs`; repeated flow-guide and business-reference structures replaced by a pointer to `/add-doc`; large-write workaround deleted. |
| 5 | `harness/opencode/command/analyze-fix.md` | 2,361 | 466 | Miss recording and linkage became the coordinator plus the derived four-question `protocol_outcome`; progress chat and duplicate templates deleted. |
| 5 | `harness/opencode/agent/orchestrator.md` | 119 | 67 | Completion contract replaced by `phase-complete.mjs`; YOLO detail left to `AGENTS.md`. |
| 5 | `AGENTS.md` | 442 | 409 | Completion paragraph shortened to the `phase-complete.mjs` rule (PB-26). |
| 5 | `phases/03-build.md` | 535 | 423 | Completion contract and YOLO repetition shortened to pointers. |
| 5 | `templates/deployment-steps-template.md` | 303 | 259 | The credential-bearing `sqlcmd` example deleted (plan §4); commands now come from the profile. |
| 6 | `harness/opencode/command/add-doc.md` | 4,707 | 438 | Both document structures moved to `document-schemas.json` (scaffold + `doc-check.mjs`, readable in `docs/Playbook-Document-Schemas.md`); HTML conversion to `render-docs.mjs`; stack-specific "no excuses" text, progress chat and the large-write workaround deleted. |
| 6 | `harness/opencode/command/refresh-doc.md` | 2,496 | 276 | Drift inventory and link checks became `doc-drift.mjs` and `reference-lint.mjs`; the repeated flow-guide procedure points to `/add-doc`. |
| 6 | `harness/opencode/command/upgrade-docs.md` | 3,528 | 366 | Backup became `doc-upgrade.mjs backup`; per-type conversion now targets the schemas; progress chat, shell-copy workaround and legacy row shapes deleted. |
| 6 | `harness/opencode/command/generate-html.md` | 1,002 | 88 | The whole mechanical conversion became `render-docs.mjs` (escaping, agent-doc exclusion, overwrite rule, read-back check). |
| 7 | `docs/Getting-Started.md` | 5,309 | 709 | Agent topology, SDLC mapping, operating flow, handoffs, telemetry, adoption and common mistakes moved to `docs/Operating-Guide.md` (2,447 words, which also absorbs nine operator documents); the length limit is now checked by `reader-path.mjs` (PB-16). The original is kept in `docs/archive/replaced/`. |
| 7 | `README.md` | 1,993 | 1,248 | Reader path first; the repo map, long install and Verifier description replaced by pointers; original kept in `docs/archive/replaced/README-2026-09-26.md`. |
| 7 | `docs/` root | 31 files | 7 files | 3 reader documents plus 4 reset control files; 4 examples, 16 maintainer documents (3 cross-framework), 13 archived originals and the 2 review files moved; nothing deleted. |
| 8 | `verification/` | 77 tracked campaign and supervisor files | 0 | V01-V03 and the YOLO supervisor state moved to `docs/archive/opencode-only-2026-09-02/` (marked HISTORICAL, SHA-256 manifest, tree `44168dbe…`); `verification/` now holds only the telemetry streams. |
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
| 5 | The miss record gains an optional `protocol_outcome`, derived by `miss-lib.mjs` from `--protocol=spec=…,playbook=…,check=…,ignored=…` answers given in order; a typed outcome is refused; historical misses may receive it once through `amend`. | "Change the miss schema only additively, through the miss CLI"; deriving keeps the order mechanical. | Drop the optional field; old records never carried it. |
| 5 | Phase 10's maximum is 5,400 words across its three runs, as plan §3 states, not the 4,200 sum of the three tier maxima. | The plan's table is the owner-approved figure. | Change `instruction-budget.mjs`. |
| 5 | Checklist items carry an optional metadata `trace` array of requirement IDs; `plan-coverage.mjs` reads it. | Coverage needs a machine link from requirement to item; the metadata key order stays as the schema lists, with `trace` after it. | Remove `trace`; coverage falls back to IDs in item text. |
| 5 | The escaped bug is the greenfield training defect (duplicate import reports success, writes nothing), answered `spec=yes,playbook=yes,check=yes` → `weak-check`; the failed item set is INV-002 and INV-003 from the verification-results example. | Both come from the case study; the miss stream's five records are historical and all closed. | Swap the fixtures. |
| 5 | `checklist-item-template.md` and `deployment-steps-template.md` now install to `.playbook/templates/`. | The shrunk commands point at them instead of repeating them. | Remove the two runtime mappings. |
| 6 | Legacy backups go to `<folder>/_legacy/<run-id>/<name>.md` (written by `doc-upgrade.mjs`) instead of the old `<name>-OLD-<date>.md` beside the file. | One folder per upgrade run keeps the documents folder clean and lets the report pair backup and current file. | Change `doc-upgrade.mjs`. |
| 6 | `render-docs.mjs` HTML-escapes the Markdown into the shell's hidden source block; the old command pasted raw text. | Raw text lets a document containing `</textarea>` break or inject into the page (fixture PB-29). | — |
| 6 | Six human document kinds get schemas (flow guide, business reference, DB changes, architecture, verification guide, Power BI mapping), with budgets set by the author from the TechieFlow shape and the plan's size classes. | Plan §5 gave budgets only for templates and checklist items; these are labelled as the maintainer's first figures in the JSON. | Edit `playbook/document-schemas.json` and regenerate the page. |
| 7 | Owner's `docs/maintainer/` (singular) is used rather than the plan's `docs/maintainers/`; TechieFlow and TfLens documents sit in `docs/maintainer/cross-framework/`. | Owner decision wording wins over the plan. | `git mv` the folder. |
| 7 | The nine merged operator documents and the old Getting Started and README are kept verbatim in `docs/archive/replaced/`; the review copies in `docs/claudereview/` moved to `docs/archive/review-2026-09-07/`. | "No content is deleted without a home" (plan §5). | Move them back. |
| 7 | `Npm-Publishing-Guide.md` was merged into `docs/maintainer/Npm-Release-Guide.md` as an appendix, with the owner named as release owner. | Plan §5 "merge with the publishing guide"; owner decision on release ownership. | Split the appendix out again. |
| 7 | Four reset control files stay at the `docs/` root (`Playbook-Reset-Plan`, `Playbook-Requirements`, `Reset-Progress`, `Playbook-Document-Schemas`) and are allowed there by `reader-path.mjs`. | The owner's instructions and the grader command name those paths. | Move them to `docs/maintainer/` and update the grader command. |
| 7 | `--with-guides` now ships Getting Started, the Operating Guide, How It Works and the two examples; the installer still recognises the old guide list for upgrade and uninstall. | Old installations carry the old names in `.playbook/installation.json`. | Edit `userDocs` in `scripts/install.mjs`. |
| 8 | The historical campaigns stay inside the repository under `docs/archive/opencode-only-2026-09-02/`, protected by `MANIFEST.sha256` and `scripts/archive-manifest.mjs --check`, instead of an external release asset. | Owner decision: no external location is approved. | Export the folder to an approved store, record its hash there, and delete it here. |
| 8 | The sweep runs itself: the first `verification/runs/` folder a runtime script creates in a process sweeps folders past `retention.raw_runs_days`; `playbook-sweep.mjs --apply` also prunes grader verdicts past 365 days. No scheduled CI job was added, because CI checkouts never hold raw runs. | A cron-style job would need every team to schedule it; the runtime is already where raw runs are born. | Remove the call in `profile-lib.mjs runDirectory()` and schedule the script instead. |
| 8 | `/verification/yolo/` is git-ignored (plugin and supervisor runtime state) in the repository and in the installer's managed block. | That state is per-run, like raw evidence; the one historical copy is archived. | Remove the ignore line. |
| 9 | Grader verdicts from CI go to the `grader-output` artefact (90 days, the public-repository maximum); the committed `verification/telemetry/grades.ndjson` keeps the year the owner asked for. | Actions cannot hold artefacts for a year on a public repository. | Point `--telemetry` elsewhere. |
| 9 | The "live OpenCode part" is PB-34, ungraded, with `docs/runbooks/live-campaign.md`; the packed-install campaign that needs no model is PB-33, graded. | Owner decision: the live part is an ungraded line with a runbook. | — |
| 9 | Misses found or fixed during the reset were recorded in the repository's own miss stream with `--protocol` answers; two closed `pass` on the grader's independent checks, one left open for the owner. | "Updated miss records" is a Session 9 output; the grader is the independent check for framework code. | Append `miss-fix` records; never edit the stream. |
| 1 | Local checks ran on Node 22.22.2 with npm 10.9.7 (the container's npm); npm 11.20.0 is installed for the Session 9 campaign. | The container ships npm 10; every existing check passes on it. | — |
| all | Every `git push` to `claude/kind-goldberg-0rvdkw` was refused with HTTP 403 ("Claude doesn't have GitHub access to techierathore/AI-First-Playbook"); all commits are local on that branch. | The GitHub App lacks write access for this repository; not something the run can change. | Reconnect GitHub or install the app, then push the branch. |
