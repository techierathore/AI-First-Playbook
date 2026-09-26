# AI-First Playbook Reset Plan

This is an analysis and a work plan. It does not change the Playbook. Measurements use the initial
tree, before any review output appeared. `find` supplied every file list, including hidden paths.
`wc -w` supplied word counts. During this session, a separate `docs/claudereview/` folder appeared
with 2 files and 15,191 words. It is not part of the baseline and was not changed here. A harness is
the command, agent, and plugin set that OpenCode runs. An instruction surface is the text loaded
before useful work. Telemetry is the stored record of runs and misses.

## 1. What Is Genuinely Right And Should Be Kept

OpenCode is already the primary shipped harness. `package.json:2-3` names the public npm package,
`package.json:12` exposes its installer, and `scripts/test-install.mjs:100-279` tests the installed
shape. A disposable install in this review resolved all 14 packaged commands. The source checkout
resolved 0 commands because it has no `.opencode/command/`; this is a source-layout fact, not a
reason to remove OpenCode or npm packaging.

The strongest parts should stay:

- `AGENTS.md` gives one standing contract for checklist authority, secrets, independent fixes, and
  completion.
- `harness/opencode/agent/builder.md` is only 352 words and gives a worker one owned slice.
- `harness/opencode/agent/orchestrator.md` is only 125 words and keeps shared writes with one parent.
- `templates/checklist-item-template.md` gives each build item a stable place for behavior, code,
  acceptance, and verification.
- `scripts/miss-lib.mjs`, `scripts/playbook-miss.mjs`, and `scripts/test-misses.mjs` form a real miss
  lifecycle with 24 passing fixture checks. A fixture is fixed sample data used to test a rule.
- `scripts/install.mjs` and `scripts/test-install.mjs` preserve project-owned files and install the
  hidden OpenCode runtime.
- `harness/opencode/plugin/write-policy.mjs` and `harness/opencode/plugin/yolo-policy.mjs` separate
  policy from OpenCode adapter code. Their pure policy tests pass, although live use has gaps named
  below.
- `phases/05-verify.md` keeps verification independent from implementation.
- `phases/09-post-verification-bugs.md` puts escaped defects back into the checklist instead of only
  patching code.
- `.github/workflows/release.yml:70-97` keeps npm publication separate from agent work and uses npm
  package history that cannot be overwritten.

### Measured Markdown Surface

The prompt snapshot is exact for Markdown files and words. The one exception is the harness share of
shouted rules, covered below. Hidden `.opencode/agent/` contributes 4 files and 9,144 words. Without
that hidden folder, the whole count would be wrong.

| Area | Prompt snapshot | Measured before these two reports | Result |
|---|---:|---:|---|
| `phases/` | 10 files, 3,572 words | 10 files, 3,572 words | Confirmed |
| `templates/` | 29 files, 5,991 words | 29 files, 5,991 words | Confirmed; 16 files are command specifications |
| `docs/` | 31 files, 57,105 words | 31 files, 57,105 words | Confirmed |
| `onboarding/` | 2 files, 1,538 words | 2 files, 1,538 words | Confirmed |
| `harness/` | 20 files, 40,350 words | 20 files, 40,350 words | Files confirmed; the claim that all of it ships is refuted |
| `verification/` | 174 files, 196,498 words | 174 files, 196,498 words | Confirmed |
| Root | 4 files, 3,187 words | 4 files, 3,187 words | Confirmed |
| Hidden `.opencode/` | Not printed as a row | 4 files, 9,144 words | Required to reach the whole total |
| Whole repository | 274 files, 317,385 words | 274 files, 317,385 words | Confirmed |

These leaf-folder totals account for every Markdown file. They are sorted by words.

| Folder | Files | Words |
|---|---:|---:|
| `docs/` | 31 | 57,105 |
| `harness/opencode/command/` | 15 | 29,800 |
| `verification/...verify-01/installed-target/.opencode/command/` | 14 | 28,966 |
| `verification/...verify-02/installed-target/.opencode/command/` | 14 | 28,966 |
| `verification/...verify-03/installed-target/.opencode/command/` | 14 | 28,966 |
| `verification/...verify-03/installed-target/docs/` | 16 | 28,232 |
| `verification/...verify-01/installed-target/docs/` | 16 | 15,649 |
| `verification/...verify-02/installed-target/docs/` | 16 | 15,649 |
| `.opencode/agent/` | 4 | 9,144 |
| `harness/opencode/agent/` | 4 | 9,144 |
| `verification/...verify-01/installed-target/.opencode/agent/` | 4 | 9,144 |
| `verification/...verify-02/installed-target/.opencode/agent/` | 4 | 9,144 |
| `verification/...verify-03/installed-target/.opencode/agent/` | 4 | 9,144 |
| `phases/` | 10 | 3,572 |
| Each of 3 `verification/.../installed-target/phases/` folders | 10 each | 3,572 each |
| Root | 4 | 3,187 |
| `templates/commands/` | 16 | 3,076 |
| `templates/` | 5 | 2,447 |
| `onboarding/` | 2 | 1,538 |
| Each of 3 `verification/.../installed-target/onboarding/` folders | 2 each | 1,538 each |
| `harness/` | 1 | 1,406 |
| Each of 3 `verification/.../installed-target/templates/` folders | 3 each | 1,015 each |
| Each of 3 `verification/.../installed-target/` roots | 1 each | 953 each |
| `templates/handoffs/` | 8 | 468 |
| Each of 3 `verification/.../installed-target/templates/handoffs/` folders | 8 each | 468 each |

The four shipped agent files are `verifier` at 8,630 words, `builder` at 352,
`orchestrator` at 125, and `analyst` at 37. The harness command folder has 15 files and 29,800
words, but the npm package ships 14 files and 28,966 words. `package.json:18-31` omits the 1-file,
834-word `update-context.md`, and `package.json:32` excludes the 1-file, 1,406-word `harness/README.md`.
The runtime prompt Markdown from `harness/` is therefore 18 files and 38,110 words, not 20 files and
40,350 words. The largest commands are still `add-doc.md` at 4,855 words and `implement.md` at 4,030
words. The prompt's command count and description of all `harness/` as shipped are refuted.

There are 61 exact uppercase uses of `MUST`, `NEVER`, `ALWAYS`, `BANNED`, `FORBIDDEN`, `REQUIRED`,
or `MANDATORY` in source Markdown. The cluster is 45 in 20 `harness/` files, 12 in 4 hidden
`.opencode/` files, 2 in 29 `templates/` files, 1 in 31 `docs/` files, and 1 in 10 `phases/` files.
The prompt's claim of 46 in `harness/` is refuted by the recursive count; the measured number is 45.
There are 15 files under `scripts/`. There are 0 `docs/metrics/` folders.

## 2. What Grew Without Earning Its Place

The main excess is copied output, repeated procedure, and stack-specific recovery text.

- `verification/` is 174 files and 196,498 words. It is 61.9 percent of all 317,385 Markdown words,
  or 62 percent when rounded to a whole number.
  Three installed target copies account for most of it.
- `harness/opencode/agent/verifier.md` is 1 file and 8,630 words. It contains the same lifecycle,
  YOLO, shell, process, data, and result-writing rules more than once.
- `harness/opencode/command/add-doc.md` is 1 file and 4,855 words. Scaffolding, HTML conversion,
  report structure, and checklist mutation should not all be handwritten procedure.
- `harness/opencode/command/implement.md` is 1 file and 4,030 words. It repeats standing YOLO rules,
  verifier workarounds, process control, result writing, and fixed .NET/SQL behavior.
- `harness/opencode/command/upgrade-docs.md` is 1 file and 3,598 words. It repeats most of `/add-doc`
  and carries editor workarounds rather than a document contract.
- `harness/opencode/command/fix.md` is 1 file and 2,766 words. It repeats `/implement` wave,
  smoke-test, deployment, and progress text.
- `docs/OpenCode-WSL-Setup-Guide.md` is 1 file and 7,479 words. It is useful setup material, but it
  should be an optional platform guide rather than part of the main reader path.
- `docs/Getting-Started.md` is 1 file and 5,351 words. It is the right entry point, but it has no
  reader-facing link from the current `README.md`; its source references come from packaging and
  validation.
- `docs/Miss-Telemetry-TechieFlow.md` is 1 file and 5,024 words and belongs to TechieFlow.
- `docs/Phase-Efficiency-TfLens-Contract.md` is 1 file and 2,710 words, and
  `docs/Miss-Telemetry-TfLens-From-AIFP.md` is 1 file and 395 words. Both belong in the TfLens
  consumer repository or an integration archive.

### Same-Name Copies

Byte-exact copies have the same SHA-256 hash. Near-identical means at least 90 percent unchanged
lines under `diff -b -B`; files under 20 lines allow no more than two changed lines. `V01`, `V02`,
and `V03` mean the three `verification/opencode-only/20260902-opencode-only-verify-*` campaigns.

| Same name | Copies and result |
|---|---|
| `AGENTS.md` | Root, V01, V02, and V03 are exact. |
| `analyst.md`, `builder.md` | Harness, hidden `.opencode`, V01, V02, and V03 are exact for each name. |
| `orchestrator.md`, `verifier.md` | Harness equals hidden `.opencode`; V01-V03 equal each other; installed path wording is the only material difference. |
| `spec-guardrails.ts`, `yolo.ts` | Harness, hidden `.opencode`, V01, V02, and V03 are exact for each name. |
| `write-policy.mjs`, `telemetry.ts`, `yolo-policy.mjs` | Harness equals hidden `.opencode`; V01-V03 equal each other; campaign copies are older near-identical versions where hashes differ. |
| `add-doc.md`, `amend-checklist.md`, `archive-checklist.md`, `create-issue-list.md`, `feature-plan.md`, `generate-html.md`, `refresh-doc.md`, `upgrade-docs.md` | Each harness command equals its V01-V03 runnable copies. Same-name `templates/commands/` files are shorter specifications, not near-identical. |
| `analyze-fix.md`, `fix.md`, `implement.md`, `legacy-audit.md`, `log-miss.md`, `verify.md` | V01-V03 are exact for each name; harness differs only in hidden installed paths. Same-name command specifications are shorter. |
| `01-plan.md` through `10-production-bugs.md` | Each source phase equals all three campaign copies. |
| `checklist-item-template.md`, `deployment-steps-template.md`, `issues-file-template.md` | Each source template equals all three campaign copies. |
| All 8 files in `templates/handoffs/` | Each source template equals all three campaign copies. |
| `first-week.md`, `team-rollout.md` | Each source file equals all three campaign copies. |
| `Operating-Model.md`, `Handoffs.md`, `Release-And-Operations.md` | Each source document equals all three campaign copies. |
| `Adoption-Metrics.md`, `Security.md`, `Troubleshooting.md`, `YOLO-Mode-Guide.md` | Source equals V03; V01 equals V02 as an older revision. |
| `Brownfield-Case-Study.md`, `Getting-Started.md`, `Greenfield-Case-Study.md` | Source is near-identical to V03; V01 equals V02 as a shorter older revision. `Getting-Started.md` is 97.52 percent unchanged. |
| `Environment-Profile.md` | V01-V03 are exact; source changes one installed path. |
| `OpenCode-WSL-Setup-Guide.md` | V01-V03 are exact; source is 99.35 percent unchanged and updates hidden-runtime wording. |
| `Telemetry-Guide.md` | V01 equals V02; source is near-identical to V03 but changes IDs from timestamp-plus-entropy to serialized daily IDs. |
| `Installation.md` | V01 equals V02. V03 and source are materially changed installer generations. |
| `Repository-Structure.md` | V01-V03 are exact. Source is a materially changed hidden-layout revision. |
| `Usage.md` | V01 equals V02. V03 and source are materially changed CLI and layout revisions. |
| `playbook-miss.mjs`, `playbook-telemetry.mjs`, `miss-lib.mjs`, `model-tiers.yml`, `environment-profile.yml`, `opencode.json`, `.gitignore`, `doc-shell.html`, `pack.json`, `state.json`, `supervisor.log`, and the npm tarball | These also have same-name campaign copies. Exact hashes exist within campaign generations; changed source or state copies are evidence snapshots, not a second maintained source. |

The copies prove what was installed on 2026-09-02, but they should not remain in the normal reader
or maintainer path. Section 5b gives them a safe home.

## 3. The Instruction Surface Per Phase Today, And A Target For Each

OpenCode removes command and agent front matter before sending prompt text. The current figures below
therefore use effective body words, not whole-file `wc` figures. Plugins are executable code and are
not counted as prompt words. Project checklists, code, and generated documents vary, so they are
shown as additions rather than guessed.

The shared automatic load is 2 files and 1,072 words: `AGENTS.md` at 953 words and
`playbook/environment-profile.yml` at 119. Phase files under `phases/` are reader documents; none is
automatically loaded. Templates are also not automatically loaded because command bodies repeat
their rules.

