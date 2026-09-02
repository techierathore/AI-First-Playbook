# Decision Log

## 2026-08-20 — Adapter boundary and per-phase model routing

**Status:** implemented and verified (same day). `playbook/model-tiers.yml` + `scripts/apply-model-tiers.mjs` stamp models in place and pass `--check`; `harness/opencode/plugin/telemetry.ts` + `scripts/playbook-telemetry.mjs` produce per-phase records; guardrail tests and repository validation are green; harness and project-local OpenCode plugin copies are in sync. Operator guides added: `docs/Model-Routing-Guide.md`, `docs/Telemetry-Guide.md`.
**Inputs:** `Capability-Matrix.md`, `Coupling-Points.md`, `Adapter-Design.md`,
`Telemetry-Hooks.md` (all this date)

### Decision 1 — OpenCode packaging is install-time, not a runtime layer

The installer reads the canonical framework sources unchanged and emits the OpenCode pack:
command and agent files, `AGENTS.md` standing-rule wiring, TypeScript guardrail plugins, MCP
registration, and tier-resolved model stamps. Phase logic, gates, the Verifier prompt, and
command bodies remain canonical inputs—the wrapping-not-redesigning constraint holds.

**Alternatives rejected:**

- **Runtime adapter / proxy daemon between the framework and the harness.** Rejected: every
  "breaks" coupling turned out to be packaging (frontmatter dialects, file locations, hook
  carriers), not runtime behaviour. A daemon adds a failure mode, an install dependency, and a
  second thing to debug, and buys nothing the generator doesn't.
- **LLM gateway as the routing layer** (route by model alias at the HTTP layer). Rejected for
  routing: the gateway cannot see phase boundaries — the harness can, natively, via
  command/agent/session model selection. (A gateway remains the right answer for the
  *NTLM-proxy* problem in `OpenCode-Guide.md`, which is unrelated.)
- **Forking the command library between source and installed copies.** Rejected: duplicated
  hand-maintained prose drifts; installation preserves canonical command bodies.
- **Abstracting OpenCode permissions behind a new runtime layer.** Deliberately out of scope:
  native wildcard/arity maps remain visible, and the load-bearing write-scope rule lives in
  the shared guardrail policy.

### Decision 2 — routing approach: tier map as the contract; native OpenCode mechanisms

Phases declare tiers in `playbook/model-tiers.yml` (frontier / standard / economy / none).
In **OpenCode**, the generator stamps `model:` into command frontmatter (verified
highest-precedence override — `packages/opencode/src/session/prompt.ts:1411-1419`) and agent
frontmatter (verified subagent resolution — `packages/opencode/src/tool/task.ts:181-184`).
A new `builder` subagent with an explicit standard-tier model closes the biggest cost leak:
wave workers inheriting the orchestrator's frontier model.

**Alternatives rejected:**

