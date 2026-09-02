# Harness — the runnable artifacts

Everything under [`templates/`](../templates/) describes *what* each part of the process
does. Everything here is the **actual working implementation** — the prompt files a
harness loads and executes.

| | [`templates/`](../templates/) | `harness/` (here) |
|---|---|---|
| Form | one spec per command, prose | the real `.md` / `.ts` / `.html` files |
| Audience | someone deciding whether to adopt, or porting to another harness | someone installing it today |
| Length | ~1 page each | 1,700+ lines for the Verifier alone |

Read `templates/` first. Install from here.

## What's in the box

```
harness/opencode/
  command/          15 command files — the slash commands (/feature-plan, /verify, /log-miss, …)
                    each stamped with a `model:` tier from playbook/model-tiers.yml
  agent/verifier.md the Verifier agent: 1,050 lines of anti-excuse rules and probes
  agent/builder.md  the wave worker /implement and /fix spawn — carries its own (cheaper)
                    model tier so parallel waves never inherit the orchestrator's model
  plugin/           spec-guardrails.ts + write-policy.mjs — mechanical enforcement of the
                    one-file rule (write-policy.mjs is the harness-independent policy)
                    telemetry.ts — opt-in per-phase token/cost capture (PLAYBOOK_TELEMETRY=1)
                    yolo.ts + yolo-policy.mjs — YOLO mode: auto-approve every permission except
                    git history, record usage-limit reset times (PLAYBOOK_YOLO=1; inert otherwise)
  templates/        doc-shell.html — the self-rendering HTML shell for human docs
```

