# Mac and OpenCode 2 Progress

Running record of the `mac-and-opencode-2` branch: make the grader and the four npm test scripts
pass on macOS, in any time zone, and on OpenCode 2. Updated and pushed after each step.

| Step | Goal | Status |
|---:|---|---|
| 1 | CI on macos-latest and ubuntu-latest, TZ=UTC and TZ=Asia/Kolkata, OpenCode 1.18.32; reproduce the owner's 23 macOS failures | Done 2026-09-27: all 23 reproduce on macOS |
| 2 | Fix every macOS and time-zone failure at its cause; record each as a miss | Done 2026-09-27: all four jobs green on `699dba0` |
| 3 | OpenCode 2: plugins load on 1.18.x and 2.x in the order telemetry, guardrails, YOLO; 2.0.18 in CI | Done 2026-09-27: green on `3bc426b` |
| 4 | Guard: a session without the guard plugins says so loudly at start; requirement line | Done 2026-09-27: PB-45 green on `3bc426b` |
| 5 | Supported versions (1.18.32, 2.0.18) in `package.json` and the docs | Done 2026-09-27: green on `3bc426b` |

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
that field cannot be amended. All 24 were closed `pass` after run 36337733186 (commit `699dba0`)
was green on every job:

| Job | Result on `699dba0` |
|---|---|
| ubuntu-latest, TZ=UTC | green: grader and the four npm scripts |
| ubuntu-latest, TZ=Asia/Kolkata | green |
| macos-latest, TZ=UTC | green |
| macos-latest, TZ=Asia/Kolkata | green |

## Step 3 — OpenCode 2

Sources: opencode.ai is blocked from this session's network, so the documentation and code were
read from the OpenCode repository itself (`anomalyco/opencode`, tags `v1.18.32` and `v2.0.18`):
`packages/web/src/content/docs/plugins.mdx`, `specs/v2/config.md` (Group 4: Plugins),
`packages/core/src/config/plugin/source.ts`, `packages/plugin/src/host.ts`,
`packages/plugin/src/README.md` (the v2 Promise plugin API), `packages/core/src/tool.ts`, and v1's
`packages/opencode/src/plugin/{index,shared}.ts`. What 2.0.18 changed for the Playbook:

- **Configured plugins must be directories.** `plugin` (legacy) and `plugins` both still work and
  keep their order, but an absolute path that is a file is skipped with the warning the owner saw.
  A directory's entry is `server.*`, then `index.*`. OpenCode 1 loads a directory's `index.*`.
- **A plugin is a default `{ id, setup }`**; hooks are registered in `setup` (`ctx.tool.hook`,
  `ctx.permission.hook`, `ctx.session.hook`, `ctx.shell.hook`). OpenCode 1 calls every export as a
  plugin function and rejects anything else, so the two shapes cannot share a module.
- **Tool names and inputs changed:** `bash` → `shell`, `filePath` → `path`, `task` → `subagent`;
  `execute.before` now carries the calling agent.
- **A thrown hook error ends the whole turn** (a defect), and a plugin cannot construct OpenCode's
  `Tool.Error`. OpenCode answers a call to an unknown tool name with a `Tool.Error` naming it, so a
  refused call is renamed to its block message: the tool never runs and the agent reads the reason.
- **`instructions` in the config is not read** by 2.0.18 (only `AGENTS.md` files found upward).
- **`run` has no `--command`**, `debug config` prints config sources, not the merged config, and the
  resolved commands/agents/plugins come from the server API (`opencode serve`, Basic auth).
- **`PLAYBOOK_*` variables** reach the plugins only through the OpenCode server's environment:
  `--standalone` from the shell that sets them, or the background service's environment.

What changed here:

- Each plugin is a directory, `harness/opencode/playbook-plugin/{telemetry,spec-guardrails,yolo}/`,
  with `index.ts` (the 1.x plugin, moved unchanged apart from import paths) and `server.ts` (the
  2.x adapter over the same `write-policy.mjs` and `yolo-policy.mjs`). `opencode.json` lists the
  three directories in the order telemetry, guardrails, YOLO; both versions load them in that
  order (checked live: the guard lines arrive in that order and v2's plugin list reports them
  `active` in that order). MISS-20260926-07's order is kept.
