# Harness — the runnable artifacts

Everything under [`templates/`](../templates) describes *what* each part of the process
does. Everything here is the **actual working implementation** — the prompt files a
harness loads and executes.

| | [`templates/`](../templates) | `harness/` (here) |
|---|---|---|
| Form | one spec per command, prose | the real `.md` / `.ts` / `.html` files |
| Audience | someone deciding whether to adopt, or porting to another harness | someone installing it today |
| Length | ~1 page each | short prompts that hand the mechanics to `.playbook/scripts/` (the Verifier is 80 lines plus one adapter per item type) |

Read `templates/` first. Install from here.

## What's in the box

```
harness/opencode/
  opencode.json     installed as .opencode/opencode.json: agents, standing-rule instructions,
                    the three plugins in load order, the (disabled) Playwright MCP entry
  command/          15 command files — the slash commands (/feature-plan, /verify, /log-miss, …);
                    14 are installed (/update-context maintains this repo's Context-Prompt.md).
                    Routing (off by default) stamps a `model:` tier from playbook/model-tiers.yml
  agent/            analyst.md, orchestrator.md, builder.md, verifier.md — the four agents.
                    builder.md is the wave worker /implement and /fix spawn; with routing on it
                    carries its own (cheaper) tier so parallel waves never inherit the
                    orchestrator's model
  playbook-plugin/  one directory per guard plugin, loaded in this order; each has index.ts
                    (OpenCode 1) and server.ts (OpenCode 2):
    telemetry/        opt-in per-phase token/cost capture (PLAYBOOK_TELEMETRY=1)
    spec-guardrails/  mechanical write rules: no report files, the Verifier's write scope, no
                      agent edits to .playbook/ or .opencode/, no git history writes
    yolo/             YOLO mode: auto-approve every permission except git history, record
                      usage-limit reset times (PLAYBOOK_YOLO=1; inert otherwise)
    write-policy.mjs, yolo-policy.mjs   the harness-independent policies both entries share
    guard-signal.mjs  the `[playbook-guard] <name> loaded` line and PLAYBOOK_GUARDS marker
                      each plugin leaves, so a missing plugin is noticed
  templates/        doc-shell.html — the self-rendering HTML shell for human docs;
                    verifier/ — the per-item-type Verifier adapters (ui, api, db,
                    logging-infra, desktop)
```

Built for **[OpenCode](https://opencode.ai)** 1.18.32 and 2.0.18 (`package.json`
`opencode.supported`; CI runs both). The command and agent files are markdown prompts with
OpenCode YAML frontmatter.

## Model tiers (per-phase routing)

Each command declares the model tier it needs in `playbook/model-tiers.yml`
(frontier / standard / economy). Routing ships **OFF**; `node scripts/playbook-routing.mjs on`
stamps the resolved `model:` into the OpenCode frontmatter (command-level `model:` has the
highest precedence in OpenCode — it overrides even the TUI selection) and `off` removes it
again. Change
models or tiers with `set-model` / `set-tier` (the script re-applies automatically); CI can
enforce consistency with `node scripts/apply-model-tiers.mjs --check`. Operator guide:
`docs/maintainer/Model-Routing-Guide.md`; rationale per phase: `docs/maintainer/Adapter-Design.md`.

## YOLO mode (unattended runs)

Add the token `YOLO` to a command (`/implement YOLO @checklist`) or start OpenCode with
`PLAYBOOK_YOLO=1`. The prompts then treat every approval gate as pre-approved and
`playbook-plugin/yolo/` (`index.ts` on OpenCode 1, `server.ts` on 2), backed by `playbook-plugin/yolo-policy.mjs`, auto-approves every permission
request except git history writes, which they deny. On OpenCode 2 the variable must be in the
OpenCode server's environment (`opencode run --standalone` from the shell that sets it). For a run that also survives the
provider's 5-hour / weekly usage limit, use the supervisor — it sets the variable, parses the
reset time from the limit error, waits it out (+15 min) and resumes the same session until
the agent prints `PLAYBOOK_RUN_COMPLETE`:

