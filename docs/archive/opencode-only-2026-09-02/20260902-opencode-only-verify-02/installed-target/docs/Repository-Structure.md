# Repository Structure and Runtime Connection

AI-First Playbook is a repository-scoped workflow, not an OpenCode application plugin installed
into OpenCode's global program directory. Its files fall into three different groups: assets the
coding harness loads, project contracts that prompts read or write, and framework source/reference
material used to maintain or understand the system.

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
| `verification/` | Created during verification with probes, evidence, screenshots, transient OpenCode events, and durable miss history. |

The connection is therefore explicit:

```text
OpenCode starts in project
  -> reads opencode.json
  -> loads AGENTS.md + playbook/environment-profile.yml
  -> discovers .opencode commands, agents, and plugins
  -> slash commands invoke project tools and runtime scripts
  -> verifier writes evidence and verdicts under verification/ and the checklist
```

## Source repository folders

The framework's own source checkout contains more than an installed target project:

| Folder | Purpose | Used automatically by OpenCode? | Installed as that top-level folder? |
|---|---|---|---|
| `harness/` | Canonical OpenCode runtime. `harness/opencode/` is copied to the target as `.opencode/`. | No. OpenCode loads the installed `.opencode/` copy. | No. |
| `playbook/` | Shared machine-readable runtime policy. The environment profile prevents guessing; the tier map configures routing and attributes observed models. | Yes, through instructions and telemetry. | Yes. |
| `scripts/` | Installer, validation, routing, telemetry/miss runtime, YOLO supervision, tests, and WSL provisioning. Only documented runtime CLIs are copied. | No. A prompt or operator must invoke a script. | Partly. |
| `templates/` | Canonical specifications and starter structures for commands, checklist metadata, handoffs, and standing rules. Target installs receive only operational checklist, deployment, issue, and handoff templates. | No. | Partly. |
| `phases/` | Human-readable definitions of the ten lifecycle steps and gates. They explain the process represented by the runnable commands. | No. | Yes by default. |
| `diagrams/` | Mermaid source for architecture and workflow illustrations. | No. | No. |
| `verification/` | The Verifier creates evidence here; telemetry plugins/CLIs use its telemetry subdirectory. | Not at startup except plugin output. | Created on demand. |
| `docs/` | Operator, installation, security, telemetry, YOLO, troubleshooting, and case-study documentation. | No, unless read explicitly. | Yes by default. |
| `onboarding/` | Team rollout and first-week exercises. | No. | Yes by default. |

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
`onboarding/`, `phases/`, handoff templates, and installed runtime scripts. It does not
cover `docs/`, implementation checklists, project-status documents, or `verification/`. Those
paths contain project-specific requirements, status matrices, verdicts, and durable evidence. The
managed block ignores only `/verification/telemetry/events.ndjson`; durable
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

`npm install @techierathore/ai-first-playbook` means "add this package as a project dependency" and
therefore creates or updates npm dependency files. That is not the AIFP installation command.

Like BMAD, AIFP exposes an installer CLI through the package's `bin`. Run it through `npx`:

```bash
cd /absolute/path/to/project
npx @techierathore/ai-first-playbook@latest install --dry-run
npx @techierathore/ai-first-playbook@latest install
```

`npx` downloads the package and its dependencies into npm's cache, runs `scripts/install.mjs`, and
copies the project payload directly into the current directory. The application receives no AIFP
dependency and no project-level npm files. Use `--target=/absolute/path` when installing from a
different directory. Existing files are preserved unless `--force` is explicit.