- The policies know `shell` as well as `bash`, and take the project root from the plugin's location
  (v2's background service serves several projects from one process).
- `install --force` removes the old single-file plugins (`.opencode/playbook-plugin/*.ts`); a
  non-forced upgrade that keeps an old config is announced loudly by the installer (step 4).
- On 2.x, telemetry records `tool-start` and `tool-end` only: 2.0.18 has no command-start hook and
  a different session event stream, so phase, turn and subagent rows are not captured yet.
- `instructions` now reads `.playbook/AGENTS.md`: **the standing rules never reached the model in an
  installed project on OpenCode 1** — it searches a relative instruction upward from the project,
  so `../.playbook/AGENTS.md` pointed above it; PB-01 only checked the config string. On 2.x, which
  ignores `instructions`, `spec-guardrails/server.ts` adds the standing rules and profile to the
  system prompt. PB-45 now proves the rules reach the model on both.
- Tests: `tests/opencode.mjs` reads the resolved runtime on both versions; PB-01 and PB-33 use it
  (all 14 commands, the four agents, the plugin order, v2 plugins `active`, the standing rules);
  PB-19's live probes run on both (on v2 the primary agent dispatches the verifier subagent that
  `/verify` would); PB-04/PB-05's offline probes also drive every `server.ts`.
- Misses: `MISS-20260927-25` (OpenCode 2 loads no plugin; PB-01 ran only on 1.x) and `-26` (the
  standing rules were never loaded; PB-01 checked the config string), both `weak-check`.
- Local run, this container (Linux): the four npm scripts pass; the grader gives 41 of 45 graded,
  41 pass, 0 fail on OpenCode 1.18.32 and on 2.0.18 (PB-33 ungraded for npm 10; run by hand with npm
  11.5.1 it passes on both).

## Step 4 — the unguarded-session alarm

A plugin that did not load cannot announce itself, so the signal comes from the plugins that did
load and is checked by things that load without them:

- Each loaded guard plugin adds `[playbook-guard] <name> loaded` to the system prompt and its name
  to `PLAYBOOK_GUARDS` in every shell command (`playbook-plugin/guard-signal.mjs`).
