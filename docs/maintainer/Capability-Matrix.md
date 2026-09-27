# OpenCode Harness Capability Matrix

**Scope:** the capabilities the AI-First Playbook (team edition of TechieFlow) actually depends
on. Produced 2026-08-20.

**Sources.** OpenCode claims were read from source at `/mnt/c/4RoCode/opencode`
(commit `da4730e4a4`, 2026-08-19, `packages/opencode` v1.18.18); paths below are relative to
that repo root. The source is **evidence only** — the framework targets the deployed OpenCode
binary, and the load-bearing behaviours (command/agent `model:` frontmatter, plugin
tool-hooks, `{env:}` config substitution, `opencode run`) were additionally confirmed live
against a deployed 1.18.18 install. Claims in this matrix cover OpenCode only.
Anything inferred rather than read is marked **UNVERIFIED** with what would verify it.

**One structural caveat that applies to every OpenCode row:** the repo contains two parallel
engines — v1 (`packages/opencode/src/**`, the shipping CLI/TUI path) and v2
(`packages/core/src/**`, an in-progress Effect-based rewrite reachable today only via the newer
`/api/*` routes and debug commands). All rows below describe **v1, the live path** (confirmed:
`opencode run` dispatches through `client.session.prompt`, the v1 route —
`packages/opencode/src/cli/cmd/run.ts:859`), with v2 divergences noted only where they change a
conclusion.

---

## a. Agent / subagent model

| Question | OpenCode |
|---|---|
| Subagents definable? | **Yes.** Markdown + YAML frontmatter under `{agent,agents}/**/*.md` in any config dir (`~/.config/opencode/`, project `.opencode/`, `~/.opencode/`, `$OPENCODE_CONFIG_DIR`), or the `"agent"` key of `opencode.json`. Body becomes the system prompt. — `packages/opencode/src/config/agent.ts:11-32`; `packages/opencode/src/config/paths.ts:23-41`; `packages/core/src/v1/config/config.ts:96-105` |
| Agent config fields | `model`, `variant`, `temperature`, `top_p`, `prompt`, `permission`, `mode: primary\|subagent\|all`, `description`, `hidden`, `color`, `steps`, `disable`; deprecated `tools` map folds into `permission`. Unknown keys pass through to the provider as `options`. — `packages/core/src/v1/config/agent.ts:12-41` |
| Subagent gets its own model? | **Yes.** When the `task` tool spawns a subagent: `const model = next.model ?? { modelID: msg.info.modelID, providerID: msg.info.providerID }` — the agent's configured model wins, else it inherits the parent's current model; the resolved model is passed explicitly into the child session's prompt. — `packages/opencode/src/tool/task.ts:181-212` |
| Subagent execution unit | A **child session** with `parentID` set; depth capped by config `subagent_depth` (default 1). — `packages/opencode/src/tool/task.ts:156-172`, `:104-117` |

## b. Model selection granularity — the decisive row

| Level | OpenCode |
|---|---|
| Session-wide default | Yes — config `model` (`"provider/model"`), plus `small_model` for utility calls. — `packages/core/src/v1/config/config.ts:74-79` |
| **Mid-session switch** | **Yes — model is a per-message parameter.** `PromptInput.model` is optional per prompt; resolution per user message is `input.model ?? agent.model ?? currentModel(session)`, the agent loop re-reads the model from the **last user message each iteration**, and one session's transcript can contain assistant messages from different models. — `packages/opencode/src/session/prompt.ts:1499-1520`, `:646`, `:1141`. TUI `/models` sends the selection with every subsequent message in the same session. — `packages/tui/src/component/prompt/index.tsx:968`, `:1094-1101` |
| **Per subagent** | **Yes** (row a). — `packages/opencode/src/tool/task.ts:181-184` |
| **Per command invocation** | **Yes, and it has the *highest* precedence:** `cmd.model` → model of `cmd.agent` → caller/TUI model → session model. A command's `model:` frontmatter beats even the model the user picked in the TUI. With `subtask: true` the override is fully scoped to a child session; inline, it also becomes the session's new sticky model. — `packages/opencode/src/session/prompt.ts:1411-1419`, `:1439-1458`; schema `packages/core/src/v1/config/command.ts:5-12` |
| Per CLI invocation (headless) | Yes — `opencode run -m provider/model --agent <a> -s <session>`. — `packages/opencode/src/cli/cmd/run.ts:165-170`, `:859-865` |
| Per tool call | **No.** `Tool.Context` carries no model; the model is fixed once per assistant-message loop step. — `packages/opencode/src/tool/tool.ts:36-46`; `packages/opencode/src/session/prompt.ts:1213-1218` |
| Programmatic per-turn override | Yes — HTTP `POST /session/{id}/message` accepts `model`, `agent`, `variant` per request; a plugin can also mutate `output.message.model` in the `chat.message` hook (undocumented but structurally honored — the mutated message is persisted *after* the hook and the loop resolves the model from it). — `packages/opencode/src/server/routes/instance/httpapi/groups/session.ts:70`; `packages/opencode/src/session/prompt.ts:999-1046`, `:1141` |

