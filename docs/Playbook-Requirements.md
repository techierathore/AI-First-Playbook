# AI-First Playbook — Requirements

| | |
|---|---|
| Purpose | The list of things the Playbook must do, each with the one check that proves it. `node scripts/playbook-grade.mjs docs/Playbook-Requirements.md` walks every line. |
| Audience | Framework maintainers and agents. The owner approves the lines; nobody has to re-read them to know the state, because the grader prints it. Agent document; not rendered to HTML. |
| Status | PB-01 to PB-18 approved by the owner as written in `docs/Playbook-Reset-Plan.md` §6 (Session 1, 2026-09-26). PB-19 and PB-20 added in Session 2 from the owner's live-probe decision; PB-21 to PB-24 in Session 3 and PB-25 to PB-28 in Session 5 and PB-29 to PB-32 in Session 6, one per prose rule that became a script; PB-33 and PB-34 in Session 9 from the owner's campaign decision; PB-35 to PB-44 in Session 10, one per group of prose rules that became runtime scripts. |
| Headline | **16 of 44 proved by a script**, 25 more by a fixture: 41 of 44 graded. Ungraded: PB-04 (owner decision), PB-20 and PB-34 (live model, runbooks). |
| Sources | `docs/Playbook-Reset-Plan.md` §6 and §8; the miss stream `verification/telemetry/misses.ndjson`; owner decisions of 2026-09-26 (§4). |

---

## 1. How to read a line

- **ID**: `PB-` and a number. A miss is traced back to an ID.
- **The Playbook …**: one sentence, one behaviour.
- **Check**: exactly one kind, first in the cell.
  - `script:` a command that fails when the line is broken. It prints `<ID> pass` and exits 0, or it fails.
  - `fixture:` a command run over a named fixture in `tests/`. Same output contract.
  - `review:` a person reads something. Printed as ungraded with the reason written here.
  - `ungraded:` needs something the grader cannot have (a live model). Names its laptop runbook.
- A check that exits 77 and prints `<ID> ungraded: <reason>` is ungraded for that run (for example, OpenCode is not on `PATH`). Every other outcome that is not an explicit pass is a fail.
- A line may say `script` or `fixture` only when the file exists in the same commit and the grader calls it (PB-09 checks this).

## 2. Where checks run

| Target | What it is | Used by |
|---|---|---|
| Packed install | `npm pack` of this checkout, installed with `npm exec` into a throwaway folder outside the repository | PB-01, PB-02 |
| Grader fixtures | `tests/grader/cases/`: one requirement file with a case per grader defect | PB-09 to PB-12 |
| Disposable project | a small Node project generated in the temp folder with the Playbook installed; the installed plugins are loaded and their hooks driven offline | PB-04, PB-05 |
| Verifier project | a disposable project with a tiny Node HTTP app and a real profile; `tests/verifier/fixtures/` holds the case-study checklist | PB-21 to PB-24 |
| Schema fixtures | `tests/checklist/fixtures/` (small 6, medium 14, large 34 items, invented from the case studies) and `tests/handoff/fixtures/good/` (the eight handoff kinds, invented from the greenfield case study) | PB-06, PB-07 |
| Planning fixtures | `tests/phase/fixtures/`: the Team Inventory BRD and planned checklist (invented from the greenfield case study); the failed item set is derived in the test | PB-13, PB-25 to PB-28 |
| Document fixtures | `tests/docs/fixtures/`: a Team Inventory flow guide, business reference and code tree (invented from the greenfield case study); legacy inputs are the documents under `docs/` | PB-29 to PB-32 |
| Runtime project | a disposable project with the Playbook installed; the Session 10 scripts run from `.playbook/scripts/` against copies of the checklist, handoff and phase fixtures, with fake HTTP apps, a fake Jira and a fake desktop bridge on 127.0.0.1 | PB-35 to PB-44 |
| Packed campaign | `npm pack` of the checkout installed with `npm exec` into a generated project with a tiny HTTP app, a real profile and the Team Inventory fixtures | PB-33 |
| Scripted model | `tests/live/mock-model.mjs`, an OpenAI-compatible server on 127.0.0.1 that OpenCode uses as its model; it plants tool calls, so a real `opencode run` exercises the live hooks | PB-04, PB-19 |