- The standing rules (`AGENTS.md`, "Guard plugins") and the four Playbook agent prompts ("Guard
  check") say: if any line is missing, the first line of the first reply is
  `PLAYBOOK GUARDS NOT LOADED: <missing> — this session is unguarded.`, run the check, write
  nothing until a human answers, even in YOLO mode. The agent prompts carry it because they load
  on both versions without plugins (OpenCode 2 would not load `AGENTS.md` without them).
- `.playbook/scripts/playbook-guards.mjs` prints a loud banner naming the missing plugins and the
  cause, and exits 3; with `--config` it checks `.opencode/opencode.json` before a session (a plugin
  configured as a file, a missing directory or entry, the order). The installer runs the same check
  after every install, so an upgrade without `--force` that kept an old config says so.
- Requirement **PB-45** (fixture, `tests/live/run.mjs PB-45`), live on real OpenCode with the
  scripted model: guarded session → standing rules and the three guard lines reach the model in
  order, the check passes; unguarded session (v2: the owner's single-file layout; v1: no plugins
  configured) → no guard line, the agent prompt's rule reaches the model, the check prints the
  banner with the cause; `--config` and the installer name a stale config. What a real model then
  says is PB-20's live-model territory.

## Step 5 — supported versions

- `package.json` `opencode.supported` is `["1.18.32", "2.0.18"]`; `scripts/opencode-package.mjs`
  maps a supported version to its npm package (`opencode-ai`, `@opencode/cli`).
- `validate.yml` and `release.yml` run a matrix over both versions; `platforms.yml` runs
  {ubuntu, macOS} × {UTC, Asia/Kolkata} × {1.18.32, 2.0.18}. PB-18 now fails a workflow that leaves a
  supported version out of its matrix.
- Docs: Getting Started, Operating Guide (including the `PLAYBOOK_*` variables on 2.x), OpenCode
  Guide (install commands for both), YOLO guide, WSL guide, Repository Structure, the live-model
  runbook, and the requirement list's owner decisions.

## CI on the OpenCode 2 change

- Run 36339441774 (`caee7ca`): 7 of 8 Platforms jobs green, including all four macOS jobs on both
  versions. **ubuntu-latest, TZ=Asia/Kolkata, OpenCode 2.0.18 failed PB-01**: resolved commands,
  agents and plugins all empty. Cause: `tests/opencode.mjs` stopped polling the v2 server as soon
  as `/api/command` answered, and on that runner the built-in commands (`init`, `review`) answered
  before the location had activated its configured commands, agents and plugins. Not a time-zone
  or plugin fault (PB-19 and PB-45 passed live in the same job). Fixed: the helper reads commands,
  agents and plugins once a second until three reads agree. A plugin that never loads still
  settles without it and fails. Failure 1 of the three-strikes budget.
- Run 36340012837 (`f3ccb21`): all eight Platforms jobs and both Validate jobs green.
- Housekeeping after that run: the v2 checks left OpenCode processes behind (CI terminated an
  orphan `opencode.exe`). `tests/opencode.mjs` now stops the private server by process group,
  and stops v2's background service after `debug config` unless it was already running.
  Local run on Linux with npm 11.5.1: 42 of 45 graded, 42 pass, 0 fail, 16 by a script, on both
  1.18.32 and 2.0.18. No OpenCode process is left afterwards.

## Final CI (`3bc426b`)

Platforms run 36340854708 and Validate runs 36340854695 / 36340851409: every job green. Each job
runs `validate`, `test:guardrails`, `test:misses`, `test:install` and the grader (exit 0; locally
the same commit grades 42 of 45 graded, 42 pass, 0 fail, 16 by a script on both versions).

| Job | Result |
|---|---|
| ubuntu-latest, TZ=UTC, OpenCode 1.18.32 | green |
| ubuntu-latest, TZ=UTC, OpenCode 2.0.18 | green |
| ubuntu-latest, TZ=Asia/Kolkata, OpenCode 1.18.32 | green |
| ubuntu-latest, TZ=Asia/Kolkata, OpenCode 2.0.18 | green |
| macos-latest, TZ=UTC, OpenCode 1.18.32 | green |
| macos-latest, TZ=UTC, OpenCode 2.0.18 | green |
| macos-latest, TZ=Asia/Kolkata, OpenCode 1.18.32 | green |
| macos-latest, TZ=Asia/Kolkata, OpenCode 2.0.18 | green |
| Validate playbook, docs (1.18.32) | green |
| Validate playbook, docs (2.0.18) | green |

`MISS-20260927-25` and `-26` closed `pass`. Open misses: only `MISS-20260926-03` (PB-04, the
owner's decision, unchanged).

## Left for the owner

- **Run it on the Mac** (macOS 26, Apple Silicon): `macos-latest` is a GitHub-hosted Mac, not
  that machine. Clean clone of this branch, `npm run grade` with 1.18.32, then again with 2.0.18.
- **A real model on OpenCode 2** (PB-20, PB-34 runbooks): the scripted model proves the hooks
  fire, not how a real model reacts to `PLAYBOOK GUARDS NOT LOADED`.
- **Upgrading existing installs:** `npx @techierathore/ai-first-playbook install --force`. A
  non-forced upgrade keeps the old `.opencode/opencode.json` (single-file plugins, `../.playbook`
  instructions); the installer now prints the banner when that happens.
- **OpenCode 2 and `PLAYBOOK_*` variables:** YOLO, telemetry, git approval and the selected
  checklist reach 2.x only through the OpenCode server's environment (`--standalone`, or the
  service's environment). The TUI through the background service will not see a variable
  exported in the shell.
- **Telemetry on 2.x records tool rows only** (no phase, turn or subagent rows yet).
- **Refusals on 2.x are a workaround:** a refused call is renamed to its block message, because
  a thrown hook error ends the turn and plugins cannot construct `Tool.Error`. If a later
  OpenCode 2 exposes `Tool.Error` to plugins, switch to it.
- **PB-04** (the Verifier running `npm test`) is still the owner's decision, as before.
- Not published, not tagged, `main` untouched. Review and merge the draft PR when satisfied.
