# The Command Library

Thirteen commands: **four carry the daily loop**, nine support it. Each has a spec file
here — and a **runnable counterpart** in
[`harness/opencode/command/`](../../harness/opencode/command/), which is the actual file
the harness loads. Read the specs here to understand the process; install from `harness/`.

Every command is a markdown file in the harness's command directory; custom commands
activate a persona by prompt instruction, except `/verify`, which targets the native
Verifier agent directly.

Two universal rules:

1. **Every command accepts file paths (`@` prefix) + free-form instructions** — both
   matter equally.
2. **Commands demand their inputs.** A command that is missing context ASKs; it never
   guesses.

## Daily commands

| Command | Persona | Purpose |
|---|---|---|
| [`/feature-plan`](feature-plan.md) | Analyst | Plan a new feature — produce the full verifiable document set |
| [`/implement`](implement.md) | Orchestrator | Build from the checklist with parallel sub-agents + build/smoke self-check |
| [`/verify`](verify.md) | **Verifier (native agent)** | Independent execution-based audit; PASS/FAIL inline in the checklist |
| [`/fix`](fix.md) | Orchestrator | Fix FAIL-annotated items only; loop with `/verify` |
| [`/analyze-fix`](analyze-fix.md) | Analyst | Fold a bug report / user story / spotted gap into the existing checklist with root-cause analysis |
| [`/add-doc`](add-doc.md) | Analyst | Build the Developer-Flow-Guide and/or Business-Verification-Reference **from the running code** |
| [`/create-issue-list`](create-issue-list.md) | Analyst | Pull Jira tickets into a structured transient Issues file |
| [`/generate-html`](generate-html.md) | none (mechanical) | Render human docs to standalone HTML via the doc-shell template |
| [`/amend-checklist`](amend-checklist.md) | none (mechanical) | Surgical checklist edit when you know exactly what to add |

## Admin commands (process-owner, not daily)

| Command | Persona | Purpose |
|---|---|---|
| [`/upgrade-docs`](upgrade-docs.md) | Analyst | One-time: convert legacy docs to the verifiable format |
| [`/refresh-doc`](refresh-doc.md) | Analyst | Re-sync docs with the current code (Mode A: shared docs; Mode B: whole feature) |
| [`/archive-checklist`](archive-checklist.md) | none | Rotate PASS items into Verified History past ~2,000 lines |
| [`/update-context`](update-context.md) | none | Keep the cold-start Context-Prompt current |

## Token-cost cheat sheet (🟢 low · 🟡 medium · 🔴 high)

| Command | Cost | Main lever |
|---|---|---|
| `/feature-plan` | 🔴 | One Business-Verification-Reference (not two docs); no HTML for the checklist |
| `/implement`, `/verify` | 🔴 | Archive the checklist first; give each sub-agent only its slice |
| `/fix`, `/add-doc`, `/refresh-doc` B | 🟡–🔴 | FAIL items only; grep-to-target, map not code-dump |
| `/analyze-fix`, `/create-issue-list`, `/refresh-doc` A | 🟡 | Prefer `/amend-checklist` for known edits |
| `/amend-checklist`, `/archive-checklist`, `/update-context`, `/generate-html` | 🟢 | Mechanical; no persona; cheapest model tier |

The mechanical commands deliberately activate **no persona** — don't "upgrade" them.