- **Per-tool-call routing.** OpenCode does not expose it. The design does not depend on it.
- **A runtime auto-escalator via OpenCode's `chat.message` model mutation.** It works
  structurally (the hook's mutated message is what the loop reads), but it is undocumented
  API. Escalation is instead applied at `/fix` launch time from the checklist's own attempt
  history—dumb and visible.
- **Session-level routing only (the "accept it" option).** Rejected as the *primary* design
  because OpenCode natively offers better, and taking it would leave sub-agent inheritance
  leaking frontier tokens.

### Consequences

- Two small new artifacts (`model-tiers.yml`, the generator) and one new subagent; zero edits
  to phases/gates/Verifier logic.
- The framework becomes testable after installation through `playbook-validate.mjs`.
- Telemetry splits into OpenCode-sourced fields (model, tokens) and framework-sourced fields
  (phase, attempt, verdict)—the latter parsed from the checklist, immune to runtime churn.
- Open verification items before implementation: (a) does OpenCode expand `${VAR}` in `mcp`
  config or only `{env:VAR}` (`Coupling-Points.md` item 9); (b) does the historical bun large-file
  crash reproduce in current OpenCode under WSL (`OpenCode-Guide.md` §1.3).

## 2026-08-20 (later) — verification outcomes and implementation

**Status:** implemented (working tree; commit pending owner review)

Both OpenCode items were tested the same day:

- **(a) CONFIRMED DEFECT, FIXED.** OpenCode substitutes only `{env:VAR}` / `{file:path}`
  (`packages/opencode/src/config/variable.ts:33-38`); `${PLAYWRIGHT_MCP_URL}` passed through
  as a literal. `opencode.json` now uses `{env:PLAYWRIGHT_MCP_URL}`.
- **(b) PASSED (proxy test).** OpenCode 1.18.18 as the **Windows** binary — the originally
  crashing configuration — read a 19.4 MB markdown checklist via a free-tier model without
  any bun error; the streaming read caps handled it. Caveat: not the original office
  workload; §1.3's acceptance test against the real workload still applies before
  decommissioning the container.

Implemented in this pass: `playbook/model-tiers.yml` + `scripts/apply-model-tiers.mjs`
(all 14 commands + 5 agents stamped for OpenCode); `builder` subagent
(`harness/opencode/agent/builder.md`, wired into `/implement` and `/fix` wave instructions);
shared guardrail policy (`harness/opencode/plugin/write-policy.mjs`) consumed by the OpenCode
plugin; telemetry plugin
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

## 2026-08-21 — Routing gets a master switch and a one-command front end

**Status:** implemented and verified (same day). `playbook/model-tiers.yml` carries `enabled: false`;
`scripts/playbook-routing.mjs` (`status | on | off | set-tier | set-model | set-escalation | bind`)
edits the map in place and re-applies it; `scripts/apply-model-tiers.mjs` honours the flag and is
importable (`applyTiers()`), its CLI unchanged. Round-trip verified: `off` strips all 22 stamps,
`on` reproduces them byte-for-byte, both idempotent; `--check` and `playbook-validate` green.
Ported from TechieFlow's `tf-routing.sh` / `tf-routing-bind.sh`.

### Decision — routing is OFF by default and fully reversible

Until now the tier map was always in force: the shipped `harness/` files carried `model:`
stamps, so installing the playbook silently pinned every phase to Anthropic model ids. That
is the wrong default for a team edition — a new team's first experience should be "the phases
run on the model I picked", with routing something they *turn on* once they have a provider
mapping they trust. So:

- `enabled: false` is the shipped state and `off` is not "don't stamp" but "**remove** every
  stamp" — the 22 mapped files end up with no `model:` field at all, identical to a repo that
  never had routing. Reversibility is what makes the switch safe to flip during a pilot.
- The map stays in the file while off (dormant, not deleted), so `status` still shows what
  `on` would do, and a tier of `inherit` opts a single command out while the rest stays routed.
- One script owns every edit. The old workflow (hand-edit YAML, then remember to re-apply) is
  exactly how flag and stamps drift apart; every verb re-applies, and `status` reports any
  disagreement it finds. The installed OpenCode pack therefore cannot carry stamps that
  disagree with the tier map.

**Alternatives rejected:**

- **Stamp-on-install, leave it to the team to delete lines.** Rejected: 22 hand edits across
  two directories to undo a default nobody chose, and no way to prove it was fully undone.
- **A runtime toggle (env var read by the plugin).** Rejected: there is no runtime layer —
  routing is frontmatter the harness reads at load — and inventing one just to carry a boolean
  re-opens the runtime-adapter decision of 2026-08-20.
- **Separate "routing profile" files swapped in and out.** Rejected: two files to keep in sync
  is the drift problem again; an in-place flag plus an idempotent apply is smaller.

**Consequence:** teams upgrading from the 2026-08-20 state will see their stamps removed on the
first `bind`/`off`; run `node scripts/playbook-routing.mjs on` to restore the prior behaviour.


## 2026-08-21 (later) — YOLO mode: unattended runs, mechanical permission bypass, limit-aware restarts

**Context.** An end-to-end goal run on a real codebase took three days instead of one
evening: the harness stopped for permissions the human had already granted in spirit
(delete a folder, read git), the command prompts stopped for in-prompt approvals
("Proceed?", "Approve the smoke test?"), the provider's 5-hour / weekly usage limit killed
the session with nobody there to restart it, and `/implement` repeatedly finished a subset
of items and handed back "run the build phase again for the rest".

### Decision 1 — YOLO is a mode with one env flag and a prompt trigger

`PLAYBOOK_YOLO=1` is the mechanical switch (plugins cannot see the conversation); the token
`YOLO` in a command's arguments is the prompt-level switch. The standing rules (`AGENTS.md` →
"YOLO mode") define what the mode means once; command bodies only annotate their gates
("YOLO mode: proceed immediately").

### Decision 2 — the bypass is mechanical, shared, and has exactly one exception

Same pattern as the guardrail: one pure policy (`yolo-policy.mjs`) and one thin OpenCode carrier,
`yolo.ts` (`permission.ask` + `tool.execute.before` + `session.error`). Everything is allowed
except git history / index / ref writes and `gh` publishes, which are denied with the AGENTS.md
reason. Unknown git subcommands fail closed. Without the env flag the carrier is a no-op.
Rejected: relying on `--auto` alone—it removes prompts but not the one rule that must survive
(no commits), and does nothing about in-prompt gates.

