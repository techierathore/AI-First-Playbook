# Adapter Boundary and Model Routing Design

Covers Tasks 3 and 4. Depends on `Capability-Matrix.md` rows (b), (c), (f) and the
breaks-list in `Coupling-Points.md`. Design only — no implementation in this pass.

---

## Part 1 — The adapter boundary (Task 3)

### The decision: an install-time generator, not a runtime abstraction

Every "breaks" item in `Coupling-Points.md` is a *packaging* difference, not a *behaviour*
difference: both harnesses can run markdown commands with `$ARGUMENTS`, both have subagents
with per-subagent models, both can abort a tool call from a hook and feed the error text back
to the model, both auto-load a root context file. What differs is frontmatter dialect, file
locations, and the carrier for the guardrail. Packaging differences are resolved once, at
install time — nothing needs to sit between the model and the harness at runtime.

So the adapter is a single script — `scripts/harness-install.mjs <opencode|claude-code>
<target-repo>` — that reads one canonical source tree and **emits** a harness pack. This
respects the hard constraint: phase logic, gates, the Verifier and the command library are
inputs to the generator, byte-for-byte unchanged in their bodies.

### What sits behind the adapter (the generator owns it)

| Concern | OpenCode emission | Claude Code emission |
|---|---|---|
| Command packaging | `.opencode/command/<name>.md`, frontmatter `description` / `agent` / `subtask` / **`model`** (stamped from the tier map, Part 2) | `.claude/commands/<name>.md`, frontmatter `description` / `argument-hint`; `/verify` gets a generated opening line delegating to the verifier subagent |
| Agent packaging | `.opencode/agent/*.md` (`mode`, `permission`, `temperature`, **`model`**) | `.claude/agents/*.md` (`description`, `tools`, **`model`**) |
| Standing rules wiring | `AGENTS.md` at root (OpenCode prefers it and suppresses `CLAUDE.md` — matrix row d) | `CLAUDE.md` containing `@AGENTS.md` — both files coexist safely |
| Guardrail carrier | TS plugin registered in `opencode.json` (`tool.execute.before` + throw) | `.claude/settings.json` PreToolUse hook invoking `scripts/spec-guardrails-hook.mjs` (JSON `permissionDecision: "deny"` with the same reason text) |
| Guardrail **policy** | One shared, pure module (`checkWritePolicy` — already extractable from `harness/opencode/plugins/spec-guardrails.ts:134-143` with zero OpenCode imports) consumed by both carriers | same module |
| MCP registration | `opencode.json` `mcp` key, `{env:PLAYWRIGHT_MCP_URL}` syntax (fixes Coupling item 9) | `.mcp.json`, `${PLAYWRIGHT_MCP_URL}` syntax |
| Instruction/profile injection | `opencode.json` `instructions: []` (fixes the case-mismatch, Coupling item 4b) | `@import` lines in `CLAUDE.md` |
| Tier → model resolution | `playbook/model-tiers.yml` → concrete `provider/model` strings stamped into command/agent frontmatter | same file → `model:` aliases stamped into subagent frontmatter |
| Install validation | `playbook-validate.mjs` grows a per-harness mode asserting the emitted pack is complete | same |

### What stays in framework code (the generator never touches it)

- The ten phase documents, the gate semantics, the verdict vocabulary
  (`PASS`/`FAIL`/`PASS (code-audit)`/…), the checklist item format, the Status Table and Run
  Log contracts.
- Every command **body** and the 1,050-line Verifier prompt — they are already
  harness-portable prose. The only tolerated in-body divergence is a two-line "tool
  vocabulary" preamble (`task` vs `Agent`) the generator prepends per harness; command text is
  not forked.
- `playbook/environment-profile.yml`, handoff templates, the HTML doc shell.
- `AGENTS.md` content.

### Deliberately left harness-specific (abstracting it isn't worth the complexity)

- **Permission dialects.** OpenCode's wildcard/arity `permission` maps and Claude Code's
  `Bash(npm:*)` matchers are expressive in incompatible ways. The adapter emits only the
  coarse per-agent scopes that exist today (`edit/write/bash allow|deny`); teams tune the rest
  natively. The load-bearing write-scope rule lives in the shared guardrail policy anyway.
