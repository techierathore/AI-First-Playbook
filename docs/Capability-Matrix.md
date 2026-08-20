# Harness Capability Matrix — OpenCode vs Claude Code

**Scope:** the capabilities the AI-First Playbook (team edition of TechieFlow) actually depends
on. Produced 2026-08-20.

**Sources.** OpenCode claims were read from source at `/mnt/c/4RoCode/opencode`
(commit `da4730e4a4`, 2026-08-19, `packages/opencode` v1.18.18); paths below are relative to
that repo root. The source is **evidence only** — the framework targets the deployed OpenCode
binary, and the load-bearing behaviours (command/agent `model:` frontmatter, plugin
tool-hooks, `{env:}` config substitution, `opencode run`) were additionally confirmed live
against a deployed 1.18.18 install. Claude Code claims were verified against official
documentation; each carries its URL. Anything inferred rather than read is marked
**UNVERIFIED** with what would verify it.

**One structural caveat that applies to every OpenCode row:** the repo contains two parallel
engines — v1 (`packages/opencode/src/**`, the shipping CLI/TUI path) and v2
(`packages/core/src/**`, an in-progress Effect-based rewrite reachable today only via the newer
`/api/*` routes and debug commands). All rows below describe **v1, the live path** (confirmed:
`opencode run` dispatches through `client.session.prompt`, the v1 route —
`packages/opencode/src/cli/cmd/run.ts:859`), with v2 divergences noted only where they change a
conclusion.

---

## a. Agent / subagent model

| Question | OpenCode | Claude Code |
|---|---|---|
| Subagents definable? | **Yes.** Markdown + YAML frontmatter under `{agent,agents}/**/*.md` in any config dir (`~/.config/opencode/`, project `.opencode/`, `~/.opencode/`, `$OPENCODE_CONFIG_DIR`), or the `"agent"` key of `opencode.json`. Body becomes the system prompt. — `packages/opencode/src/config/agent.ts:11-32`; `packages/opencode/src/config/paths.ts:23-41`; `packages/core/src/v1/config/config.ts:96-105` | **Yes.** `.claude/agents/*.md` with YAML frontmatter. — https://code.claude.com/docs/en/sub-agents.md |
| Agent config fields | `model`, `variant`, `temperature`, `top_p`, `prompt`, `permission`, `mode: primary\|subagent\|all`, `description`, `hidden`, `color`, `steps`, `disable`; deprecated `tools` map folds into `permission`. Unknown keys pass through to the provider as `options`. — `packages/core/src/v1/config/agent.ts:12-41` | `name`, `description`, `tools`, `disallowedTools`, `model`, `permissionMode`, `maxTurns`, `skills`, `mcpServers`, `hooks`, `memory`, and more. — https://code.claude.com/docs/en/sub-agents.md |
| Subagent gets its own model? | **Yes.** When the `task` tool spawns a subagent: `const model = next.model ?? { modelID: msg.info.modelID, providerID: msg.info.providerID }` — the agent's configured model wins, else it inherits the parent's current model; the resolved model is passed explicitly into the child session's prompt. — `packages/opencode/src/tool/task.ts:181-212` | **Yes.** `model:` frontmatter accepts aliases (`haiku`/`sonnet`/`opus`), full model IDs, or `inherit` (default). — https://code.claude.com/docs/en/sub-agents.md |
| Subagent execution unit | A **child session** with `parentID` set; depth capped by config `subagent_depth` (default 1). — `packages/opencode/src/tool/task.ts:156-172`, `:104-117` | Isolated context; only the final summary returns to the parent. — https://code.claude.com/docs/en/sub-agents.md |

## b. Model selection granularity — the decisive row