### Decision 3 — usage limits are handled outside the agent, by a supervisor

Once the provider says "limit reached" the agent process is finished; only something outside
it can wait and resume. `scripts/playbook-yolo.mjs` runs OpenCode headless
(`opencode run --session …`), recognises limit text in the output or the plugin's
`rate-limit.json`, parses the reset time in every shape the provider API emits, adds a
15-minute buffer, sleeps, and resumes the same session. The agent
signals the end with a sentinel line (`PLAYBOOK_RUN_COMPLETE` / `PLAYBOOK_RUN_BLOCKED`) so a
pause cannot be mistaken for completion; runs that end without one are nudged on, then
given up after eight consecutive tries. State is persisted so a VM reboot can `resume`.

### Decision 4 — the build phase has a completion contract, independent of YOLO

`/implement` (and `/fix` for its FAIL set) ends only when every item in scope is to-verify
or carries an external-blocker tag; "run again for the remaining items" is named a
violation, and the "When done" section now begins with a completion check that sends the
orchestrator back to wave planning. Context pressure is solved with smaller slices and more
waves, never by handing work back.

### Consequences

- New: `harness/opencode/plugin/{yolo.ts,yolo-policy.mjs}`,
  `scripts/playbook-yolo.mjs`, `docs/YOLO-Mode-Guide.md`; `opencode.json` registers `yolo.ts`
  after `spec-guardrails.ts` (order checked by the validator); `test-guardrails.mjs` covers git-write
  denial, allow-list, limit parsing and sentinels.
- Unchanged: the guardrail, verifier write scope, verdict tiers, secrets rules, and "agents
  never commit" — now enforced mechanically in YOLO instead of by prose.

## 2026-08-29 — Durable miss telemetry

**Status:** implemented and independently verified in the working tree. Two fresh-context,
read-only audits covered lifecycle and provenance semantics, concurrent session accounting,
privacy boundaries and installer delivery. Repository validation, 24 focused miss
tests, guardrail tests, package dry-run and diff checks pass; rollout remains an owner decision.

### Decision 1 — misses use a separate durable stream

Miss lifecycle records append to committed `verification/telemetry/misses.ndjson`.
`verification/telemetry/events.ndjson` remains transient and rotatable because it is high-volume
harness capture. The repository ignores only `/verification/telemetry/events.ndjson`; ignoring
the directory or all NDJSON would destroy durable history. Alternatives rejected: adding miss
kinds to `events.ndjson` (retention semantics conflict) and persisting joined costs into the miss
stream (would mutate history when transient windows disappear or pricing changes).

### Decision 2 — agents classify; emitters and joiners derive facts

An agent may choose closed-vocabulary `miss_class`, artifact, severity, origin/found context and
`why_missed`. It may not author model provenance, confidence, tokens, dollars or cost attribution.
`origin_model`/`origin_confidence` come from an exact origin-window lookup, while fix model,
tier, usage and `sole | shared:<n> | none` attribution are joined from the exact fix window at
read time. A missing window yields null/none, never a plausible estimate. This preserves the
existing “never self-reported numbers” rule: classification is a constrained judgement; usage
and provenance are observations.

### Decision 3 — append-only correction is `miss-amend`

The stream has three kinds from day one: `miss`, `miss-fix`, and `miss-amend`. An amend can
complete a still-null, closed-vocabulary judgement (`why_missed`) and can never overwrite a
value. Observations and derived facts are not amendable. Rejected: editing old lines (breaks
append-only auditability) or leaving pre-schema nulls permanently unclassifiable.

### Decision 4 — backlog and live-defect predicates deliberately diverge

Backlog means latest `verdict_after` is neither `pass` nor `abandoned`; it answers how much work
is outstanding. The `open --if-new` collapse check treats only `pass` as no longer live; an
abandoned defect that appears again is the same defect, not a new record. `deferred` remains open
under both predicates. The two definitions must not be “simplified” into one.

### Decision 5 — `instruction-ignored` is agent-origin only

The seventh `why_missed` value is adopted only for a written instruction that an **agent had
loaded and did not follow**. It must not classify a human's behaviour and must not become a proxy
performance judgement. Human/process gaps use the other causal vocabulary or remain unassessed.

### Decision 6 — actor is aggregate-only

`actor` may support aggregate team/context analysis, but no report, export or dashboard may
group miss, amendment, escape, rework, time or cost figures by actor. “Who amended whom” is also
forbidden. Per-actor reporting would discourage recording and destroy both the data and the
learning loop; closed vocabularies and this reporting ban are the privacy controls for the
committed stream.