```bash
node scripts/playbook-yolo.mjs --harness=opencode --cwd=/path/to/your-repo \
     --goal "Feature X: implement the checklist, verify, fix until every item PASSes"
```

Operator guide: `docs/maintainer/YOLO-Mode-Guide.md`.

## Install (OpenCode)

Use the package installer rather than copying the source tree manually:

```bash
cd /path/to/your-repo
npx @techierathore/ai-first-playbook@latest install
```

The target receives only `.opencode/` and `.playbook/`; both are hidden and gitignored. Upgrade
with `install --force`: it moves an older install to the plugin directories and never resets the
environment profile. The standing rules are `.playbook/AGENTS.md` (OpenCode 1 loads it through the
config's `instructions`; OpenCode 2.0.18 ignores `instructions`, so the spec-guardrails plugin adds
it), and the topology/command contract is
`.playbook/environment-profile.yml`. Replace its placeholders before the first run. Optional
Playwright is configured through `PLAYWRIGHT_MCP_URL`:

   ```bash
   npx @playwright/mcp@latest --port "$PLAYWRIGHT_PORT" --allowed-hosts "*"
   ```

Check the plugins with `node .playbook/scripts/playbook-guards.mjs --config`; inside a session, a
missing plugin makes the agent open with `PLAYBOOK GUARDS NOT LOADED` and write nothing. Then
smoke-test before trusting it: run `/verify` against a checklist with a bug you planted, and
confirm the Verifier annotates it `FAIL` **inline in the checklist**. If it produces a separate
report file instead, the plugin isn't loading.

Runtime CLIs are under `.playbook/scripts/`, and model tiers are
`.playbook/model-tiers.yml`. Preserve durable `verification/telemetry/misses.ndjson`; ignore only
the transient `/verification/telemetry/events.ndjson`, never the whole telemetry directory.

## Personas

Each command names the agent it runs as, and the four agents ship in `.opencode/agent/`. A persona
here is just a prompt file that sets voice, priorities and elicitation style before the command
body runs:

| Role | Used by | What it changes |
|---|---|---|
| **Analyst** | `/feature-plan`, `/analyze-fix`, `/add-doc`, `/refresh-doc`, `/upgrade-docs`, `/create-issue-list` ("You are the Analyst (`.opencode/agent/analyst.md`)"), `/legacy-audit` (`agent: analyst`) | Asks for missing inputs instead of guessing; writes documents, not code |
| **Orchestrator** | `/implement`, `/fix` ("You are the Orchestrator (`.opencode/agent/orchestrator.md`)"); spawns **Builder** workers per slice | Coordinates parallel sub-agents in waves rather than working items one at a time |
| **Verifier** | `/verify` (`agent: verifier`, `subtask: true`) | Runs in a fresh child session with no memory of the build |

