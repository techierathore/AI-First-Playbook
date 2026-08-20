# Model Routing Guide — run cheap phases on cheap models

**Audience:** anyone operating the playbook — team lead setting defaults, engineer running phases. **TL;DR:** every command and agent declares a model *tier*; one YAML file maps tiers to real models; one script applies it everywhere. **Design rationale and source evidence:** [`Adapter-Design.md`](Adapter-Design.md) · **capture of what actually ran:** [`Telemetry-Guide.md`](Telemetry-Guide.md).

## 1. The problem this solves

Without routing, `/feature-plan` (where a wrong decision poisons every later phase) and `/archive-checklist` (mechanical file rotation) run on the same model at the same price. Over a project's life the mechanical commands plus the builder wave-workers dominate token spend, while the genuinely hard thinking is a handful of runs. Routing assigns each command and agent one of three tiers:

| Tier | Mental model | Default OpenCode model | Default Claude Code model |
|---|---|---|---|
| `frontier` | Costliest place to be wrong — spec synthesis, root-cause reasoning, discovery | `anthropic/claude-opus-5` | `opus` |
| `standard` | Everyday competent execution — building, verifying, fixing | `anthropic/claude-sonnet-5` | `sonnet` |
| `economy` | Mechanical transcription and rotation | `anthropic/claude-haiku-4-5` | `haiku` |

The defaults are working values — substitute your own provider/models (§5) and re-apply.

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
| `create-issue-list` | — | economy | Tracker-to-markdown transcription |
| `amend-checklist` / `archive-checklist` | — | economy | Mechanical in-place edits / rotation |
| `update-context` / `generate-html` | — | economy | Mechanical sync / conversion |

## 3. The complete map — agents

Command tier outranks agent tier (in both harnesses the command's `model:` frontmatter wins). Agent tiers are the *fallback* for anything that reaches an agent without going through a tier-stamped command — and they are what the wave workers inherit:

| Agent | Tier | Why |
|---|---|---|
| `analyst` | frontier | Owns the P1 elicitation — same reasoning depth as `feature-plan` |
| `orchestrator` | standard | Coordinates waves; the expensive judgement is already in the plan |
| `builder` | standard | **The big leak plug** — `/implement` and `/fix` spawn many builder subagents, and without a stamp each one runs on whatever the session uses. Standard, not economy, deliberately: a cheap builder that ships broken work costs a full verify → fix cycle, which dwarfs the per-token saving. |
| `verifier` | standard | Evidence gathering plus judgement on what the evidence means |
| your default chat | **never routed** | Routing stamps the playbook's commands and named agents only — your day-to-day conversation stays on the model you picked |

## 4. Escalation — when standard isn't cutting it

`model-tiers.yml` carries an advisory escalation policy:

```yaml
escalation:
  fix:
    after_attempts: 2
    tier: frontier
```

Meaning: if a checklist item's Run Log shows two failed fix attempts, launch the third `/fix` on the frontier tier. It is **advisory** — applied by whoever launches the command (human or wrapper script) by reading the attempt history from the checklist Run Log; nothing switches models mid-run automatically. The telemetry records (`attempt`, `tier`, `model` per phase — [`Telemetry-Guide.md`](Telemetry-Guide.md)) are how you tune the threshold.

## 5. Changing the map — every case

All changes are: edit `playbook/model-tiers.yml`, then re-apply. The apply step is idempotent — run it as often as you like.

```bash
# 1. Change which model a tier means (e.g. your shop uses a different provider):
#    edit playbook/model-tiers.yml →
#      tiers:
#        standard:
#          opencode: "myprovider/my-model"
#          claude-code: "sonnet"
node scripts/apply-model-tiers.mjs                 # stamps harness/opencode frontmatter

# 2. Move a command between tiers (e.g. verify feels over-modeled on a stable repo):
#    edit →  commands:
#              verify: economy
node scripts/apply-model-tiers.mjs

# 3. Move an agent (e.g. test the "cheap builders" hypothesis — watch the fix-rate!):
#    edit →  agents:
#              builder: economy
node scripts/apply-model-tiers.mjs

# 4. Using the Claude Code pack? Regenerate it after ANY tier change:
node scripts/harness-install.mjs claude-code --target=/path/to/project

# 5. Prove the stamps match the map (run this in CI):
node scripts/apply-model-tiers.mjs --check

# 6. See what the map resolves to for a harness without touching anything:
node scripts/apply-model-tiers.mjs --harness=claude-code --print
```

OpenCode model ids are `provider/model` — list what your account offers with `opencode models`. Claude Code accepts the `opus`/`sonnet`/`haiku` aliases or a full model id; the `ANTHROPIC_DEFAULT_{OPUS,SONNET,HAIKU}_MODEL` environment variables re-point the aliases machine-wide.

## 6. How it works, and how you see it

**Mechanism (deliberately boring):** `apply-model-tiers.mjs` writes a `model:` field into the YAML frontmatter of `harness/opencode/command/*.md` and `harness/opencode/agent/*.md`; `harness-install.mjs` does the same for the generated Claude Code pack. Command frontmatter has the highest model precedence in both harnesses. There is no runtime layer — what you stamped is what runs.

**Where you see it:**

- Running a command — the OpenCode footer shows the run executing on the command's model, not your chat model.
- `node scripts/apply-model-tiers.mjs --check` — proves stamps and map agree.
- The telemetry — each per-phase record carries the observed `model` and its reverse-mapped `tier` ([`Telemetry-Guide.md`](Telemetry-Guide.md)), which is how you catch drift and judge the map with data.

**Two session behaviors worth knowing** (verified empirically on OpenCode 1.18.x and Claude Code 2.1.x):

1. **OpenCode: the command's model sticks.** After a stamped command finishes, that session's next plain message *continues on the command's model* — it does not bounce back to your selection. Re-pick your model from the model list (or start a new session) if you keep chatting after an economy command.
2. **Claude Code: turn-scoped.** A stamped command runs its whole turn on the tier model; your next prompt reverts to the session model automatically.

## 7. Troubleshooting

| Symptom | Cause → fix |
|---|---|
| "I applied tiers and my chat model didn't change" | Correct — your default chat is never routed (§3). Run a playbook command to see routing. |
| `--check` fails in CI | Someone edited a command file's `model:` by hand, or edited the map without re-applying → `node scripts/apply-model-tiers.mjs` |
| A phase ran on the wrong model | Invoked outside a stamped command (typed at the raw agent), or the Claude pack wasn't regenerated after a map change → §5 step 4 |
| Follow-up chat runs on the command's model (OpenCode) | Verified behavior (§6) — re-pick your model or start a new session |
| Fix keeps failing on standard | That's what escalation is for (§4) — relaunch on frontier after `after_attempts` |
| "Which models can I even use?" | `opencode models` (OpenCode) · alias envs or full ids (Claude Code) |