**Conclusion for this row:** per-phase model routing is **natively expressible in OpenCode
at command granularity**, documented and highest-precedence. Subagent frontmatter provides
the independently routed child-session mechanism used by builders and verifiers, while the
session remains the fallback routing unit when neither command nor agent declares a model.

## c. Custom command definition

| Question | OpenCode |
|---|---|
| Format | Markdown + YAML frontmatter; body (trimmed) becomes the prompt `template`. Fields: `description`, `agent`, `model`, `variant`, `subtask` (`template` implicit). — `packages/core/src/v1/config/command.ts:5-12`; parser `packages/opencode/src/config/command.ts:21-31` |
| Discovery | `{command,commands}/**/*.md` under `~/.config/opencode/`, every `.opencode/` from cwd up to the worktree root, `~/.opencode/`, `$OPENCODE_CONFIG_DIR`; plus `opencode.json` `"command"` key; plus MCP prompts and skills. — `packages/opencode/src/config/command.ts:15-20`; `packages/opencode/src/config/paths.ts:78-96` |
| Arguments | `$ARGUMENTS` (raw string), `$1..$N` positional (quote-aware; highest-numbered placeholder soaks up the rest); args auto-appended when no placeholder present; `` !`cmd` `` shell substitution; `@path` file references (worktree-relative). — `packages/opencode/src/session/prompt.ts:1372-1409`, `:157-191`, regexes `:1592-1596` |
| Known quirks | (1) v1 does **not** reverse the directory walk for commands/agents, so an **ancestor** `.opencode/command/x.md` overrides a nearer one (v2 fixed this — `packages/core/src/config.ts:189-195`). (2) `` !`cmd` `` runs *after* argument substitution — user args can reach the shell — and inherits the server-process cwd, contradicting the docs. — `packages/opencode/src/config/paths.ts:78-96`; `packages/opencode/src/session/prompt.ts:1383-1408` |

## d. Context / memory file discovery

| Question | OpenCode |
|---|---|
| Files auto-read | Global and project `AGENTS.md` files supply standing instructions. Project discovery walks upward from cwd to the worktree; nearby `AGENTS.md` files are lazily attached when the model reads files under them. — `packages/opencode/src/session/instruction.ts:60-68`, `:110-153`, `:179-221` |
| Extra instruction files | `opencode.json` `instructions: []` — files, globs (walked upward), `~/` paths, and URLs (5s timeout); concatenated + deduped across config layers rather than replaced. — `packages/core/src/v1/config/config.ts:124-126`; `packages/opencode/src/session/instruction.ts:135-150` |

## e. Tool permissioning

