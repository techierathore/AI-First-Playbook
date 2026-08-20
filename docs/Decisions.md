# Decision Log

## 2026-08-20 — Adapter boundary and per-phase model routing

**Status:** implemented and verified (same day). `playbook/model-tiers.yml` + `scripts/apply-model-tiers.mjs` (stamps in place; `--check` passes), `scripts/harness-install.mjs` (Claude pack with tier-resolved models), `harness/opencode/plugin/telemetry.ts` + `scripts/playbook-telemetry.mjs` (per-phase records), guardrail tests green (`scripts/test-guardrails.mjs`), repo validation green (`scripts/playbook-validate.mjs`), harness/`.opencode` plugin copies in sync. Operator guides added: `docs/Model-Routing-Guide.md`, `docs/Telemetry-Guide.md`. One cross-verified correction folded into `Telemetry-Hooks.md`: Claude Code per-subagent usage IS recoverable via the `SubagentStop` payload's `agent_transcript_path` / the deterministic `…/subagents/agent-*.jsonl` location (the "confirmed absence" row was wrong).
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

## 2026-08-20 (later) — verification outcomes and implementation

**Status:** implemented (working tree; commit pending owner review)

All three open items were tested the same day:

- **(a) CONFIRMED — Claude Code honors command `model:` frontmatter.** Live test on Claude
  Code 2.1.237: a command with `model: claude-haiku-4-5` executed on Haiku
  (`modelUsage` in `--output-format json`); the identical command without the field executed
  on the session default. The capability is **undocumented**, so the generated pack stamps
  both command models *and* subagent models (the documented mechanism) — routing survives
  either way.
- **(b) CONFIRMED DEFECT, FIXED.** OpenCode substitutes only `{env:VAR}` / `{file:path}`
  (`packages/opencode/src/config/variable.ts:33-38`); `${PLAYWRIGHT_MCP_URL}` passed through
  as a literal. `opencode.json` now uses `{env:PLAYWRIGHT_MCP_URL}`.
- **(c) PASSED (proxy test).** OpenCode 1.18.18 as the **Windows** binary — the originally
  crashing configuration — read a 19.4 MB markdown checklist via a free-tier model without
  any bun error; the streaming read caps handled it. Caveat: not the original office
  workload; §1.3's acceptance test against the real workload still applies before
  decommissioning the container.

Implemented in this pass: `playbook/model-tiers.yml` + `scripts/apply-model-tiers.mjs`
(all 14 commands + 5 agents stamped for OpenCode); `builder` subagent
(`harness/opencode/agent/builder.md`, wired into `/implement` and `/fix` wave instructions);
shared guardrail policy (`harness/opencode/plugin/write-policy.mjs`) consumed by both the
OpenCode plugin and the Claude Code PreToolUse hook; generated Claude Code pack
(`harness/claude-code/`, via `scripts/harness-install.mjs`); telemetry plugin
(`harness/opencode/plugin/telemetry.ts`, opt-in via `PLAYBOOK_TELEMETRY=1`) +
`scripts/playbook-telemetry.mjs`; `scripts/provision-wsl.sh`; fixes for Coupling items 4b
(instructions path), 9 (env syntax), 10 (duplicate plugin dir removed).

One policy bug found by the port's own tests and fixed in the shared module: the
shell-redirect pattern missed the space-separated form (`echo x > Gap-Report.md`) — present
in the original plugin since inception. The refactor paid for itself before it shipped.

## 2026-08-20 (later) — no OpenCode version pinning

**Status:** decided (owner)

The framework does not pin an OpenCode version and does not treat OpenCode upgrades as
re-verification events — this supersedes the earlier advice to treat an engine flip as a
design-review trigger. Rationale: the friction of verifying every release outweighs the
risk, because (a) the framework consumes only stable, documented OpenCode surface
(command/agent `model:` frontmatter, the plugin API, `{env:}` config substitution), so the
OpenCode source tree was reference material for the capability matrix, never a dependency;
and (b) breakage is cheaply detectable after the fact instead of expensively prevented
before it: CI runs `validate` + `test:guardrails`, `apply-model-tiers.mjs --check` guards
the tier stamps, and the two-minute plant-a-bug smoke test proves the guardrail inside the
live harness (`docs/OpenCode-Guide.md` §8). Version numbers in `Capability-Matrix.md`
remain as provenance only.

**Alternative rejected:** pin the deployed version and re-verify the capability matrix on
each bump — safest on paper, but it converts every routine update into a chore nobody will
do, and the failure mode it prevents (a silently changed harness surface) is exactly what
the smoke test catches in two minutes anyway.

## 2026-08-20 (later) — Claude Code pack verified end-to-end

**Status:** verified live (Claude Code 2.1.237)

The generated pack was installed into a scratch repo and driven for real: the main session
(Haiku) launched the `verifier` subagent, which ran on **Sonnet** — its stamped
`model:` frontmatter honored (`modelUsage` showed both models). The subagent's attempt to
`Write Probe-Gap-Report.md` was **blocked** by the PreToolUse hook with the full shared
remediation text fed back to it, while its write to `verification/smoke/note.txt` was
allowed — both policy branches proven in the live harness. A debug hook captured the raw
PreToolUse input and confirmed `agent_type: "verifier"` **is** delivered for subagent tool
calls, so the stricter verifier write-scope is fully active in Claude Code (the
fail-open-on-scope fallback in the hook remains as defence for harness versions that omit
the field). Nothing about this run required the OpenCode source — deployed binaries only.
