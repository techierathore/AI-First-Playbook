# Coupling Points — where the framework depends on harness-specific behaviour

Produced 2026-08-20, against `Capability-Matrix.md` (same date).

**A note on direction.** The task brief asked for "every place TechieFlow depends on Claude
Code specific behaviour" — but this repo is **OpenCode-native**: every runnable artifact under
`harness/opencode/`, `.opencode/`, and `opencode.json` targets OpenCode, and the only Claude
Code reference in the tree is a porting note in `harness/README.md`. So the itemisation below
runs in the direction that actually matters for the stated goal ("shortest path to a working
run in both harnesses"): each item states what the framework assumes of its harness, where in
the repo, what the *other* harness (Claude Code) does instead, and severity when run there.
Severity is judged against a Claude Code run; everything already works under OpenCode except
items 4b and 9, which are live defects even there.

Severity: **breaks** = the phase loop cannot complete or a load-bearing rule silently
disappears · **degrades** = runs but loses a property the framework was built to guarantee ·
**cosmetic** = wording only.

---

## Breaks

### 1. The spec-guardrails plugin is an OpenCode TS plugin — the framework's only mechanical rule
- **Assumes:** OpenCode's plugin API — `tool.execute.before` receives mutable tool args and a
  **thrown error aborts the tool call**, surfacing the message as the tool result. The plugin
  enforces the two rules prompt-engineering repeatedly failed to hold: no separate
  gap-report/verification-report files, and Verifier writes limited to the selected checklist +
  `verification/**` + `deploy/<feature>/**`.
- **Where:** `harness/opencode/plugins/spec-guardrails.ts:191-226` (hook + throw),
  `:134-143` (`checkWritePolicy`); registered via `opencode.json:4`; re-exported at
  `.opencode/plugin/spec-guardrails.ts:1`.
- **Claude Code instead:** no TS plugin system. Equivalent capability exists as a
  **PreToolUse shell hook**: block via exit code 2 (stderr fed to the model) or JSON
  `permissionDecision: "deny"` (https://code.claude.com/docs/en/hooks.md).
- **Severity: breaks.** Without it, Phase 6's "no separate report file" rule reverts to
  prompt-only enforcement, which `harness/README.md:154-163` documents as having failed three
  times. The run *appears* to work — which is worse than crashing.

### 2. `/verify` relies on command frontmatter `agent: verifier` + `subtask: true`
- **Assumes:** OpenCode dispatches a command whose agent is `mode: subagent` into a **fresh
  child session** under that agent — this is what delivers Phase 5's keystone guarantee, "the
  Verifier must have no memory of the build" (`phases/05-verify.md:3-5`).
- **Where:** `harness/opencode/command/verify.md:1-5`; agent definition
  `harness/opencode/agent/verifier.md` frontmatter (`mode: subagent`, `temperature: 0.1`,
  permission block) and `opencode.json:8`.
- **Claude Code instead:** slash-command/skill frontmatter has no documented `agent:` or
  `subtask:` field. The verified equivalent is a **subagent** (`.claude/agents/verifier.md`)
  that the command body explicitly delegates to ("use the verifier subagent for everything
  below"), which also runs in an isolated context
  (https://code.claude.com/docs/en/sub-agents.md).
- **Severity: breaks.** If `/verify` runs inline in the build chat, the independence property
  of the entire verification gate is silently lost.

### 3. Standing rules live in `AGENTS.md` — Claude Code doesn't read it
- **Assumes:** the harness auto-loads `AGENTS.md` from the repo root as always-on context
  (OpenCode does, and it *suppresses* `CLAUDE.md` when both exist —
  matrix row d, `packages/opencode/src/session/instruction.ts:122-132`).
- **Where:** `AGENTS.md` (root); demanded by `templates/agents-md-template.md`,
  `harness/README.md:46-48`, `Context-Prompt.md:3`.
- **Claude Code instead:** reads `CLAUDE.md` (hierarchy + `@import`); `AGENTS.md` is not in the
  documented discovery list (https://code.claude.com/docs/en/memory.md).
- **Severity: breaks — silently.** A Claude Code run proceeds with zero standing rules
  (secrets policy, Verifier write-scope, gate/handoff contract). Fix is one file:
  a `CLAUDE.md` containing `@AGENTS.md`. Because OpenCode prefers `AGENTS.md` over `CLAUDE.md`,
  the two files coexist without double-loading.

### 4. `opencode.json` is the sole carrier of agents, instructions, plugin, and MCP wiring
- **Assumes:** the harness reads `opencode.json` for: (a) the three agent definitions with
  `file://` prompts and permission scopes, (b) the `instructions` array injecting the
  environment profile, (c) plugin registration, (d) the Playwright MCP endpoint.
- **Where:** `opencode.json:1-13`.
- **Claude Code instead:** ignores the file entirely. Equivalents are spread across
  `.claude/agents/*.md`, `CLAUDE.md` imports, `.claude/settings.json` (hooks, permissions), and
  `.mcp.json` (https://code.claude.com/docs/en/settings.md).
- **Severity: breaks** (no agents, no profile in context, no guardrail, no Playwright).
- **4b — a live defect even under OpenCode:** `opencode.json:3` lists
  `"docs/ENVIRONMENT-PROFILE.md"` in `instructions`, but the repo file is
  `docs/Environment-Profile.md` and the actual profile is `playbook/environment-profile.yml`.
  On a case-sensitive filesystem (the Docker container, WSL) that instruction entry resolves to
  nothing and is silently skipped. UNVERIFIED whether OpenCode warns; the loader globs and
  missing files simply don't match (`packages/opencode/src/session/instruction.ts:135-150`).

---

## Degrades

### 5. Command bodies name the `task` tool and OpenCode's child-session mechanics
- **Assumes:** a lowercase `task` tool that spawns parallel subagents in child sessions, with
  the TUI behaviour described in the text ("sub-agents run in CHILD SESSIONS…").
- **Where:** `harness/opencode/command/implement.md:107-168, 207-215`;
  `harness/opencode/command/fix.md` (same wave machinery);
  `harness/opencode/agent/verifier.md` (`task: allow`, parallel sub-verifiers).
- **Claude Code instead:** the delegation tool is `Agent` (historically `Task`); parallel
  subagents exist and can be launched in one message. The model generally adapts to the tool it
  actually has; the prose about TUI child sessions becomes wrong.
- **Severity: degrades** — waves still run, but named-tool instructions and UI notes mislead.

### 6. Verifier write-scope is expressed as OpenCode per-agent `permission` + the plugin
- **Assumes:** per-agent `permission` maps (`opencode.json:6-8`, `verifier.md` frontmatter)
  layered under the plugin's path policy.
- **Claude Code instead:** subagent `tools:`/`permissionMode` and settings `permissions` rules —
  a different dialect; fine-grained "may edit only the checklist" cannot be expressed in either
  harness's permission language and lives in the guardrail (item 1) in both.
- **Severity: degrades** (defence-in-depth thins; the plugin/hook carries the real rule).

### 7. Persona activation references literal `.opencode/agent/*.md` paths
- **Where:** seven command bodies, e.g. `harness/opencode/command/feature-plan.md:5-8`,
  `analyze-fix.md:5-8`, `implement.md:9-12` ("reading and following
  `.opencode/agent/analyst.md`").
- **Claude Code instead:** the file would live at `.claude/agents/analyst.md` (or the paragraph
  is deleted — `harness/README.md:77-83` already blesses that).
- **Severity: degrades** (a dead path costs one failed read; command bodies carry the
  behaviour).

### 8. `scripts/playbook-validate.mjs` validates only the OpenCode install shape
- **Where:** `scripts/playbook-validate.mjs:10-18` (asserts `opencode.json` exists and the
  plugin is registered), `:19-36` (iterates `harness/opencode/command`).
- **Claude Code instead:** nothing validates a `.claude/` install; CI passes while a Claude
  Code deployment is broken.
- **Severity: degrades** (false confidence, not a runtime failure).

### 9. MCP env substitution syntax — `${PLAYWRIGHT_MCP_URL}` is not OpenCode's syntax
- **Where:** `opencode.json:11`.
- **What OpenCode actually substitutes:** `{env:VAR}` and `{file:path}` before parse
  (`packages/opencode/src/config/variable.ts:34-91`). `${VAR}` is **UNVERIFIED** as supported —
  I found no handler for it; if unsupported, the Playwright MCP URL is passed through as a
  literal string and the (disabled-by-default) server can never be enabled correctly.
  Verify by enabling it once and checking the MCP status. Claude Code's `.mcp.json` *does*
  document `${VAR}` expansion.
- **Severity: degrades** under OpenCode (UI verification falls back to code-audit), cosmetic
  under Claude Code (different file anyway).

### 10. Plugin double-discovery after install
- **Where:** the install copies `harness/opencode/.` into `.opencode/`, which contains **both**
  `plugin/spec-guardrails.ts` (re-export) and `plugins/spec-guardrails.ts` (implementation).
  OpenCode auto-discovers `{plugin,plugins}/*.{ts,js}` (`packages/opencode/src/config/plugin.ts:21-28`)
  and dedupes by exact file URL — two different files, same hooks ⇒ the guardrail loads twice
  and every block fires twice.
- **Severity: degrades** (harmless for a throw-only guardrail, but doubles log noise and is a
  trap for any future stateful hook).

---

## Cosmetic

### 11. Tool-name vocabulary in prose
`read`/`edit`/`write`/`grep`/`glob`/`bash` casing matches OpenCode; Claude Code capitalises
(`Read`, `Bash`…). Models map these reliably. — throughout command bodies;
`harness/README.md:146-149` already lists the mapping as a porting step.

### 12. Restart-after-change instruction
"Restart OpenCode after changing configuration, commands, agents…" (`harness/README.md:39-40`)
— harness-specific operational note, wrong for Claude Code (commands/skills are re-read).

### 13. Container topology baked into the Verifier
`verifier.md:69` ("You are running inside a Linux Docker container"), `host.docker.internal`
probes (`verifier.md:229, 546, 559`). This is a **deployment** coupling, not a harness-API
coupling — `harness/README.md:94-99` already tables it as an environment assumption. It becomes
wrong the moment the WSL deployment (see `OpenCode-Guide.md`) replaces the container; the
environment profile's `topology:` field is the right override point.

---

## Shortest path to a working run in both harnesses

Under **OpenCode** it already runs; fix item 4b (instructions path) and item 9 (env syntax),
and delete one of the duplicate plugin dirs (item 10).

Under **Claude Code**, exactly five artifacts are missing, all generatable from what exists
(this is the adapter's job — see `Adapter-Design.md`):

1. `CLAUDE.md` → one line: `@AGENTS.md` (item 3).
2. `.claude/agents/{analyst,orchestrator,verifier}.md` → same prompt bodies, frontmatter
   translated (`mode: subagent` → subagent by location; `permission` → `tools`) (items 2, 4, 6).
3. `.claude/commands/*.md` → same bodies; for `/verify`, replace the `agent:`/`subtask:`
   frontmatter with an explicit "delegate everything below to the verifier subagent" opening
   line (item 2).
4. `.claude/settings.json` PreToolUse hook + `scripts/spec-guardrails-hook.mjs` reimplementing
   `checkWritePolicy` (the policy function is already nearly pure and portable) (item 1).
5. `.mcp.json` with the Playwright server (item 9).

Everything else on this list is polish, not path.