| Phase | What OpenCode loads, in order | Current fixed surface | Active tier | Target / maximum | Position |
|---|---|---:|---|---:|---|
| 1 Plan | `AGENTS.md`; profile; `feature-plan.md`; Analyst | 4 files, 3,675 words | Frontier | 1,200 / 1,800 | 1,875 over maximum |
| 2 Plan review | Retained Phase 1 context; generated docs follow | 4 retained files, 3,675 words | Frontier retained | 1,200 / 1,800 | 1,875 over maximum |
| 3 Build | `AGENTS.md`; profile; `implement.md`; Orchestrator | 4 files, 5,198 words | Standard | 800 / 1,200 | 3,998 over maximum |
| 4 Self-review | Retained `/implement` context, or retained `/fix` context | 4 retained files, 5,198 words from build | Standard | 800 / 1,200 | 3,998 over maximum |
| 5 Verify | `AGENTS.md`; profile; Verifier; `verify.md` | 4 files, 10,054 words | Standard | 800 / 1,200 | 8,854 over maximum |
| 6 Results gate | Retained Verifier context | 4 retained files, 10,054 words | Standard | 800 / 1,200 | 8,854 over maximum |
| 7 Fix | `AGENTS.md`; profile; `fix.md`; Orchestrator | 4 files, 3,933 words | Standard | 800 / 1,200 | 2,733 over maximum |
| 8 Human acceptance | No new OpenCode instruction file | 0 files, 0 new words | Human | 0 / 0 | At budget |
| 9 Escaped bugs | `AGENTS.md`; profile; `analyze-fix.md`; Analyst | 4 files, 3,484 words | Frontier | 1,200 / 1,800 | 1,684 over maximum |
| 10 Production bugs | Separate analyze, fix, and verify contexts | 12 file loads, 17,471 words total | Frontier then Standard | 3,600 / 5,400 across 3 runs | 12,071 over maximum |

Phase 5 reads the most before its first useful environment probe: 4 files and 10,054 fixed words,
then the checklist, verification guide, database guide, and supplied references. The 1-file,
8,536-word effective Verifier body is 84.9 percent of that fixed surface. Phase 10 is larger only as
the sum of three separate command runs.

### Tier Budgets

| Model tier | Short core target / maximum | Total instruction target / maximum | Use |
|---|---:|---:|---|
| Economy | 120 / 180 words | 300 / 550 words | Fixed transformations such as archive, amend, issue import, and HTML |
| Standard | 250 / 350 words | 800 / 1,200 words | Build, verify, fix, and document execution |
| Frontier | 350 / 500 words | 1,200 / 1,800 words | Planning, uncertain root cause, and legacy analysis |

Each phase file should have a short core with only purpose, required inputs, allowed writes, safety
limits, completion, and handoff. Detailed reference sections should load only when their condition is
true. UI guidance loads only for UI items. Database guidance loads only for data items. Windows
bridge guidance loads only for a desktop application. YOLO guidance loads only when YOLO is active.
The checklist schema is referenced once, not copied into every command. This preserves steps while
meeting smaller budgets.

## 4. Keep, Script, Or Delete

The review covered 59 prose files: 20 in `harness/`, 10 in `phases/`, and 29 in `templates/`.
Meaningful headings and cohesive list sections form the blocks. There are 312 block decisions:
168 KEEP AS WORDS, 99 SCRIPT, and 45 DELETE. `SCRIPT` names a proposed artefact, but Section 6 marks
all reset requirements as review because this analysis session was not allowed to create scripts.

### `harness/opencode/agent/verifier.md` - 8,630 Words

| # | What the block says, in one line | Verdict | Why |
|---:|---|---|---|
| 1 | Define an independent Verifier and its permissions. | KEEP AS WORDS | Identity and authority are policy. |
| 2 | Treat the environment profile as authority and do not guess. | KEEP AS WORDS | This is the main runtime safety rule. |
| 3 | Limit writes to the checklist, evidence, telemetry tool, and named deploy helpers. | KEEP AS WORDS | Scope must stay prominent. |
| 4 | Repeat all YOLO behavior and sentinels. | DELETE | `AGENTS.md` already owns it. |
| 5 | Define five verdict tiers. | KEEP AS WORDS | Outcome meaning is policy. |
| 6 | Say verification always runs in Docker on Windows. | DELETE | It contradicts the profile. |
| 7 | Forbid suggesting another host or deployment merely to test. | KEEP AS WORDS | This is a useful boundary. |
| 8 | Require Playwright when the configured browser is reachable. | KEEP AS WORDS | Evidence choice needs judgement. |
| 9 | Ban cloud CLIs and assume .NET cloud behavior. | DELETE | These are project assumptions. |
| 10 | Discover Node and other required tools. | SCRIPT | Build `playbook-probe.mjs`. |
| 11 | Recover from NuGet private-feed failures. | SCRIPT | Build `dotnet-restore-diagnostics.mjs` as an optional adapter. |
| 12 | Attempt a real headless fallback before BLOCKED. | KEEP AS WORDS | The principle needs judgement. |
| 13 | Define Windows bridge discovery and HTTP calls. | SCRIPT | Build `windows-app-bridge-client.mjs`. |
| 14 | Do not ask for facts already in chat. | DELETE | This is generic agent behavior. |
| 15 | Keep the checklist as the only Markdown report. | KEEP AS WORDS | This is a central invariant. |
| 16 | Open, link, defer, and close miss records. | SCRIPT | Build `checklist-miss-coordinator.mjs`. |
| 17 | Split verification by item type and centralize writes. | KEEP AS WORDS | Orchestration needs judgement. |
| 18 | Use BLOCKED only after five concrete checks. | KEEP AS WORDS | Last-resort reasoning must be explicit. |
| 19 | Separate absent test data from defects. | KEEP AS WORDS | This distinction changes release routing. |
| 20 | Verify only checklist scope. | KEEP AS WORDS | Scope needs judgement. |
| 21 | Use focused reads and avoid repeated work. | KEEP AS WORDS | This is concise and role-specific. |
| 22 | Prescribe symbols and chat between tool calls. | DELETE | It is repeated interface detail. |
| 23 | Read the checklist and supporting documents. | KEEP AS WORDS | Context selection needs judgement. |
| 24 | Run a hard-coded shell environment probe. | SCRIPT | Build profile-driven `playbook-probe.mjs`. |
| 25 | Start, poll, record, and stop applications. | SCRIPT | Build `playbook-app-lifecycle.mjs`. |
| 26 | Resolve real service configuration. | SCRIPT | Build `secret-safe-config-resolver.mjs`; remove argument-based secrets. |
| 27 | Approve and execute deployment steps. | SCRIPT | Build `deployment-step-runner.mjs`. |
| 28 | Use the Developer Flow Guide as an end-to-end map. | KEEP AS WORDS | Correlation needs judgement. |
| 29 | Classify checklist items into verification groups. | SCRIPT | Build `checklist-plan.mjs verify`. |
| 30 | Dispatch non-overlapping workers. | KEEP AS WORDS | Worker boundaries depend on the project. |
| 31 | Run touched build and test gates. | SCRIPT | Build `profile-gates.mjs`. |
| 32 | Repeat Node and NuGet recovery details. | DELETE | Blocks 10 and 11 already own them. |
| 33 | Explain UI, API, DB, log, and infrastructure evidence. | KEEP AS WORDS | Evidence selection varies by item. |
| 34 | Repeat forbidden paths before each write. | DELETE | Block 15 and the plugin own this. |
| 35 | Write item results, status, telemetry, and the run log. | SCRIPT | Build `verification-result-writer.mjs`. |
| 36 | Call DATA-GAP a sixth legal tier. | DELETE | It contradicts block 5. |
| 37 | Stop processes started by verification. | SCRIPT | Put cleanup in `playbook-app-lifecycle.mjs`. |
| 38 | Render the final result message. | SCRIPT | Build `verification-summary.mjs`. |
| 39 | Repeat forbidden phrases and local-only rules. | DELETE | Blocks 7 and 15 own them. |
| 40 | Delete every file other than the checklist. | DELETE | It contradicts allowed evidence. |
| 41 | Recommend archive after a line threshold. | DELETE | The archive command owns it. |

### `harness/opencode/command/add-doc.md` - 4,855 Words

| # | What the block says, in one line | Verdict | Why |
|---:|---|---|---|
| 1 | Define the Developer Flow Guide and Business Verification Reference. | KEEP AS WORDS | Purpose and audience need words. |
| 2 | Interpret paths, constraints, and broad or narrow scope. | KEEP AS WORDS | User intent needs judgement. |
| 3 | Explain when each guide is created and reconciled. | KEEP AS WORDS | This is lifecycle policy. |
| 4 | Require evidence and ask when it is missing. | KEEP AS WORDS | It prevents invention. |
| 5 | Read implementation through focused references. | KEEP AS WORDS | This is useful analysis guidance. |
| 6 | Distinguish UI flows from services, jobs, and packages. | KEEP AS WORDS | It is core information design. |
| 7 | Build the guide by executing real behavior. | KEEP AS WORDS | This is the quality principle. |
| 8 | Add defects found during documentation to the checklist. | SCRIPT | Build `checklist-append-finding.mjs`. |
| 9 | Create guide metadata, diagrams, screens, steps, and symptoms. | SCRIPT | Build `developer-flow-scaffold.mjs`. |
| 10 | Describe reusable package entry points and side effects. | KEEP AS WORDS | Package meaning needs judgement. |
| 11 | Require real names, suitable flow types, and simple diagrams. | KEEP AS WORDS | These are authoring standards. |
| 12 | Explain the one-document business and QA choice. | KEEP AS WORDS | The consolidation reason matters. |
| 13 | Create sources, calculations, mappings, examples, and glossary. | SCRIPT | Build `business-verification-scaffold.mjs`. |
| 14 | Ban internals and require complete business mappings. | KEEP AS WORDS | Semantic completeness needs review. |
| 15 | Work around large tool writes with skeleton edits. | DELETE | This is tool-specific. |
| 16 | Prescribe progress messages. | DELETE | It is repeated interface detail. |
| 17 | Check flow, names, mappings, and audience rules. | SCRIPT | Build `doc-contract-lint.mjs`. |
| 18 | Convert eligible Markdown to HTML. | SCRIPT | Build shared `render-docs.mjs`. |

### `harness/opencode/command/implement.md` - 4,030 Words

| # | What the block says, in one line | Verdict | Why |
|---:|---|---|---|
| 1 | Set profile authority and use the Orchestrator. | KEEP AS WORDS | It defines execution context. |
| 2 | Parse checklist paths and user limits. | KEEP AS WORDS | Intent handling needs judgement. |
| 3 | Repeat standing YOLO rules. | DELETE | `AGENTS.md` owns them. |
| 4 | Finish every item or name an owned external blocker. | KEEP AS WORDS | This is the phase invariant. |
| 5 | Read checklist, standards, architecture, and DB documents. | KEEP AS WORDS | Selection is project-specific. |
| 6 | Use focused reads and right-sized waves. | KEEP AS WORDS | Useful orchestration guidance. |
| 7 | Build a dependency and file-conflict plan. | SCRIPT | Build `checklist-plan.mjs implement`. |
| 8 | Dispatch Builder workers after approval. | KEEP AS WORDS | Dispatch depends on available capacity. |
| 9 | Prescribe progress symbols and cadence. | DELETE | It is repeated interface detail. |
| 10 | Define Builder ownership, fidelity, logging, and result duties. | KEEP AS WORDS | These are worker constraints. |
| 11 | Record Builder miss candidates serially. | SCRIPT | Use `checklist-miss-coordinator.mjs`. |
| 12 | Require runtime smoke proof after build. | KEEP AS WORDS | Build and behavior are different. |
| 13 | Repeat stack-specific verifier workarounds. | DELETE | They conflict with profile authority. |
| 14 | Use the flow guide for smoke checks. | KEEP AS WORDS | Assertion choice needs judgement. |
| 15 | Build touched projects. | SCRIPT | Use `profile-gates.mjs build`. |
| 16 | Start and stop configured applications. | SCRIPT | Use `playbook-app-lifecycle.mjs`. |
| 17 | Probe changed endpoints, data, and UI. | SCRIPT | Build `smoke-runner.mjs`. |
| 18 | Write self-test outcomes and linked misses. | SCRIPT | Build `self-test-result-writer.mjs`. |
| 19 | Explain why side effects belong in the checklist. | KEEP AS WORDS | The reason is durable. |
| 20 | Add infrastructure records. | SCRIPT | Build `checklist-infra.mjs`. |
| 21 | Add deployment records. | SCRIPT | Build `checklist-deploy.mjs`. |
| 22 | Mandate raw SQL, sqlcmd, .NET, and React commands. | DELETE | Adapters and the profile must decide. |
| 23 | Distinguish persistent prerequisites from actions. | KEEP AS WORDS | Classification needs judgement. |
| 24 | Insert canonical empty side-effect sections. | SCRIPT | Put this in `checklist-deploy.mjs validate`. |
| 25 | Check completion and render the handoff. | SCRIPT | Build `phase-complete.mjs build`. |

