# Decision Log

## 2026-08-20 — Adapter boundary and per-phase model routing

**Status:** proposed (design session; no implementation yet)
**Inputs:** `Capability-Matrix.md`, `Coupling-Points.md`, `Adapter-Design.md`,
`Telemetry-Hooks.md` (all this date)

### Decision 1 — the adapter is an install-time generator, not a runtime layer

One script (`scripts/harness-install.mjs <harness> <target>`) reads the canonical framework
sources unchanged and emits a harness pack: command files with translated frontmatter, agent
files, the standing-rules wiring (`AGENTS.md` + a `CLAUDE.md` shim for Claude Code), the
guardrail in the native carrier (OpenCode TS plugin / Claude Code PreToolUse hook, both
consuming one shared pure `checkWritePolicy` module), MCP registration, and tier-resolved
model stamps. Phase logic, gates, the Verifier prompt, and command bodies are inputs, never
outputs — the wrapping-not-redesigning constraint holds.

**Alternatives rejected:**

- **Runtime adapter / proxy daemon between the framework and the harness.** Rejected: every
  "breaks" coupling turned out to be packaging (frontmatter dialects, file locations, hook
  carriers), not runtime behaviour. A daemon adds a failure mode, an install dependency, and a
  second thing to debug, and buys nothing the generator doesn't.
- **LLM gateway as the routing layer** (route by model alias at the HTTP layer). Rejected for
  routing: the gateway cannot see phase boundaries — the harness can, natively, via
  command/agent/session model selection. (A gateway remains the right answer for the
  *NTLM-proxy* problem in `OpenCode-Guide.md`, which is unrelated.)
- **Forking the command library per harness.** Rejected: 14 commands × 2 harnesses of
  hand-maintained prose is how the two copies drift; the whole point of the generator is that
  divergence is limited to frontmatter and a two-line tool-vocabulary preamble.
- **Abstracting the permission dialects.** Deliberately out of scope: OpenCode's
  wildcard/arity maps and Claude Code's matchers are incompatible expressive surfaces; only
  the coarse per-agent scopes are emitted, and the load-bearing write-scope rule lives in the
  shared guardrail policy anyway.

### Decision 2 — routing approach: tier map as the contract; native mechanisms per harness

Phases declare tiers in `playbook/model-tiers.yml` (frontier / standard / economy / none).
In **OpenCode**, the generator stamps `model:` into command frontmatter (verified
highest-precedence override — `packages/opencode/src/session/prompt.ts:1411-1419`) and agent
frontmatter (verified subagent resolution — `packages/opencode/src/tool/task.ts:181-184`).
In **Claude Code**, routing units are the session (session-per-phase, which the framework's
"Chat: fresh" discipline already mandates) and the subagent (`model:` frontmatter, verified);
per-command frontmatter is UNVERIFIED there and the design does not depend on it.
A new `builder` subagent with an explicit standard-tier model closes the biggest cost leak:
wave workers inheriting the orchestrator's frontier model.

**Alternatives rejected:**

- **Per-tool-call routing.** Doesn't exist in either harness (verified both). Not designed
  around.
- **A runtime auto-escalator via OpenCode's `chat.message` model mutation.** It works
  structurally (the hook's mutated message is what the loop reads), but it is undocumented
  API in one harness with no Claude Code equivalent. Escalation is instead applied at `/fix`
  launch time from the checklist's own attempt history — dumb, visible, portable.
- **Session-level routing only (the "accept it" option).** Rejected as the *primary* design
  because OpenCode natively offers better, and taking it would leave sub-agent inheritance
  leaking frontier tokens; retained as the honest floor for Claude Code interactive use.

### Consequences

- Two small new artifacts (`model-tiers.yml`, the generator) and one new subagent; zero edits
  to phases/gates/Verifier logic.
- The framework becomes testably dual-harness: `playbook-validate.mjs` gains a per-pack mode.
- Telemetry splits into harness-sourced fields (model, tokens) and framework-sourced fields
  (phase, attempt, verdict) — the latter parsed from the checklist, immune to harness churn.
- Open verification items before implementation: (a) does Claude Code honor `model:` in
  command frontmatter (5-minute live test); (b) does OpenCode expand `${VAR}` in `mcp` config
  or only `{env:VAR}` (`Coupling-Points.md` item 9); (c) does the historical bun large-file
  crash reproduce in current OpenCode under WSL (`OpenCode-Guide.md` §1.3).
