# Coupling Points — where the framework depends on harness-specific behaviour

Produced 2026-08-20, against `Capability-Matrix.md` (same date).

**Direction.** This repository is OpenCode-native: every runnable artifact under
`harness/opencode/`, `.opencode/`, and `opencode.json` targets OpenCode. The inventory below
states what the framework assumes of OpenCode, where the dependency lives, and the impact if
that assumption stops holding. Items 4b and 9 record configuration defects found during the
original audit.

Severity: **breaks** = the phase loop cannot complete or a load-bearing rule silently
disappears · **degrades** = runs but loses a property the framework was built to guarantee ·
**cosmetic** = wording only.

---

## Breaks

### 1. The spec-guardrails plugin carries the framework's mechanical write rules
- **Assumes:** OpenCode's plugin API — `tool.execute.before` receives mutable tool args and a
  **thrown error aborts the tool call**, surfacing the message as the tool result. The plugin
  enforces the two rules prompt-engineering repeatedly failed to hold: no separate
  gap-report/verification-report files, and Verifier writes limited to the selected checklist +
  `verification/**` + `deploy/<feature>/**`.
- **Where:** `harness/opencode/plugins/spec-guardrails.ts:191-226` (hook + throw),
  `:134-143` (`checkWritePolicy`); registered via `opencode.json:4`; re-exported at
  `.opencode/plugin/spec-guardrails.ts:1`.
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
- **Severity: breaks.** If `/verify` runs inline in the build chat, the independence property
  of the entire verification gate is silently lost.

### 3. Standing rules live in `AGENTS.md`
- **Assumes:** the harness auto-loads `AGENTS.md` from the repo root as always-on context
  (matrix row d, `packages/opencode/src/session/instruction.ts:122-132`).
- **Where:** `AGENTS.md` (root); demanded by `templates/agents-md-template.md`,
  `harness/README.md:46-48`, `Context-Prompt.md:3`.
- **Severity: breaks — silently.** If the file is absent or not discovered, a run proceeds
  with zero standing rules (secrets policy, Verifier write-scope, gate/handoff contract).

### 4. `opencode.json` is the sole carrier of agents, instructions, plugin, and MCP wiring
- **Assumes:** the harness reads `opencode.json` for: (a) the three agent definitions with
  `file://` prompts and permission scopes, (b) the `instructions` array injecting the
  environment profile, (c) plugin registration, (d) the Playwright MCP endpoint.
- **Where:** `opencode.json:1-13`.
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
- **Severity: degrades** if command prose and the installed OpenCode tool vocabulary drift;
  waves may serialize or delegation instructions may mislead.

### 6. Verifier write-scope is expressed as OpenCode per-agent `permission` + the plugin
- **Assumes:** per-agent `permission` maps (`opencode.json:6-8`, `verifier.md` frontmatter)
  layered under the plugin's path policy.
- **Severity: degrades** if permission maps drift (defence-in-depth thins; the plugin carries
  the load-bearing path rule).

### 7. Persona activation references literal `.opencode/agent/*.md` paths
- **Where:** seven command bodies, e.g. `harness/opencode/command/feature-plan.md:5-8`,
  `analyze-fix.md:5-8`, `implement.md:9-12` ("reading and following
  `.opencode/agent/analyst.md`").
- **Severity: degrades** if installation changes the path (a dead path costs one failed read;
  command bodies still carry the behaviour).

### 8. `scripts/playbook-validate.mjs` validates only the OpenCode install shape
- **Where:** `scripts/playbook-validate.mjs:10-18` (asserts `opencode.json` exists and the
  plugin is registered), `:19-36` (iterates `harness/opencode/command`).
- **Severity: degrades** if validation misses an OpenCode install artifact (false confidence,
  not an immediate runtime failure).

### 9. MCP env substitution syntax — `${PLAYWRIGHT_MCP_URL}` is not OpenCode's syntax
- **Where:** `opencode.json:11`.
- **What OpenCode actually substitutes:** `{env:VAR}` and `{file:path}` before parse
  (`packages/opencode/src/config/variable.ts:34-91`). `${VAR}` is **UNVERIFIED** as supported —
  I found no handler for it; if unsupported, the Playwright MCP URL is passed through as a
  literal string and the (disabled-by-default) server can never be enabled correctly.
  Verify by enabling it once and checking the MCP status.
- **Severity: degrades** under OpenCode (UI verification falls back to code-audit).

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
`read`/`edit`/`write`/`grep`/`glob`/`bash` casing must continue to match OpenCode throughout
command bodies. `harness/README.md` records the canonical vocabulary.

### 12. Restart-after-change instruction
"Restart OpenCode after changing configuration, commands, agents…" (`harness/README.md:39-40`)
— an OpenCode-specific operational dependency that should remain explicit.

### 13. Container topology baked into the Verifier
`verifier.md:69` ("You are running inside a Linux Docker container"), `host.docker.internal`
probes (`verifier.md:229, 546, 559`). This is a **deployment** coupling, not a harness-API
coupling — `harness/README.md:94-99` already tables it as an environment assumption. It becomes
wrong the moment the WSL deployment (see `OpenCode-Guide.md`) replaces the container; the
environment profile's `topology:` field is the right override point.

---

## Shortest path to a working OpenCode run

The framework runs under OpenCode. Keep the instruction/profile path valid (item 4b), use
OpenCode's `{env:VAR}` substitution for MCP configuration (item 9), and ensure each plugin is
registered and discovered exactly once (item 10). Validation should cover the installed
commands, agents, standing rules, plugins, environment profile, and optional MCP wiring.
