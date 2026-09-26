# Repository Structure and Installed Layout

AI-First Playbook has two different layouts:

- The **framework source repository** contains implementation, tests, diagrams, release tooling,
  and documentation for framework maintainers.
- An **application project installation** receives only the hidden runtime needed by OpenCode.

Do not copy the framework source tree into an application project. The installer follows the
one-shot package-runner model used by [BMAD Method](https://github.com/bmad-code-org/BMAD-METHOD):
npm transports and executes an installer, but the framework does not become an application
dependency.

## Correct installation command

Run this from the application project:

```bash
npx @techierathore/ai-first-playbook@latest install
```

For a fresh directory, the complete framework-created layout is:

```text
.opencode/     OpenCode commands, agents, plugins, document shell, and hidden config
.playbook/     standing rules, environment profile, model tiers, runtime CLIs, install marker
.gitignore     only a managed block is added; an existing file is preserved
```

There is no project-root `node_modules/`, `package.json`, or `package-lock.json` because `npx`
runs the package from npm's cache. There is also no project-root `onboarding/`, `phases/`,
`playbook/`, `scripts/`, `templates/`, `harness/`, `diagrams/`, `docs/`, or `verification/`
created by default.

Do **not** use:

```bash
npm install @techierathore/ai-first-playbook
```

That command means "add this as an application dependency." npm will necessarily create
`node_modules`, `package.json`, and `package-lock.json`; an npm package cannot suppress that
package-manager behavior. BMAD also documents `npx bmad-method install`, not `npm install
bmad-method`, for the same reason.

## Installed runtime connection

| Installed path | Purpose | How it is used |
|---|---|---|
| `.opencode/opencode.json` | Hidden project-level framework config | OpenCode merges it from the `.opencode` configuration directory. It loads the hidden standing rules and environment profile. |
| `.opencode/command/*.md` | Slash commands | OpenCode discovers `/feature-plan`, `/implement`, `/verify`, `/fix`, and supporting commands. |
| `.opencode/agent/*.md` | Specialized agents | OpenCode discovers the analyst, orchestrator, builder, and verifier. |
| `.opencode/plugin/*` | Mechanical guardrails and optional telemetry/YOLO behavior | OpenCode loads plugins from its project extension directory. |
| `.opencode/templates/doc-shell.html` | HTML rendering shell | Documentation commands read it explicitly when rendering project documents. |
| `.playbook/AGENTS.md` | Shared framework rules | `.opencode/opencode.json` includes it as standing instructions. |
| `.playbook/environment-profile.yml` | Project topology and command contract | Every build/verify command reads it before running tools. This is the file the operator customizes. |
| `.playbook/model-tiers.yml` | Optional model routing and attribution | Runtime utilities read it when routing or telemetry is enabled. |
| `.playbook/scripts/*.mjs` | Miss and telemetry runtime | Framework commands invoke these exact hidden paths; they are not auto-run merely because they exist. |
| `.playbook/installation.json` | Package ownership record | Upgrade and uninstall use it to avoid deleting unowned project files. `--force` may replace or remove locally edited package-created files after dry-run review. |

The runtime chain is:

```text
OpenCode starts in the application project
  -> discovers .opencode/
  -> merges .opencode/opencode.json
  -> loads .playbook/AGENTS.md and .playbook/environment-profile.yml
  -> discovers commands, agents, and plugins
  -> commands invoke .playbook/scripts only when required
```

Both framework directories are added to the installer's managed `.gitignore` block. They are
reinstallable copies, not application source.

## Why verification is different

`verification/` is not installed framework implementation. `/verify` creates it later only when
the project needs executable probes, screenshots, logs, or evidence. That output belongs to the
application and is intentionally visible and trackable. Only the transient
`verification/telemetry/events.ndjson` stream is ignored; durable miss history remains
committable.

## Optional guides

The default installation excludes all operator/reference material. If a team deliberately wants
an offline copy, use:

```bash
npx @techierathore/ai-first-playbook@latest install --with-guides
```

Those files remain hidden under `.playbook/guides/`; they are never placed in visible root
folders.

## Source repository folders

These folders belong to the framework source checkout, not a default application install:

| Source folder | Maintainer purpose | Installed by default? |
|---|---|---|
| `harness/` | Canonical OpenCode runtime copied into `.opencode/` | Its OpenCode payload is copied, but the `harness/` folder is not. |
| `playbook/` | Source copies of the environment profile and model-tier map | Copied into `.playbook/`, never as visible `playbook/`. |
| `scripts/` | Installer, validators, tests, release utilities, supervisors, and runtime CLIs | Only required runtime CLIs are copied into `.playbook/scripts/`. |
| `templates/` | Framework specifications and optional document starters | No. Optional hidden guides only with `--with-guides`. |
| `phases/` | Human-readable lifecycle reference | No. Optional hidden guides only with `--with-guides`. |
| `onboarding/` | Team rollout material | No. Optional hidden guides only with `--with-guides`. |
| `docs/` | Framework documentation and case studies | No. Optional hidden guides only with `--with-guides`. |
| `diagrams/` | Mermaid sources used to maintain framework illustrations | No. |
| `verification/` | This repository's own test/evidence output | No. |

Source folders stay visible in this repository because this repository develops and publishes the
framework. That source layout must never be confused with the minimal target deployment layout.
