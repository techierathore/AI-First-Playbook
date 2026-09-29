# Coupling Points — where the framework depends on harness-specific behaviour

Produced 2026-08-20, against `Capability-Matrix.md` (same date).

**Direction.** This repository is OpenCode-native: every runnable artifact under
`harness/opencode/`, `.opencode/`, and `opencode.json` targets OpenCode. The inventory below
states what the framework assumes of OpenCode, where the dependency lives, and the impact if
that assumption stops holding. Items 4b and 9 record configuration defects found during the
original audit. Items 4b, 9, 10 and 13 have since been resolved; each says how.

Severity: **breaks** = the phase loop cannot complete or a load-bearing rule silently
disappears · **degrades** = runs but loses a property the framework was built to guarantee ·
**cosmetic** = wording only.

---

## Breaks

### 1. The spec-guardrails plugin carries the framework's mechanical write rules
- **Assumes:** OpenCode's plugin API. On OpenCode 1, `tool.execute.before` receives mutable tool
  args and a **thrown error aborts the tool call**, surfacing the message as the tool result. On
  OpenCode 2 a thrown hook error ends the whole turn, so the `tool` `execute.before` hook renames a
  refused call to its block message and OpenCode answers the unknown tool with that text. The plugin
  enforces the two rules prompt-engineering repeatedly failed to hold: no separate
  gap-report/verification-report files, and Verifier writes limited to the selected checklist +
  `verification/**` + `deploy/<feature>/**`.
- **Where:** `harness/opencode/playbook-plugin/spec-guardrails/index.ts` (OpenCode 1: hook +
  throw) and `server.ts` (OpenCode 2: hook + rename); the policy, `checkWritePolicy`, is in
  `harness/opencode/playbook-plugin/write-policy.mjs`; registered in `opencode.json` `plugin`,
  after `telemetry` and before `yolo`.
- **Severity: breaks.** Without it, Phase 6's "no separate report file" rule reverts to
  prompt-only enforcement, which `harness/README.md` ("Why the guardrail plugin exists")
  documents as having failed three times. The run *appears* to work — which is worse than crashing.

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
- **Assumes:** OpenCode loads the installed standing rules as always-on context. OpenCode 1 loads
  `.playbook/AGENTS.md` through the config's `instructions` (matrix row d,
  `packages/opencode/src/session/instruction.ts:122-132`). OpenCode 2.0.18 ignores
  `instructions` and reads only `AGENTS.md` files found above the project, so the spec-guardrails
  `server.ts` adds `.playbook/AGENTS.md` and the profile through its `session` `context` hook.
- **Where:** `AGENTS.md` (source) → `.playbook/AGENTS.md` (installed); demanded by
  `templates/agents-md-template.md`, `harness/README.md` (Install), `Context-Prompt.md:3`.
  The guard plugins also add `[playbook-guard] <name> loaded` lines, which the standing rules
  tell the agent to check.
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
  **Resolved:** the installed config lists `.playbook/AGENTS.md` and
  `.playbook/environment-profile.yml`. The earlier `../.playbook/…` entries pointed above the
  project (OpenCode 1 searches a relative instruction upward from it), so on OpenCode 1 the
  standing rules never reached the model in an installed project.

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
- **Where:** `scripts/playbook-validate.mjs` (asserts both `opencode.json` files list exactly the
  three plugin directories in load order, and that each has `index.ts` and `server.ts`; iterates
  `harness/opencode/command`). Before a session, `.playbook/scripts/playbook-guards.mjs --config`
  checks the installed config the same way.
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
- **Resolved:** `opencode.json` uses `{env:PLAYWRIGHT_MCP_URL}`.

### 10. Plugin double-discovery after install
- **Where:** the install copies `harness/opencode/.` into `.opencode/`, which contains **both**
  `plugin/spec-guardrails.ts` (re-export) and `plugins/spec-guardrails.ts` (implementation).
  OpenCode auto-discovers `{plugin,plugins}/*.{ts,js}` (`packages/opencode/src/config/plugin.ts:21-28`)
  and dedupes by exact file URL — two different files, same hooks ⇒ the guardrail loads twice
  and every block fires twice.
- **Severity: degrades** (harmless for a throw-only guardrail, but doubles log noise and is a
  trap for any future stateful hook).
- **Resolved:** the plugins live in `.opencode/playbook-plugin/`, which OpenCode does not
  auto-discover, as directories listed once each in `opencode.json`; `install --force` removes an
  old `.opencode/plugin/` or single-file layout recorded in `.playbook/installation.json`.

---

## Cosmetic

### 11. Tool-name vocabulary in prose
`read`/`edit`/`write`/`grep`/`glob`/`bash` casing must continue to match OpenCode throughout
command bodies. `harness/README.md` records the canonical vocabulary. OpenCode 2 renamed the shell
tool to `shell` and a file tool's `filePath` argument to `path`; the plugins' policies accept both.

### 12. Restart-after-change instruction
"Restart OpenCode" after installing or changing configuration (`docs/Getting-Started.md` §2,
the installer's last line) — an OpenCode-specific operational dependency that should remain
explicit.

### 13. Container topology baked into the Verifier
`verifier.md:69` ("You are running inside a Linux Docker container"), `host.docker.internal`
probes (`verifier.md:229, 546, 559`). This is a **deployment** coupling, not a harness-API
coupling — it becomes wrong the moment the WSL deployment (see `OpenCode-Guide.md`) replaces the
container; the environment profile's `topology:` field is the right override point.
**Resolved:** the Verifier prompt no longer names a topology; `playbook-probe.mjs` reads it from
the profile (`harness/README.md`, "Environment assumptions — now in the profile").

---

## Shortest path to a working OpenCode run

The framework runs under OpenCode. Keep the instruction/profile path valid (item 4b), use
OpenCode's `{env:VAR}` substitution for MCP configuration (item 9), and ensure each plugin is
registered and discovered exactly once (item 10). Validation should cover the installed
commands, agents, standing rules, plugins, environment profile, and optional MCP wiring.