## 3. The four questions for a miss

Asked in order; stop at the first fixed response; the response is stored in the miss record.

1. Did the project's spec say it clearly? No → fix the checklist line (`spec-gap`).
2. Did the Playbook say it anywhere? No → add one line here plus a check (`playbook-gap`).
3. Was there a check, and did it fail to catch it? Yes → fix the check, not the prose (`weak-check`).
4. Was it written and ignored anyway? Yes → make it a script or a gate, or delete it (`ignored-rule`).

## 4. Requirements

| ID | The Playbook … | Check | Source |
|---|---|---|---|
| PB-01 | resolves all 14 OpenCode commands and the four agents from a packed npm install. | script: `node tests/package/run.mjs PB-01` packs, installs into a throwaway target and reads `opencode debug config`. | Reset Plan §1, §6 |
| PB-02 | ships OpenCode as its only coding harness. | script: `node tests/package/run.mjs PB-02` scans the packed files and the installed target. | Reset Plan §6 |
| PB-03 | keeps every phase's measured instruction total below its tier maximum. | script: `node tests/phase/run.mjs PB-03` runs `scripts/instruction-budget.mjs` (fixed surface per phase, front matter stripped) and a grown-command twin. | Reset Plan §3 |
| PB-04 | blocks product edits by the Verifier through the live write boundary and allows safe test commands. | review: the block half passes live (PB-19) and offline (`tests/plugin/run.mjs PB-04`); the allow half fails in both — the Verifier shell policy still blocks `npm test`, and widening it was refused as a security relaxation in the unattended Session 2 run. Owner decision needed (Reset-Progress, Session 2). | Reset Plan §6 M06-M08 |
| PB-05 | denies unapproved Git history changes in normal and YOLO modes. | fixture: `node tests/plugin/run.mjs PB-05` loads the installed plugins in a disposable project and plants git writes in both modes. | Reset Plan §6 M11, P05 |
| PB-06 | makes every checklist item follow the ordered schema and the acceptance sentence rule. | fixture: `node tests/checklist/run.mjs PB-06` lints the small, medium and large fixtures clean and catches 12 broken twins with the installed `checklist-lint.mjs`. | Reset Plan §5 |
| PB-07 | persists all 10 standing fields in every handoff. | fixture: `node tests/handoff/run.mjs PB-07` validates the eight handoff examples and catches each broken twin with the installed `handoff-record.mjs`. | `AGENTS.md`; Reset Plan §6 P04 |
| PB-08 | declares required order, optional parts, TARGET and MAXIMUM in every template. | script: `node tests/handoff/run.mjs PB-08` runs `scripts/template-lint.mjs` over all 29 templates and over broken copies. | Reset Plan §5 |
| PB-09 | names, for every script or fixture line, a file that exists and that the grader invokes. | script: `node tests/grader/run.mjs PB-09` | Reset Plan §6 |
| PB-10 | reports one result or one written ungraded reason per requirement, never a PASS inferred from missing output. | script: `node tests/grader/run.mjs PB-10` | Reset Plan §6 |
| PB-11 | prints the headline `N of M graded`, then pass, fail and ungraded counts. | script: `node tests/grader/run.mjs PB-11` | Reset Plan §6 |
| PB-12 | appends one redacted `grader-verdict` record per requirement to telemetry. | script: `node tests/grader/run.mjs PB-12` | Reset Plan §6 |
| PB-13 | stores one protocol outcome on every miss record, from the four questions in order. | fixture: `node tests/phase/run.mjs PB-13` records the escaped duplicate-import bug with `--protocol` answers and checks derivation, order, refusal and the historical stream. | Reset Plan §7 |
| PB-14 | git-ignores raw run evidence, sweeps it after 7 days and keeps it out of npm. | fixture: `node tests/retention/run.mjs PB-14` ages run folders in an installed project and checks `.gitignore`, `playbook-sweep.mjs`, the automatic sweep and the npm package. | Reset Plan §5b |
| PB-15 | keeps durable OpenCode-only proof as a rerunnable self-test plus a historical archive. | script: `node tests/retention/run.mjs PB-15` checks the manifest of `docs/archive/opencode-only-2026-09-02/` and reruns the V01-V03 checks on the current tree. | Reset Plan §5b |
| PB-16 | gives readers one path: Getting Started, ten phases, templates and one operating guide. | script: `node tests/navigation/run.mjs PB-16` runs `scripts/reader-path.mjs` on the repository and on four broken copies. | Reset Plan §5 |
| PB-17 | keeps TechieFlow and TfLens documents outside the reader path. | script: `node tests/navigation/run.mjs PB-17` | Reset Plan §5 |
| PB-18 | validates releases on the declared Node and npm versions and runs every graded check. | script: `node tests/release/run.mjs PB-18` reads `.github/workflows/validate.yml` and `release.yml` and catches four broken copies. | Reset Plan §6 M30, M31 |
| PB-19 | enforces the Verifier product-write block and the git-history denial inside a live `opencode run`, in normal and YOLO modes. | fixture: `node tests/live/run.mjs PB-19` drives real OpenCode with the scripted model; transcripts in `tests/live/transcripts/`. | Session 2 (M06, M10, M11) |
| PB-20 | keeps the PB-19 guardrails when a real model, not a scripted one, drives the planted probes. | ungraded: needs a live model; runbook `docs/runbooks/live-model-probes.md`. | Session 2 owner decision |
| PB-21 | resolves every verification environment fact from the profile and reports a placeholder, missing tool or unreachable URL by field name, never a guessed value. | script: `node tests/verifier/run.mjs PB-21` | Reset Plan §4 Verifier blocks 2, 10, 24 |
| PB-22 | starts, polls, records and stops only the application processes a run started, from the profile's commands. | script: `node tests/verifier/run.mjs PB-22` | Reset Plan §4 Verifier blocks 25, 37 |
| PB-23 | runs the build and test gates from the profile and reports a failing gate as FAIL, a missing command as BLOCKED. | script: `node tests/verifier/run.mjs PB-23` | Reset Plan §4 Verifier block 31; old Step 5.3 |
| PB-24 | loads a Verifier adapter only for the item kinds present in the checklist. | fixture: `node tests/verifier/run.mjs PB-24` over the case-study checklist (UI, API, DB, synthetic desktop). | Reset Plan §3, §4 Verifier blocks 8, 13, 29, 33 |
| PB-25 | plans dependency-safe build and fix waves with one owner for every shared file. | fixture: `node tests/phase/run.mjs PB-25` over the medium fixture and the failed item set (INV-002, INV-003). | Reset Plan §4 implement 7, fix 6; §6 P15 |
| PB-26 | recomputes build and fix completion from item metadata and never lets a builder pass its own work. | fixture: `node tests/phase/run.mjs PB-26` | Reset Plan §4 implement 25, fix 18; §6 P07; misses INSTALL-LAYOUT, OC-005 |
| PB-27 | maps every requirement ID and every screen of the requirements source to a checklist item. | fixture: `node tests/phase/run.mjs PB-27` over the invented Team Inventory BRD. | Reset Plan §4 feature-plan 12; §6 P12, P13 |
| PB-28 | links each recorded miss to its checklist item once, serially, and never removes an ID. | fixture: `node tests/phase/run.mjs PB-28` | Reset Plan §4 Verifier 16, implement 11, fix 15; §6 P25 |
| PB-29 | renders only human documents to HTML, by script, with the Markdown escaped into the page. | fixture: `node tests/docs/run.mjs PB-29` renders the case studies under `docs/examples/` and refuses the checklist and an Issues file. | Reset Plan §4 generate-html 1-6, add-doc 18; §6 P31 |
| PB-30 | writes every human document from its schema and fails a document that breaks it. | fixture: `node tests/docs/run.mjs PB-30` over the Team Inventory flow guide and business reference, all six scaffolds and seven broken twins. | Reset Plan §4 add-doc 9, 13, 17; `docs/Playbook-Document-Schemas.md` |
| PB-31 | names every stale code reference and broken link in a document by line. | fixture: `node tests/docs/run.mjs PB-31` (drift over fixture code; links over the reader documents and a V01-style broken README). | Reset Plan §4 refresh-doc 3, 9, 11; §5b V01 |
| PB-32 | backs up a legacy document byte-for-byte before an upgrade changes it and never overwrites a backup. | fixture: `node tests/docs/run.mjs PB-32` on a copy of the legacy `docs/archive/replaced/Operating-Model.md`. | Reset Plan §4 upgrade-docs 3, 20 |
| PB-33 | installs from a fresh `npm pack` with Node 22.14.0+ and npm 11.5.1+ into a new project, where every shipped runtime script works from the installed copy and OpenCode resolves the runtime. | script: `node tests/campaign/run.mjs PB-33` (ungraded when Node or npm on `PATH` is below the declared versions). | Reset Plan §8 Session 9 |
| PB-34 | takes a feature through plan, build, verify and fix with a real model on the installed copy, in normal and YOLO modes. | ungraded: needs a live model; runbook `docs/runbooks/live-campaign.md`. | Session 9 owner decision |
| PB-35 | writes Verifier outcomes, run-log entries and the Status Table only through a script that refuses an incomplete BLOCKED or DATA-GAP and any secret, runs deployment steps only after approval and stops BLOCKED at the first failure, renders the final summary from the checklist, and lets the Verifier run exactly those scripts. | fixture: `node tests/runtime/run.mjs PB-35` (includes the Status Table item-loss and `PASS (code-audit)` regressions). | Reset Plan §4 verify, verifier.md |
| PB-36 | hands a configuration secret to a command only through a 0600 file or stdin, never printing it, and reports a missing reference as BLOCKED naming it. | fixture: `node tests/runtime/run.mjs PB-36`. | Reset Plan §4 verify; `AGENTS.md` secret channels |
| PB-37 | runs the build self-test from a declared probe list and records it per item without ever setting `pass`. | fixture: `node tests/runtime/run.mjs PB-37`. | Reset Plan §4 implement, fix |
| PB-38 | keeps Infrastructure Requirements and Deployment Steps in one shape and refuses a credential in either. | fixture: `node tests/runtime/run.mjs PB-38`. | Reset Plan §4 implement, amend-checklist |
| PB-39 | amends a checklist with stable, never-reused IDs, protects verified items, and archives and restores items verbatim. | fixture: `node tests/runtime/run.mjs PB-39`. | Reset Plan §4 amend-checklist, archive-checklist |
| PB-40 | folds bugs and stories into the checklist without inventing analysis, tracks each escaped bug to its miss, refuses to resolve an incident on an unverified fix, and never picks between two checklists. | fixture: `node tests/runtime/run.mjs PB-40`. | Reset Plan §4 analyze-fix; `phases/` |
| PB-41 | says whether the plan-review and verification-results gates are ready from the evidence, and catches a record that disagrees with the checklist. | fixture: `node tests/runtime/run.mjs PB-41`. | Reset Plan §4 feature-plan, verify; `phases/` |
| PB-42 | writes Issues files with absent facts marked `[MISSING]` and fetches Jira tickets with credentials from an allowed channel only, never printing the token. | fixture: `node tests/runtime/run.mjs PB-42` (fake Jira on 127.0.0.1). | Reset Plan §4 create-issue-list |
| PB-43 | keeps the Context-Prompt command block in step with the command set and names every drift. | fixture: `node tests/runtime/run.mjs PB-43`. | Reset Plan §4 update-context |
| PB-44 | diagnoses a failed .NET restore without printing a credential, and treats an absent desktop bridge as headless, never BLOCKED. | fixture: `node tests/runtime/run.mjs PB-44` (fixture restore log; fake bridge). | Reset Plan §4 verify, desktop adapter |

## 5. Owner decisions

| Date | Decision |
|---|---|
| 2026-09-26 | PB-01 to PB-18 approved as written. |
| 2026-09-26 | Raw run evidence is kept 7 days; graded verdicts 1 year (`playbook/environment-profile.yml` `retention`). |
| 2026-09-26 | Supported OpenCode version: 1.18.32 (`package.json` `opencode.supported`), observed with `opencode --version`. |
| 2026-09-26 | Allowed secret channels: approved secret manager, environment reference, protected stdin, protected temporary file (`AGENTS.md`; profile `secrets.sources`). |