| Question | OpenCode |
|---|---|
| Mechanism | Config `permission` key: per-tool action `allow\|ask\|deny`, or a `{pattern: action}` map; last-match-wins wildcard evaluation, default `ask`. Per-agent `permission` overrides merge over global. A `"*": deny` rule removes the tool from the model's tool list entirely; a granular deny does not. — `packages/core/src/v1/config/permission.ts:5-48`; `packages/opencode/src/permission/index.ts:28-38`, `:204-219`; `packages/opencode/src/agent/agent.ts:293` |
| Bash granularity | Command parsed with tree-sitter; **every** sub-command of a compound must clear; one denied sub-command denies the call. `*`→`.*` full-match wildcards, `"x *"` also matches bare `x`; a ~135-entry arity table drives "always allow" prefixes (`git commit *`, not `git *`). — `packages/opencode/src/tool/shell.ts:283-290`, `:384-409`; `packages/core/src/util/wildcard.ts:3-14`; `packages/opencode/src/permission/arity.ts:1-161` |
| Programmatic allow/deny | The typed `permission.ask` plugin hook is **declared but dead** — never invoked since the legacy permission module was deleted (commit `2fc06c5a17`). Deny programmatically by throwing from `tool.execute.before`; allow programmatically only by replying to the `permission.asked` event via the SDK. — `packages/plugin/src/index.ts:261`; `packages/opencode/src/permission/index.ts:67-107` |

## f. Hooks / lifecycle events

| Question | OpenCode |
|---|---|
| Mechanism | **TypeScript plugins only** — no shell-command hook system, no `hooks` config key (verified: zero hits in the full config schema `packages/core/src/v1/config/config.ts:32-190`). Loaded from config `plugin: []` and `{plugin,plugins}/*.{ts,js}` under any config dir. — `packages/opencode/src/config/plugin.ts:21-28`; `packages/web/src/content/docs/plugins.mdx:54-63` |
| Tool-call interception | `tool.execute.before` — receives `{tool, sessionID, callID}` and **mutable** `output.args`; **throwing blocks the call** and the thrown message becomes the tool result (documented pattern; this is what `spec-guardrails.ts` relies on). `tool.execute.after` — `{tool, sessionID, callID, args}` in, mutable `{title, output, metadata}` out. — `packages/plugin/src/index.ts:263-281`; `packages/opencode/src/session/tools.ts:106-125`; `packages/web/src/content/docs/plugins.mdx:247-256` |
| Per-message LLM params | `chat.params` — mutable `temperature`, `topP`, `topK`, `maxOutputTokens`, provider `options`; **no `model` field**. `chat.message` — the mutable `output.message` *is* the object persisted after the hook, so mutating `message.model` / `message.agent` there does reroute the turn (undocumented). `chat.headers` for headers. — `packages/plugin/src/index.ts:247-255`; `packages/opencode/src/session/llm/request.ts:114-146`; `packages/opencode/src/session/prompt.ts:999-1046` |
| Event stream | `event` hook / SSE `GET /event`: `session.created/updated/idle/error/status/compacted`, `message.updated`, `message.part.updated` (includes `step-finish` parts with tokens+cost), `permission.asked/replied`, `command.executed`, `file.edited`, `todo.updated`, and ~80 more runtime types. — `packages/sdk/js/src/gen/types.gen.ts:704-736`; `packages/schema/src/session-event.ts`; `packages/schema/src/session-status-event.ts:35-44` |
| Hook failure semantics | Hook exceptions are unhandled defects: a throw in `tool.execute.before` fails **that tool call** (the desired guardrail behavior), but a throw in `chat.params` or `experimental.text.complete` kills the whole turn. Only `config` and `event` hooks are error-isolated. — `packages/opencode/src/plugin/index.ts:282-295` |

## g. Configuration

| Question | OpenCode |
|---|---|
| Files & precedence | `opencode.json`/`opencode.jsonc` (JSONC, trailing commas OK). Merge order, later wins: remote `.well-known/opencode` → global `~/.config/opencode/{config.json,opencode.json,opencode.jsonc}` → `$OPENCODE_CONFIG` → project `opencode.json(c)` walking down to nearest → `.opencode/` dirs (their json + `command/`, `agent/`, `plugin/` files) → `$OPENCODE_CONFIG_CONTENT` → org remote config → system managed dir (`/etc/opencode`, `%ProgramData%\opencode`) → macOS MDM. `{env:VAR}` and `{file:path}` substitution before parse. — `packages/opencode/src/config/config.ts:139-147`, `:356-534`; `packages/opencode/src/config/variable.ts:34-91` |
| Orchestration keys | `model`, `small_model`, `default_agent`, `subagent_depth`, `agent{}`, `command{}`, `permission{}`, `plugin[]`, `mcp{}`, `provider{}`, `instructions[]`, `skills`, `compaction{}`, `experimental{}`. — `packages/core/src/v1/config/config.ts:32-190` |