### `harness/opencode/command/upgrade-docs.md` - 3,598 Words

| # | What the block says, in one line | Verdict | Why |
|---:|---|---|---|
| 1 | Choose the authoritative legacy requirement source. | KEEP AS WORDS | Source choice needs judgement. |
| 2 | Choose full or targeted scope. | KEEP AS WORDS | User intent controls it. |
| 3 | Back up files before replacement. | SCRIPT | Build `doc-upgrade.mjs backup`. |
| 4 | Give user instructions precedence below safety. | KEEP AS WORDS | This is instruction hierarchy. |
| 5 | Ask only for inputs needed by selected documents. | KEEP AS WORDS | It avoids unnecessary blocking. |
| 6 | Reconcile schema, mappings, DDL, and diagrams. | SCRIPT | Build `doc-upgrade.mjs db` plus review. |
| 7 | Reconcile services, methods, injection, and diagrams. | SCRIPT | Build `doc-upgrade.mjs architecture` plus review. |
| 8 | Add checklist fields, statuses, and coverage. | SCRIPT | Build `checklist-migrate.mjs`. |
| 9 | Keep a legacy deployment row shape. | DELETE | It conflicts with the current shape. |
| 10 | Build a complete Verification Guide. | KEEP AS WORDS | Completeness needs domain judgement. |
| 11 | Upgrade Power BI mapping documents. | KEEP AS WORDS | This is specialised and semantic. |
| 12 | Merge legacy business and QA reports. | SCRIPT | Build `doc-upgrade.mjs business-reference`. |
| 13 | Require consent before deleting old files. | KEEP AS WORDS | Deletion is a human decision. |
| 14 | Repeat the full Developer Flow Guide procedure. | DELETE | Call the canonical workflow. |
| 15 | Add defects found during upgrade to the checklist. | SCRIPT | Use `checklist-append-finding.mjs`. |
| 16 | Prescribe progress messages. | DELETE | It is repeated interface detail. |
| 17 | Work around large edits with shell copies. | DELETE | A script should own replacement. |
| 18 | Require evidence and forbid invention. | KEEP AS WORDS | This needs judgement. |
| 19 | Select Mermaid diagram forms by subject. | KEEP AS WORDS | It is a short authoring rule. |
| 20 | Report outputs and render HTML. | SCRIPT | Use `doc-upgrade.mjs report` and `render-docs.mjs`. |

### `harness/opencode/command/fix.md` - 2,766 Words

| # | What the block says, in one line | Verdict | Why |
|---:|---|---|---|
| 1 | Set profile authority and limit work to failures. | KEEP AS WORDS | It defines phase scope. |
| 2 | Fold legacy gap reports into the checklist. | KEEP AS WORDS | Persisted legacy files are a real case. |
| 3 | Repeat YOLO rules. | DELETE | `AGENTS.md` owns them. |
| 4 | Read verdicts, standards, and related documents. | KEEP AS WORDS | Context selection needs judgement. |
| 5 | Read only failing items and owned files. | KEEP AS WORDS | This is useful scope control. |
| 6 | Group failures into dependency-safe waves. | SCRIPT | Use `checklist-plan.mjs fix`. |
| 7 | Dispatch Builder workers after approval. | KEEP AS WORDS | Dispatch is orchestration. |
| 8 | Prescribe progress messages. | DELETE | It is repeated interface detail. |
| 9 | Define Builder repair and annotation duties. | KEEP AS WORDS | It is the worker contract. |
| 10 | Keep Issues files until independent PASS. | KEEP AS WORDS | This is lifecycle policy. |
| 11 | Repeat stack-specific fallback claims. | DELETE | They conflict with profile authority. |
| 12 | Build touched projects. | SCRIPT | Use `profile-gates.mjs build`. |
| 13 | Start apps and run focused smoke checks. | SCRIPT | Use lifecycle and smoke scripts. |
| 14 | Write self-test status. | SCRIPT | Use `self-test-result-writer.mjs`. |
| 15 | Defer linked misses pending verification. | SCRIPT | Use `checklist-miss-coordinator.mjs defer`. |
| 16 | Update infrastructure and deployment records. | SCRIPT | Use `checklist-infra.mjs` and `checklist-deploy.mjs`. |
| 17 | Mandate raw SQL and stack commands. | DELETE | The profile must decide. |
| 18 | Check completion and hand back to verification. | SCRIPT | Build `phase-complete.mjs fix`. |

### Remaining `harness/`

| File and # | What the block says, in one line | Verdict | Why |
|---|---|---|---|
| `harness/README.md` 1 | Separate human specifications from runnable harness files. | KEEP AS WORDS | Useful maintainer orientation. |
| `harness/README.md` 2 | Explain optional model tiers and scripts. | KEEP AS WORDS | Operators need precedence and control. |
| `harness/README.md` 3 | Explain YOLO invocation and supervision. | KEEP AS WORDS | It belongs in harness use guidance. |
| `harness/README.md` 4 | Explain npm installation and smoke testing. | KEEP AS WORDS | Setup guidance is needed. |
| `harness/README.md` 5 | Explain personas and optional BMAD substitution. | KEEP AS WORDS | It records portability. |
| `harness/README.md` 6 | List stack assumptions in runnable prompts. | KEEP AS WORDS | It exposes migration risk. |
| `harness/README.md` 7 | Describe the optional Windows bridge. | KEEP AS WORDS | It is an external contract. |
| `harness/README.md` 8 | Explain OpenCode front matter. | KEEP AS WORDS | Maintainers need it. |
| `harness/README.md` 9 | Explain why a guardrail plugin exists. | KEEP AS WORDS | The design reason is sound. |
| `harness/README.md` 10 | Mark product names as examples. | KEEP AS WORDS | It prevents literal reuse. |
| `agent/analyst.md` 1 | Define Analyst questions, write scope, and handoff. | KEEP AS WORDS | It is already 37 words. |
| `agent/builder.md` 1 | Define a standard-tier, slice-owned worker. | KEEP AS WORDS | Identity and cost boundary matter. |
| `agent/builder.md` 2 | Require file ownership, honesty, and miss candidates. | KEEP AS WORDS | It is a compact worker contract. |
| `agent/orchestrator.md` 1 | Define waves, profile safety, completion, and YOLO forwarding. | KEEP AS WORDS | It is already 125 words. |
| `command/amend-checklist.md` 1 | Route known edits away from analysis, refresh, and fix. | KEEP AS WORDS | Command choice needs intent. |
| `command/amend-checklist.md` 2 | Require a checklist, exact change, and approval. | KEEP AS WORDS | Approval is human. |
| `command/amend-checklist.md` 3 | Add, update, remove, and renumber safely. | SCRIPT | Build `checklist-amend.mjs`. |
| `command/amend-checklist.md` 4 | Protect PASS items and history. | KEEP AS WORDS | Ownership policy matters. |
| `command/amend-checklist.md` 5 | Report changes and next route. | SCRIPT | Have `checklist-amend.mjs` emit it. |
| `command/analyze-fix.md` 1 | Fold defects and stories into the existing checklist. | KEEP AS WORDS | This is the core policy. |
| `command/analyze-fix.md` 2 | Find the checklist and supporting files. | SCRIPT | Build `feature-context.mjs locate`. |
| `command/analyze-fix.md` 3 | Prescribe progress messages. | DELETE | It is repeated interface detail. |
| `command/analyze-fix.md` 4 | Add cause, status, and repair items for early bugs. | SCRIPT | Build `checklist-ingest.mjs bug`. |
| `command/analyze-fix.md` 5 | Classify escaped bugs and strengthen tests. | KEEP AS WORDS | Root cause needs judgement. |
| `command/analyze-fix.md` 6 | Open one linked miss per escaped issue. | SCRIPT | Use `checklist-miss-coordinator.mjs`. |
| `command/analyze-fix.md` 7 | Compare legacy reports and reject false positives. | KEEP AS WORDS | Evidence comparison needs judgement. |
| `command/analyze-fix.md` 8 | Add story requirements to the checklist. | SCRIPT | Build `checklist-ingest.mjs story`. |
| `command/analyze-fix.md` 9 | Investigate vague documentation gaps. | KEEP AS WORDS | This is analytical work. |
| `command/analyze-fix.md` 10 | Keep source issue files until their facts are durable. | KEEP AS WORDS | This is audit policy. |
| `command/analyze-fix.md` 11 | Validate ingestion and prohibit checklist HTML. | SCRIPT | Build `checklist-ingest.mjs validate`. |
| `command/archive-checklist.md` 1 | Define archive, restore, and thresholds. | KEEP AS WORDS | Eligibility policy matters. |
| `command/archive-checklist.md` 2 | Exclude referenced, fresh, pattern, and deployment items. | SCRIPT | Build `checklist-archive.mjs candidates`. |
| `command/archive-checklist.md` 3 | Preserve rich history records. | SCRIPT | Build `checklist-archive.mjs archive`. |
| `command/archive-checklist.md` 4 | Prescribe progress messages. | DELETE | It is repeated interface detail. |
| `command/archive-checklist.md` 5 | Count, confirm, move, and update archive state. | SCRIPT | Put this in `checklist-archive.mjs archive`. |
| `command/archive-checklist.md` 6 | Suggest committing the archive. | DELETE | Standing rules own version control. |
| `command/archive-checklist.md` 7 | Restore records as incomplete items. | SCRIPT | Build `checklist-archive.mjs restore`. |
| `command/archive-checklist.md` 8 | Enforce PASS-only and stable IDs. | SCRIPT | Validate in `checklist-archive.mjs`. |
| `command/create-issue-list.md` 1 | Accept Jira keys, URLs, manual bugs, or Markdown. | KEEP AS WORDS | Input intent varies. |
| `command/create-issue-list.md` 2 | Find Jira config and fetch tickets. | SCRIPT | Build `jira-issues.mjs fetch` with protected secrets. |
| `command/create-issue-list.md` 3 | Convert Jira rich text to Markdown. | SCRIPT | Build `jira-adf-to-markdown.mjs`. |
| `command/create-issue-list.md` 4 | Extract issue keys from URLs. | SCRIPT | Put parsing in `jira-issues.mjs`. |
| `command/create-issue-list.md` 5 | Prescribe per-ticket progress. | DELETE | Script output can be concise. |
| `command/create-issue-list.md` 6 | Render summary and issue sections. | SCRIPT | Build `issues-file.mjs render`. |
| `command/create-issue-list.md` 7 | Mark absent facts and handle manual issues. | KEEP AS WORDS | Missing meaning needs judgement. |
| `command/create-issue-list.md` 8 | Reconcile requested keys to output. | SCRIPT | Build `issues-file.mjs validate`. |
| `command/feature-plan.md` 1 | Select requirements and ask for missing context. | KEEP AS WORDS | Planning needs judgement. |
| `command/feature-plan.md` 2 | Select human and agent documents. | KEEP AS WORDS | Audience and domain vary. |
| `command/feature-plan.md` 3 | Design DB and architecture documents. | KEEP AS WORDS | Architecture is semantic. |
| `command/feature-plan.md` 4 | Create checklist item fields and metadata. | SCRIPT | Build `checklist-create.mjs`. |
| `command/feature-plan.md` 5 | Group shared files and dependencies. | KEEP AS WORDS | Ownership needs code understanding. |
| `command/feature-plan.md` 6 | Insert status, infrastructure, deployment, and run log. | SCRIPT | Put this in `checklist-create.mjs`. |
| `command/feature-plan.md` 7 | Design verification and optional BI documents. | KEEP AS WORDS | Domain content needs judgement. |
| `command/feature-plan.md` 8 | Repeat Developer Flow Guide structure. | DELETE | Reference one schema. |
| `command/feature-plan.md` 9 | Repeat Business Verification Reference structure. | DELETE | Reference one schema. |
| `command/feature-plan.md` 10 | Work around large writes. | DELETE | It is tool-specific. |
| `command/feature-plan.md` 11 | Choose Mermaid diagram forms. | KEEP AS WORDS | It is a concise convention. |
| `command/feature-plan.md` 12 | Check requirement and mockup coverage. | SCRIPT | Build `plan-coverage.mjs`. |
| `command/feature-plan.md` 13 | Offer HTML for human documents. | SCRIPT | Use `render-docs.mjs`. |
| `command/generate-html.md` 1 | Select inputs and ask about overwrite. | SCRIPT | Build `render-docs.mjs select`. |
| `command/generate-html.md` 2 | Transform title and Markdown into the shell. | SCRIPT | Put it in `render-docs.mjs`. |
| `command/generate-html.md` 3 | Trust output without parsing it. | DELETE | Generated HTML needs structure checks. |
| `command/generate-html.md` 4 | Exclude checklists and issues by default. | SCRIPT | Classify in `render-docs.mjs`. |
| `command/generate-html.md` 5 | Filter folders and handle overwrite. | SCRIPT | This is deterministic. |
| `command/generate-html.md` 6 | Repeat shell UI capabilities. | DELETE | `doc-shell.html` owns them. |
| `command/generate-html.md` 7 | Preserve Markdown and avoid unsafe parallel output. | KEEP AS WORDS | Keep a short safety contract. |
| `command/legacy-audit.md` 1 | Baseline behavior, ownership, risks, and safe seams without edits. | KEEP AS WORDS | It is already 72 words. |
| `command/log-miss.md` 1 | Limit work to classification and linkage. | KEEP AS WORDS | This is a critical scope limit. |
| `command/log-miss.md` 2 | List allowed classification values. | SCRIPT | Read one `miss-schema.json`. |
| `command/log-miss.md` 3 | Build a CLI call and link the result. | SCRIPT | Add `classify-and-link` to the miss CLI. |
| `command/refresh-doc.md` 1 | Choose one document or a whole feature. | KEEP AS WORDS | Scope depends on intent. |
| `command/refresh-doc.md` 2 | Resolve documents, code, and standards. | KEEP AS WORDS | Inputs vary. |
| `command/refresh-doc.md` 3 | Inventory references and calculate drift. | SCRIPT | Build `doc-drift.mjs`. |
| `command/refresh-doc.md` 4 | Edit without replacing the document voice. | KEEP AS WORDS | Editorial judgement is needed. |
| `command/refresh-doc.md` 5 | Prefer section diagrams in large documents. | KEEP AS WORDS | Useful authoring advice. |
| `command/refresh-doc.md` 6 | Classify feature documents and code. | SCRIPT | Build `feature-context.mjs inventory-docs`. |
| `command/refresh-doc.md` 7 | Repeat flow-guide creation. | DELETE | Call the canonical workflow. |
| `command/refresh-doc.md` 8 | Confirm names and behavior from code and runtime. | KEEP AS WORDS | Evidence correlation needs judgement. |
| `command/refresh-doc.md` 9 | Flag stale checklist references without changing verdicts. | SCRIPT | Build `checklist-reference-lint.mjs`. |
| `command/refresh-doc.md` 10 | Add defects to the checklist. | SCRIPT | Use `checklist-append-finding.mjs`. |
| `command/refresh-doc.md` 11 | Render a drift report. | SCRIPT | Use `doc-drift.mjs report`. |
| `command/refresh-doc.md` 12 | Prescribe approval and progress chat. | DELETE | It is repeated interface detail. |
| `command/refresh-doc.md` 13 | Work around large edits. | DELETE | It is tool-specific. |
| `command/refresh-doc.md` 14 | Require evidence, preservation, and Mermaid. | KEEP AS WORDS | These are editorial standards. |
| `command/refresh-doc.md` 15 | Render HTML and recommend re-verification. | SCRIPT | Use renderer and reference lint. |
| `command/update-context.md` 1 | Define the cold-start primer. | KEEP AS WORDS | Purpose remains useful if retained. |
| `command/update-context.md` 2 | Hard-code `/app` and stale command paths. | DELETE | It conflicts with current layout. |
| `command/update-context.md` 3 | List primer sections to update. | KEEP AS WORDS | This is its document contract. |
| `command/update-context.md` 4 | Compare commands and documented names. | SCRIPT | Build `context-sync.mjs diff`. |
| `command/update-context.md` 5 | Preserve format, history, and confirmed facts. | KEEP AS WORDS | These are editorial rules. |
| `command/update-context.md` 6 | Report changes and suggest doc updates. | SCRIPT | Use `context-sync.mjs report`. |
| `command/update-context.md` 7 | Suggest a commit. | DELETE | Standing rules own version control. |
| `command/verify.md` 1 | Dispatch verification with profile authority. | KEEP AS WORDS | It is a thin wrapper duty. |
| `command/verify.md` 2 | Require the checklist and optional guides. | KEEP AS WORDS | This is the input contract. |
| `command/verify.md` 3 | Forward YOLO mode to the Verifier. | KEEP AS WORDS | Dispatch must preserve the mode. |
| `command/verify.md` 4 | Delegate all item work to the Verifier. | KEEP AS WORDS | Thin delegation is correct. |
| `command/verify.md` 5 | Repeat report and telemetry mechanics. | DELETE | The Verifier and coordinator own them. |