The commands were originally written against persona agents from
[BMAD-METHOD](https://github.com/bmad-code-org/BMAD-METHOD) (MIT), which is **not
redistributed here**. The shipped native agents are the supported default; to use your own
persona files, change the path in the command's first line. The commands still work without the
persona line, because every behaviour that matters is spelled out in the command body.

The mechanical commands (`/generate-html`, `/amend-checklist`, `/archive-checklist`,
`/log-miss`, `/update-context`) deliberately name **no persona**. Don't "upgrade" them.

## Environment assumptions — now in the profile

Earlier versions baked one stack into the prompts (a Linux container talking to a Windows host
over `host.docker.internal`, .NET with `sqlcmd`, Playwright on port 8931, `appsettings.Development.json`).
The prompts no longer name a stack. Every such fact is a field of `.playbook/environment-profile.yml`,
and the runtime scripts read it:

| Fact | Profile / source | Read by |
|---|---|---|
| Topology, OS, shell | `topology`, `os`, `shell` | `playbook-probe.mjs` |
| Build, test, start, stop, cleanup commands | `commands`, `cleanup.command` | `profile-gates.mjs`, `playbook-app-lifecycle.mjs` |
| Application URLs | `application` | `playbook-probe.mjs`, the UI and API adapters |
| Database method and config path; migration command | `database.method`, `database.config_path`, `database.migration_command` | the DB adapter, through `secret-safe-config-resolver.mjs` |
| Browser endpoint (Playwright) | `browser.endpoint`; the MCP URL is `{env:PLAYWRIGHT_MCP_URL}` in `opencode.json` | the UI adapter |
| Jira | `jira-issues.mjs`: REST v3, credentials from `JIRA_BASE_URL`/`JIRA_EMAIL`/`JIRA_API_TOKEN` or a 0600 `JIRA_CONFIG` file | `/create-issue-list` |

A value nobody knows stays a placeholder: the probe reports it as `blocked` by field name, and
nothing guesses it.

What is *not* stack-specific, and is the actual content: verify by executing rather than
reading, one checklist as the single output, evidence attached to every verdict, and
parallelism by item type.

## The optional Windows-app bridge

The desktop adapter (`.opencode/templates/verifier/desktop.md`) uses a GUI bridge only when the
probe or the `WINAPP_BRIDGE` environment reference names one and `GET /health` answers 200
(`windows-app-bridge-client.mjs`; there is no default address). **No bridge ships in this repo.**
Without one, the Verifier takes the default headless path — running the desktop app's library
logic from a console runner under `verification/<feature>/` — which covers everything except pure
window chrome.

If you want to build one, the contract the agents expect is:

| Endpoint | Purpose |
|---|---|
| `GET /health` | 200 = bridge is up |
| `POST /launch {"exe": …}` | Start the application |
| `POST /click {"selector": …}` | Click a control |
| `POST /type {"selector": …, "text": …}` | Enter text |
| `GET /text?selector=…` | Read a control's value (to compare against API + DB) |
| `GET /screenshot` | PNG evidence |
| `POST /stop` | Shut down |

Absence of the bridge is **never** a valid `BLOCKED` reason; the desktop adapter says so, because
the rule was violated three times when it lived only in prose.

## OpenCode command frontmatter

The command files are markdown with an OpenCode frontmatter block:

```yaml
---
description: <shown in the harness's command list>
agent: verifier        # only /verify — targets a named agent
subtask: true          # only /verify — runs in a fresh context
---
```

`$ARGUMENTS` is substituted with whatever the user typed after the command name. The prompts use
OpenCode's `read`, `edit`, `write`, `grep`, `glob`, `bash`, and `task` tools. The `task` tool
provides the parallel subagents used by `/implement`, `/fix`, and `/verify`. OpenCode 2 names the
shell tool `shell` and a file tool's path argument `path` (OpenCode 1: `bash`, `filePath`); the
plugins handle both spellings.

## Why the guardrail plugin exists

The spec-guardrails plugin (`playbook-plugin/spec-guardrails/`, policy in `write-policy.mjs`)
blocks writes to `*Gap-Report*.md`, `*Verification-Report*.md`, and
similar filenames. It exists because prompt rules alone did not hold: after three rounds of
adding progressively louder instructions, the Verifier still created separate report files,
because "write a report at the end" is deeply trained behaviour. The rule became mechanical
and the problem stopped.

That is the general lesson worth stealing from this directory: **when a rule matters and the
model keeps breaking it, move the rule out of the prompt and into the tool layer.**

## A note on the examples

The worked examples throughout these files — `App-CostOptDashboard-*` documents,
`CostDataSyncSvc`, `CloudManagerCore`, `PROJ-1234`, `src/frontend` — are illustrative
placeholders standing in for whatever your project actually calls things. They are
deliberately concrete rather than abstract: a command that says "name the service exactly
as specified, e.g. `CostDataSyncSvc` with methods `SyncOrgCostData` and `SyncAllCostData`"
teaches the shape of a good instruction far better than one that says
"e.g. `<ServiceName>`".

Substitute your own names freely. Nothing in the behaviour depends on them.
