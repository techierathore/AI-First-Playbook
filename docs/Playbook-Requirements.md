# AI-First Playbook — Requirements

| | |
|---|---|
| Purpose | The list of things the Playbook must do, each with the one check that proves it. `node scripts/playbook-grade.mjs docs/Playbook-Requirements.md` walks every line. |
| Audience | Framework maintainers and agents. The owner approves the lines; nobody has to re-read them to know the state, because the grader prints it. Agent document; not rendered to HTML. |
| Status | PB-01 to PB-18 approved by the owner as written in `docs/Playbook-Reset-Plan.md` §6 (Session 1, 2026-09-26). PB-19 and PB-20 added in Session 2 from the owner's live-probe decision; PB-21 to PB-24 in Session 3, one per Verifier rule that became a script. |
| Headline | **9 of 24 proved by a script**, 3 more by a fixture: 12 of 24 graded. Every review or ungraded line names what is missing. |
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
| PB-03 | keeps every phase's measured instruction total below its tier maximum. | review: no instruction counter yet; Sessions 3 and 5 shrink the phases and add it. | Reset Plan §3 |
| PB-04 | blocks product edits by the Verifier through the live write boundary and allows safe test commands. | review: the block half passes live (PB-19) and offline (`tests/plugin/run.mjs PB-04`); the allow half fails in both — the Verifier shell policy still blocks `npm test`, and widening it was refused as a security relaxation in the unattended Session 2 run. Owner decision needed (Reset-Progress, Session 2). | Reset Plan §6 M06-M08 |
| PB-05 | denies unapproved Git history changes in normal and YOLO modes. | fixture: `node tests/plugin/run.mjs PB-05` loads the installed plugins in a disposable project and plants git writes in both modes. | Reset Plan §6 M11, P05 |
| PB-06 | makes every checklist item follow the ordered schema and the acceptance sentence rule. | review: no checklist validator yet; Session 4 builds `checklist-lint.mjs`. | Reset Plan §5 |
| PB-07 | persists all 10 standing fields in every handoff. | review: no handoff validator yet; Session 4 builds `handoff-record.mjs`. | `AGENTS.md`; Reset Plan §6 P04 |
| PB-08 | declares required order, optional parts, TARGET and MAXIMUM in every template. | review: no template linter yet; Sessions 4 and 6 add schema blocks and their linter. | Reset Plan §5 |
| PB-09 | names, for every script or fixture line, a file that exists and that the grader invokes. | script: `node tests/grader/run.mjs PB-09` | Reset Plan §6 |
| PB-10 | reports one result or one written ungraded reason per requirement, never a PASS inferred from missing output. | script: `node tests/grader/run.mjs PB-10` | Reset Plan §6 |
| PB-11 | prints the headline `N of M graded`, then pass, fail and ungraded counts. | script: `node tests/grader/run.mjs PB-11` | Reset Plan §6 |
| PB-12 | appends one redacted `grader-verdict` record per requirement to telemetry. | script: `node tests/grader/run.mjs PB-12` | Reset Plan §6 |
| PB-13 | stores one protocol outcome on every miss record, from the four questions in order. | review: the miss schema has no outcome field yet; Session 5 adds it through the miss CLI. | Reset Plan §7 |
| PB-14 | git-ignores raw run evidence, sweeps it after 7 days and keeps it out of npm. | review: no retention tooling yet; Session 8 builds it. | Reset Plan §5b |
| PB-15 | keeps durable OpenCode-only proof as a rerunnable self-test plus a historical archive. | review: the V01-V03 campaigns are still loose under `verification/`; Session 8 archives them. | Reset Plan §5b |
| PB-16 | gives readers one path: Getting Started, ten phases, templates and one operating guide. | review: navigation is reset in Session 7. | Reset Plan §5 |
| PB-17 | keeps TechieFlow and TfLens documents outside the reader path. | review: they move in Session 7. | Reset Plan §5 |
| PB-18 | validates releases on the declared Node and npm versions and runs every graded check. | review: no workflow runs the grader yet; Session 9 adds it. | Reset Plan §6 M30, M31 |
| PB-19 | enforces the Verifier product-write block and the git-history denial inside a live `opencode run`, in normal and YOLO modes. | fixture: `node tests/live/run.mjs PB-19` drives real OpenCode with the scripted model; transcripts in `tests/live/transcripts/`. | Session 2 (M06, M10, M11) |
| PB-20 | keeps the PB-19 guardrails when a real model, not a scripted one, drives the planted probes. | ungraded: needs a live model; runbook `docs/runbooks/live-model-probes.md`. | Session 2 owner decision |
| PB-21 | resolves every verification environment fact from the profile and reports a placeholder, missing tool or unreachable URL by field name, never a guessed value. | script: `node tests/verifier/run.mjs PB-21` | Reset Plan §4 Verifier blocks 2, 10, 24 |
| PB-22 | starts, polls, records and stops only the application processes a run started, from the profile's commands. | script: `node tests/verifier/run.mjs PB-22` | Reset Plan §4 Verifier blocks 25, 37 |
| PB-23 | runs the build and test gates from the profile and reports a failing gate as FAIL, a missing command as BLOCKED. | script: `node tests/verifier/run.mjs PB-23` | Reset Plan §4 Verifier block 31; old Step 5.3 |
| PB-24 | loads a Verifier adapter only for the item kinds present in the checklist. | fixture: `node tests/verifier/run.mjs PB-24` over the case-study checklist (UI, API, DB, synthetic desktop). | Reset Plan §3, §4 Verifier blocks 8, 13, 29, 33 |

## 5. Owner decisions

| Date | Decision |
|---|---|
| 2026-09-26 | PB-01 to PB-18 approved as written. |
| 2026-09-26 | Raw run evidence is kept 7 days; graded verdicts 1 year (`playbook/environment-profile.yml` `retention`). |
| 2026-09-26 | Supported OpenCode version: 1.18.32 (`package.json` `opencode.supported`), observed with `opencode --version`. |
| 2026-09-26 | Allowed secret channels: approved secret manager, environment reference, protected stdin, protected temporary file (`AGENTS.md`; profile `secrets.sources`). |