### `phases/`

| File and # | What the block says, in one line | Verdict | Why |
|---|---|---|---|
| `01-plan.md` 1 | Explain planning authority and inputs. | KEEP AS WORDS | Concise lifecycle guidance. |
| `01-plan.md` 2 | List outputs and audiences. | KEEP AS WORDS | Readers need the document map. |
| `01-plan.md` 3 | Check coverage and route to review. | KEEP AS WORDS | It is a clear phase summary. |
| `02-plan-review-gate.md` 1 | Explain why a person reviews before code. | KEEP AS WORDS | The reason supports adoption. |
| `02-plan-review-gate.md` 2 | Check requirements, UI, acceptance, tests, and names. | SCRIPT | Build `gate-check.mjs plan-review`; approval stays human. |
| `02-plan-review-gate.md` 3 | Route rejection to plan and approval to build. | KEEP AS WORDS | Human routing is clear. |
| `03-build.md` 1 | Explain dependency waves and central writes. | KEEP AS WORDS | This is the core build model. |
| `03-build.md` 2 | Require the whole checklist before handoff. | KEEP AS WORDS | This is the main invariant. |
| `03-build.md` 3 | Repeat detailed YOLO rules. | DELETE | `AGENTS.md` owns them. |
| `03-build.md` 4 | Summarize fidelity, side effects, status, and misses. | KEEP AS WORDS | Keep it, but remove raw-SQL assumptions. |
| `04-self-review.md` 1 | Build, run, probe, check data/UI/logs, and clean up. | SCRIPT | Build `smoke-runner.mjs` with adapters. |
| `04-self-review.md` 2 | Link self-review misses without claiming PASS. | SCRIPT | Use `checklist-miss-coordinator.mjs defer`. |
| `04-self-review.md` 3 | Explain end-to-end agreement and independent verification. | KEEP AS WORDS | The distinction matters. |
| `05-verify.md` 1 | Explain fresh-context identity and write scope. | KEEP AS WORDS | Readers need the assurance model. |
| `05-verify.md` 2 | Run deployment steps before item checks. | SCRIPT | Use `deployment-step-runner.mjs`. |
| `05-verify.md` 3 | Summarize environment, UI, API, DB, log, and parallel checks. | KEEP AS WORDS | It is a useful overview. |
| `05-verify.md` 4 | Repeat stack-specific forbidden excuses. | DELETE | Adapters and profile should own recovery. |
| `06-verification-results-gate.md` 1 | Put verdicts, status, and run log in the checklist. | KEEP AS WORDS | It explains the single contract. |
| `06-verification-results-gate.md` 2 | Open and close linked misses serially. | SCRIPT | Use `checklist-miss-coordinator.mjs`. |
| `06-verification-results-gate.md` 3 | Route outcomes to fix, acceptance, or release. | SCRIPT | Build `gate-check.mjs verification-results`. |
| `07-fix.md` 1 | Summarize failure-only parallel repair. | KEEP AS WORDS | It is concise phase guidance. |
| `07-fix.md` 2 | Defer repaired misses pending verification. | SCRIPT | Use `checklist-miss-coordinator.mjs defer`. |
| `07-fix.md` 3 | Repeat fix and verify until all pass. | KEEP AS WORDS | The loop is clear. |
| `08-human-acceptance.md` 1 | Explain business and usability review. | KEEP AS WORDS | Humans must judge it. |
| `08-human-acceptance.md` 2 | Create a durable acceptance record. | SCRIPT | Build `handoff-record.mjs create acceptance`. |
| `08-human-acceptance.md` 3 | Route acceptance or escaped bugs. | KEEP AS WORDS | Lifecycle routing is clear. |
| `09-post-verification-bugs.md` 1 | Strengthen the checklist after an escape. | KEEP AS WORDS | This is the learning principle. |
| `09-post-verification-bugs.md` 2 | Log, analyze, review, fix, verify, and retire inputs. | SCRIPT | Build `escaped-bug-workflow.mjs status`. |
| `09-post-verification-bugs.md` 3 | Record one linked miss per issue. | SCRIPT | Use `checklist-miss-coordinator.mjs`. |
| `09-post-verification-bugs.md` 4 | Explain why better specifications improve later checks. | KEEP AS WORDS | The reason matters. |
| `10-production-bugs.md` 1 | Define severity, targets, and authority. | KEEP AS WORDS | This is human governance. |
| `10-production-bugs.md` 2 | Preserve evidence, ownership, communication, and postmortems. | KEEP AS WORDS | Incident policy needs words. |
| `10-production-bugs.md` 3 | Apply analyze, fix, verify, and release to production. | SCRIPT | Build `incident-workflow.mjs validate`. |
| `10-production-bugs.md` 4 | Explain regression growth, archive, and legacy adoption. | KEEP AS WORDS | It gives the long view. |

### Core Templates

| File and # | What the block says, in one line | Verdict | Why |
|---|---|---|---|
| `agents-md-template.md` 1 | Explain why shared rules are always loaded. | KEEP AS WORDS | Adoption guidance is useful. |
| `agents-md-template.md` 2 | Provide logging, safety, completion, YOLO, and checklist rules. | KEEP AS WORDS | This is the distributable policy. |
| `agents-md-template.md` 3 | Move repeatedly broken rules into checks. | KEEP AS WORDS | The design principle is sound. |
| `checklist-item-template.md` 1 | Define item metadata and observable fields. | SCRIPT | Create `checklist-schema.json` and a renderer. |
| `checklist-item-template.md` 2 | Show one complete UI item. | KEEP AS WORDS | A real example teaches quality. |
| `checklist-item-template.md` 3 | Define parallel ownership and dependencies. | KEEP AS WORDS | Planning needs judgement. |
| `checklist-item-template.md` 4 | Define required sections, status, misses, and outcomes. | SCRIPT | Enforce with `checklist-lint.mjs`. |
| `deployment-steps-template.md` 1 | Define automated and manual deployment rows. | KEEP AS WORDS | The contract is concise. |
| `deployment-steps-template.md` 2 | Show sqlcmd with credential arguments. | DELETE | It conflicts with the secret rule. |
| `deployment-steps-template.md` 3 | Require profile tools, protected secrets, and real start commands. | KEEP AS WORDS | These are correct safety rules. |
| `issues-file-template.md` 1 | Keep issue files until facts and miss IDs are durable. | KEEP AS WORDS | This is lifecycle policy. |
| `issues-file-template.md` 2 | Define Expected, Actual, Steps, Severity, cause, and Miss ID. | SCRIPT | Use `issues-file.mjs`. |
| `issues-file-template.md` 3 | Restrict cause labels and make telemetry secondary. | KEEP AS WORDS | Classification needs judgement. |
| `issues-file-template.md` 4 | Explain Jira ingestion. | DELETE | The command already owns it. |
| `verifier-agent.md` 1 | Summarize Verifier identity and permissions. | KEEP AS WORDS | It is a portable definition. |
| `verifier-agent.md` 2 | Summarize verdict, evidence, scope, and telemetry rules. | KEEP AS WORDS | It is a useful short contract. |
| `verifier-agent.md` 3 | List probes, runners, browser, bridge, and workers. | KEEP AS WORDS | Keep it profile-driven. |
| `verifier-agent.md` 4 | Explain why the context must be fresh. | KEEP AS WORDS | This is core assurance. |

### Handoff Templates

| File | What the block says, in one line | Verdict | Why |
|---|---|---|---|
| `handoffs/acceptance.md` | Record identity, evidence, decision, and exceptions. | SCRIPT | Build `handoff-record.mjs create acceptance`. |
| `handoffs/implementation-summary.md` | Transfer files, tests, risks, rollback, and ownership. | SCRIPT | Build `handoff-record.mjs create implementation-summary`. |
| `handoffs/incident.md` | Record severity, impact, timeline, evidence, cause, and actions. | SCRIPT | Build `handoff-record.mjs create incident`. |
| `handoffs/operations-transfer.md` | Transfer service resources, risks, and open work. | SCRIPT | Build `handoff-record.mjs create operations-transfer`. |
| `handoffs/plan-approval.md` | Record plan decision, approver, evidence, and exceptions. | SCRIPT | Build `handoff-record.mjs create plan-approval`. |
| `handoffs/pr-evidence.md` | Package review, CI, security, migration, rollback, and monitoring. | SCRIPT | Build `handoff-record.mjs create pr-evidence`. |
| `handoffs/release-readiness.md` | Record release authority, compatibility, rollback, and monitoring. | SCRIPT | Build `handoff-record.mjs create release-readiness`. |
| `handoffs/verification-results.md` | Transfer outcome, evidence, exceptions, and next action. | SCRIPT | Build `handoff-record.mjs create verification-results`. |

### Command Specifications In `templates/commands/`

