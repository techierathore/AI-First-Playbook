# Changelog

User-visible changes to the `@techierathore/ai-first-playbook` package. The GitHub Release notes
start from the `Unreleased` section ([Npm-Release-Guide.md](Npm-Release-Guide.md) §4).

## Unreleased

Everything since `v0.1.8`: the reset (PR #1) and the macOS and OpenCode 2 work (PR #2).

### Upgrading from 0.1.8

Run `npx @techierathore/ai-first-playbook@latest install --dry-run --force`, review it, then
`install --force`, and restart OpenCode. `--force` moves the plugins to the new layout, removes the
old `.opencode/plugin/*.ts` files recorded in `.playbook/installation.json`, and keeps your
`.playbook/environment-profile.yml`. Without `--force` the old `.opencode/opencode.json` is kept.
OpenCode 2 cannot load it, and the installer prints `PLAYBOOK GUARDS NOT LOADED` to say so. Check
the result with `node .playbook/scripts/playbook-guards.mjs --config`.

### Added

- **OpenCode 2 support.** Supported versions are OpenCode 1.18.32 and 2.0.18
  (`package.json` `opencode.supported`). One install serves both.
- **Guard alarm (PB-45).** Each guard plugin adds `[playbook-guard] <name> loaded` to the system
  prompt and its name to `PLAYBOOK_GUARDS` for every shell command. When one is missing, the
  standing rules make the agent open with `PLAYBOOK GUARDS NOT LOADED: <missing>`, run
  `.playbook/scripts/playbook-guards.mjs` and write nothing until a person fixes it, even in YOLO
  mode. The Verifier's prompt carries the same check.
- `.playbook/scripts/playbook-guards.mjs`: inside a session, reports which guards loaded; with
  `--config`, checks that `.opencode/opencode.json` lists the three plugin directories in order.
  Exits 3 with a banner and the fix when something is wrong.
- `.playbook/scripts/opencode-command.mjs`: runs a Playbook command headlessly on either OpenCode
  version (`opencode run --command` on 1.x; a private `opencode serve` and its command route on
  2.x, whose `run` would send `/verify …` as plain text). `--auto` answers permission requests;
  exit 4 means the agent is waiting for a person, answered with `--continue=<session id>`.
- Runtime scripts under `.playbook/scripts/` that the commands and the Verifier now call instead
  of carrying the logic in prose: environment probe, app lifecycle, profile gates, checklist
  scaffold/lint/plan/amend/archive/ingest, phase completion, plan coverage, handoff records,
  document scaffold/check/render/drift/upgrade, deployment-step runner, Verifier result writer and
  summary, secret-safe config resolver, smoke runner, gate check, Jira and Issues-file tools,
  escaped-bug and incident workflows, retention sweep. The Operating Guide §7 lists them.
- Checklist, handoff and document schemas (`.playbook/checklist-schema.json`,
  `handoff-schema.json`, `document-schemas.json`). Every checklist must pass `checklist-lint.mjs`,
  and every gate persists a handoff record made by `handoff-record.mjs`.
- Verifier adapters, one per item type (`.opencode/templates/verifier/`: ui, api, db,
  logging-infra, desktop), loaded only for the buckets a checklist has.
- Raw run evidence goes to the git-ignored `verification/runs/<run-id>/` and is swept after the
  profile's `retention.raw_runs_days` (7). The managed `.gitignore` block also ignores
  `/verification/runs/` and `/verification/yolo/`.
- Miss records gain an optional `protocol_outcome` derived from the four miss questions.
- CI: `validate.yml` runs the four npm tests and the requirement grader on every push and pull
  request for both OpenCode versions. The new `platforms.yml` repeats them on every pull request
  on macOS and Linux, in UTC and Asia/Kolkata, for both versions (eight jobs). `release.yml`
  validates, runs `test:install` and grades for both versions before publishing. OpenCode is
  installed by `scripts/opencode-package.mjs` (`opencode-ai` for 1.x, `@opencode/cli` for 2.x).

### Changed

- **Plugins are directories.** `.opencode/plugin/*.ts` became `.opencode/playbook-plugin/telemetry/`,
  `spec-guardrails/` and `yolo/`, each with `index.ts` (OpenCode 1) and `server.ts` (OpenCode 2),
  registered in that order in `.opencode/opencode.json` (no longer auto-discovered, so the load
  order no longer follows the file system). Shared code: `write-policy.mjs`, `yolo-policy.mjs`,
  `guard-signal.mjs`.
- On OpenCode 2 the guards follow its renames: the shell tool is `shell` (was `bash`) and a file
  tool's path argument is `path` (was `filePath`); both spellings are handled. A refused call is
  renamed to its block message, because a thrown hook error ends the whole turn in OpenCode 2.
- OpenCode 2.0.18 ignores the config's `instructions`, so the spec-guardrails plugin adds
  `.playbook/AGENTS.md` and the environment profile to the context itself.
- On OpenCode 2, `PLAYBOOK_YOLO`, `PLAYBOOK_TELEMETRY`, `PLAYBOOK_GIT_APPROVED` and
  `PLAYBOOK_CHECKLIST` must be in the OpenCode server's environment (`--standalone` from the shell
  that sets them, or the background service's environment). The YOLO supervisor uses
  `run --standalone`, and it starts a first prompt that names a command through
  `opencode-command.mjs`.
- Telemetry on OpenCode 2 records only `tool-start` and `tool-end` rows. Phase, turn and subagent
  rows are not captured on 2.x yet.
- **No agent edits the installed Playbook.** Writes to `.playbook/` and `.opencode/` are refused
  for every agent, except `.playbook/environment-profile.yml`; a Playbook defect is recorded as a
  miss.
- **Plan approval waits for a person.** Outside YOLO, `/feature-plan` ends by asking the approver
  and writes the `plan-approval` record only after a named person answers.
- The Verifier is a short core (80 lines, was 1,138) that hands probing, planning, result writing
  and the summary to the runtime scripts. Its shell may run only those approved scripts and the
  miss emitter; tests run through `profile-gates.mjs`. Results are written by
  `verification-result-writer.mjs`, which refuses a `BLOCKED` without its audit.
- Commands were shortened onto the scripts; `/implement` and `/fix` end only when
  `phase-complete.mjs` passes. Rows under `## Deployment Steps` are deployment actions, not
  checklist items, so completion and gate checks no longer count them.
- `install --force` never resets `.playbook/environment-profile.yml`.
- Documentation: one reader path — README → Getting Started → How It Works → phases → templates →
  Operating Guide. The former separate guides were merged into the Operating Guide or moved to
  `docs/maintainer/`; case studies moved to `docs/examples/`. `--with-guides` installs the new
  set.

### Fixed

- **Standing rules never reached the model on OpenCode 1** in an installed project: the config
  listed `../.playbook/AGENTS.md`, which OpenCode resolves upward from the project, so it pointed
  above it. It now lists `.playbook/AGENTS.md` and `.playbook/environment-profile.yml`.
- **macOS:** runtime scripts started through a symlinked path (for example `/var` →
  `/private/var`) silently did nothing, because the main-module check compared unresolved paths.
  They now compare real paths. The write policy compares the project root and the target path
  canonically, so a symlinked checkout no longer misjudges a path.
- The guard plugins load in the configured order (`telemetry`, `spec-guardrails`, `yolo`), so a
  forbidden write is blocked before YOLO could allow it.

### Removed

- The single-file plugins (`.opencode/plugin/spec-guardrails.ts`, `telemetry.ts`, `yolo.ts`; their
  policy files moved to `.opencode/playbook-plugin/`); `install --force` removes them from an
  existing install.

### Known limitations

- PB-04: the Verifier cannot run safe test commands such as `npm test` directly. Its shell is
  limited to the approved Playbook scripts; widening it is an owner decision.
- PB-20 and PB-34 (real-model probes and the live campaign) are graded by runbook, not by script.