Built for **[OpenCode](https://opencode.ai)**. The command and agent files are markdown prompts
with OpenCode YAML frontmatter.

## Model tiers (per-phase routing)

Each command declares the model tier it needs in `playbook/model-tiers.yml`
(frontier / standard / economy). Routing ships **OFF**; `node scripts/playbook-routing.mjs on`
stamps the resolved `model:` into the OpenCode frontmatter (command-level `model:` has the
highest precedence in OpenCode — it overrides even the TUI selection) and `off` removes it
again. Change
models or tiers with `set-model` / `set-tier` (the script re-applies automatically); CI can
enforce consistency with `node scripts/apply-model-tiers.mjs --check`. Operator guide:
`docs/Model-Routing-Guide.md`; rationale per phase: `docs/Adapter-Design.md`.

## YOLO mode (unattended runs)

Add the token `YOLO` to a command (`/implement YOLO @checklist`) or start OpenCode with
`PLAYBOOK_YOLO=1`. The prompts then treat every approval gate as pre-approved and
`plugin/yolo.ts`, backed by `plugin/yolo-policy.mjs`, auto-approves every permission
request except git history writes, which they deny. For a run that also survives the
provider's 5-hour / weekly usage limit, use the supervisor — it sets the variable, parses the
reset time from the limit error, waits it out (+15 min) and resumes the same session until
the agent prints `PLAYBOOK_RUN_COMPLETE`:

```bash
node scripts/playbook-yolo.mjs --harness=opencode --cwd=/path/to/your-repo \
     --goal "Feature X: implement the checklist, verify, fix until every item PASSes"
```

Operator guide: `docs/YOLO-Mode-Guide.md`.

## Install (OpenCode)

Use the package installer rather than copying the source tree manually:

```bash
cd /path/to/your-repo
npx @techierathore/ai-first-playbook@latest install
```

The target receives only `.opencode/` and `.playbook/`; both are hidden and gitignored. The
standing rules are `.playbook/AGENTS.md`, and the topology/command contract is
`.playbook/environment-profile.yml`. Replace its placeholders before the first run. Optional
Playwright is configured through `PLAYWRIGHT_MCP_URL`:

   ```bash
   npx @playwright/mcp@latest --port "$PLAYWRIGHT_PORT" --allowed-hosts "*"
   ```

Smoke-test before trusting it: run `/verify` against a checklist with a bug you
   planted, and confirm the Verifier annotates it `FAIL` **inline in the checklist**. If
   it produces a separate report file instead, the plugin isn't loading.

Runtime CLIs are under `.playbook/scripts/`, and model tiers are
`.playbook/model-tiers.yml`. Preserve durable `verification/telemetry/misses.ndjson`; ignore only
the transient `/verification/telemetry/events.ndjson`, never the whole telemetry directory.

## Personas

Several commands open with "activate the Analyst persona" or "activate the Orchestrator
persona". A persona here is just a prompt file that sets voice, priorities, and elicitation
style before the command body runs. Two roles are used:

| Role | Used by | What it changes |
|---|---|---|
| **Analyst** | `/feature-plan`, `/analyze-fix`, `/add-doc`, `/refresh-doc`, `/upgrade-docs`, `/create-issue-list` | Asks for missing inputs instead of guessing; writes documents, not code |
| **Orchestrator** | `/implement`, `/fix` | Coordinates parallel sub-agents in waves rather than working items one at a time |

These commands were originally written against persona agents from
[BMAD-METHOD](https://github.com/bmad-code-org/BMAD-METHOD) (MIT), which is **not
redistributed here**. The shipped native agents under `.opencode/agent/` are the supported
default; existing BMAD installations remain optional:

- **Install BMAD** into your harness and the paths resolve as written.
- **Substitute your own** analyst/orchestrator persona files and update the path in the
  seven affected commands.
- **Skip personas entirely.** Delete the activation paragraph. The commands still work —
  every behaviour that matters is spelled out in the command body itself. You lose
  consistency of voice, not capability.

The mechanical commands (`/generate-html`, `/amend-checklist`, `/archive-checklist`,
`/update-context`) deliberately activate **no persona**. Don't "upgrade" them.

## Environment assumptions baked into these files

These files are a working system, not a neutral template — they assume the stack they were
built against. None of it is load-bearing for the *process*, but you will want to edit
these before your first run:

| Assumption | Where it shows up | Change it to |
|---|---|---|
| Agent runs in a Linux container; apps run on the developer's Windows host | Verifier Rule 1, `host.docker.internal` probes | Your topology — if agent and apps share a host, `localhost` replaces `host.docker.internal` throughout |
| .NET backend + React frontend | `dotnet build`, `npm run start:local`, `verification/<feature>Runner/` consoles | Your build, run, and test commands |
| Raw SQL over `sqlcmd`; **no** Entity Framework | Deployment Steps rules in `/implement`, `/fix` | Your migration tool |
| Playwright MCP on port 8931 | Verifier Rules 2 and probes | Your port, or drop the probe |
| Config read from `appsettings.Development.json` | Verifier Steps 1 and 3 | Your config file |
| Jira via REST v3 + a `jira-config.json` at the shared root | `/create-issue-list` | Your tracker, or use the command's plain-text input mode |

What is *not* stack-specific, and is the actual content: verify by executing rather than
reading, one checklist as the single output, evidence attached to every verdict, the
forbidden-excuse list, and parallelism by item type.

## The optional Windows-app bridge

The Verifier and `/implement` probe `${WINAPP_BRIDGE:-http://host.docker.internal:8932}/health`
before attempting GUI-level verification of a Windows desktop app. **No bridge ships in this
repo.** If `/health` doesn't answer, the agents fall back to the headless path — running the
desktop app's .NET library logic directly from a console runner — which is the default and
covers everything except pure window chrome.

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

Absence of the bridge is **never** a valid `BLOCKED` reason — that rule is written into the
Verifier three times because it was violated three times.

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
provides the parallel subagents used by `/implement`, `/fix`, and `/verify`.

## Why the guardrail plugin exists

`spec-guardrails.ts` blocks writes to `*Gap-Report*.md`, `*Verification-Report*.md`, and
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