| File and # | What the block says, in one line | Verdict | Why |
|---|---|---|---|
| `README.md` 1 | Explain the specification library and universal rules. | KEEP AS WORDS | It is the human index. |
| `README.md` 2 | List daily and administrative commands. | KEEP AS WORDS | Operators need command choice. |
| `README.md` 3 | Show rough token cost and optimization. | KEEP AS WORDS | It aids planning; label figures as targets. |
| `add-doc.md` 1 | Explain when and how to create companion guides. | KEEP AS WORDS | Concise command reference. |
| `add-doc.md` 2 | Summarize the two guide types. | KEEP AS WORDS | It is a useful short specification. |
| `amend-checklist.md` 1 | Explain targeted known changes. | KEEP AS WORDS | Concise operator reference. |
| `amend-checklist.md` 2 | Route work away from analysis, refresh, and fix. | KEEP AS WORDS | Command choice is useful. |
| `analyze-fix.md` 1 | Explain issue and story analysis. | KEEP AS WORDS | Concise operator reference. |
| `analyze-fix.md` 2 | Summarize context, escape analysis, checklist changes, and flags. | KEEP AS WORDS | It is an appropriate short contract. |
| `archive-checklist.md` 1 | Explain archive and restore. | KEEP AS WORDS | Concise operator reference. |
| `archive-checklist.md` 2 | Protect referenced and pattern-defining PASS items. | KEEP AS WORDS | Conservative policy is useful. |
| `archive-checklist.md` 3 | Claim history keeps only one line per item. | DELETE | It conflicts with the runnable rich record. |
| `create-issue-list.md` 1 | Explain Jira, URL, manual, and file input. | KEEP AS WORDS | Concise operator reference. |
| `create-issue-list.md` 2 | Summarize fields, parsing, output, and lifecycle. | KEEP AS WORDS | Keep it, but point secrets to protected input. |
| `feature-plan.md` 1 | Explain feature planning and output documents. | KEEP AS WORDS | Concise operator reference. |
| `feature-plan.md` 2 | Summarize inputs, naming, coverage, reports, and HTML. | KEEP AS WORDS | It is a useful short contract. |
| `fix.md` 1 | Explain failure-only repair and re-verification. | KEEP AS WORDS | Concise operator reference. |
| `fix.md` 2 | Summarize waves, smoke checks, and checklist updates. | KEEP AS WORDS | It is a useful short contract. |
| `generate-html.md` 1 | Explain Markdown to standalone HTML. | KEEP AS WORDS | Concise operator reference. |
| `generate-html.md` 2 | Summarize filtering, overwrite, and diagrams. | KEEP AS WORDS | It is a useful capability map. |
| `implement.md` 1 | Explain parallel checklist implementation. | KEEP AS WORDS | Concise operator reference. |
| `implement.md` 2 | Summarize completion, waves, side effects, and smoke checks. | KEEP AS WORDS | It is a useful short contract. |
| `legacy-audit.md` 1 | Summarize baseline evidence before legacy edits. | KEEP AS WORDS | It is already minimal. |
| `log-miss.md` 1 | Explain lightweight miss classification. | KEEP AS WORDS | Concise operator reference. |
| `log-miss.md` 2 | Limit work to vocabulary, append, and linkage. | KEEP AS WORDS | This safety boundary matters. |
| `refresh-doc.md` 1 | Explain one-document reconciliation. | KEEP AS WORDS | Concise operator reference. |
| `refresh-doc.md` 2 | Explain whole-feature reconciliation. | KEEP AS WORDS | The scope distinction is useful. |
| `update-context.md` 1 | Explain the cold-start context primer. | KEEP AS WORDS | The rationale is clear. |
| `update-context.md` 2 | Show when and how to refresh it. | KEEP AS WORDS | Concise operator guidance. |
| `upgrade-docs.md` 1 | Explain one-time legacy document conversion. | KEEP AS WORDS | Concise operator reference. |
| `upgrade-docs.md` 2 | Summarize sources, scope, links, and findings. | KEEP AS WORDS | It is a useful short contract. |
| `verify.md` 1 | Explain the thin wrapper around a fresh Verifier. | KEEP AS WORDS | This architecture is correct. |
| `verify.md` 2 | Summarize deployment, evidence, parallel work, and inline results. | KEEP AS WORDS | It is a concise contract. |

## 5. Documents To Merge, Shrink, Or Move

The repository contains 31 files and 57,105 words under `docs/`. An inbound reference below is one
matching line outside the document itself. The search included hidden paths and `verification/`.
No document has zero repository-wide references. That does not mean all 31 belong in the reader's
path: some references are package lists, tests, or old evidence.

| Document | Audience | Inbound reference lines | Decision |
|---|---|---:|---|
| `Adapter-Design.md` | Framework maintainers | 6 | Move to `docs/maintainers/`. |
| `Adoption-Metrics.md` | Process owners and team leads | 16 | Merge measures into the operating guide. |
| `Brownfield-Case-Study.md` | Teams adopting on legacy systems | 17 | Move to `docs/examples/`; keep as optional training. |
| `Capability-Matrix.md` | OpenCode integrators | 7 | Move to `docs/maintainers/`. |
| `Coupling-Points.md` | Harness maintainers | 5 | Merge live risks into maintainer design; archive history. |
| `Decisions.md` | Framework owners | 9 | Keep under `docs/maintainers/decisions/`; split by topic later. |
| `Environment-Profile.md` | Project operators | 14 | Merge into the operating guide. |
| `Getting-Started.md` | New corporate adopters | 10 | Keep as the main entry; shrink and link from `README.md`. |
| `Greenfield-Case-Study.md` | New product teams | 17 | Move to `docs/examples/`; keep as optional training. |
| `Handoffs.md` | Gate owners and approvers | 10 | Merge into the operating guide. |
| `Installation.md` | npm and OpenCode installers | 26 | Merge with Getting Started; retain a short install reference. |
| `Miss-Telemetry-AI-First-Playbook.md` | Telemetry maintainers | 6 | Merge contract details into maintainer telemetry reference. |
| `Miss-Telemetry-TechieFlow.md` | TechieFlow owner | 4 | Move to TechieFlow or `docs/archive/cross-framework/`. |
| `Miss-Telemetry-TfLens-From-AIFP.md` | TfLens team | 18 | Move to TfLens or `docs/integrations/tflens/`. |
| `Model-Routing-Guide.md` | OpenCode operators | 10 | Merge setup into the operating guide; details to maintainers. |
| `Npm-Publishing-Guide.md` | Package owner | 3 | Merge with npm release guide under maintainers. |
| `Npm-Release-Guide.md` | Release maintainers | 5 | Merge with publishing guide under maintainers. |
| `OpenCode-Guide.md` | OpenCode platform engineers | 12 | Merge current platform advice into the operating guide. |
| `OpenCode-Only-Framework-Implementation-Checklist.md` | Framework builders and Verifiers | 7 | Move to `docs/archive/checklists/`; keep links from durable decisions only. |
| `OpenCode-Setup-Guide.md` | Legacy Docker image maintainers | 2 | Move to `docs/archive/platform/`; it is not reader navigation. |
| `OpenCode-WSL-Setup-Guide.md` | Corporate Windows users | 20 | Keep as an optional platform guide; shrink its 7,479 words. |
| `Operating-Model.md` | Delivery team | 10 | Expand into the one operating guide. |
| `Phase-Efficiency-TfLens-Contract.md` | TfLens team | 16 | Move to TfLens or `docs/integrations/tflens/`. |
| `Release-And-Operations.md` | Release and operations owners | 14 | Merge into the operating guide. |
| `Repository-Structure.md` | Package users and maintainers | 17 | Split: reader paths into Getting Started; source layout into maintainers. |
| `Security.md` | All users handling secrets and evidence | 16 | Merge concise rules into the operating guide; keep detail as reference. |
| `Telemetry-Guide.md` | Operators and telemetry stewards | 43 | Merge basic use into operating guide; keep machine contract under maintainers. |
| `Telemetry-Hooks.md` | Plugin and data joiner maintainers | 18 | Move to `docs/maintainers/`. |
| `Troubleshooting.md` | Operators | 7 | Merge common cases into the operating guide. |
| `Usage.md` | npm package users | 18 | Merge with Getting Started and Installation. |
| `YOLO-Mode-Guide.md` | Unattended-run operators | 34 | Merge safe operation into the operating guide; keep supervisor detail as reference. |

`OpenCode-Setup-Guide.md` has only 2 inbound lines, both from a test or evidence file.
`Troubleshooting.md` has 7, but its source-tree links are packaging entries. `Getting-Started.md` has
10, but none comes from current README navigation. These files are not unreferenced; they are hard
for a reader to discover. The three documents that belong primarily to another product are
`Miss-Telemetry-TechieFlow.md`, `Miss-Telemetry-TfLens-From-AIFP.md`, and
`Phase-Efficiency-TfLens-Contract.md`.

The reader path after reset should contain `README.md`, one short `Getting-Started.md`, this
ten-phase `Playbook-How-It-Works.md`, the 10 files in `phases/`, the 29 templates, and one expanded
`Operating-Guide.md`. Examples move to `docs/examples/`. Maintainer contracts move to
`docs/maintainers/`. Old checklists and replaced documents move to `docs/archive/`. TfLens and
TechieFlow contracts move to their owner repositories when possible, with an archived pointer here.
No content is deleted without one of those homes.

### Template Schema Proposals

A schema is a fixed document shape that a tool can validate. Project sizes are measured by active
checklist items: small is 1-10, medium is 11-30, and large is 31-75. Split or archive above 75.
Budgets are TARGET / MAXIMUM words. A target guides normal writing; the maximum catches drift without
forcing early truncation.