- **Session mechanics** — resume, compaction, child-session UX, "restart after config
  change". These never cross the framework's contract surface; phase docs already say only
  "Chat: fresh".
- **Parallelism mechanics.** No abstraction over `task` vs `Agent`; the vocabulary preamble
  plus the model's own adaptation is sufficient, and `harness/README.md` already documents
  serial fallback as acceptable.
- **Telemetry transport** (SSE/SQLite vs OTel/JSONL) — two capture scripts behind one emit
  schema; see `Telemetry-Hooks.md`. Abstracting the transports themselves buys nothing.
- **TUI ergonomics, cost display, model pickers** — irrelevant to correctness.

Rejected alternatives and why are recorded in `DECISIONS.md`.

---

## Part 2 — Model routing design (Task 4)

### How a phase declares its tier

Phases are entered through commands — that is already the framework's shape — so **the command
is the routing unit** and the declaration lives in one new file:

```yaml
# playbook/model-tiers.yml
version: 1
tiers:            # resolved per harness by the generator
  frontier:
    opencode: "anthropic/claude-fable-5"     # examples — teams substitute
    claude-code: "fable"
  standard:
    opencode: "anthropic/claude-sonnet-5"
    claude-code: "sonnet"
  economy:
    opencode: "anthropic/claude-haiku-4-5"
    claude-code: "haiku"

commands:         # phase → tier (see mapping table below)
  feature-plan: frontier
  implement: standard
  verify: standard
  fix: standard
  analyze-fix: frontier
  # ...
agents:
  verifier: standard
  builder: standard      # new subagent type for /implement waves — see note
subagent_default: inherit
escalation:
  fix: {after_attempts: 2, tier: frontier}   # advisory; see "Escalation" below
```

The generator stamps the resolved model into frontmatter at install time. No phase file, gate,
or command body changes — the declaration is config layered *onto* the framework, which is the
wrapping-not-redesigning test passing.

### Honouring it in OpenCode — fully native

Verified chain (matrix row b): command frontmatter `model:` has the **highest** precedence —
above the TUI selection — and with `subtask: true` is scoped entirely to the child session
(`packages/opencode/src/session/prompt.ts:1411-1419`, `:1439-1458`). Agent frontmatter `model:`
governs subagents spawned via `task` (`packages/opencode/src/tool/task.ts:181-184`).

So per-phase routing in OpenCode is: stamp `model:` into each command file, stamp `model:` into
`verifier.md`. Done — the harness does the rest, including mixed-model transcripts in one
session.

