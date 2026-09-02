# Repository Structure and Runtime Connection

AI-First Playbook is a repository-scoped workflow, not an OpenCode application plugin installed
into OpenCode's global program directory. The framework has to be installed in each target project
because OpenCode discovers project commands and agents from that project's `.opencode/` directory.
The other top-level folders are either files those commands use, project outputs they create, or
reference/source material. They are not all loaded automatically.

There is no `playbooks/` folder in the supported layout. The singular `playbook/` folder contains
machine-readable project configuration; `phases/` contains the human-readable lifecycle.

## What OpenCode actually loads

OpenCode starts in the target project and discovers the following files:

| Path in the project | How it is connected |
|---|---|
| `.opencode/command/*.md` | OpenCode discovers these as slash commands such as `/feature-plan`, `/implement`, `/verify`, and `/fix`. |
| `.opencode/agent/*.md` | `opencode.json` registers these as the analyst, orchestrator, builder, and independent verifier agents. |
| `.opencode/plugin/*` | `opencode.json` loads guardrail, optional telemetry, and YOLO plugins. |
| `.opencode/templates/doc-shell.html` | Documentation commands read this when they render Markdown as human-readable HTML. |
| `opencode.json` | Project-level OpenCode configuration. It connects the agents, plugins, standing instructions, and optional Playwright MCP endpoint. |
| `AGENTS.md` | Always-on team rules loaded through `opencode.json`. This is shared process policy, not personal OpenCode state. |
| `playbook/environment-profile.yml` | Runtime source of truth for topology, commands, URLs, logs, data access, secrets policy, and cleanup. Commands explicitly read it before acting. |
| `playbook/model-tiers.yml` | Optional model-routing configuration and telemetry tier attribution. Source-only routing utilities are not included in a target install. |
| `scripts/playbook-miss.mjs`, `scripts/miss-lib.mjs`, `scripts/playbook-telemetry.mjs` | Installed runtime CLIs for durable miss writes and OpenCode telemetry export. Ordinary scripts are invoked by commands/operators, not auto-loaded. |
| `verification/` | Not a framework program folder. It is project output created during verification: probes, evidence, screenshots, transient OpenCode events, and durable miss history. |

The connection is therefore explicit:

```text
OpenCode starts in project
  -> reads opencode.json
  -> loads AGENTS.md + playbook/environment-profile.yml
  -> discovers .opencode commands, agents, and plugins
  -> slash commands invoke project tools and runtime scripts
  -> verifier writes evidence and verdicts under verification/ and the checklist
```

## What each folder is for

The framework's own source checkout contains more than an installed target project:

| Folder | Purpose | Runtime, operator aid, or source only? | Installed as that top-level folder? |
|---|---|---|---|
| `harness/` | Canonical framework source for harness adapters. The installer copies `harness/opencode/` to the target as `.opencode/`. OpenCode never searches `harness/`. | Source only; it produces the runtime copy. | No. |
| `playbook/` | Machine-readable project policy. `environment-profile.yml` prevents agents from guessing topology and commands; `model-tiers.yml` configures optional routing/attribution. | Runtime input read by prompts/scripts. | Yes. |
| `scripts/` | Package installer plus maintainer utilities in the source repository. A target receives only the miss and telemetry CLIs that commands call explicitly. Scripts are not auto-loaded merely because the folder exists. | Partly runtime, partly source only. | Partly. |
| `templates/` | Starter structures for checklist metadata, deployment instructions, issue files, and gate handoffs. Operators or commands use them when creating project documents; OpenCode does not discover this folder. | Operator aid. | Partly, by default. |
| `phases/` | Explanations of the ten lifecycle steps and gates. The runnable behavior is already implemented in `.opencode/command/`; these files let humans inspect the process. | Reference documentation. | Yes, by default. |
| `diagrams/` | Mermaid sources used to maintain framework illustrations. They do not participate in an installed run. | Source only. | No. |
| `verification/` | Project-owned output from `/verify`: tests/runners, logs, screenshots, evidence, YOLO state, and telemetry. It is created when needed, not copied as framework content. | Runtime output. | Created on demand. |
| `docs/` | Installation, usage, security, telemetry, troubleshooting, and operating guides. OpenCode reads one only when a prompt or user explicitly references it. | Operator documentation. | Yes, by default. |
| `onboarding/` | First-week exercises and team rollout guidance. It has no effect on OpenCode execution. | Operator documentation. | Yes, by default. |