| Template | Required sections in order | Optional sections | Small | Medium | Large | Every row must follow |
|---|---|---|---:|---:|---:|---|
| `agents-md-template.md` | Purpose; logging; UI; errors/data; standards; done; Verifier; docs; version control; completion; YOLO; checklist; enforcement | Project security, platform, ownership | 550/750 | 700/950 | 850/1,150 | One rule per bullet; reserve shouted words for invariants; no phase procedure. |
| `checklist-item-template.md` | Contract; item shape; example; parallel rules; required checklist sections; metadata/status; outcomes | Migration and compatibility notes | 350/500 | 400/550 | 450/600 | Stable ID; one behavior; exact path; executable Verify; acceptance shape below. |
| `deployment-steps-template.md` | Purpose; execution point; shape; Automated; Manual; tools/secrets | Rollback; environment branch | 100/180 | 200/320 | 320/500 | One action per row; automated row has one command or script; no secret values. |
| `issues-file-template.md` | Title; lifecycle; repeated issues; ingestion | Jira metadata, attachments, labels | 180/280 | 450/700 | 900/1,400 | One defect; Expected, Actual, Steps, Severity; ordered reproduction. |
| `verifier-agent.md` | Purpose; invocation; definition; write scope; outcomes; machinery; independence | Platform adapters; escalation examples | 500/700 | 650/900 | 800/1,100 | One invariant or mechanism per row; closed outcomes only. |
| `commands/README.md` | Purpose; universal rules; daily table; admin table; cost table | Install and routing notes | 350/500 | 420/600 | 500/700 | One command, persona, tier, and purpose per row. |
| `commands/feature-plan.md` | Contract; usage; inputs; document set; coverage; approval handoff | Report, BI, HTML branches | 350/500 | 500/700 | 650/900 | One output per row; state each condition. |
| `commands/implement.md` | Contract; usage; checklist inputs; waves; completion; self-review; handoff | YOLO, DB, UI, platform branches | 260/380 | 350/500 | 450/650 | Each wave row has dependency, owner, slice, and exit. |
| `commands/verify.md` | Contract; usage; checklist; deployment gate; probe; evidence; outcomes; handoff | UI, DB, desktop, runner branches | 260/380 | 350/500 | 450/650 | Each probe names action, assertion, evidence, and outcome effect. |
| `commands/fix.md` | Contract; usage; FAIL input; waves; self-test; update; handoff | Issues and YOLO branches | 260/380 | 350/500 | 450/650 | One failed requirement per work row; never mark own work PASS. |
| `commands/analyze-fix.md` | Contract; usage; inputs; cause; checklist changes; gap analysis; handoff | Story and escaped-bug branches | 350/500 | 500/700 | 650/900 | One issue; separate symptom, cause, checklist defect, and regression test. |
| `commands/add-doc.md` | Contract; usage; requested doc; code/runtime inputs; execution; output | Flow or business branch | 260/380 | 350/500 | 450/650 | One flow step; real names in developer docs; business language in business docs. |
| `commands/create-issue-list.md` | Contract; usage; sources; protected credentials; extraction; output; lifecycle | Manual items; attachments | 150/220 | 180/260 | 220/320 | One ticket; preserve source ID; mark missing facts. |
| `commands/generate-html.md` | Contract; usage; input; render; exclusions; overwrite; output | Folder and Mermaid branches | 150/220 | 180/260 | 220/320 | One transform; name skips and overwrite choice. |
| `commands/amend-checklist.md` | Contract; usage; checklist; exact change; validation; output | Legacy retrofit | 150/220 | 180/260 | 220/320 | One requested mutation; no speculative additions. |
| `commands/log-miss.md` | Contract; usage; one-line input; classification; writes; fixed branch; failure | None | 150/220 | 180/260 | 220/320 | One miss; closed values; append-only ID. |
| `commands/archive-checklist.md` | Contract; usage; checklist; eligibility; dependencies; archive/restore | Restore branch | 150/220 | 180/260 | 220/320 | One history row; stable ID, title, outcome, run, evidence. |
| `commands/update-context.md` | Contract; usage; context file; qualifying changes; reconcile; output | Gotcha and command index | 150/220 | 180/260 | 220/320 | One durable fact; no transient feature state. |
| `commands/refresh-doc.md` | Contract; usage; target; code/runtime reconciliation; output; defect handling | Mode A, Mode B, HTML | 260/380 | 350/500 | 450/650 | One discrepancy with old claim, evidence, change, and validation. |
| `commands/upgrade-docs.md` | Contract; usage; legacy inputs; reconcile; convert; review marks; output | Partial, no-UI, report branches | 260/380 | 350/500 | 450/650 | One converted requirement; preserve source and mark new findings. |
| `commands/legacy-audit.md` | Contract; usage; target/profile; inventory; map; baseline; risks; seams; handoff | UI, API, data probes | 350/500 | 500/700 | 650/900 | One component, dependency, risk, or invariant with evidence. |
| `handoffs/plan-approval.md` | Feature; parties; approver; transition; scope; evidence; decisions; escalation; exceptions; UTC | Notes | 100/150 | 130/190 | 160/230 | One field per row; enum decision; owner and date for open work. |
| `handoffs/implementation-summary.md` | Feature; parties; approver; transition; files/order; tests; risks/rollback; decisions/escalation; exceptions; UTC | Deployment notes | 110/170 | 150/220 | 190/280 | Link evidence; separate blockers from risks. |
| `handoffs/verification-results.md` | Feature/run; parties; Verifier; transition/outcome; checklist; evidence; decisions; escalation; exceptions; UTC | Environment | 100/160 | 140/210 | 180/260 | Closed outcomes; every non-PASS names item IDs. |
| `handoffs/acceptance.md` | Feature/scope; parties; approver; transition/decision; evidence; differences; decisions/escalation; exceptions; UTC | Notes | 100/150 | 130/190 | 160/230 | Separate accepted differences from expiring exceptions. |
| `handoffs/pr-evidence.md` | PR/feature; parties; approver; transition; scope; CI/evidence; reviews; migration/rollback/monitoring; decisions; exceptions; UTC | Reviewer notes | 100/160 | 140/210 | 180/270 | Use durable links; write `none` instead of blank. |
| `handoffs/release-readiness.md` | Feature/release; parties; owner; transition; approvals; migration; rollback; monitoring; escalation; exceptions; UTC | Window | 120/180 | 170/250 | 220/320 | Every action has an owner; thresholds are observable. |
| `handoffs/operations-transfer.md` | Service; owners; parties; approver; transition; resources; risks/support; evidence; open work; exceptions; acceptance; UTC | Training | 120/180 | 170/250 | 220/330 | Every resource resolves; open work has owner and date. |
| `handoffs/incident.md` | Incident/severity; parties; authorities; approver; transition; impact; evidence; timeline; cause; regression; actions; exceptions; postmortem; UTC | Detection and related incidents | 150/230 | 220/320 | 300/450 | UTC timeline; separate fact from theory; link regression item. |

The eight handoff schemas all include the 10 standing fields required by `AGENTS.md:17-19`:
producer, consumer, accountable approver, identity, UTC time, status transition, evidence, open
decisions, escalation owner, and exception expiry.

### Worked Checklist Item Schema

The generated item budget is 90 / 130 words at every project size. Large projects get more focused
items, not longer items.

| Order | Row | Rule |
|---:|---|---|
| 1 | Metadata | Required keys in stable order: schema, id, owner, priority, risk, status, dates, evidence, misses. |
| 2 | Checkbox and title | Presentation only; title is unique, verb-led, and one behavior. |
| 3 | Type | One of UI, backend API, backend service, DB, logging, infrastructure, cross-cutting. |
| 4 | Behavior | One sentence naming an observable result. |
| 5 | Location | Exact repository path; add symbol or route when useful. |
| 6 | UI ref | Required only for UI; name screen, position, and reused pattern. |
| 7 | Logging | Name start, completion, count, and error signals, or `None` with a reason. |
| 8 | Acceptance | Exactly `When <actor> <does what> on <screen>, then <a result a machine can observe>`. Target 20 words, maximum 30, one behavior. |
| 9 | Verify | Name tool, action, assertion, and retained evidence. A fresh Verifier can execute it. |
| 10 | Coding Standards | Name the exact document and section. |
| 11 | Depends on | Optional; stable IDs only; no dependency cycle. |
| 12 | Verifier Result | Added only by verification; outcome, observation, action, evidence, identity, UTC. |

Do not join separate outcomes with `and`. Do not use subjective words such as `correctly` or
`user-friendly`. Consolidate ownership of shared files. Keep `misses` append-only.

```markdown
<!-- metadata: {"schema":1,"id":"REQ-014","owner":"frontend-reports","priority":"P1","risk":"medium","status":"planned","created_at":"2026-09-07T00:00:00Z","updated_at":"2026-09-07T00:00:00Z","evidence":[],"misses":[]} -->
- [ ] Export the filtered Cost Report grid
  - Type: ui
  - Behavior: Selecting Export downloads a workbook containing the visible filtered rows.
  - Location: `src/frontend/src/Components/Reports/Cost/ExportButton.tsx`
  - UI ref: Cost Report screen, top-right toolbar; reuse the report toolbar button pattern.
  - Logging: INFO at start and completion with row count; ERROR with report ID on failure.
  - Acceptance: When a report user selects Export on the Cost Report screen, then the downloaded workbook row count equals the visible filtered grid row count
  - Verify: Playwright records the grid count, selects Export, parses the workbook, asserts equal row counts, and retains the trace and workbook hash.
  - Coding Standards: `docs/coding-standards.md`, section 4.2, Report toolbar actions.
```

The acceptance line has 24 words and one machine-observable behavior. The prompt records 14
TechieFlow misses from acceptance lines with two honest readings. This repository's five miss
records do not include that cause, so the 14 is evidence from TechieFlow, not this Playbook.

## 5b. What To Do About `verification/`

`verification/` contains 174 Markdown files and 196,498 words, or 61.9 percent of the measured
317,385-word repository. This rounds to the prompt's 62 percent. It holds three campaigns from
2026-09-02.

The campaigns prove something worth keeping. Campaign V01 found 2 broken README links after 5 of 7
items passed. V02 reran the failed scope and reached 7 of 7 PASS. V03 repeated all 7 items, scanned
354 files for removed integration markers, checked 100 Markdown files with 0 broken links, packed a
75-file npm archive, installed 73 target files, and scanned 72 installed source files with 0 banned
markers or artefacts. That is the only stored proof found here that a packed OpenCode-only install
worked end to end on 2026-09-02.

Nothing in the current validator or installer tests executes a campaign file. The old framework
checklist has 27 matching lines that point into these campaign folders, and two state files plus one
campaign helper point within the folders themselves. Those links are historical dependencies, not
runtime dependencies. The current `npm run test:install` independently repeats package and install
behavior in a temporary folder.

Recommended treatment:

1. Before moving anything, export V01-V03 once to an immutable release asset or the company's
   approved evidence store. Keep that historical asset for one year, or the company's longer audit
   period. Record its hash and location in the archived OpenCode-only checklist.
2. Move reusable checks from V01 and V03 into maintained self-tests. The source scan, relative-link
   audit, document structure check, packed install, and installed-source scan must become commands
   anyone can rerun. The current installer suite already covers much of the packed install.
3. After the release asset and self-tests are independently reviewed, remove the three committed
   campaign trees. Do not remove them before that proof exists elsewhere.
4. Put future raw evidence in an ignored `verification/runs/` folder. Sweep it after 7 days. Keep
   logs, screenshots, temporary runners, installed targets, and tarballs there.
5. Keep one compact verdict record per run for one year in CI artefacts or the approved telemetry
   store, not in the repository. It should contain run ID, requirement IDs, outcomes, tool versions,
   self-test version, hashes, and evidence links. It must contain no secret values.
6. Keep durable proof as executable tests and the miss stream, not copies of their output. Keep the
   small checklist result and decision record in `docs/archive/checklists/` after its 27 campaign
   links point to the external asset.

This is a recommendation, not an assumption. The owner must confirm the external evidence home and
retention rule before any campaign is removed.

## 6. Requirements For The Playbook And Its Grader

### Real Enforcement Today: 22 Of 66 Rules, Or 33.3 Percent

A rule unit has one subject, condition, required result, and enforcement boundary. Duplicate wording
counts once. A script-enforced rule has an executable artefact that can return failure. A prose rule
depends on an agent or person reading words. This method found 32 mechanically represented rules and
34 prose-only rules, for 66 total. Only 22 exact rules had a matching check run in this session and
produce a pass or fail. The other 44 did not.

| Cluster | Rule units | Main paths |
|---|---:|---|
| OpenCode config and plugins | 14 mechanical | `opencode.json`, `harness/opencode/plugin/` |
| Miss and run telemetry | 5 mechanical | `scripts/miss-lib.mjs`, `playbook-miss.mjs`, `playbook-telemetry.mjs` |
| Model routing | 2 mechanical | `playbook/model-tiers.yml`, routing scripts |
| Installer and npm package | 5 mechanical | `scripts/install.mjs`, lifecycle scripts, `package.json` |
| Validation, workflows, and provisioning | 6 mechanical | validator/tests, `.github/workflows/`, `provision-wsl.sh` |
| Standing agent conduct | 11 prose | `AGENTS.md` |
| Plan, build, and self-review | 8 prose | phases 1-4 and their commands |
| Verify and result handling | 6 prose | phases 5-6 and Verifier prompt |
| Fix, acceptance, and escaped bugs | 5 prose | phases 7-10 and their commands |
| Documents, Jira, progress, and model use | 4 prose | document commands and `model-tiers.yml` |

The successful session commands were `node scripts/apply-model-tiers.mjs --check`,
`npm run validate`, `npm run test:guardrails`, `npm run test:misses`, `npm run test:install`,
`npm run pack:check`, `bash -n scripts/provision-wsl.sh`, read-only OpenCode diagnostics, and
disposable install checks. Node was 22.23.2 and met `package.json:70`. npm was 10.9.8 and did not meet
the required 11.5.1, although all npm checks run here passed. No Git command ran.

