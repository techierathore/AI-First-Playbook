# Mac and OpenCode 2 Progress

Running record of the `mac-and-opencode-2` branch: make the grader and the four npm test scripts
pass on macOS, in any time zone, and on OpenCode 2. Updated and pushed after each step.

| Step | Goal | Status |
|---:|---|---|
| 1 | CI on macos-latest and ubuntu-latest, TZ=UTC and TZ=Asia/Kolkata, OpenCode 1.18.32; reproduce the owner's 23 macOS failures | Done 2026-09-27: all 23 reproduce on macOS |
| 2 | Fix every macOS and time-zone failure at its cause; record each as a miss | Fixed; awaiting CI |
| 3 | OpenCode 2: plugins load on 1.18.x and 2.x in the order telemetry, guardrails, YOLO; 2.0.18 in CI | Not started |
| 4 | Guard: a session without the guard plugins says so loudly at start; requirement line | Not started |
| 5 | Supported versions (1.18.32, 2.0.18) in `package.json` and the docs | Not started |

## Step 1 — CI

- Added `.github/workflows/platforms.yml`: matrix `os` × `tz` × `opencode`
  (`ubuntu-latest`, `macos-latest`) × (`UTC`, `Asia/Kolkata`) × (`1.18.32`), `fail-fast: false`;
  each job runs `validate`, `test:guardrails`, `test:misses`, `test:install` and the grader (each
  step runs even when an earlier one fails) and uploads `grader-output/`.
- The workflow runs on `pull_request` and `workflow_dispatch` only, so a push to the PR starts one
  run, not two.

### First run (commit `bab9366`, clean `main` plus the workflow), run 36337186158

| Job | Grader | Four npm scripts |
|---|---|---|
| ubuntu-latest, TZ=UTC | 38 of 44 graded pass; PB-16 and PB-17 fail (this progress file sat at the docs root) | pass |
| ubuntu-latest, TZ=Asia/Kolkata | same as UTC | pass |
| macos-latest, TZ=UTC | pass 17, fail 24, ungraded 3 | pass |
| macos-latest, TZ=Asia/Kolkata | pass 17, fail 24, ungraded 3 (the same 24 IDs as UTC) | pass |

- **Every one of the owner's 23 macOS failures reproduced** on `macos-latest`, with the same first
  error lines. The 24th, PB-33, fails too: CI has npm 11.5.1, so PB-33 is graded there; the owner's
  Mac skipped it for npm < 11.5.1.
- **No time-zone failure reproduced.** Asia/Kolkata failed exactly the macOS UTC set on macOS and
  nothing on Linux (also run locally: Linux, TZ=Asia/Kolkata, 40 of 44 graded, 40 pass). The
  "macOS (fails with both)" column in the owner's table is macOS, not the Mac's time zone.

## Step 2 — macOS fixes

Reproduced on Linux too: pointing `TMPDIR` at a symlink (as macOS's `/var` → `/private/var` is)
fails the same IDs. Three causes, all path spelling:

1. **Main-module check (22 IDs plus PB-33).** 40 scripts decided whether they were run directly
   with ``import.meta.url === `file://${process.argv[1]}` `` (or a `resolve()` variant). Node
   reports the main module by its real path (`/private/var/...`) while `argv[1]` keeps the spelling
   it was given (`/var/...`), so on macOS every script run from a temporary project exited 0
   having done nothing: empty stdout ("Unexpected end of JSON input"), "expected 1, got 0",
   missing output files (ENOENT), "probe exit 0". The check now compares
   `realpathSync(process.argv[1])` with `fileURLToPath(import.meta.url)`, which also handles a path
   with spaces or `%`. `test:install` now runs an installed script through a symlinked project
   path and fails any script whose main check does not resolve symlinks.
2. **Write policy path spelling (PB-19).** `normalizePath` compared the tool's path with the
   project root lexically, so `/var/...` under a `/private/var/...` root read as outside the
   project and the Verifier's evidence write was refused. Both are now compared canonically (real
   path of the deepest existing ancestor). This also closes a hole: a new file under an in-project
   symlink that points outside the project used to be allowed. `test:guardrails` checks both.
3. **Live fixture path spelling (PB-19).** `tests/live/run.mjs` gave the scripted model paths under
   `/var/...`; OpenCode names the project by its real path and auto-rejected the write as an
   `external_directory`. A model writes to the paths OpenCode reports, so the fixture now uses the
   real path of its temporary project.

No check was loosened. `docs/Mac-OpenCode2-Progress.md` was added to the reader-path control files
(it is the progress file the owner named, like `Reset-Progress.md`).

| ID | Mac error (owner) | Cause |
|---|---|---|
| PB-06 | Unexpected end of JSON input | 1: installed `checklist-lint.mjs` did nothing |
| PB-07 | record passed validation | 1: `handoff-record.mjs` did nothing, exit 0 |
| PB-14 | sweep printed nothing | 1: `playbook-sweep.mjs` did nothing |
| PB-16 | reader-path printed nothing | 1: `reader-path.mjs` did nothing |
| PB-17 | reader-path printed nothing | 1: `reader-path.mjs` did nothing |
| PB-19 | permitted evidence write did not happen | 2 and 3 |
| PB-21 | probe exit 0 | 1: `playbook-probe.mjs` did nothing |
| PB-24 | Unexpected end of JSON input | 1: `checklist-plan.mjs` did nothing |
| PB-25 | Unexpected end of JSON input | 1: `checklist-plan.mjs` did nothing |
| PB-26 | empty output | 1: `phase-complete.mjs` did nothing |
| PB-27 | empty output | 1: `plan-coverage.mjs` did nothing |
| PB-29 | ENOENT on the rendered page | 1: `render-docs.mjs` did nothing |
| PB-30 | kinds | 1: `doc-scaffold.mjs` / `doc-check.mjs` did nothing |
| PB-31 | empty output | 1: `doc-drift.mjs` / `reference-lint.mjs` did nothing |
| PB-33 | an unbuilt checklist was reported complete (CI only) | 1: `phase-complete.mjs` did nothing |
| PB-35 | INV-001 status: expected pass, got planned | 1: `verification-result-writer.mjs` did nothing |
| PB-36 | Cannot read properties of null (reading '1') | 1: `secret-safe-config-resolver.mjs` printed nothing to parse |
| PB-37 | expected 1, got 0 | 1: `smoke-runner.mjs` / `self-test-result-writer.mjs` did nothing |
| PB-38 | expected 1, got 0 | 1: `checklist-infra.mjs` / `checklist-deploy.mjs` did nothing |
| PB-39 | empty output | 1: `checklist-amend.mjs` / `checklist-archive.mjs` did nothing |
| PB-40 | expected 1, got 0 | 1: `checklist-ingest.mjs` and friends did nothing |
| PB-41 | empty output | 1: `gate-check.mjs` did nothing |
| PB-42 | ENOENT on the Issues file | 1: `issues-file.mjs` did nothing |
| PB-44 | empty output | 1: `dotnet-restore-diagnostics.mjs` / `windows-app-bridge-client.mjs` did nothing |

Misses: `MISS-20260927-01` to `-24`, one per ID above in table order, recorded through
`scripts/playbook-miss.mjs open` (`wrong-behaviour`, `src`, `major`, why missed
`insufficient-verify-method`, protocol `spec=yes,playbook=yes,check=yes` → `weak-check`: the checks
existed but only ever ran on Linux, whose temporary folder is not a symlink). `-15` (PB-33) was
found by this CI, not on the owner's Mac; the record says `found_by: human` like the others, and
that field cannot be amended. Each is closed `pass` once CI is green on every job.