| Level | OpenCode | Claude Code |
|---|---|---|
| Session-wide default | Yes — config `model` (`"provider/model"`), plus `small_model` for utility calls. — `packages/core/src/v1/config/config.ts:74-79` | Yes — settings / `claude --model`. — https://code.claude.com/docs/en/settings.md |
| **Mid-session switch** | **Yes — model is a per-message parameter.** `PromptInput.model` is optional per prompt; resolution per user message is `input.model ?? agent.model ?? currentModel(session)`, the agent loop re-reads the model from the **last user message each iteration**, and one session's transcript can contain assistant messages from different models. — `packages/opencode/src/session/prompt.ts:1499-1520`, `:646`, `:1141`. TUI `/models` sends the selection with every subsequent message in the same session. — `packages/tui/src/component/prompt/index.tsx:968`, `:1094-1101` | **Yes** — `/model` switches for subsequent turns in the same session. — https://code.claude.com/docs/en/commands.md |
| **Per subagent** | **Yes** (row a). — `packages/opencode/src/tool/task.ts:181-184` | **Yes** — subagent `model:` frontmatter. — https://code.claude.com/docs/en/sub-agents.md |
| **Per command invocation** | **Yes, and it has the *highest* precedence:** `cmd.model` → model of `cmd.agent` → caller/TUI model → session model. A command's `model:` frontmatter beats even the model the user picked in the TUI. With `subtask: true` the override is fully scoped to a child session; inline, it also becomes the session's new sticky model. — `packages/opencode/src/session/prompt.ts:1411-1419`, `:1439-1458`; schema `packages/core/src/v1/config/command.ts:5-12` | **Yes — VERIFIED empirically, but undocumented.** Live test on Claude Code 2.1.237 (2026-08-20): a command with `model: claude-haiku-4-5` frontmatter executed on Haiku (`modelUsage` in `claude -p --output-format json`); the same command without it executed on the session default. Not in the documented frontmatter fields (`description`, `argument-hint`, `disable-model-invocation`, `user-invocable`), so treat as version-fragile and keep subagent-model routing as the documented backstop. — https://code.claude.com/docs/en/skills.md ; test recorded in `Decisions.md` |
| Per CLI invocation (headless) | Yes — `opencode run -m provider/model --agent <a> -s <session>`. — `packages/opencode/src/cli/cmd/run.ts:165-170`, `:859-865` | Yes — `claude -p --model`. — https://code.claude.com/docs/en/headless.md |
| Per tool call | **No.** `Tool.Context` carries no model; the model is fixed once per assistant-message loop step. — `packages/opencode/src/tool/tool.ts:36-46`; `packages/opencode/src/session/prompt.ts:1213-1218` | **No.** Sub-message granularity is not exposed; the subagent is the smallest routing unit. — https://code.claude.com/docs/en/sub-agents.md |
| Programmatic per-turn override | Yes — HTTP `POST /session/{id}/message` accepts `model`, `agent`, `variant` per request; a plugin can also mutate `output.message.model` in the `chat.message` hook (undocumented but structurally honored — the mutated message is persisted *after* the hook and the loop resolves the model from it). — `packages/opencode/src/server/routes/instance/httpapi/groups/session.ts:70`; `packages/opencode/src/session/prompt.ts:999-1046`, `:1141` | No equivalent; hooks cannot change the model. — https://code.claude.com/docs/en/hooks.md |

**Conclusion for this row:** per-phase model routing is **natively expressible in both
harnesses** at command granularity — documented and highest-precedence in OpenCode,
empirically verified but undocumented in Claude Code (2.1.237). The subagent and the session
remain Claude Code's *documented* routing units, so the design stamps both.

## c. Custom command definition

| Question | OpenCode | Claude Code |
|---|---|---|
| Format | Markdown + YAML frontmatter; body (trimmed) becomes the prompt `template`. Fields: `description`, `agent`, `model`, `variant`, `subtask` (`template` implicit). — `packages/core/src/v1/config/command.ts:5-12`; parser `packages/opencode/src/config/command.ts:21-31` | `.claude/skills/<name>/SKILL.md` (primary) or `.claude/commands/*.md` (legacy). Fields: `description`, `argument-hint`, `disable-model-invocation`, `user-invocable`. — https://code.claude.com/docs/en/skills.md |
| Discovery | `{command,commands}/**/*.md` under `~/.config/opencode/`, every `.opencode/` from cwd up to the worktree root, `~/.opencode/`, `$OPENCODE_CONFIG_DIR`; plus `opencode.json` `"command"` key; plus MCP prompts and skills. — `packages/opencode/src/config/command.ts:15-20`; `packages/opencode/src/config/paths.ts:78-96` | Project `.claude/` and user `~/.claude/` skill/command dirs, plus plugins. — https://code.claude.com/docs/en/skills.md |
| Arguments | `$ARGUMENTS` (raw string), `$1..$N` positional (quote-aware; highest-numbered placeholder soaks up the rest); args auto-appended when no placeholder present; `` !`cmd` `` shell substitution; `@path` file references (worktree-relative). — `packages/opencode/src/session/prompt.ts:1372-1409`, `:157-191`, regexes `:1592-1596` | `$ARGUMENTS`, `$0`/`$1`/`$2` positional, `!` command execution, `@file` references. — https://code.claude.com/docs/en/skills.md |
| Known quirks | (1) v1 does **not** reverse the directory walk for commands/agents, so an **ancestor** `.opencode/command/x.md` overrides a nearer one (v2 fixed this — `packages/core/src/config.ts:189-195`). (2) `` !`cmd` `` runs *after* argument substitution — user args can reach the shell — and inherits the server-process cwd, contradicting the docs. — `packages/opencode/src/config/paths.ts:78-96`; `packages/opencode/src/session/prompt.ts:1383-1408` | — |