| The rule | Where it is stated | The check it claims | Runs today? | Proof |
|---|---|---|---|---|
| M01 Load standing rules, profile, agents, and MCP config | `opencode.json:3-13` | OpenCode config resolution | Yes | `opencode debug config`, agent list, and MCP list resolved; source commands were 0. |
| M02 Enforce agent modes and tool permissions | `opencode.json:5-9` | OpenCode agent resolution | Yes | Analyst Bash denial and three allowed roles resolved. |
| M03 Load guardrails before YOLO | `opencode.json:4`; validator line 121 | Validator plus resolved plugin order | Yes | Static check passed; live order failed: source was YOLO, telemetry, guardrails. |
| M04 Block separate report names | `write-policy.mjs:24-56` | Pure policy and guardrail fixtures | Yes | `Feature-Gap-Report.md` returned the expected block. |
| M05 Reject escaping, absolute, or linked paths | `write-policy.mjs:158-173` | Pure path policy | Yes | `../outside` returned the expected block. |
| M06 Restrict Verifier writes | `write-policy.mjs:206-217`; `spec-guardrails.ts:22-63` | Verifier policy plus live hook | No | Unit input passes, but supported hook input has no `agent`; live identity cannot activate. |
| M07 Allow miss writes only through the fixed CLI shape | `write-policy.mjs:68-138` | Parser plus live Verifier hook | No | Parser fixtures pass; the same missing Verifier identity prevents live scope. |
| M08 Deny targetless Verifier shell writes | `write-policy.mjs:240-249` | Pure policy plus live hook | No | Pure policy wrongly blocks harmless `npm test`; live Verifier branch is not proven. |
| M09 Recognize YOLO environment and token | `yolo-policy.mjs:34-47` | YOLO fixtures | Yes | Environment values and standalone token cases passed. |
| M10 Auto-answer OpenCode permission requests in YOLO | `yolo.ts:48-61` | `permission.ask` hook | No | The policy function passes, but no live permission event was observed. |
| M11 Deny Git and selected `gh` writes in YOLO | `yolo-policy.mjs:53-150` | Classifier plus live hook | No | Pure strings classify correctly; a live OpenCode tool call was not tested. |
| M12 Parse provider limits and retry times | `yolo-policy.mjs:156-319` | Seven fixed parser cases | Yes | All seven rate-limit cases passed. |
| M13 Persist and resume a limited session | `playbook-yolo.mjs:94-259` | Supervisor run | No | Source was read; no real limit/resume run occurred. |
| M14 Capture sanitized OpenCode events | `telemetry.ts:37-205` | Live telemetry plugin | No | Discovery and static terms passed; no live event capture was tested. |
| M15 Join events into phase measures | `miss-lib.mjs:229-665` | Telemetry fixtures | Yes | Parent, child, timing, tokens, cost, and incomplete-window cases passed. |
| M16 Keep miss writes opt-in | `playbook-miss.mjs:10-126` | Miss CLI | Yes | `next-id` returned `MISS-20260907-01` without writing. |
| M17 Validate miss values, types, and provenance | `miss-lib.mjs:26-101,680-932` | Miss fixtures | Yes | Relevant checks in the 24-check suite passed. |
| M18 Enforce IDs, collapse, amend, fix, and reopen rules | `miss-lib.mjs:103-227,771-823` | Miss fixtures | Yes | Lifecycle cases in the 24-check suite passed. |
| M19 Derive model and cost only from valid windows | `miss-lib.mjs:667-678,935-974` | Attribution fixtures | Yes | Complete, missing, shared, and invalid cases passed. |
| M20 Keep model stamps equal to the tier map | `apply-model-tiers.mjs`; `tier-lib.mjs` | `--check` | Yes | Reported routing OFF and matching stamps. |
| M21 Apply routing and escalation as stated | `playbook-routing.mjs`; `model-tiers.yml` | Routing status only | No | Status ran, but routing was OFF and escalation is advisory. |
| M22 Reject unsafe install targets and support dry run | `install.mjs:120-160` | Installer fixtures | Yes | Dry run and unsafe target cases passed. |
| M23 Preserve unowned files and ownership records | `install.mjs:150-289` | Installer fixtures | Yes | Reinstall, uninstall, force, and symlink cases passed. |
| M24 Install the hidden OpenCode runtime | `install.mjs:17-270` | Disposable install and resolution | Yes | Five runtime groups verified and all 14 commands resolved. |
| M25 Clean npm lifecycle footprint | `npm-lifecycle.mjs`; `npm-cleanup.mjs` | Installer lifecycle fixture | Yes | Plain npm and one-shot install fixtures passed. |
| M26 Ship only the intended npm payload | `package.json:12-70` | npm dry-run pack | Yes | 78 files, 244.2 kB packed size, 701.8 kB unpacked. |
| M27 Validate required files, removed artefacts, names, parity, and front matter | `playbook-validate.mjs:13-87,115-137` | `npm run validate` | Yes | Validator passed. |
| M28 Validate workflow strings, plugins, metadata, misses, and ignores | `playbook-validate.mjs:88-197` | `npm run validate` | Yes | Static checks passed; they do not prove live behavior. |
| M29 Run regression fixture suites | `test-guardrails.mjs`; `test-misses.mjs`; `test-install.mjs` | Three npm test commands | Yes | All passed; miss suite ran 24 checks. |
| M30 Run all checks on push and pull request | `.github/workflows/validate.yml:1-13` | GitHub Actions | No | Workflow text was checked; no Actions run occurred this session. |
| M31 Gate and publish a release with provenance | `.github/workflows/release.yml:3-97` | GitHub Actions release | No | Workflow text and package dry run passed; no release ran. |
| M32 Keep WSL provisioning shell syntax valid | `provision-wsl.sh:22-189` | `bash -n` | Yes | Exit 0 with no output; provisioning behavior was not run. |
| P01 Checklist metadata and Status Table are authoritative | `AGENTS.md:3-19` | None | No | Prose and template only. |
| P02 Read the profile and never guess environment facts | `AGENTS.md:3-5`; phase 3 | None | No | Current profile still has placeholders. |
| P03 Keep secrets out of arguments, Markdown, logs, URLs, and evidence | `AGENTS.md:7-8` | Narrow example scan only | No | The broad rule has no matching check. |
| P04 Persist all 10 handoff fields at every gate | `AGENTS.md:17-19` | Templates | No | No state checker validates every gate. |
| P05 Never stage or change Git history outside allowed human direction | `AGENTS.md:21-27` | YOLO-only partial policy | No | Normal mode remains prose. |
| P06 Keep verification independent and route fixes through `/fix` | `AGENTS.md:10-15`; phase 5 | Prompt | No | No test proves context independence. |
| P07 Finish every build or fix item in one phase | `AGENTS.md:29-37`; phase 3 | Prompt | No | No completion checker recomputes status. |
| P08 Carry prompt-token YOLO into every child | `AGENTS.md:41-44` | Prompt | No | Mechanical mode needs an environment value. |
| P09 Ask no questions in YOLO and record reversible decisions | `AGENTS.md:46-54` | Prompt | No | No transcript check ran. |
| P10 Resume without repeating work and stop only complete or externally blocked | `AGENTS.md:62-74` | Prompt and supervisor | No | No full resume run occurred. |
| P11 Handle stale WSL ownership through Windows move | `AGENTS.md:78-100` | Manual procedure | No | Not exercised. |
| P12 Plan from complete inputs and ask rather than guess | `phases/01-plan.md`; `feature-plan.md` | Analyst prompt | No | No planted missing-input fixture exists. |
| P13 Produce complete documents and seven-field items | `phases/01-plan.md`; `feature-plan.md` | Self-check text | No | No schema validator covers output. |
| P14 Pass a human plan review gate | `phases/02-plan-review-gate.md` | Human checklist | No | Review only. |
| P15 Use dependency-safe waves and one owner for shared files | `phases/03-build.md`; `implement.md` | Orchestrator prompt | No | No ownership conflict checker exists. |
| P16 Preserve patterns, fidelity, logging, errors, and honest results | `builder.md`; `implement.md` | Builder prompt | No | Review only. |
| P17 Use raw SQL and sqlcmd, not Entity Framework | `phases/03-build.md:53-54` | Prompt | No | No check; rule should be profile-driven. |
| P18 Maintain deployment, infrastructure, and status sections | `phases/03-build.md`; `implement.md` | Prompt | No | No checklist shape check covers all three. |
| P19 Build, run, probe, inspect data/UI/logs, and clean up | `phases/04-self-review.md` | Prompt | No | No end-to-end fixture ran. |
| P20 Give verification a fresh context with no build memory | `phases/05-verify.md`; `verify.md` | Subtask plus prompt | No | Agent mode resolved; memory separation was not tested. |
| P21 Run deployment steps first and stop on failure | `phases/05-verify.md`; Verifier | Prompt | No | No planted failed-deployment run exists. |
| P22 Use real config and runtime evidence for all item types | `phases/05-verify.md`; Verifier | Prompt | No | Placeholder profile blocks an application run. |
| P23 Give every item a legal evidence-backed result | `phases/06-verification-results-gate.md` | Prompt | No | No complete checklist result validator exists. |
| P24 Use BLOCKED last and DATA-GAP only for missing data | `verifier.md` rules 8-9 | Prompt | No | No decision fixture grades these choices. |
| P25 Serialize miss writes and let only independent PASS close them | phases 3, 6, and 7 | Prompt plus CLI | No | CLI semantics pass; orchestration order was not tested. |
| P26 Fix only active failures and loop until all pass | `phases/07-fix.md`; `fix.md` | Prompt | No | No full fix loop fixture exists. |
| P27 Record human acceptance durably | `phases/08-human-acceptance.md` | Human template | No | Review only. |
| P28 Add cause, missed-check analysis, checklist patch, and miss for escapes | `phases/09-post-verification-bugs.md` | Prompt | No | No escaped-bug fixture grades all outputs. |
| P29 Apply severity, evidence, authority, and postmortem rules | `phases/10-production-bugs.md` | Human process | No | Review only. |
| P30 Archive only mature PASS items and preserve restorable history | phase 10; archive command | Prompt | No | No archive schema or round-trip test exists. |
| P31 Render only human documents as HTML | feature plan; HTML command | Prompt | No | No renderer script or classification test exists. |
| P32 Fetch Jira safely and render complete issues | issue command | Prompt | No | No Jira fixture or secret-channel check exists. |
| P33 Alternate progress messages with tool work | implement, fix, Verifier | Prompt | No | This is interface prose and should be deleted. |
| P34 Use model tiers and escalate fixes | `model-tiers.yml`; Builder | Advisory routing | No | Routing is OFF and no model switch occurs mid-run. |

### Preliminary Reset Requirements

This session may create only two Markdown files, so it cannot honestly mark a new requirement as
`script` or `fixture run`. All 18 lines below are therefore `review`. The current headline is
**0 of 18 graded**. Session 1 must write the grader and the machine-checkable lines together, then
change only the lines that have real artefacts.

| ID | Requirement | Grade kind now | Reason it is not graded now |
|---|---|---|---|
| PB-01 | A packed npm install resolves all 14 OpenCode commands and four agents. | review | The reset grader does not exist. |
| PB-02 | OpenCode is the primary runtime; no second coding harness ships. | review | Existing scan is narrow and no new grader calls it. |
| PB-03 | Every phase has one measured instruction total and stays below its tier maximum. | review | No instruction counter exists. |
| PB-04 | The Verifier live write boundary blocks product edits and allows safe test commands. | review | The current live agent identity is broken. |
| PB-05 | Normal and YOLO modes both deny unapproved Git history changes. | review | Only pure YOLO classification is tested. |
| PB-06 | Every checklist item follows the ordered schema and acceptance sentence rule. | review | No checklist schema validator exists. |
| PB-07 | Every handoff contains all 10 standing fields. | review | No handoff validator exists. |
| PB-08 | Every template declares required order, optional parts, TARGET, and MAXIMUM. | review | This plan proposes it; no linter exists. |
| PB-09 | Every claimed script check names a file that exists and is invoked by the grader. | review | The grader does not exist. |
| PB-10 | The grader reports one result or one explicit ungraded reason per requirement. | review | The grader does not exist. |
| PB-11 | The headline is `N of M graded`, not only a pass count. | review | The grader does not exist. |
| PB-12 | Every grader result appends one redacted verdict record to telemetry. | review | No grader telemetry record exists. |
| PB-13 | Miss records answer the four protocol questions in order and store one outcome. | review | The current miss schema lacks the outcome field. |
| PB-14 | Raw run evidence is ignored, swept after 7 days, and kept out of npm. | review | Retention tooling does not exist. |
| PB-15 | Durable OpenCode-only proof is a rerunnable self-test plus an external historical asset. | review | The external home needs owner approval. |
| PB-16 | The reader path is Getting Started, ten phases, templates, and one operating guide. | review | Navigation has not been reset. |
| PB-17 | TechieFlow and TfLens documents are outside the normal Playbook reader path. | review | Their destination needs owner approval. |
| PB-18 | Release validation uses the declared Node and npm versions and runs all graded checks. | review | No release ran in this session. |

### Grader Deliverable

In Session 1, create `docs/Playbook-Requirements.md` and `scripts/playbook-grade.mjs` together. The
one command will be `node scripts/playbook-grade.mjs docs/Playbook-Requirements.md`. It will walk
every ID once. It will run a named script, run a named fixture, or emit `ungraded` with the written
review reason. It will never infer PASS from missing output. It will print `N of M graded`, followed
by pass, fail, and ungraded counts. It will append one redacted `grader-verdict` record per ID through
the telemetry library. Until that same session writes and tests the script, this paragraph is a plan,
not an enforcement claim.

## 7. The Miss Protocol, As Recorded And Reported

The repository can show some failures. `verification/telemetry/misses.ndjson` has 10 valid records:
5 `miss` records and 5 closing `miss-fix` records. All 5 unique misses are closed as PASS, so the
current backlog is 0. There are 0 `miss-amend` records. `docs/metrics/` is absent.

| View | Exact count |
|---|---:|
| Cause `instruction-ignored` | 3 of 5 misses |
| Cause `insufficient-verify-method` | 2 of 5 misses |
| Origin phase `build` | 4 of 5 misses |
| Origin phase `self-review` | 1 of 5 misses |
| Found in `human-acceptance` | 2 of 5 misses |
| Found in `verification-results-gate` | 2 of 5 misses |
| Found in `self-review` | 1 of 5 misses |
| Found by a human | 2 of 5 misses |
| Found by the Verifier | 2 of 5 misses |
| Found by agent review | 1 of 5 misses |
| Class `partial-implementation` | 3 of 5 misses |
| Class `scope-creep` | 2 of 5 misses |
| Severity `major` | 5 of 5 misses |

The framework can show what it got wrong, but five misses are too few to support a trend claim. The
first reset should improve collection and grading, not add more prose.

### Four Questions

Ask these in order. Stop at the first fixed response. Store the response code in
`protocol_outcome` on the miss record.

