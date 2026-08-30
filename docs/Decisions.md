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
  disagreement it finds. The Claude Code generator reads the same flag, so the pack cannot
  carry stamps the OpenCode side doesn't.

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

### Decision 1 — YOLO is a mode with one env flag and two prompt triggers

`PLAYBOOK_YOLO=1` is the mechanical switch (hooks cannot see the conversation); the token
`YOLO` in a command's arguments or an active Claude Code `/goal` is the prompt-level switch.
The standing rules (`AGENTS.md` → "YOLO mode") define what the mode means once, for both
harnesses; the command bodies only annotate their gates ("YOLO mode: proceed immediately").

### Decision 2 — the bypass is mechanical, shared, and has exactly one exception

Same pattern as the guardrail: one pure policy (`yolo-policy.mjs`) and two thin carriers —
`yolo.ts` (`permission.ask` + `tool.execute.before` + `session.error`) for OpenCode,
`yolo-hook.mjs` (PreToolUse `permissionDecision: allow` / exit 2, PermissionRequest
`decision`) for Claude Code. Everything is allowed except git history / index / ref writes
and `gh` publishes, which are denied with the AGENTS.md reason. Unknown git subcommands fail
closed. Without the env flag both carriers are no-ops. Rejected: relying on
`--dangerously-skip-permissions` / `--auto` alone — those remove the prompts but also the
one rule that must survive (no commits), and do nothing about in-prompt gates.

### Decision 3 — usage limits are handled outside the agent, by a supervisor

Once the provider says "limit reached" the agent process is finished; only something outside
it can wait and resume. `scripts/playbook-yolo.mjs` runs the harness headless
(`claude -p … --resume` / `opencode run --session …`), recognises limit text in the output
(or the plugin's `rate-limit.json`), parses the reset time in every shape the harnesses and
the API emit, adds a 15-minute buffer, sleeps, and resumes the same session. The agent
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

- New: `harness/opencode/plugin/{yolo.ts,yolo-policy.mjs}`, `harness/claude-code/hooks/yolo-hook.mjs`,
  `scripts/playbook-yolo.mjs`, `docs/YOLO-Mode-Guide.md`; `opencode.json` registers `yolo.ts`
  after `spec-guardrails.ts` (order checked by the validator); the Claude Code pack generator
  emits both hook registrations and copies the policy; `test-guardrails.mjs` covers git-write
  denial, allow-list, limit parsing and sentinels.
- Unchanged: the guardrail, verifier write scope, verdict tiers, secrets rules, and "agents
  never commit" — now enforced mechanically in YOLO instead of by prose.

## 2026-08-29 — Durable miss telemetry

**Status:** implemented and independently verified in the working tree. Two fresh-context,
read-only audits covered lifecycle and provenance semantics, concurrent session accounting,
harness parity, privacy boundaries and installer delivery. Repository validation, 16 focused miss
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