## d. Context / memory file discovery

| Question | OpenCode | Claude Code |
|---|---|---|
| Files auto-read | Global: `~/.config/opencode/AGENTS.md`, else `~/.claude/CLAUDE.md`. Project: walking up from cwd to worktree, the first filename to match **wins and suppresses the others** — order `AGENTS.md` → `CLAUDE.md` → `CONTEXT.md` (deprecated). So a repo with both reads only `AGENTS.md`. Nearby `AGENTS.md`/`CLAUDE.md` are lazily attached when the model reads files under them. — `packages/opencode/src/session/instruction.ts:60-68`, `:110-153`, `:179-221` | `CLAUDE.md` hierarchy: managed policy → `~/.claude/CLAUDE.md` → project `./CLAUDE.md` or `./.claude/CLAUDE.md` → `./CLAUDE.local.md`; subdirectory files load on demand; `@path` imports (max 4 hops). **`AGENTS.md` is not documented as read.** — https://code.claude.com/docs/en/memory.md |
| Extra instruction files | `opencode.json` `instructions: []` — files, globs (walked upward), `~/` paths, and URLs (5s timeout); concatenated + deduped across config layers rather than replaced. — `packages/core/src/v1/config/config.ts:124-126`; `packages/opencode/src/session/instruction.ts:135-150` | `@import` inside CLAUDE.md. — https://code.claude.com/docs/en/memory.md |

## e. Tool permissioning

| Question | OpenCode | Claude Code |
|---|---|---|
| Mechanism | Config `permission` key: per-tool action `allow\|ask\|deny`, or a `{pattern: action}` map; last-match-wins wildcard evaluation, default `ask`. Per-agent `permission` overrides merge over global. A `"*": deny` rule removes the tool from the model's tool list entirely; a granular deny does not. — `packages/core/src/v1/config/permission.ts:5-48`; `packages/opencode/src/permission/index.ts:28-38`, `:204-219`; `packages/opencode/src/agent/agent.ts:293` | `settings.json` `permissions` with `allow`/`ask`/`deny` rule arrays and tool matchers (`Bash(npm:*)` etc.); precedence managed > CLI > local project > project > user. — https://code.claude.com/docs/en/permissions.md ; https://code.claude.com/docs/en/settings.md |
| Bash granularity | Command parsed with tree-sitter; **every** sub-command of a compound must clear; one denied sub-command denies the call. `*`→`.*` full-match wildcards, `"x *"` also matches bare `x`; a ~135-entry arity table drives "always allow" prefixes (`git commit *`, not `git *`). — `packages/opencode/src/tool/shell.ts:283-290`, `:384-409`; `packages/core/src/util/wildcard.ts:3-14`; `packages/opencode/src/permission/arity.ts:1-161` | Prefix/glob matchers on the command string. — https://code.claude.com/docs/en/permissions.md |
| Programmatic allow/deny | The typed `permission.ask` plugin hook is **declared but dead** — never invoked since the legacy permission module was deleted (commit `2fc06c5a17`). Deny programmatically by throwing from `tool.execute.before`; allow programmatically only by replying to the `permission.asked` event via the SDK. — `packages/plugin/src/index.ts:261`; `packages/opencode/src/permission/index.ts:67-107` | PreToolUse hook returns `permissionDecision: allow\|deny\|ask`. — https://code.claude.com/docs/en/hooks.md |

## f. Hooks / lifecycle events

