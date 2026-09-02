# Model Routing Guide — run cheap phases on cheap models

**Audience:** anyone operating the playbook — team lead setting defaults, engineer running phases. **TL;DR:** every command and agent declares a model *tier*; one YAML file maps tiers to real models; one command (`node scripts/playbook-routing.mjs`) turns it on/off and changes the map. **Routing ships OFF** — until you run `on`, every phase uses your session model. **Design rationale and source evidence:** [`Adapter-Design.md`](Adapter-Design.md) · **capture of what actually ran:** [`Telemetry-Guide.md`](Telemetry-Guide.md).

## 1. The problem this solves

Without routing, `/feature-plan` (where a wrong decision poisons every later phase) and `/archive-checklist` (mechanical file rotation) run on the same model at the same price. Over a project's life the mechanical commands plus the builder wave-workers dominate token spend, while the genuinely hard thinking is a handful of runs. Routing assigns each command and agent one of three tiers:

| Tier | Mental model | Default OpenCode model |
|---|---|---|
| `frontier` | Costliest place to be wrong — spec synthesis, root-cause reasoning, discovery | `anthropic/claude-opus-5` |
| `standard` | Everyday competent execution — building, verifying, fixing | `anthropic/claude-sonnet-5` |
| `economy` | Mechanical transcription and rotation | `anthropic/claude-haiku-4-5` |

The defaults are working values — substitute your own provider/models (§5.4). Nothing is stamped until routing is turned on (§5.1).

## 2. The complete map — commands

The single source of truth is [`playbook/model-tiers.yml`](../playbook/model-tiers.yml). The shipped assignments and the reasoning behind each:

| Command | Phase | Tier | Why |
|---|---|---|---|
| `feature-plan` | P1 | frontier | Spec synthesis — the costliest place to be wrong |
| `analyze-fix` | P9/P10 | frontier | Root-cause and verification-gap reasoning |
| `legacy-audit` | — | frontier | Discovery over uncharacterised code |
| `upgrade-docs` | P1 alt | standard | Constrained document transformation |
| `add-doc` / `refresh-doc` | — | standard | Derive/reconcile docs against real code |
| `implement` | P3 | standard | Wave planning over an explicit checklist — the judgement already lives in the spec |
| `verify` | P5 | standard | Prescriptive evidence gathering; the gates themselves are deterministic |
| `fix` | P7 | standard | Targeted fixes — with escalation to frontier after repeated failures (§4) |
| `log-miss` | between phases | standard | One-line closed-vocabulary classification; reasoning, but no app boot or implementation |
| `create-issue-list` | — | economy | Tracker-to-markdown transcription |
| `amend-checklist` / `archive-checklist` | — | economy | Mechanical in-place edits / rotation |
| `update-context` / `generate-html` | — | economy | Mechanical sync / conversion |

## 3. The complete map — agents

Command tier outranks agent tier because OpenCode gives command `model:` frontmatter precedence. Agent tiers are the *fallback* for anything that reaches an agent without going through a tier-stamped command — and they are what the wave workers inherit:

| Agent | Tier | Why |
|---|---|---|
| `analyst` | frontier | Owns the P1 elicitation — same reasoning depth as `feature-plan` |
| `orchestrator` | standard | Coordinates waves; the expensive judgement is already in the plan |
| `builder` | standard | **The big leak plug** — `/implement` and `/fix` spawn many builder subagents, and without a stamp each one runs on whatever the session uses. Standard, not economy, deliberately: a cheap builder that ships broken work costs a full verify → fix cycle, which dwarfs the per-token saving. |
| `verifier` | standard | Evidence gathering plus judgement on what the evidence means |
| your default chat | **never routed** | Routing stamps the playbook's commands and named agents only — your day-to-day conversation stays on the model you picked |

### Use linked miss rate as the quality signal

Attempt count says how often a phase repeated; the durable miss stream says what escaped it.
Review both by observed `tier` **and** `model`:

```text
linked miss rate = linked misses attributed to tier/model
                   ÷ eligible completed phase runs on that tier/model
```

Only records with `origin_confidence: "linked"` and a non-null observed model belong in this
rate. Exclude `inferred` and `unknown` from both numerator and model/tier attribution—placing
them in an “unknown model” bucket would turn missing provenance into a model result. Segment
the numerator by `miss_class`, `why_missed` and escape source so a cheap builder defect is not
confused with a weak Verify method.

Keep economics equally honest: compare measured cost per repaired miss using
`cost_attribution: "sole"` only. Show `shared:<n>` equal apportionments in a separate labelled
series and keep `none` out of cost denominators. A tier is a false economy when its lower phase
cost is outweighed by a higher linked miss rate and sole-attributed rework cost.

## 4. Escalation — when standard isn't cutting it

`model-tiers.yml` carries an advisory escalation policy:

```yaml
escalation:
  fix:
    after_attempts: 2
    tier: frontier
```

Meaning: if a checklist item's Run Log shows two failed fix attempts, launch the third `/fix` on the frontier tier. It is **advisory** — applied by whoever launches the command (human or wrapper script) by reading the attempt history from the checklist Run Log; nothing switches models mid-run automatically. The telemetry records (`attempt`, `tier`, `model` per phase — [`Telemetry-Guide.md`](Telemetry-Guide.md)) are how you tune the threshold.

## 5. Operating routing — one command, every case

Everything goes through **`node scripts/playbook-routing.mjs <verb>`** (alias: `npm run routing -- <verb>`). Each verb edits [`playbook/model-tiers.yml`](../playbook/model-tiers.yml) in place — comments preserved — and immediately re-applies it to the harness files, so the map and the `model:` stamps can never disagree. Every verb is idempotent; run it as often as you like. (`node scripts/apply-model-tiers.mjs` still works underneath; `--check` and `--print` are unchanged.)