## h. Session lifecycle

| Question | OpenCode |
|---|---|
| Persistence | **SQLite** at `~/.local/share/opencode/opencode.db` (`OPENCODE_DB` overridable): `session` (incl. `parent_id`, `agent`, `model`, `cost`, `tokens_*`), `message` + `part` as JSON blobs. Also on disk: `auth.json`, snapshots, worktrees, plans, truncated tool output. — `packages/core/src/database/database.ts:43-55`; `packages/core/src/session/sql.ts:22-100` |
| Subagent sessions | Child sessions with `parentID`; `GET /session/{id}/children` lists them; `--continue` skips children. — `packages/opencode/src/tool/task.ts:156-172`; `packages/opencode/src/session/session.ts:596-600`; `packages/opencode/src/cli/cmd/run.ts:492` |
| Headless / API | `opencode run [msg]` non-interactive by default, flags incl. `-m/--model`, `--agent`, `-s/--session`, `-c/--continue`, `--command`, `--format json` (NDJSON events incl. step-finish tokens/cost), `--attach <server>`, `--auto`. Full HTTP server (`opencode serve`) + SDK: `POST /session` (accepts `parentID`, `agent`, `model`), `POST /session/{id}/message` (per-request `model`/`agent`/`variant`), `/summarize`, `/abort`, SSE `/event`. — `packages/opencode/src/cli/cmd/run.ts:127-262`; `packages/sdk/openapi.json` |
| Compaction | Auto-compaction on overflow (20k-token buffer), dedicated `compaction` agent, prune settings, manual `POST /session/{id}/summarize`. — `packages/opencode/src/session/overflow.ts:8-33`; `packages/opencode/src/session/compaction.ts` |

## i. Token and cost reporting

| Question | OpenCode |
|---|---|
| Per turn | **Yes.** Every LLM step emits a `step-finish` part with `cost` and `tokens {input, output, reasoning, cache{read, write}}`; the assistant message accumulates cost and carries tokens. — `packages/opencode/src/session/processor.ts:435-456`; `packages/schema/src/v1/session.ts:240-256`, `:471-481`; usage computed in `packages/opencode/src/session/session.ts:338-405` |
| Per subagent | **Yes** — subagents are child sessions; `GET /session/{childID}` returns rolled-up `cost` + `tokens`, and `message.updated` events can be filtered by `sessionID`. — `packages/core/src/session/projector.ts:89-109`; `packages/schema/src/session.ts:25-34` |
| Per session | Yes — session rollup columns (`cost`, `tokens_input/output/reasoning/cache_read/cache_write`) maintained by the projector; queryable via REST, SSE, `opencode stats` CLI, or directly in SQLite (`json_extract` over message blobs). — `packages/core/src/session/sql.ts:43-48`; `packages/opencode/src/cli/cmd/stats.ts:50-51` |
| Caveat | The v2 engine currently publishes `cost: 0` hardcoded (`packages/core/src/session/runner/llm.ts:332-343`); tokens are correct on v2, cost is only trustworthy on the v1 path. High-confidence source read, not runtime-proven. |

---

## The four findings that drive everything downstream

1. **OpenCode supports per-command model override at the highest precedence** — a phase can
   declare its tier in the command file it is entered through, with zero framework changes
   (`packages/opencode/src/session/prompt.ts:1411-1419`).
2. **OpenCode routes subagents through explicit child sessions** — agent frontmatter can pin
   builder and verifier models while preserving fresh-context execution.
3. **Guardrail enforcement is a TypeScript plugin in OpenCode** — the carrier can abort a tool
   call and return text to the model, which is the property the framework depends on.
4. **OpenCode exposes tokens+cost per turn and per subagent session** — telemetry can use one
   event/SQLite capture strategy (see `Telemetry-Hooks.md`).