| Question | OpenCode | Claude Code |
|---|---|---|
| Mechanism | **TypeScript plugins only** — no shell-command hook system, no `hooks` config key (verified: zero hits in the full config schema `packages/core/src/v1/config/config.ts:32-190`). Loaded from config `plugin: []` and `{plugin,plugins}/*.{ts,js}` under any config dir. — `packages/opencode/src/config/plugin.ts:21-28`; `packages/web/src/content/docs/plugins.mdx:54-63` | **Shell commands** (plus MCP) configured in settings; events: `PreToolUse`, `PostToolUse`, `PostToolUseFailure`, `UserPromptSubmit`, `Stop`, `SubagentStart`, `SubagentStop`, `SessionStart`, `SessionEnd`, `PreCompact`, `Notification`, `PermissionRequest`, and more. — https://code.claude.com/docs/en/hooks.md |
| Tool-call interception | `tool.execute.before` — receives `{tool, sessionID, callID}` and **mutable** `output.args`; **throwing blocks the call** and the thrown message becomes the tool result (documented pattern; this is what `spec-guardrails.ts` relies on). `tool.execute.after` — `{tool, sessionID, callID, args}` in, mutable `{title, output, metadata}` out. — `packages/plugin/src/index.ts:263-281`; `packages/opencode/src/session/tools.ts:106-125`; `packages/web/src/content/docs/plugins.mdx:247-256` | PreToolUse blocks via exit code 2 (stderr fed to the model) or JSON `permissionDecision: "deny"`. PostToolUse output goes to logs, not the model. — https://code.claude.com/docs/en/hooks.md |
| Per-message LLM params | `chat.params` — mutable `temperature`, `topP`, `topK`, `maxOutputTokens`, provider `options`; **no `model` field**. `chat.message` — the mutable `output.message` *is* the object persisted after the hook, so mutating `message.model` / `message.agent` there does reroute the turn (undocumented). `chat.headers` for headers. — `packages/plugin/src/index.ts:247-255`; `packages/opencode/src/session/llm/request.ts:114-146`; `packages/opencode/src/session/prompt.ts:999-1046` | No hook can alter model or sampling params. — https://code.claude.com/docs/en/hooks.md |
| Event stream | `event` hook / SSE `GET /event`: `session.created/updated/idle/error/status/compacted`, `message.updated`, `message.part.updated` (includes `step-finish` parts with tokens+cost), `permission.asked/replied`, `command.executed`, `file.edited`, `todo.updated`, and ~80 more runtime types. — `packages/sdk/js/src/gen/types.gen.ts:704-736`; `packages/schema/src/session-event.ts`; `packages/schema/src/session-status-event.ts:35-44` | Hook events above; plus OTel events/metrics for monitoring. — https://code.claude.com/docs/en/monitoring-usage.md |
| Hook failure semantics | Hook exceptions are unhandled defects: a throw in `tool.execute.before` fails **that tool call** (the desired guardrail behavior), but a throw in `chat.params` or `experimental.text.complete` kills the whole turn. Only `config` and `event` hooks are error-isolated. — `packages/opencode/src/plugin/index.ts:282-295` | Hook errors surface per event; blocking is an explicit contract (exit 2 / JSON). — https://code.claude.com/docs/en/hooks.md |

## g. Configuration

| Question | OpenCode | Claude Code |
|---|---|---|
| Files & precedence | `opencode.json`/`opencode.jsonc` (JSONC, trailing commas OK). Merge order, later wins: remote `.well-known/opencode` → global `~/.config/opencode/{config.json,opencode.json,opencode.jsonc}` → `$OPENCODE_CONFIG` → project `opencode.json(c)` walking down to nearest → `.opencode/` dirs (their json + `command/`, `agent/`, `plugin/` files) → `$OPENCODE_CONFIG_CONTENT` → org remote config → system managed dir (`/etc/opencode`, `%ProgramData%\opencode`) → macOS MDM. `{env:VAR}` and `{file:path}` substitution before parse. — `packages/opencode/src/config/config.ts:139-147`, `:356-534`; `packages/opencode/src/config/variable.ts:34-91` | `settings.json`: enterprise managed → CLI args → `.claude/settings.local.json` → `.claude/settings.json` → `~/.claude/settings.json`. — https://code.claude.com/docs/en/settings.md |
| Orchestration keys | `model`, `small_model`, `default_agent`, `subagent_depth`, `agent{}`, `command{}`, `permission{}`, `plugin[]`, `mcp{}`, `provider{}`, `instructions[]`, `skills`, `compaction{}`, `experimental{}`. — `packages/core/src/v1/config/config.ts:32-190` | `model`, `permissions`, `hooks`, `env`, MCP config in `.mcp.json`, subagents/skills as files. — https://code.claude.com/docs/en/settings.md |

## h. Session lifecycle

