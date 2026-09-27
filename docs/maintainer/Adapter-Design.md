# Adapter Boundary and Model Routing Design

Covers the OpenCode packaging boundary and model-routing design. Depends on
`Capability-Matrix.md` rows (b), (c), and (f), plus `Coupling-Points.md`.

---

## Part 1 — The adapter boundary (Task 3)

### The decision: install-time packaging, not a runtime abstraction

The framework's OpenCode dependencies are packaging concerns: Markdown commands with
`$ARGUMENTS`, subagents with per-subagent models, plugins that can abort a tool call and feed
the error text back to the model, and automatic loading of a root context file. File
locations, frontmatter, and plugin registration are resolved once at install time; nothing
needs to sit between the model and OpenCode at runtime.

The installer reads the canonical OpenCode source tree and emits the project-local pack.
This respects the hard constraint: phase logic, gates, the Verifier, and the command library
remain canonical inputs rather than runtime-generated behavior.

### What the installer owns

| Concern | OpenCode emission |
|---|---|
| Command packaging | `.opencode/command/<name>.md`, frontmatter `description` / `agent` / `subtask` / **`model`** (stamped from the tier map, Part 2) |
| Agent packaging | `.opencode/agent/*.md` (`mode`, `permission`, `temperature`, **`model`**) |
| Standing rules wiring | `AGENTS.md` at the repository root |
| Guardrail carrier | TS plugins registered in `opencode.json` (`tool.execute.before` + throw) |
| Guardrail **policy** | Shared pure policy modules consumed by the OpenCode plugin carriers |
| MCP registration | `opencode.json` `mcp` key with `{env:PLAYWRIGHT_MCP_URL}` syntax |
| Instruction/profile injection | `opencode.json` `instructions: []` |
| Tier → model resolution | `playbook/model-tiers.yml` → concrete `provider/model` strings stamped into command/agent frontmatter |
| Install validation | `playbook-validate.mjs` asserts that the emitted OpenCode pack is complete |

### What stays in framework code (the generator never touches it)

- The ten phase documents, the gate semantics, the verdict vocabulary
  (`PASS`/`FAIL`/`PASS (code-audit)`/…), the checklist item format, the Status Table and Run
  Log contracts.
- Every command **body** and the 1,050-line Verifier prompt — they are already
  harness-portable prose. The only tolerated in-body divergence is a two-line "tool
  vocabulary" guidance needed for OpenCode's `task` tool; command text is not forked.
- `playbook/environment-profile.yml`, handoff templates, the HTML doc shell.
- `AGENTS.md` content.

### Deliberately left OpenCode-native

- **Permission dialect.** OpenCode's wildcard/arity `permission` maps remain native. The
  installer emits the coarse per-agent scopes used by the framework (`edit/write/bash
  allow|deny`); teams tune additional permissions directly. The load-bearing write-scope
  rule lives in the guardrail policy.
- **Session mechanics** — resume, compaction, child-session UX, "restart after config
  change". These never cross the framework's contract surface; phase docs already say only
  "Chat: fresh".
- **Parallelism mechanics.** OpenCode's `task` tool is the native delegation mechanism, and
  `harness/README.md` documents serial fallback as acceptable.
- **Telemetry transport.** OpenCode's event and SQLite sources feed one emit schema; see
  `Telemetry-Hooks.md`. Abstracting the transport itself buys nothing.
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
tiers:
  frontier:
    opencode: "anthropic/claude-fable-5"     # examples — teams substitute
  standard:
    opencode: "anthropic/claude-sonnet-5"
  economy:
    opencode: "anthropic/claude-haiku-4-5"

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

### Operational routing constraints

The framework mandates fresh chats for phases 1, 3, 5, and 9, while command frontmatter gives
each phase its declared model. `verifier` and `builder` subagents also carry model frontmatter,
so verification independence and wave-worker cost control use the same native mechanism.
The orchestrator's own turns use the command-selected model; child sessions use their agent's
configured model or inherit only when no model is configured. The tier map remains the routing
contract and generated frontmatter remains its mechanical enforcement.

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