### 5.1 Turning it on and off

Routing ships **OFF**. Off means: no harness file carries a `model:` stamp and every phase runs on whatever model your session has. The map stays in the file, dormant.

```bash
node scripts/playbook-routing.mjs status     # read-only: what routing is / would be doing
node scripts/playbook-routing.mjs on         # stamps model: into harness/opencode/{command,agent}/*.md
node scripts/playbook-routing.mjs off        # removes exactly those stamps — fully reversible
```

After `on` you keep typing the same commands (`/verify`, `/implement`, …); they now execute on their tier's model. Your default chat is never routed (§3).

### 5.2 Seeing what is going on — `status`

```
$ node scripts/playbook-routing.mjs status
Routing: OFF   (model: stamps on disk: 0/19 mapped files)

Tier models:
  frontier  opencode: anthropic/claude-opus-5
  standard  opencode: anthropic/claude-sonnet-5
  economy   opencode: anthropic/claude-haiku-4-5

Commands by tier:
  frontier  analyze-fix, feature-plan, legacy-audit
  standard  add-doc, fix, implement, log-miss, refresh-doc, upgrade-docs, verify
  economy   amend-checklist, archive-checklist, create-issue-list, generate-html, update-context
Agents:    analyst=frontier, builder=standard, orchestrator=standard, verifier=standard

Escalation (ADVISORY — applied by whoever launches the command; nothing switches a model mid-run):
  fix                after 2 attempt(s) -> launch the next /fix on frontier (base tier: standard)
  ...

Every phase runs on the session model. Turn on with:  node scripts/playbook-routing.mjs on
```

If the flag and the stamps on disk disagree (someone hand-edited a file, or the map, without re-applying) `status` says so and tells you to run `bind`.

### 5.3 Moving a command or agent between tiers

```bash
# verify feels over-modeled on a stable repo → try economy (watch the fix-rate!):
node scripts/playbook-routing.mjs set-tier verify economy

# test the "cheap builders" hypothesis — see §3 for why the default is standard:
node scripts/playbook-routing.mjs set-tier builder economy

# take one command out of routing entirely (runs on the session model again):
node scripts/playbook-routing.mjs set-tier generate-html inherit
```

The name must already exist under `commands:` or `agents:` in the map — the script tells you the valid names if it doesn't.

### 5.4 Changing which OpenCode model a tier means

```bash
# your shop uses a different provider for the everyday tier:
node scripts/playbook-routing.mjs set-model standard opencode myprovider/my-model
# zero-cost experiments on OpenCode's free models:
node scripts/playbook-routing.mjs set-model economy opencode opencode/hy3-free
```

OpenCode ids are `provider/model` — list what your account offers with `opencode models`. The
default `anthropic/claude-*` values are Anthropic models selected through OpenCode.

### 5.5 Escalation — when the base tier isn't cutting it

```bash
node scripts/playbook-routing.mjs set-escalation fix 2 frontier      # after 2 fix attempts, launch the 3rd on frontier
node scripts/playbook-routing.mjs set-escalation verify 3 frontier   # add a policy for another command
```

Escalation is **advisory** (§4): it changes nothing on disk except the map — you apply it when you launch the command, reading the attempt count from the checklist Run Log (it is also the `attempt` field in every telemetry record). `status` lists the current policies.

### 5.6 Edited the map by hand? — `bind`

```bash
node scripts/playbook-routing.mjs bind               # re-apply whatever model-tiers.yml now says
node scripts/apply-model-tiers.mjs --check           # CI: prove stamps, map and the on/off flag agree
```

## 6. How it works, and how you see it

**Mechanism (deliberately boring):** `playbook-routing.mjs` edits the map and calls `apply-model-tiers.mjs`, which writes a `model:` field into the YAML frontmatter of `harness/opencode/command/*.md` and `harness/opencode/agent/*.md` when `enabled: true` — and removes it when `enabled: false`. Command frontmatter has the highest model precedence in OpenCode. There is no runtime layer — what you stamped is what runs.

**Where you see it:**

- Running a command — the OpenCode footer shows the run executing on the command's model, not your chat model.
- `node scripts/apply-model-tiers.mjs --check` — proves stamps and map agree.
- The telemetry — each per-phase record carries the observed `model` and its reverse-mapped `tier` ([`Telemetry-Guide.md`](Telemetry-Guide.md)), which is how you catch drift and judge the map with data.

**OpenCode session behavior worth knowing:** after a stamped command finishes, that session's next plain message *continues on the command's model* — it does not bounce back to your selection. Re-pick your model from the model list (or start a new session) if you keep chatting after an economy command.

## 7. Troubleshooting

| Symptom | Cause → fix |
|---|---|
| "I ran `on` and my chat model didn't change" | Correct — your default chat is never routed (§3). Run a playbook command to see routing. |
| "I changed the map and nothing happened" | Routing is OFF (the default) — `status` shows it; run `node scripts/playbook-routing.mjs on` |
| `--check` fails in CI / `status` says "disagree" | Someone edited a command file's `model:` by hand, or edited the map without re-applying → `node scripts/playbook-routing.mjs bind` |
| A phase ran on the wrong model | It was invoked outside a stamped command, or the map changed without `bind` → §5.6 |
| Follow-up chat runs on the command's model (OpenCode) | Verified behavior (§6) — re-pick your model or start a new session |
| Fix keeps failing on standard | That's what escalation is for (§4) — relaunch on frontier after `after_attempts`; tune with `set-escalation` (§5.5) |
| Misses appear under an unknown/inferred model | Expected when the origin event window has rotated or capture was unavailable. Exclude these from per-tier/model miss rates; do not guess attribution. |
| "Which models can I even use?" | Run `opencode models`. |