| Question | OpenCode | Claude Code |
|---|---|---|
| Persistence | **SQLite** at `~/.local/share/opencode/opencode.db` (`OPENCODE_DB` overridable): `session` (incl. `parent_id`, `agent`, `model`, `cost`, `tokens_*`), `message` + `part` as JSON blobs. Also on disk: `auth.json`, snapshots, worktrees, plans, truncated tool output. — `packages/core/src/database/database.ts:43-55`; `packages/core/src/session/sql.ts:22-100` | Transcripts as JSONL at `~/.claude/projects/<project>/<session-id>.jsonl`; `--continue`/`--resume`. — https://code.claude.com/docs/en/sessions.md |
| Subagent sessions | Child sessions with `parentID`; `GET /session/{id}/children` lists them; `--continue` skips children. — `packages/opencode/src/tool/task.ts:156-172`; `packages/opencode/src/session/session.ts:596-600`; `packages/opencode/src/cli/cmd/run.ts:492` | Subagent contexts are not separately addressable sessions; only the summary returns. — https://code.claude.com/docs/en/sub-agents.md |
| Headless / API | `opencode run [msg]` non-interactive by default, flags incl. `-m/--model`, `--agent`, `-s/--session`, `-c/--continue`, `--command`, `--format json` (NDJSON events incl. step-finish tokens/cost), `--attach <server>`, `--auto`. Full HTTP server (`opencode serve`) + SDK: `POST /session` (accepts `parentID`, `agent`, `model`), `POST /session/{id}/message` (per-request `model`/`agent`/`variant`), `/summarize`, `/abort`, SSE `/event`. — `packages/opencode/src/cli/cmd/run.ts:127-262`; `packages/sdk/openapi.json` | `claude -p` headless with `--model`, `--output-format json`; Agent SDK for programmatic sessions. — https://code.claude.com/docs/en/headless.md |
| Compaction | Auto-compaction on overflow (20k-token buffer), dedicated `compaction` agent, prune settings, manual `POST /session/{id}/summarize`. — `packages/opencode/src/session/overflow.ts:8-33`; `packages/opencode/src/session/compaction.ts` | Auto-compaction; `PreCompact`/`PostCompact` hooks. — https://code.claude.com/docs/en/hooks.md |

## i. Token and cost reporting

| Question | OpenCode | Claude Code |
|---|---|---|
| Per turn | **Yes.** Every LLM step emits a `step-finish` part with `cost` and `tokens {input, output, reasoning, cache{read, write}}`; the assistant message accumulates cost and carries tokens. — `packages/opencode/src/session/processor.ts:435-456`; `packages/schema/src/v1/session.ts:240-256`, `:471-481`; usage computed in `packages/opencode/src/session/session.ts:338-405` | Per-message usage in transcript JSONL: **UNVERIFIED** (format is internal/undocumented; verify by inspecting a transcript). `claude -p --output-format json` returns usage + `total_cost_usd` per run. — https://code.claude.com/docs/en/headless.md |
| Per subagent | **Yes** — subagents are child sessions; `GET /session/{childID}` returns rolled-up `cost` + `tokens`, and `message.updated` events can be filtered by `sessionID`. — `packages/core/src/session/projector.ts:89-109`; `packages/schema/src/session.ts:25-34` | **No** — subagent token usage is not exposed. — https://code.claude.com/docs/en/sub-agents.md |
| Per session | Yes — session rollup columns (`cost`, `tokens_input/output/reasoning/cache_read/cache_write`) maintained by the projector; queryable via REST, SSE, `opencode stats` CLI, or directly in SQLite (`json_extract` over message blobs). — `packages/core/src/session/sql.ts:43-48`; `packages/opencode/src/cli/cmd/stats.ts:50-51` | OpenTelemetry metrics: `claude_code.token.usage`, `claude_code.cost.usage` with attributes incl. `model` — but **no phase/command dimension**. Hooks receive **no** token counts. — https://code.claude.com/docs/en/monitoring-usage.md |
| Caveat | The v2 engine currently publishes `cost: 0` hardcoded (`packages/core/src/session/runner/llm.ts:332-343`); tokens are correct on v2, cost is only trustworthy on the v1 path. High-confidence source read, not runtime-proven. | `/cost` command: UNVERIFIED (not found in current docs). |

---

## The four findings that drive everything downstream

1. **OpenCode supports per-command model override at the highest precedence** — a phase can
   declare its tier in the command file it is entered through, with zero framework changes
   (`packages/opencode/src/session/prompt.ts:1411-1419`).
2. **Claude Code's documented routing units are the subagent and the session** — but
   per-command `model:` frontmatter works too (verified live on 2.1.237, undocumented; see
   row b).
3. **Guardrail enforcement is a TS plugin in OpenCode and a shell hook in Claude Code** — same
   policy, two mechanically different carriers. Both can abort a tool call and return text to
   the model, which is the property the framework depends on.
4. **OpenCode exposes tokens+cost per turn and per subagent session; Claude Code exposes
   per-run and OTel aggregates only** — telemetry needs two different capture strategies
   (see `Telemetry-Hooks.md`).