The minimum executable chain is `.opencode/` + `opencode.json` + `AGENTS.md` + `playbook/`.
Installed runtime scripts support miss/telemetry operations. `docs/`, `onboarding/`, `phases/`, and
`templates/` explain or support operation but are not OpenCode discovery locations. Use
`--no-docs` when only the runtime payload is wanted.

The npm tarball must contain the source files from which the installer copies the project payload.
Seeing `harness/`, `docs/`, or `scripts/` under
`node_modules/@techierathore/ai-first-playbook/` means npm installed the package transport; it does
not mean OpenCode searches that nested directory.

## What is ignored in a target project

A leading dot is a harness discovery convention, not a security boundary. `.opencode/` is hidden
because OpenCode expects project extensions there. In an application repository, however, the
installed commands, agents, plugins, runtime policy, and installer metadata are reproducible
framework copies. The installer adds an idempotent managed `.gitignore` block for them so another
machine can restore them by running the same `npx ... install` command.

The managed block covers `.opencode/`, `.playbook/`, `AGENTS.md`, `opencode.json`, `playbook/`,
`onboarding/`, `phases/`, installed templates, runtime scripts, and each generic framework guide
that the installer actually created under `docs/`. A preserved pre-existing file is never claimed
or ignored. It ignores owned guide filenames rather than the entire `docs/` folder, so
project-created requirements, implementation checklists, and status documents remain trackable.
The whole `verification/` folder also remains trackable because it is project evidence; only
transient `/verification/telemetry/events.ndjson` is ignored. Durable
`verification/telemetry/misses.ndjson` remains committable.

This rule applies to target applications. The AI-First Playbook source repository tracks its own
framework implementation because that repository is the canonical source from which packages are
published.

Personal OpenCode credentials and user preferences belong under `~/.config/opencode/` and
`~/.local/share/opencode/`, outside the project and outside Git.

Framework-maintainer material such as `Context-Prompt.md`, `/update-context`, design decisions,
publishing procedures, generated documentation HTML, and external-consumer
contracts remains in the source repository and is deliberately excluded from npm and target
installs.

## npm installation versus project scaffolding

Both npm forms now put the runnable payload directly in the project root, but they have different
package-manager effects.

The recommended form is the one-shot installer CLI:

```bash
cd /absolute/path/to/project
npx @techierathore/ai-first-playbook@latest install --dry-run
npx @techierathore/ai-first-playbook@latest install
```

`npx` downloads the package and its dependencies into npm's cache, runs `scripts/install.mjs`, and
copies the project payload directly into the current directory. The application receives no AIFP
dependency and no project-level npm files. Use `--target=/absolute/path` when installing from a
different directory. Existing files are preserved unless `--force` is explicit.

Plain npm installation is also supported:

```bash
cd /absolute/path/to/project
npm install @techierathore/ai-first-playbook@latest
```

The package's guarded `postinstall` runs the same installer and copies the payload directly into
the directory where `npm install` was started, so OpenCode can immediately discover `.opencode/`.
However, `npm install` always means "add a dependency": npm itself creates or updates
`package.json`, `package-lock.json`, and `node_modules/`, and retains the package transport under
`node_modules/@techierathore/ai-first-playbook/`. A package cannot disable that npm behavior. Use
the `npx` form when those dependency artifacts are not wanted. The automatic scaffold is skipped
for global installation and for `npx`; lifecycle scripts must not be disabled with
`--ignore-scripts` when using the plain npm form.