| Order | Question | Trigger | Fixed response | Stored value |
|---:|---|---|---|---|
| 1 | Did the project's spec say it clearly? | no | Fix the checklist line. Framework untouched. | `spec-gap` |
| 2 | Did the Playbook say it anywhere? | no | Add one requirement line plus a check. | `playbook-gap` |
| 3 | Was there a check, and did it fail to catch it? | yes | Fix the check, not the prose. | `weak-check` |
| 4 | Was it written and ignored anyway? | yes | Make it a script or a gate, or delete it. | `ignored-rule` |

Reports show counts by `protocol_outcome`, origin phase, discovery phase, and finder. They do not
rank people. A rule ignored twice does not get a third paragraph. It becomes a check or is removed.
TechieFlow's roughly one-half weak checks, one-quarter missing rules, and one-quarter ignored rules
explain the order, but they are not Playbook counts. This Playbook currently has 2 of 5 misses named
`insufficient-verify-method` and 3 of 5 named `instruction-ignored`.

### Incident-Driven Rules Already Present

`Ai-First-Playbook-Gap.md` names hardening areas but gives no individual incident narratives.
`docs/Decisions.md` records 20 incident-driven rules. `Enforced` below means a repository artefact
checks or implements at least the named narrow behavior. It does not override the live gaps in
Section 6.

| # | Incident-driven rule | Mark | Path behind the mark |
|---:|---|---|---|
| 1 | Use OpenCode `{env:VAR}`, not shell-style environment substitution. | Enforced | `opencode.json`; `harness/opencode/opencode.json` |
| 2 | Load the real, case-correct environment profile path. | Enforced | Both OpenCode config files |
| 3 | Detect shell redirection both with and without a space. | Enforced | `write-policy.mjs:186-192`; guardrail fixtures |
| 4 | Keep one discoverable plugin folder and pure policy in `.mjs`. | Enforced | `harness/opencode/plugin/` structure |
| 5 | Package OpenCode at install time; do not add a runtime adapter. | Enforced | `scripts/install.mjs`; installer fixtures |
| 6 | Give Builder subagents their own standard tier. | Enforced | `model-tiers.yml`; `builder.md`; tier script |
| 7 | Ship routing OFF and remove every model stamp when off. | Enforced | `model-tiers.yml`; routing scripts |
| 8 | Let one routing script own map and stamp changes. | Enforced | `playbook-routing.mjs`; `apply-model-tiers.mjs --check` |
| 9 | Do not pin OpenCode; use checks and a planted live defect after upgrades. | Prose | `Decisions.md:91-110`; the live planted test is manual |
| 10 | In YOLO, auto-allow work except history and publishing writes. | Enforced | `yolo-policy.mjs`; live permission hook remains unproved |
| 11 | In YOLO, do not stop at in-prompt approval questions. | Prose | `AGENTS.md`; command prompts |
| 12 | Resume provider-limited runs from an external supervisor. | Enforced | `scripts/playbook-yolo.mjs`; parser fixtures |
| 13 | End unattended runs with COMPLETE or BLOCKED sentinel text. | Enforced | Supervisor consumes it; production remains prompt-driven |
| 14 | Finish the full `/implement` or `/fix` scope in one phase. | Prose | `AGENTS.md`; implement and fix prompts |
| 15 | Keep misses separate and durable; rotate only raw events. | Enforced | miss CLI, validator, and `.gitignore` |
| 16 | Let agents classify, but derive model, tokens, and cost. | Enforced | `miss-lib.mjs`; telemetry joiner; miss fixtures |
| 17 | Correct append-only records with `miss-amend`, never edits. | Enforced | `miss-lib.mjs`; miss fixtures |
| 18 | Treat abandoned work differently for backlog and duplicate collapse. | Enforced | `miss-lib.mjs`; miss fixtures |
| 19 | Use `instruction-ignored` only when an agent loaded the rule. | Enforced | `miss-lib.mjs`; miss fixture 20 |
| 20 | Never report miss, time, token, or cost figures by actor. | Prose | Adoption and telemetry documents; exporters still carry actor |

## 8. Ordered Work Sessions

Shared files come first even though that is outside lifecycle order. `AGENTS.md` and the profile add
2 files and 1,072 words to every agent phase. Shrinking and clarifying them reduces every phase at
once.

| Session | Goal | Inputs the owner brings | Output files |
|---:|---|---|---|
| 1 | Agree the small Playbook requirement list and build its grader while shrinking shared rules. | Approved 18-line scope, corporate retention period, supported OpenCode version, and allowed secret channels. | `docs/Playbook-Requirements.md`, `scripts/playbook-grade.mjs`, tests, `AGENTS.md`, `playbook/environment-profile.yml` |
| 2 | Repair live OpenCode enforcement before trusting more policy prose. | A disposable target repo and permission to run live planted write, shell, normal-mode, and YOLO probes. | `harness/opencode/plugin/spec-guardrails.ts`, `yolo.ts`, policy fixtures, grader records |
| 3 | Reduce the 8,630-word Verifier to a short core plus conditional adapters. | One UI item, one API item, one DB item, and one desktop item from real corporate projects. | `harness/opencode/agent/verifier.md`, `playbook-probe.mjs`, lifecycle and profile gate scripts |
| 4 | Create the checklist and handoff schemas with validators. | Three small, medium, and large approved checklists plus all eight accepted handoff examples. | `checklist-schema.json`, `checklist-lint.mjs`, `handoff-schema.json`, `handoff-record.mjs` |
| 5 | Shrink plan, build, fix, and analyze commands around those schemas. | One greenfield feature, one escaped bug, and one failed item set. | `feature-plan.md`, `implement.md`, `fix.md`, `analyze-fix.md`, planning and phase-completion fixtures |
| 6 | Replace mechanical documentation procedure with shared tools. | Approved document shapes and representative legacy documents. | document scaffold, drift, upgrade, HTML, and reference-lint scripts plus shortened commands |
| 7 | Reset reader navigation to one entry, ten phases, templates, and one operating guide. | Owner decisions on WSL detail, release ownership, security policy, and TfLens/TechieFlow destinations. | `README.md`, `Getting-Started.md`, `Operating-Guide.md`, moved maintainer/example/archive documents |
| 8 | Preserve the historical OpenCode proof outside Git and start seven-day raw evidence retention. | Approved external evidence location and one-year or corporate retention period. | external V01-V03 asset, archived checklist links, ignored run folder, sweep job |
| 9 | Run a fresh npm-to-OpenCode grading campaign. | Clean disposable target, supported Node 22.14.0+ and npm 11.5.1+, and package publish candidate. | one grader result stream, CI artefact, updated miss records, and `N of M graded` headline |

Each session ends with an independent grader run. Any line that still lacks a real script or fixture
is reported as ungraded with its reason. The reset is complete only when the owner accepts the
remaining review lines and the grader reports every script and fixture line without guessing.

### Session Record

Each line states what the session delivered and the grader headline at its close
(`node scripts/playbook-grade.mjs docs/Playbook-Requirements.md`).

- **Session 1 — Done 2026-09-26:** `docs/Playbook-Requirements.md` (PB-01 to PB-18), `scripts/playbook-grade.mjs`, the grader-verdict stream in `scripts/miss-lib.mjs`, `tests/grader/` and `tests/package/` (the packed install is resolved by OpenCode 1.18.32); `AGENTS.md` cut from 943 to 485 words (WSL procedure moved to the WSL guide §10f); the profile names the four secret channels and the 7-day / 1-year retention. Grader: **6 of 18 graded**, pass 6, fail 0, ungraded 12.
- **Session 2 — Done 2026-09-26:** `spec-guardrails.ts` learns each session's agent from `chat.params`, `chat.message` and `message.updated`, so the Verifier boundary works on OpenCode's real hook input, and blocks git history writes in normal mode (`PLAYBOOK_GIT_APPROVED=1` lifts it outside YOLO); `tests/plugin/` drives the installed plugins in a disposable project; `tests/live/` runs real `opencode run` against a scripted local model and keeps redacted transcripts; PB-19 (live, graded) and PB-20 (real model, runbook) added. The PB-04 allowance for safe Verifier test commands was not made: it was refused as a security relaxation and is left for the owner. Grader: **8 of 20 graded**, pass 8, fail 0, ungraded 12.
- **Session 3 — Done 2026-09-26:** `verifier.md` cut from 8,508 to 484 words and `/verify` from 458 to 115; five conditional adapters under `.opencode/templates/verifier/`; `playbook-probe.mjs`, `playbook-app-lifecycle.mjs`, `profile-gates.mjs`, `checklist-plan.mjs verify` with `profile-lib.mjs` and `checklist-lib.mjs`, installed under `.playbook/scripts/`; `tests/verifier/` with the case-study UI, API, DB and a labelled synthetic desktop item; PB-21 to PB-24 added. The fixtures caught two real bugs before commit (escaped quotes in the profile reader; `VAR=value` prefixes in the probe). Grader: **12 of 24 graded**, pass 12, fail 0, ungraded 12.
- **Session 4 — Done 2026-09-26:** `playbook/checklist-schema.json` with `checklist-lint.mjs` (the acceptance sentence rule, field order, metadata order, dependencies, Status Table, size classes, split above 75), `playbook/handoff-schema.json` with `handoff-record.mjs` (`template`, `create`, `validate`; all 10 standing fields in all eight kinds), the eight handoff templates regenerated from the schema, a `template-schema` block in all 29 templates with `scripts/template-lint.mjs`; `tests/checklist/` (small 6, medium 14, large 34 items; 12 broken twins) and `tests/handoff/` (eight examples; nine broken twins). Grader: **15 of 24 graded**, pass 15, fail 0, ungraded 9.
- **Session 5 — Done 2026-09-26:** `/implement` 3,939 → 385 words, `/fix` 2,702 → 314, `/feature-plan` 2,534 → 482, `/analyze-fix` 2,361 → 466, orchestrator 119 → 67; every phase's fixed surface is now within its tier maximum (`scripts/instruction-budget.mjs`: plan 1,090/1,800, build 1,023/1,200, verify 1,124/1,200, fix 951/1,200, escaped bugs 1,071/1,800, production 3,146/5,400); new runtime scripts `checklist-plan.mjs implement|fix`, `phase-complete.mjs`, `plan-coverage.mjs`, `checklist-create.mjs`, `checklist-miss-coordinator.mjs`; the miss record's additive `protocol_outcome`, derived from the four questions; `tests/phase/` with the greenfield BRD, the failed item set and the escaped bug; PB-25 to PB-28 added and PB-03, PB-13 graded. Grader: **21 of 28 graded**, pass 21, fail 0, ungraded 7.
- **Session 6 — Done 2026-09-26:** `playbook/document-schemas.json` for six human document kinds with `doc-scaffold.mjs` and `doc-check.mjs`, `render-docs.mjs` (escaped, agent documents refused), `doc-drift.mjs`, `reference-lint.mjs` and `doc-upgrade.mjs` (backup and report), all installed under `.playbook/scripts/`; `docs/Playbook-Document-Schemas.md` generated from the schema files; `/add-doc` 4,707 → 438 words, `/refresh-doc` 2,496 → 276, `/upgrade-docs` 3,528 → 366, `/generate-html` 1,002 → 88; `tests/docs/` over the Team Inventory fixtures and the legacy documents under `docs/`; PB-29 to PB-32 added. Grader: **25 of 32 graded**, pass 25, fail 0, ungraded 7.
- **Session 7 — Done 2026-09-26:** reader path reset to `README.md` → `docs/Getting-Started.md` (5,309 → 709 words) → `docs/Playbook-How-It-Works.md` → `phases/` → `templates/` → the new `docs/Operating-Guide.md`; examples to `docs/examples/`, maintainer references (with the WSL guide and a merged npm release guide owned by the owner) to `docs/maintainer/`, TechieFlow and TfLens documents to `docs/maintainer/cross-framework/`, the old OpenCode-only checklist, the Docker setup guide, the merged originals and the review copies to `docs/archive/`; 108 links rewritten, none broken; installer, package list, validator and tests follow the new layout; `scripts/reader-path.mjs` with `tests/navigation/` grades PB-16 and PB-17. Grader: **27 of 32 graded**, pass 27, fail 0, ungraded 5.
- **Session 8 — Done 2026-09-26:** V01-V03 and the YOLO supervisor state moved from `verification/` to `docs/archive/opencode-only-2026-09-02/`, marked HISTORICAL, with a SHA-256 manifest (`scripts/archive-manifest.mjs`); the archived checklist's 27 evidence links now resolve there; `/verification/runs/` and `/verification/yolo/` are git-ignored in the repository and in installed projects; `playbook-sweep.mjs` removes raw runs after 7 days (automatically on every new run) and grader verdicts after 365; the V01-V03 checks are rerun on the current tree by `tests/retention/run.mjs PB-15`. PB-14 and PB-15 graded. Grader: **29 of 32 graded**, pass 29, fail 0, ungraded 3.