One genuine gap: `/implement`'s wave sub-agents currently go through the default `general`
subagent, which **inherits the parent's model**. If the orchestrator runs frontier, every wave
worker silently runs frontier too — the exact cost leak this project exists to stop. The fix
that stays inside the wrapping constraint: the generator emits a `builder` subagent
(`mode: subagent`, `model: <standard>`, prompt: "implement exactly the checklist slice you are
given…") and the vocabulary preamble tells the orchestrator to spawn `builder` for wave work.
Command wave logic is untouched.

### Honouring it in Claude Code — honest constraints

Per-command `model:` frontmatter is **UNVERIFIED** in Claude Code (matrix row b). Do not design
on it. The real options, in recommended order:

1. **Session-per-phase routing (primary).** The framework *already* mandates "Chat: fresh" for
   phases 1, 3, 5, 9 — phase boundaries and session boundaries coincide by design. Launch each
   phase as `claude --model <tier-model>` (or `/model` before the command; both verified). The
   generator emits a phase-launcher note (or thin `playbook <phase>` wrapper script) so the
   tier choice is mechanical, not remembered.
2. **Subagents as the routing unit (secondary, composes with 1).** `verifier` and `builder`
   subagents carry `model:` frontmatter (verified), so `/verify`'s independence and its tier
   come from the same mechanism, and `/implement`'s waves get standard-tier workers even when
   the session runs frontier.
3. **Accept the residual:** the orchestrator's own turns (wave planning, aggregation) run on
   whatever the session model is. With option 1 that session is already tiered per phase, so
   the residual is zero except when a user chains phases in one chat against the framework's
   own advice.

If the `model:` command-frontmatter capability turns out to exist (one 5-minute test verifies
it), option 1's launcher collapses into stamped frontmatter and the two harnesses become
symmetric. The design works either way — that is why the tier map, not the mechanism, is the
contract.

### Starting tier mapping (and where I push back on the hypothesis)

| Phase / command | Tier | One-line justification |
|---|---|---|
| P1 `/feature-plan` | **frontier** | Spec synthesis + enforced elicitation; an error here is the most expensive in the lifecycle (Phase 2's own 2-minutes-vs-hours argument). |
| P1 `/upgrade-docs`, `/add-doc`, `/refresh-doc` | standard | Deriving docs from existing code is constrained transformation, not open design. |
| P2 Plan-review gate | **none** | Human gate; no model turns at all. |
| P3 `/implement` (orchestrator) | standard | Wave planning is mechanical decomposition of an explicit, seven-field checklist — the hard thinking already happened in P1. *(Hypothesis challenged: I put the orchestrator lower than "planning needs frontier" might suggest — its planning is derivative.)* |
| P3 wave workers (`builder`) | standard | Scoped .NET/React implementation against exact acceptance criteria. **Not economy**: silent code-quality misses here multiply /verify+/fix loop cost, which swamps the token saving. |
| P4 self-review | standard | Same session as P3; running builds/curl/SQL checks is command-following. |
| P5 `/verify` (verifier + sub-verifiers) | standard | Each item's Verify field prescribes the method; evidence-gathering is procedural. The anti-excuse discipline is carried by the guardrail + prompt, not model size. First candidate to *bump* if code-audit verdict quality drops — watch telemetry. |
| P5 build/test-gate sub-verifier | economy | "Run build, report output" — pure execution and transcription. |
| P6 verification-results gate | **none / deterministic** | Verdicts already sit inline in the checklist; routing on them should be a parser script, not a model. *(Extends the hypothesis: today this gate is prose-driven; making it a script is the cheapest deterministic win.)* |
| P7 `/fix` | standard, **escalate frontier at attempt ≥ 2** | Fixing an item annotated FAIL-with-evidence is targeted; a second FAIL on the same item is the signal the cheap model is out of depth. |
| P8 human acceptance | none | Human gate. |
| P9/P10 `/analyze-fix` | **frontier** | Root cause + "why did the Verifier miss it" + a checklist patch that would have caught it — the deepest cross-artifact reasoning in the framework. |
| `/legacy-audit` | frontier | Discovery over an uncharacterised codebase; unknown-unknowns work. |
| `/create-issue-list`, `/amend-checklist`, `/archive-checklist`, `/update-context`, `/generate-html` | economy | Mechanical formatting/rotation; the commands themselves say "no persona — mechanical task". |

**Where the hypothesis holds:** planning/architecture → frontier: yes. Gates deterministic:
yes, and P6 should become *actually* deterministic. **Where it needs a correction:** "test
generation doesn't need frontier" — in this framework the Verifier *writes integration probes
against a live environment and diagnoses their failures*; that is standard-tier work, not
economy, and misclassifying it corrupts the verdicts everything downstream trusts. And
"refactoring/scaffolding don't need frontier" is right, but the money is not in the
orchestrator's turns — it is in the wave workers, which today silently inherit the parent
model. The `builder` subagent is the single highest-leverage change in this whole design.

### Escalation

Keep it dumb and visible: the attempt counter already exists in the framework's own data (the
`## Verifier Run Log` accrues one entry per run; a FAIL item's history is inline). The
escalation rule is applied by whoever launches `/fix` — human or launcher script — reading
attempt count from the checklist, not by a runtime router. An automatic in-flight escalator
(OpenCode `chat.message` model mutation) exists but is undocumented API; noted as a future
option, not part of this design.
