# Playbook Reset Plan

Measured 2026-09-07 against the working tree at `/mnt/c/3AIGenCode/AI-First-Playbook`.
Every number below came from a command run in this session. Nothing is estimated.

Read `Playbook-How-It-Works.md` first. This document assumes you have.

---

## 0. The snapshot, confirmed and corrected

The snapshot supplied for this review is **correct in every folder it names**. It has one
omission and one distortion, both worth stating before anything else.

Counted recursively with `find` (not a glob, so dot-directories are included), excluding only
`.git`:

| Folder | Files | Words | Snapshot said | Verdict |
|---|---:|---:|---|---|
| `phases/` | 10 | 3,572 | 10 / 3,572 | exact |
| `templates/` | 29 | 5,991 | 29 / 5,991 | exact |
| `docs/` | 33 | 68,786 | 31 / 57,105 | see note |
| `onboarding/` | 2 | 1,538 | 2 / 1,538 | exact |
| `harness/` | 20 md (27 files) | 40,350 | 20 / 40,350 | exact |
| `verification/` | 174 md (247 files) | 196,498 | 174 / 196,498 | exact |
| `.opencode/` | 4 md (10 files) | 9,144 | **not listed** | omission |
| root | 4 | 3,187 | 4 / 3,187 | exact |
| **whole repository** | **276 md (400 files)** | **329,066** | 274 / 317,385 | see note |

Two notes, both mine to explain rather than yours to worry about:

- **`docs/` is 33 files, not 31.** The extra two are `docs/Playbook-Reset-Plan.md` (10,551
  words) and `docs/Playbook-How-It-Works.md` (1,130 words) — outputs of an earlier run of this
  same review, left in the working tree. Subtract them and `docs/` is 31 files and 57,105
  words, matching the snapshot to the word. The same two files account for the whole-repository
  difference: 276 − 2 = 274 files, 329,066 − 11,681 = 317,385 words. **The snapshot is exact.**
  I have not touched either file.
- **`.opencode/` is missing from the snapshot's folder list.** Its four files and 9,144 words
  are inside the snapshot's repository total, but the folder has no row of its own. This is the
  hidden-path trap the brief warned about, surviving into the brief's own table. It matters
  because `.opencode/agent/verifier.md` is where the 8,630-word verifier prompt actually sits
  at run time in this repository.

All other figures in the snapshot verified exactly: shipped commands are 15 files totalling
**29,800 words** (largest `add-doc.md` 4,855, `implement.md` 4,030); shipped agents are verifier
8,630, builder 352, orchestrator 125, analyst 37; `scripts/` holds 15 files; `docs/metrics/`
does not exist.

One snapshot figure I measured differently. Shouted rules — whole-word `MUST`, `NEVER`,
`ALWAYS`, `BANNED`, `FORBIDDEN`, `REQUIRED`, `MANDATORY` across markdown — total **68**, not 61,
distributed: `harness/` 45, `.opencode/` 12 (a mirror of harness, so not independent), `docs/` 8,
`templates/` 2, `phases/` 1, `onboarding/` 0, root markdown 0. The concentration claim in the
snapshot holds and then some: **45 of the 56 non-duplicated shouted rules — 80 percent — are in
`harness/`**, and 12 of those are in `verifier.md` alone.

### Every markdown file by folder, largest first

```
verification/   174 files  196,498 w   committed run evidence, not shipped
docs/            33 files   68,786 w   (31 / 57,105 excluding this review's own two files)
harness/         20 files   40,350 w   what ships and is read at run time
.opencode/        4 files    9,144 w   byte-identical mirror of harness/opencode agents
templates/       29 files    5,991 w   15 command specs + README, 8 handoffs, 5 doc templates
phases/          10 files    3,572 w   the lifecycle, read by humans only
root              4 files    3,187 w   README 2,055 · AGENTS 953 · Gap 99 · Context-Prompt 80
onboarding/       2 files    1,538 w
```

Largest single files: `harness/opencode/agent/verifier.md` 8,630 · `docs/OpenCode-WSL-Setup-Guide.md`
7,479 · `docs/Getting-Started.md` 5,351 · `docs/Miss-Telemetry-TechieFlow.md` 5,024 ·
`harness/opencode/command/add-doc.md` 4,855 · `docs/Brownfield-Case-Study.md` 4,419 ·
`docs/Miss-Telemetry-AI-First-Playbook.md` 4,201 · `harness/opencode/command/implement.md` 4,030.

### Duplicate files

Nine files exist twice with **identical MD5 hashes**: `.opencode/agent/{analyst,builder,orchestrator,verifier}.md`
and `.opencode/plugin/{spec-guardrails.ts,telemetry.ts,write-policy.mjs,yolo-policy.mjs,yolo.ts}`
each match their `harness/opencode/` original byte for byte. This is **deliberate and checked**:
`scripts/test-guardrails.mjs` lines 8–31 fail the build if any of them drift. It is a maintained
mirror, not rot. Leave it alone.

Fifteen more filenames appear twice with *different* content — `templates/commands/<name>.md`
against `harness/opencode/command/<name>.md`. These are not duplicates either: the
`templates/commands/` files are 60–280-word specifications of what a command does (3,341 words
total including their README), and the `harness/` files are the 29,800-word runnable prompts.
`scripts/playbook-validate.mjs:131-134` fails if either side is missing its partner. Also
deliberate, also checked.

**There is no accidental duplication in this repository.** That is a genuinely good result and
differs from what the brief led me to expect.

---

## 1. What is genuinely right and should be kept

Six things. Name them, protect them, and do not let the reset touch them.

**1. The mechanical guards actually work.** `harness/opencode/plugin/write-policy.mjs` is a pure
policy module with no harness imports; `spec-guardrails.ts` is a thin carrier. I called the
policy directly this session and watched it behave:

| Call | Result |
|---|---|
| write `docs/Gap-Report.md` | BLOCKED |
| write `Verification-Results.md` | BLOCKED |
| `bash: echo x > Gap-Report.md` | BLOCKED |
| verifier edits `src/Api/Program.cs` | BLOCKED |
| verifier edits `verification/telemetry/misses.ndjson` | BLOCKED |
| verifier writes the selected checklist | ALLOWED |
| verifier writes `verification/f/r1/out.txt` | ALLOWED |

And the unattended-mode policy, `yolo-policy.mjs`: `git commit` **deny**, `gh pr create`
**deny**, `git status` **allow**, `rm -rf build` **allow**. This is the single best thing in the
Playbook. The lesson written into `harness/README.md` — *when a rule matters and the model keeps
breaking it, move the rule out of the prompt and into the tool layer* — is the reset's whole
method, already discovered here.

**2. The one-file rule.** No gap report, no verification report, no fix log. Findings are
annotated inline in the checklist and the run log appends. This removes an entire class of
"which document is current?" failure, and it is enforced by (1) rather than by wording.

**3. The installer and its test suite.** `scripts/install.mjs` (14,369 bytes) plus
`scripts/test-install.mjs` (17,534 bytes). A default install writes exactly 33 files into two
hidden folders and a managed `.gitignore` block — I ran it into a scratch directory and counted
them. `--force` touches only files recorded in `.playbook/installation.json`; uninstall without
`--force` removes nothing. This is careful work and the tests prove it.

**4. The miss stream.** `verification/telemetry/misses.ndjson`, `scripts/miss-lib.mjs` (48,496
bytes), `scripts/playbook-miss.mjs`, and 24 focused tests in `scripts/test-misses.mjs` — all 24
pass. The design decisions behind it (append-only, agents classify but never author numbers,
`instruction-ignored` is agent-origin only, no per-person reporting) are recorded in
`docs/Decisions.md` and each is enforced by a test. See §7.

**5. The ten phase files.** 3,572 words for the entire lifecycle, 184–560 words each. They are
the clearest writing in the repository and they cost nothing at run time because no agent loads
them. Do not grow them.

**6. Per-phase model routing, shipped off.** `playbook/model-tiers.yml` plus
`scripts/playbook-routing.mjs` and `scripts/apply-model-tiers.mjs`. I ran
`playbook-routing.mjs status`: **routing OFF, 0 of 22 mapped files carry a stamp**, and
`apply-model-tiers.mjs --check` agrees. Shipping it off by default was the right call for a team
edition and the reversibility is proven by test.

---

## 2. What grew without earning its place

**2.1 `harness/opencode/agent/verifier.md` — 8,630 words, 1,138 lines.**
This is 21 percent of everything that ships and it is loaded on **every** verify run, before the
verifier has read a single checklist item. Inside it: 12 numbered "ABSOLUTE RULES" plus three
lettered sub-rules; 12 of the repository's shouted keywords; and three blocks that alone total
1,760 words — Rule 4b "you cannot claim you can't run it" (569 w), Step 5.9 "aggregate and
annotate" (779 w), Step 7 "final message to the user" (515 w). Roughly 1,900 words are
stack-specific (.NET, `sqlcmd`, `host.docker.internal`, private NuGet feeds, a Windows desktop
bridge that does not exist) sitting inside the prompt every team loads whatever their stack.

**2.2 `harness/opencode/command/add-doc.md` — 4,855 words.**
The largest command file, and it is not on the daily path. Thirty-six blocks, of which fourteen
are literal document skeletons ("## 1. Map (one diagram)", "## 4. Mapping tables") that belong
in a template file, not in a prompt read on every invocation.

**2.3 `harness/opencode/command/implement.md` — 4,030 words — and `fix.md` — 2,766 words.**
These two share large sections almost verbatim: progress-reporting rules, the "NO EXCUSES" block,
build/smoke steps 3.1–3.6, the deployment-steps critical rules, and the token-discipline
paragraph. Measured overlap is roughly **1,400 words duplicated between the two files**. Every
`/implement` run and every `/fix` run pays for its own copy.

**2.4 `docs/` at 57,105 words for a 40,350-word product.**
Thirty-one documents. Sixteen ship. The other fifteen are 24,000 words of design and provenance
material sitting in the same folder a new adopter opens. Four of them —
`Miss-Telemetry-TechieFlow.md` (5,024), `Miss-Telemetry-TfLens-From-AIFP.md` (395),
`Phase-Efficiency-TfLens-Contract.md` (2,710), and most of `Miss-Telemetry-AI-First-Playbook.md`
(4,201) — are about the **other framework** or about a contract between the two. That is 12,330
words, 22 percent of `docs/`, describing something that is not this product.

**2.5 `verification/` at 196,498 words — 62 percent of the repository.** See §5b.

**2.6 Three real checks nobody wired into CI.** Buried in the campaign folders are three working
scripts: `link-audit.mjs`, `source-scan.mjs`, and `verify-doc-integrity.mjs`. I ran all three
today. The first two pass. **The third fails** — `docs/Getting-Started.md` is 606 lines against
its pinned 601. A real check, red for days, invisible because nothing runs it.

**2.7 Prose that has drifted from the code.** `harness/README.md` says each command is "stamped
with a `model:` tier" — 0 of 22 files carry a stamp today, because routing ships off. The same
file calls `verifier.md` "1,050 lines"; it is 1,138. Small, but this is the file a porting team
reads first.

---

## 3. The instruction surface per phase

### How it was traced

`opencode.json` names two always-loaded instruction files. In an installed target these resolve
to `.playbook/AGENTS.md` (**953 words**) and `.playbook/environment-profile.yml` (**119 words**)
— a constant **1,072-word floor on every phase**. On top of that OpenCode loads the agent prompt
named by the command (or by the operator's selection) and the command file itself. Nothing else
is loaded automatically: **`phases/` and `templates/` are never read by an agent**, and in a
default install they are not even present — they arrive only with `--with-guides`, under
`.playbook/guides/`.

### Today, against a proposed budget

Budget is per model tier, because a frontier model tolerates a larger prompt than an economy one.
Proposed ceilings: **frontier 6,000 · standard 3,500 · economy 1,200** words loaded before the
first useful step.

| Phase | Command | Agent | Floor | Agent w | Command w | **Total today** | Tier | Budget | Over by |
|---|---|---|---:|---:|---:|---:|---|---:|---:|
| 1 Plan | `/feature-plan` | analyst | 1,072 | 37 | 2,588 | **3,697** | frontier | 6,000 | — |
| 2 Plan review | — (human gate) | — | 0 | 0 | 0 | **0** | — | — | — |
| 3 Build | `/implement` | orchestrator | 1,072 | 125 | 4,030 | **5,227** | standard | 3,500 | +1,727 |
| 3 Build (each builder) | — | builder | 1,072 | 352 | slice | **1,424 + slice** | standard | 3,500 | — |
| 4 Self-review | inside `/implement` | orchestrator | — | — | — | **0 extra** | standard | — | — |
| 5 Verify | `/verify` | **verifier** | 1,072 | **8,630** | 461 | **10,163** | standard | 3,500 | **+6,663** |
| 5 Verify (each sub-verifier) | — | unnamed | 1,072 | up to 8,630 | brief | **up to 9,702 each** | standard | 3,500 | +6,202 |
| 6 Results gate | output of `/verify` | verifier | — | — | — | **0 extra** | — | — | — |
| 7 Fix | `/fix` | orchestrator | 1,072 | 125 | 2,766 | **3,963** | standard | 3,500 | +463 |
| 8 Human acceptance | — (human gate) | — | 0 | 0 | 0 | **0** | — | — | — |
| 9 Post-verify bugs | `/analyze-fix` | analyst | 1,072 | 37 | 2,402 | **3,511** | frontier | 6,000 | — |
| 10 Production bugs | `/analyze-fix` (+`/create-issue-list`) | analyst | 1,072 | 37 | 2,402 | **3,511** | frontier | 6,000 | — |

Off-lifecycle commands, same method:

| Command | Total today | Tier | Budget | Over by |
|---|---:|---|---:|---:|
| `/add-doc` | 5,964 | standard | 3,500 | +2,464 |
| `/upgrade-docs` | 4,707 | standard | 3,500 | +1,207 |
| `/refresh-doc` | 3,671 | standard | 3,500 | +171 |
| `/archive-checklist` | 2,998 | economy | 1,200 | +1,798 |
| `/create-issue-list` | 2,453 | economy | 1,200 | +1,253 |
| `/generate-html` | 2,099 | economy | 1,200 | +899 |
| `/amend-checklist` | 2,074 | economy | 1,200 | +874 |
| `/log-miss` | 1,479 | standard | 3,500 | — |
| `/legacy-audit` | 1,181 | frontier | 6,000 | — |

### Said plainly

**Phase 5, Verify, reads by far the most before its first useful step: 10,163 words, nearly
three times its budget and 2.7 times the next-largest phase.** Nine-tenths of that is one file.
And it may be worse than the table shows: `/implement` explicitly instructs the orchestrator to
"always spawn the `builder` subagent type" (`implement.md:141`), but `/verify` Step 5.2 says only
"multiple `task` calls in ONE message" and **names no subagent type**. If sub-verifiers resolve
to the verifier agent, a five-bucket verify run loads the 8,630-word prompt six times. This is
the single largest, most easily removed cost in the framework, and it is an ambiguity in one
line of one file.

Second finding: **four of the five commands routed to the economy tier exceed an economy budget
by 70–150 percent**, entirely because of the 1,072-word floor plus command files that were never
trimmed for the cheapest model. Routing to `economy` and then handing the model 3,000 words is a
routing decision that does not survive contact with the file.

### How a phase document is written to fit a small budget

Not by deleting steps. By splitting one file into two kinds of content:

- **Core** — everything the agent needs to take the first three steps and to know what it must
  never do. Always loaded. Target: 60 percent of the tier budget.
- **Reference** — everything it needs only *sometimes*: a stack-specific workaround, a document
  skeleton, a worked example, a rare failure mode. Moved to
  `harness/opencode/reference/<topic>.md` and **named by path in the core with the condition that
  triggers reading it** — "if `dotnet build` fails with a 401 against a private feed, read
  `reference/private-feed-401.md`". OpenCode loads command and agent files wholesale; a reference
  section only becomes optional when it is a separate file the agent chooses to read.

Applied to `verifier.md`, the core is roughly 2,400 words (profile authority, the six verdict
tiers, the write-scope rule, the five-step data check, parallel grouping, the annotation format)
and about 6,200 words move to eight reference files. That fits a standard-tier budget with room
to spare, and no rule is lost — each one moves to a file whose trigger condition is written next
to the step that needs it.

---

## 4. The existing checks — which are real

For each rule the Playbook states as enforced: is there an artefact that fails when the rule is
broken, and did I run it in this session? **"Runs today" is yes only if I ran it here and saw a
result.** Everything else is no.

Suites run this session, all green unless noted: `node scripts/playbook-validate.mjs` (exit 0),
`node scripts/test-guardrails.mjs` (exit 0, 4 groups), `node scripts/test-misses.mjs` (exit 0,
24 tests), `node scripts/test-install.mjs` (exit 0), `node scripts/apply-model-tiers.mjs --check`
(exit 0), plus direct calls into `write-policy.mjs` and `yolo-policy.mjs`, plus the three
campaign scripts.

### Rules that are really enforced

| # | The rule | Where it is stated | The check it claims | Runs today? | Proof |
|---|---|---|---|---|---|
| 1 | No separate gap / verification / audit report file may be written | AGENTS.md; `phases/06`; verifier Rule 6 | `write-policy.mjs` `checkForbidden` (6 patterns) | **yes** | called it: `docs/Gap-Report.md` and `Verification-Results.md` both BLOCKED |
| 2 | The same rule survives a shell redirect | verifier Rule 6 | `shellWriteTargets` | **yes** | `echo x > Gap-Report.md` BLOCKED |
| 3 | Verifier writes only the selected checklist, `verification/**`, `deploy/<feature>/**` | AGENTS.md | `checkWritePolicy` | **yes** | `src/Api/Program.cs` BLOCKED; checklist and `verification/f/r1/out.txt` ALLOWED |
| 4 | Verifier may not edit the miss stream directly | AGENTS.md | `checkWritePolicy` | **yes** | direct write to `misses.ndjson` BLOCKED |
| 5 | Agents never write git history, even unattended | AGENTS.md "Version control" | `yolo-policy.mjs` `yoloDecision` | **yes** | `git commit -m x` → deny |
| 6 | Agents never publish through `gh` | AGENTS.md | `yoloDecision` | **yes** | `gh pr create` → deny |
| 7 | Read-only git stays allowed unattended | AGENTS.md | `yoloDecision` | **yes** | `git status` → allow |
| 8 | The guard plugin loads before the unattended plugin | `docs/Decisions.md` 2026-08-21 | `playbook-validate.mjs:121` | **yes** | validate exit 0 |
| 9 | Every runnable command has a spec, every spec a runnable command | `templates/commands/README.md` | `playbook-validate.mjs:131-134` | **yes** | validate exit 0 |
| 10 | Every command file carries frontmatter | `harness/README.md` | `playbook-validate.mjs:129` | **yes** | validate exit 0 |
| 11 | The standing rules and their template both carry the unattended section | `docs/Decisions.md` | `playbook-validate.mjs:125-126` | **yes** | validate exit 0 |
| 12 | `.gitignore` ignores the transient event stream only; the miss stream stays committable | `docs/Decisions.md` Decision 1 | `playbook-validate.mjs:178-184` | **yes** | validate exit 0 |
| 13 | Checklist item metadata requires a `misses` array | `templates/checklist-item-template.md` | `playbook-validate.mjs:167-171` | **yes** | validate exit 0 |
| 14 | The miss stream stays parseable and schema-valid | `docs/Telemetry-Guide.md` | `playbook-validate.mjs:193-195` via `miss-lib.mjs` | **yes** | "5 of 5 assessed; 0 in backlog" |
| 15 | All miss logic flows through one shared library | `docs/Decisions.md` | `playbook-validate.mjs:162` | **yes** | validate exit 0 |
| 16 | No credential-bearing command example in shipped docs | `docs/Security.md` | `playbook-validate.mjs:145` | **yes** | validate exit 0 |
| 17 | `docs/` filenames follow the naming rule | repository convention | `playbook-validate.mjs:116` | **yes** | validate exit 0 |
| 18 | The release workflow keeps its publish contract and carries no approval gate | `docs/Npm-Release-Guide.md` | `playbook-validate.mjs:88-104` (8 clauses) | **yes** | validate exit 0 |
| 19 | The validation workflow runs all four suites | `.github/workflows/validate.yml` | `playbook-validate.mjs:109-112` | **yes** | validate exit 0 |
| 20 | No artefact or wording from the other harness anywhere in source | `docs/OpenCode-Only-...-Checklist.md` | `openCodeOnlyErrors()` + 20 negative fixtures | **yes** | "OpenCode-only negative validation passed" |
| 21 | Every phase-entry command has a model tier | `playbook/model-tiers.yml` | `playbook-validate.mjs:187-188` | **yes** | validate exit 0 |
| 22 | The `.opencode/` mirror never drifts from `harness/` | `docs/Decisions.md` | `test-guardrails.mjs:8-31` (policy, 4 agents, telemetry) | **yes** | "guardrail policy coverage passed" |
| 23 | The telemetry plugin never stores raw command arguments | `docs/Decisions.md` Decision 6 | `test-guardrails.mjs:30` | **yes** | same run |
| 24 | The guard carrier imports the shared policy, never restates it | `docs/Adapter-Design.md` | `test-guardrails.mjs:13-17` | **yes** | same run |
| 25 | Sub-agent tokens are counted once, not twice | `docs/Telemetry-Guide.md` | `test-guardrails.mjs:273` | **yes** | "telemetry subagent accounting passed" |
| 26 | Unattended limit text is parsed and the sentinels recognised | AGENTS.md; `docs/YOLO-Mode-Guide.md` | `test-guardrails.mjs` yolo group | **yes** | "yolo policy checks passed" |
| 27 | Miss IDs are a compact daily sequence | `docs/Telemetry-Guide.md` §7 | `test-misses.mjs` #1 | **yes** | 24/24 |
| 28 | Corrections are append-only; nothing overwrites | `docs/Decisions.md` Decision 3 | `test-misses.mjs` #3, #4 | **yes** | 24/24 |
| 29 | Agents classify but never author numbers or provenance | `docs/Decisions.md` Decision 2 | `test-misses.mjs` #7 | **yes** | 24/24 |
| 30 | `instruction-ignored` is agent-origin only | `docs/Decisions.md` Decision 5 | `test-misses.mjs` #20 + `miss-lib.mjs:742` | **yes** | 24/24 |
| 31 | Backlog and live-defect predicates stay distinct | `docs/Decisions.md` Decision 4 | `test-misses.mjs` #5 | **yes** | 24/24 |
| 32 | Telemetry writes are opt-in; reads always work | `docs/Telemetry-Guide.md` | `test-misses.mjs` #23 | **yes** | 24/24 |
| 33 | Unverified cost is null, never estimated | `docs/Decisions.md` Decision 2 | `test-misses.mjs` #15, #16 | **yes** | 24/24 |
| 34 | Malformed stream lines are reported without exposing content | `docs/Telemetry-Guide.md` | `test-misses.mjs` #17 | **yes** | 24/24 |
| 35 | A default install writes only the two hidden folders and the gitignore block | `docs/Installation.md` | `test-install.mjs:121` | **yes** | ran installer: 33 files, entries `.gitignore .opencode .playbook` |
| 36 | Installed command and agent files equal their harness sources | `docs/Repository-Structure.md` | `test-install.mjs:129` | **yes** | installer tests passed |
| 37 | `--force` replaces only files this package created | `docs/Usage.md` | `test-install.mjs:204-207` | **yes** | installer tests passed |
| 38 | Uninstall without `--force` removes nothing | `docs/Usage.md` | `test-install.mjs:170` | **yes** | installer tests passed |
| 39 | Model stamps agree with the tier map and its on/off flag | `docs/Model-Routing-Guide.md` | `apply-model-tiers.mjs --check` | **yes** | "stamps match the tier map (routing OFF)"; `status` shows 0/22 |
| 40 | Every relative markdown link resolves | implied by the doc set | `verification/.../verify-01/link-audit.mjs` | **yes** | `markdown_files=102 broken_relative_links=0` — **not in CI** |
| 41 | No prohibited markers across the source tree (second implementation) | as #20 | `verification/.../verify-01/source-scan.mjs` | **yes** | `source_files_scanned=357 prohibited_marker_hits=0` — **not in CI** |
| 42 | Shipped docs keep their pinned structure | campaign contract | `verification/.../verify-03/verify-doc-integrity.mjs` | **yes — and it FAILS** | exit 1: `docs/Getting-Started.md lines=606/601`. Not in CI, so nobody saw it. |

### Rules stated as binding with no artefact behind them

| # | The rule | Where it is stated | The check it claims | Runs today? | Proof |
|---|---|---|---|---|---|
| 43 | The checklist covers every line of the requirements document | `phases/02`; `feature-plan.md` | none — a human reads | no | — |
| 44 | Every mockup element maps to a checklist item | `phases/01`, `phases/02` | none | no | — |
| 45 | Every cross-cutting rule has an acceptance condition, not a mention | `phases/02` | none | no | — |
| 46 | Every item's verify method is executable by a fresh agent | `phases/02` | none | no | — |
| 47 | An acceptance line holds one behaviour and permits one reading | implied by #46 | none — the format is not even stated | no | — |
| 48 | `/implement` finishes every item in scope in one run | AGENTS.md "Build phase"; `phases/03` | none | no | prose only, in three files |
| 49 | Cross-cutting edits are consolidated to one item per file | `phases/03`; `implement.md` | none | no | — |
| 50 | Migrations are raw SQL, never the ORM shortcut | `phases/03`; `implement.md` | none | no | — |
| 51 | Self-review queries the real database; a 200 with no rows is a failure | `phases/04`; `implement.md` §3.4 | none | no | — |
| 52 | Self-review stops every process it started | `phases/04` §7 | none | no | — |
| 53 | The browser tool is used whenever reachable | verifier Rule 2 | none | no | — |
| 54 | `BLOCKED` only after the listed workarounds were tried | verifier Rule 8 (412 w) | none | no | longest rule in the file, unenforced |
| 55 | Data conditions are `DATA-GAP`, never `BLOCKED` | verifier Rule 9; `phases/06` | partial: validate only checks the string appears in checklist docs | no | — |
| 56 | Only the six verdict tiers are used | verifier Rule 0; `Context-Prompt.md` | none at run time | no | — |
| 57 | Verify only items in this checklist's scope | verifier Rule 10 | none | no | — |
| 58 | Probe for tools; never claim missing without `command -v` | verifier Rule 4 (327 w + 294 w script) | none | no | — |
| 59 | Read real configuration; never invent a connection string | verifier Step 3 | none | no | — |
| 60 | Sub-verifiers return findings; only the parent writes | verifier Step 5.2 | none | no | — |
| 61 | A miss is recorded for every FAIL and DATA-GAP, its ID appended to item metadata | `phases/06`; verifier Rule 6a | none — the append is fire-and-forget by design | no | — |
| 62 | `verdict_after=pass` only from an independent verify run | `phases/06`, `phases/07` | none | no | schema permits it from any actor |
| 63 | The issues file is deleted only after every field is copied and every issue has a miss ID | `phases/09`, `phases/10` | none | no | — |
| 64 | Every gate persists a handoff packet with its eleven fields | AGENTS.md; `docs/Handoffs.md` | none | no | eight templates exist; nothing checks one was written |
| 65 | Item metadata, not the checkbox, is authoritative status | AGENTS.md; item template | none | no | — |
| 66 | Secrets never appear in command arguments, markdown, logs, URLs or evidence | AGENTS.md; `docs/Security.md` | partial: validate greps two patterns in docs only | no | nothing checks a run |
| 67 | Evidence carries no credentials or unredacted personal data; 180-day retention | `templates/checklist-metadata.yml` | none | no | — |
| 68 | The checklist is archived past roughly 2,000 lines | `phases/10`; `archive-checklist.md` | none | no | — |
| 69 | The analyst asks for missing inputs instead of guessing | `phases/01`; `templates/commands/README.md` | none | no | the defining behaviour of Phase 1 |
| 70 | Progress text is emitted between tool calls | verifier §Progress; `implement.md` | none | no | 193 w + 302 w of rules |
| 71 | Severity targets met and a postmortem within five business days | `phases/10` | none | no | — |
| 72 | An unattended run ends with a completion or blocked sentinel line | AGENTS.md | partial: the supervisor parses one; nothing makes the agent emit it | no | — |

### The number

**42 of 72 rules have a check I ran in this session. 30 do not.**

Three qualifications, all of which matter more than the headline:

- **Three of the 42 (#40, #41, #42) are not in CI.** They live in `verification/opencode-only/`
  and run only if someone types their path. One of them is red right now. Counting only what CI
  enforces, the ratio is **39 of 72**.
- **The 30 unenforced rules are not evenly spread.** Twelve of them (#53–#61, #70) live in
  `verifier.md`, the most expensive file in the system. The Playbook's most-read file is also
  its least-enforced.
- **The split is the finding.** Everything mechanical about *packaging, installing, and
  recording* is enforced. Almost nothing about *building and verifying a feature* is. The
  Playbook has excellent tests for itself and none for the work it exists to govern.

---

## 5. The keep / script / delete table

Verdicts: **KEEP AS WORDS** (needs judgement), **SCRIPT** (mechanical — the named artefact),
**DELETE** (duplicates another file or states the obvious). One row per block. You can rule on a
row without reading the block; ask to see any block and I will print it.

Block-level coverage below is `verifier.md` and the four largest command files — the 20,281 words
that dominate every run. The remaining eleven commands, `harness/README.md`, `phases/` and
`templates/` are given file-level rows, and finishing them at block level is Session 4's job.
I am not pretending otherwise.

### 5.1 `harness/opencode/agent/verifier.md` — 8,630 words, 55 blocks

| # | What the block says, in one line | Verdict | Why |
|---|---|---|---|
| 1 | Profile authority: the environment profile is the source of truth for topology (164 w) | KEEP AS WORDS | Sets the disposition the whole run depends on |
| 2 | Unattended mode: every approval in this file is pre-approved (152 w) | SCRIPT — `yolo-policy.mjs` (exists) | The plugin already does this; the prose restates it |
| 3 | "ABSOLUTE RULES override anything else" preamble (22 w) | DELETE | States the obvious about the section it heads |
| 4 | Rule 0: only the six verdict tiers (120 w) | SCRIPT — `verdict-lint.mjs` (new) | Six literals; a lint over the annotated checklist decides it |
| 5 | Rule 1: verify here, on this machine, never by deploying (200 w) | KEEP AS WORDS | Judgement about what "here" means on an unknown topology |
| 6 | Rule 2: use the browser tool for screen items when reachable (74 w) | SCRIPT — `verify-evidence-lint.mjs` (new) | A screen item passing with no browser evidence is detectable |
| 7 | Rule 3: cloud CLIs are not needed; do not ask for them (125 w) | KEEP AS WORDS | Refusal behaviour, not a file property |
| 8 | Rule 4: probe with `command -v`; do not guess a tool is missing (327 w) | KEEP AS WORDS (core) + reference | Core is two sentences; the 294-word probe script is reference |
| 9 | Other tooling truths (82 w) | move to `reference/tooling.md` | Stack-specific; not every team has this stack |
| 10 | Rule 4a: private feed credentials live in the repo config (196 w) | move to `reference/private-feed-401.md` | Needed only on a 401 |
| 11 | Rule 4b: "can't run it" is not a blocked reason (569 w) | KEEP AS WORDS (trim to ~150) | The most valuable rule here; 569 words is four restatements of one idea |
| 12 | Rule 5: never re-ask what the user already said (79 w) | KEEP AS WORDS | Conversational, unscriptable |
| 13 | Rule 6: single output file — plugin enforces (126 w) | SCRIPT — `write-policy.mjs` (exists) | Already enforced; keep 15 words pointing at the block message |
| 14 | Rule 6a: miss telemetry is serialised, linked, fire-and-forget (221 w) | SCRIPT — `miss-link-lint.mjs` (new) | "Every FAIL has a miss ID in item metadata" is checkable |
| 15 | Rule 7: parallelise, never sequential (62 w) | KEEP AS WORDS | Planning judgement |
| 16 | Rule 8: BLOCKED is the last resort; prove you cannot first (412 w) | KEEP AS WORDS (trim to ~120) + reference | The principle is one paragraph; the case list is reference |
| 17 | Rule 9: data conditions are DATA-GAP, not BLOCKED (266 w) | SCRIPT — `verdict-lint.mjs` (new) | A BLOCKED whose evidence says "no data" is detectable |
| 18 | Rule 10: verify only items in this checklist (209 w) | SCRIPT — `verify-scope-lint.mjs` (new) | Annotated item IDs versus checklist item IDs; a set difference |
| 19 | Rule 11: token discipline — read surgically (111 w) | KEEP AS WORDS | Judgement; and see the irony |
| 20 | Progress reporting: emit text between tool calls (66 w) | KEEP AS WORDS | Harness-behaviour coaching |
| 21 | Required text-turn moments, each its own response (193 w) | DELETE | Cosmetic; 193 words on message formatting in the most expensive file |
| 22 | Write annotations serially after workers return (48 w) | KEEP AS WORDS | Real concurrency rule, cheaply stated |
| 23 | What NOT to put in chat (44 w) | DELETE | Cosmetic |
| 24 | Step 0: read the checklist and supporting docs (59 w) | KEEP AS WORDS | Core |
| 25 | Step 1: probe the environment once, remember it (92 w) | KEEP AS WORDS | Core |
| 26 | The probe script itself (294 w of shell) | move to `reference/probe.sh` | Executable, not prose; the agent should run it, not read it |
| 27 | Private-feed comment block + script (358 w) | move to `reference/private-feed-401.md` | Merges with #10 |
| 28 | Step 2: get the apps running (29 w) | KEEP AS WORDS | Core |
| 29 | Scenario A: apps already running (33 w) | KEEP AS WORDS | Core |
| 30 | Scenario B: ask the user to start them (113 w) | KEEP AS WORDS | Core |
| 31 | Scenario C: start them yourself with approval (101 w) | KEEP AS WORDS | Core |
| 32 | What you will NEVER do — recap of Rule 1 (108 w) | DELETE | Explicitly a recap of block #5 |
| 33 | Step 3: read real config (70 w) | KEEP AS WORDS | Core; the "never invent a connection string" rule |
| 34 | Step 4: process deployment steps (6 w) | KEEP AS WORDS | Core |
| 35 | Automated subsection: ask before each (57 w) | KEEP AS WORDS | Core |
| 36 | Manual subsection: record as deferred (36 w) | KEEP AS WORDS | Core |
| 37 | Step 5: verify in parallel by type (23 w) | KEEP AS WORDS | Core |
| 38 | Step 5.0: use the developer-flow guide as the map (253 w) | KEEP AS WORDS (trim to ~80) | Good idea, three times the words it needs |
| 39 | Step 5.1: group the items (192 w) | SCRIPT — `bucket-items.mjs` (new) | Grouping by the `Type` field is a sort, not a judgement |
| 40 | Step 5.2: spawn one sub-verifier per bucket in parallel (66 w) | KEEP AS WORDS — **and fix** | Names no subagent type; this is the §3 cost finding |
| 41 | Step 5.3: build/test gate sub-verifier (67 w) | KEEP AS WORDS | Core |
| 42 | Handling a 401 against a private feed (185 w) | move to `reference/private-feed-401.md` | Third copy of the same topic |
| 43 | Handling "node/npm not in container" (322 w) | move to `reference/container-tooling.md` | Deep stack specificity |
| 44 | Step 5.4: screen sub-verifier (117 w) | KEEP AS WORDS | Core |
| 45 | Step 5.5: backend/API sub-verifier (87 w) | KEEP AS WORDS | Core |
| 46 | Step 5.6: database sub-verifier (54 w) | KEEP AS WORDS | Core — the five-step check |
| 47 | Step 5.7: logging sub-verifier (43 w) | KEEP AS WORDS | Core |
| 48 | Step 5.8: infrastructure sub-verifier (50 w) | KEEP AS WORDS | Core |
| 49 | Step 5.9: aggregate and annotate (779 w) | **SCRIPT — `annotate-checklist.mjs` (new)** | Largest block in the file and almost entirely a fixed output format |
| 50 | Step 6: clean up (15 w) | KEEP AS WORDS | Core |
| 51 | Step 7: final message to the user (515 w) | SCRIPT — `run-summary.mjs` (new) | A report template; generate it from the annotations |
| 52 | When the checklist gets very large (41 w) | KEEP AS WORDS | Core |
| 53 | Header: "You are the Verifier" (0 w body) | KEEP AS WORDS | Identity line |
| 54 | (frontmatter) description + agent binding | KEEP AS WORDS | Required by the harness |
| 55 | (frontmatter) `subtask: true` | KEEP AS WORDS | The fresh-context guarantee |

**Effect:** 12 blocks DELETE-or-move (2,192 words leave the prompt entirely), 7 blocks become
scripts (2,197 words), 3 blocks trim by roughly 1,100 words. Core lands near **2,400 words** —
inside a standard-tier budget with room for the checklist.

### 5.2 `harness/opencode/command/add-doc.md` — 4,855 words, 36 blocks

| # | What the block says, in one line | Verdict | Why |
|---|---|---|---|
| 1 | User's full input placeholder (1 w) | KEEP AS WORDS | Harness mechanic |
| 2 | How to parse the input (172 w) | KEEP AS WORDS | Real elicitation logic |
| 3 | How this guide is created and kept up to date (269 w) | KEEP AS WORDS | Lifecycle judgement |
| 4 | Required inputs — ask if missing (253 w) | KEEP AS WORDS | The defining behaviour |
| 5 | Token discipline before reading code (176 w) | KEEP AS WORDS (trim to ~60) | Good rule, over-argued |
| 6 | Document 1 — developer flow guide, intro (71 w) | KEEP AS WORDS | Core |
| 7 | Two flow classes — pick what applies (181 w) | KEEP AS WORDS | Judgement |
| 8 | Build the guide by executing the code, not reading it (457 w) | KEEP AS WORDS (trim to ~150) | The most important rule here; three times its needed length |
| 9 | Fold gaps and bugs into the checklist (192 w) | KEEP AS WORDS | Core |
| 10 | "Structure" heading (1 w) | DELETE | Empty |
| 11 | Skeleton: guide title block (91 w) | move to `templates/developer-flow-guide.md` | A document skeleton, not an instruction |
| 12 | Skeleton: §1 Map, one diagram (106 w) | move to the same template | ditto |
| 13 | Skeleton: §2 Screen/tab flows (7 w) | move | ditto |
| 14 | Skeleton: §2.1 per screen (149 w) | move | ditto |
| 15 | Skeleton: §3 Service/package/job flows (71 w) | move | ditto |
| 16 | Skeleton: §3.1 per service, worked example (440 w) | move | Largest block; pure skeleton |
| 17 | Skeleton: reusable package variant (107 w) | move | ditto |
| 18 | Skeleton: §4 Cross-cutting flows (27 w) | move | ditto |
| 19 | Skeleton: §5 "where do I look" index (182 w) | move | ditto |
| 20 | Hard rules for the developer flow guide (143 w) | SCRIPT — `doc-schema-lint.mjs` (new) | Section presence and order are checkable once #11–#19 are a schema |
| 21 | Document 2 — business verification reference, intro (35 w) | KEEP AS WORDS | Core |
| 22 | Why one document, not two (88 w) | KEEP AS WORDS | Rationale that prevents a known regression |
| 23 | "Structure" heading (1 w) | DELETE | Empty |
| 24 | Skeleton: reference title block (47 w) | move to `templates/business-verification-reference.md` | Skeleton |
| 25 | Skeleton: §1 what the report shows (10 w) | move | ditto |
| 26 | Skeleton: §2 data sources (176 w) | move | ditto |
| 27 | Skeleton: §3 calculation logic in plain English (51 w) | move | ditto |
| 28 | Skeleton: §4 mapping tables (120 w) | move | ditto |
| 29 | Skeleton: §5 how to verify a value (74 w) | move | ditto |
| 30 | Skeleton: §6 worked scenarios (35 w) | move | ditto |
| 31 | Skeleton: §7 glossary (8 w) | move | ditto |
| 32 | Hard rules for the business reference (148 w) | SCRIPT — `doc-schema-lint.mjs` (new) | Same lint |
| 33 | How to write large documents without aborting the tool (37 w) | KEEP AS WORDS | Real harness workaround |
| 34 | Progress reporting (84 w) | DELETE | Cosmetic, and duplicated across four command files |
| 35 | Self-check before returning (109 w) | SCRIPT — `doc-schema-lint.mjs` (new) | It is a checklist of file properties |
| 36 | Finally (51 w) | KEEP AS WORDS | Closing instruction |

**Effect:** 19 blocks (1,704 words) become two template files; 3 blocks (400 words) become one
lint; 2 blocks delete. Core lands near **1,900 words**.

### 5.3 `harness/opencode/command/implement.md` — 4,030 words, 36 blocks

| # | What the block says, in one line | Verdict | Why |
|---|---|---|---|
| 1 | User's full input (1 w) | KEEP AS WORDS | Harness mechanic |
| 2 | How to parse the input (45 w) | KEEP AS WORDS | Core |
| 3 | Unattended mode — check this first (158 w) | SCRIPT — `yolo-policy.mjs` (exists) | Already mechanical |
| 4 | Completion contract: the whole checklist in one run (178 w) | **SCRIPT — `completion-gate.mjs` (new)** | "Every item is to-verify or tagged blocked" is a parse of the status table |
| 5 | Required inputs (34 w) | KEEP AS WORDS | Core |
| 6 | Before writing any code (62 w) | KEEP AS WORDS | Core |
| 7 | Token discipline (87 w) | KEEP AS WORDS (trim) | Shared with `fix.md` — see #37 note |
| 8 | Phase 1: plan parallel execution (384 w) | KEEP AS WORDS | Genuine planning judgement |
| 9 | Progress reporting during long runs (37 w) | DELETE | Cosmetic |
| 10 | The mandatory alternating pattern (102 w) | DELETE | Cosmetic |
| 11 | Required announcements, each its own turn (302 w) | DELETE | Cosmetic; the single largest cosmetic block in the command set |
| 12 | What NOT to announce (58 w) | DELETE | Cosmetic |
| 13 | Reality about parallel sub-agents in the TUI (110 w) | KEEP AS WORDS | Real harness behaviour |
| 14 | Phase 2: implementation rules for every sub-agent (213 w) | KEEP AS WORDS | Core |
| 15 | Centralised miss recording for builder-found gaps (138 w) | SCRIPT — `miss-link-lint.mjs` (new) | Shares the lint from verifier #14 |
| 16 | Phase 3: build + smoke self-check, mandatory (29 w) | KEEP AS WORDS | Core |
| 17 | NO EXCUSES — you can run things in this container (201 w) | KEEP AS WORDS (trim to ~70) | Duplicated in `fix.md` #18 |
| 18 | Smoke test against the developer-flow guide (51 w) | KEEP AS WORDS | Core |
| 19 | Step 3.1: build everything touched (58 w) | KEEP AS WORDS | Core |
| 20 | Step 3.2: start the apps / build a runner (171 w) | KEEP AS WORDS | Core |
| 21 | Step 3.3: hit each endpoint, confirm status (61 w) | KEEP AS WORDS | Core |
| 22 | Step 3.4: verify the data reached the database (82 w) | KEEP AS WORDS | The rule that earns its keep |
| 23 | Step 3.5: one frontend snapshot (45 w) | KEEP AS WORDS | Core |
| 24 | Step 3.6: stop what you started (13 w) | KEEP AS WORDS | Core |
| 25 | Step 3.7: record smoke-test outcomes (142 w) | SCRIPT — `run-summary.mjs` (new) | Output format |
| 26 | Phase 4: update infrastructure and deployment steps (17 w) | KEEP AS WORDS | Core |
| 27 | A. Infrastructure requirements section (79 w) | move to `templates/deployment-steps-template.md` | Skeleton; the template already exists |
| 28 | B. Deployment steps section (16 w) | move to the same template | ditto |
| 29 | Deployment-steps heading skeleton (0 w) | move | ditto |
| 30 | Automated subsection skeleton (39 w) | move | ditto |
| 31 | Manual subsection skeleton (62 w) | move | ditto |
| 32 | Critical rules to avoid common mistakes (379 w) | KEEP AS WORDS (trim to ~140) | Duplicated in `fix.md` #24 |
| 33 | Decision: infrastructure versus deployment step (54 w) | KEEP AS WORDS | Genuine distinction |
| 34 | Empty sections (29 w) | KEEP AS WORDS | Core |
| 35 | When done (212 w) | SCRIPT — `completion-gate.mjs` (new) | Same gate as #4 |
| 36 | (frontmatter) description | KEEP AS WORDS | Required |

**Effect:** 4 cosmetic blocks delete (507 words); 5 skeleton blocks (196 words) move into the
existing deployment template; 3 blocks (532 words) become two scripts; the shared blocks with
`fix.md` become one reference file. Core lands near **2,100 words**.

### 5.4 `harness/opencode/command/upgrade-docs.md` — 3,598 words, 19 blocks

| # | What the block says, in one line | Verdict | Why |
|---|---|---|---|
| 1 | Not every feature has a requirements document — read this first (218 w) | KEEP AS WORDS | Real judgement about substitute inputs |
| 2 | Scope: full upgrade or targeted update (118 w) | KEEP AS WORDS | Core |
| 3 | Preserve history: back up old docs, never silently overwrite (335 w) | SCRIPT — `backup-before-upgrade.mjs` (new) | Copy-then-write is mechanical |
| 4 | Custom instructions are first-class (158 w) | KEEP AS WORDS | Core |
| 5 | Required inputs (219 w) | KEEP AS WORDS | Core |
| 6 | What to do for each document type (0 w) | DELETE | Empty heading |
| 7 | For database-change documents (261 w) | move to `reference/upgrade-by-doctype.md` | Read only for that document type |
| 8 | For architecture documents (129 w) | move to the same reference | ditto |
| 9 | For implementation checklists (475 w) | KEEP AS WORDS | The checklist is the contract; this one stays |
| 10 | For verification and testing guides (68 w) | move to `reference/upgrade-by-doctype.md` | ditto |
| 11 | For BI mapping documents (64 w) | move | ditto |
| 12 | For report features — consolidate to one reference (171 w) | move | ditto |
| 13 | Producing a flow guide for a legacy feature (282 w) | move | Duplicates `add-doc.md` #8 |
| 14 | Fold bugs found during upgrade into the checklist (92 w) | KEEP AS WORDS | Core |
| 15 | Progress reporting (246 w) | DELETE | Cosmetic; largest such block in the file |
| 16 | How to write large documents (183 w) | KEEP AS WORDS (trim to ~40) | Same workaround as `add-doc.md` #33, five times longer |
| 17 | Accuracy rules (149 w) | KEEP AS WORDS | Core |
| 18 | Diagram rules (34 w) | KEEP AS WORDS | Core |
| 19 | When done (158 w) | SCRIPT — `doc-schema-lint.mjs` (new) | A list of file properties |

**Effect:** 6 blocks (975 words) move to one reference file; 2 delete (246 words); 1 becomes a
script. Core lands near **1,900 words**.

### 5.5 `harness/opencode/command/fix.md` — 2,766 words, 26 blocks

| # | What the block says, in one line | Verdict | Why |
|---|---|---|---|
| 1 | User's full input (1 w) | KEEP AS WORDS | Harness mechanic |
| 2 | How to parse the input (30 w) | KEEP AS WORDS | Core |
| 3 | Required inputs (54 w) | KEEP AS WORDS | Core |
| 4 | Reject gap-report inputs (220 w) | SCRIPT — `write-policy.mjs` (exists) | The plugin already blocks the file; refusing it as *input* is a filename test |
| 5 | Unattended mode (108 w) | SCRIPT — `yolo-policy.mjs` (exists) | Already mechanical |
| 6 | Before fixing (91 w) | KEEP AS WORDS | Core |
| 7 | Token discipline (47 w) | DELETE | Duplicate of `implement.md` #7 |
| 8 | Phase 1: plan parallel execution (252 w) | KEEP AS WORDS | Judgement, though 80% shared with `implement.md` #8 |
| 9 | Progress reporting during long fix runs (56 w) | DELETE | Cosmetic |
| 10 | The mandatory alternating pattern (32 w) | DELETE | Cosmetic; duplicate |
| 11 | Required text turns (279 w) | DELETE | Cosmetic; duplicate of `implement.md` #11 |
| 12 | What NOT to announce (30 w) | DELETE | Cosmetic; duplicate |
| 13 | Sub-agents and the TUI (24 w) | DELETE | Duplicate of `implement.md` #13 |
| 14 | Phase 2: fix rules for every sub-agent (206 w) | KEEP AS WORDS | Core |
| 15 | Phase 3: build + smoke self-check (12 w) | KEEP AS WORDS | Core |
| 16 | NO EXCUSES — you can run things here (132 w) | DELETE | Duplicate of `implement.md` #17 |
| 17 | Step 3.1: build everything touched (39 w) | DELETE | Duplicate |
| 18 | Step 3.2: start the apps, ask first (97 w) | DELETE | Duplicate |
| 19 | Step 3.3: smoke-test each fix, confirm the data (152 w) | KEEP AS WORDS | Fix-specific and load-bearing |
| 20 | Step 3.4: stop what you started (5 w) | DELETE | Duplicate |
| 21 | Step 3.5: record outcomes (41 w) | SCRIPT — `run-summary.mjs` (new) | Output format |
| 22 | Step 3.6: defer addressed linked misses, serially (101 w) | SCRIPT — `miss-link-lint.mjs` (new) | Checkable after the fact |
| 23 | Phase 4: update deployment steps / infrastructure (92 w) | DELETE | Duplicate of `implement.md` #26–#31 |
| 24 | Critical rules, same as `/implement` (214 w) | DELETE | Says so in its own heading |
| 25 | When done (159 w) | SCRIPT — `completion-gate.mjs` (new) | Same gate as `implement.md` #35 |
| 26 | (frontmatter) description | KEEP AS WORDS | Required |

**Effect:** 12 blocks marked DELETE, of which 11 are literal duplicates of `implement.md`
totalling **1,082 words**. The right move is one shared reference file,
`harness/opencode/reference/build-and-smoke.md`, read by both. Core lands near **1,300 words**.

### 5.6 File-level rows — everything else

| File | Words | Verdict | Why |
|---|---:|---|---|
| `harness/opencode/command/feature-plan.md` | 2,588 | KEEP AS WORDS, budget-fit | Phase 1 is 3,697 total; already inside frontier budget |
| `harness/opencode/command/refresh-doc.md` | 2,562 | SCRIPT (partial) — `doc-schema-lint.mjs` | Drift detection between doc and code is partly mechanical |
| `harness/opencode/command/analyze-fix.md` | 2,402 | KEEP AS WORDS | Root-cause reasoning is the least scriptable thing here |
| `harness/opencode/command/archive-checklist.md` | 1,926 | **SCRIPT — `archive-checklist.mjs` (new)** | Rotating passed items past a line count needs no model at all |
| `harness/opencode/command/create-issue-list.md` | 1,344 | SCRIPT (partial) — tracker fetch is mechanical | Only the description parsing needs a model |
| `harness/opencode/command/generate-html.md` | 1,027 | **SCRIPT — `generate-html.mjs` (new)** | Markdown into a fixed shell; a model is not required |
| `harness/opencode/command/amend-checklist.md` | 965 | KEEP AS WORDS | Small, surgical, needs judgement |
| `harness/opencode/command/verify.md` | 461 | KEEP AS WORDS | Thin binding to the verifier agent; correct as is |
| `harness/opencode/command/log-miss.md` | 370 | KEEP AS WORDS | Already minimal and well-shaped |
| `harness/opencode/command/update-context.md` | 834 | DELETE from the harness | Not shipped (`install.mjs:51` excludes it, `package.json` omits it) yet still validated as a pair — dead weight |
| `harness/opencode/command/legacy-audit.md` | 72 | KEEP AS WORDS | Exemplary size |
| `harness/opencode/agent/builder.md` | 352 | KEEP AS WORDS | Right size for a wave worker |
| `harness/opencode/agent/orchestrator.md` | 125 | KEEP AS WORDS | Right size |
| `harness/opencode/agent/analyst.md` | 37 | KEEP AS WORDS — **but check** | 37 words for the role that runs Phases 1, 9 and 10 |
| `harness/README.md` | 1,406 | KEEP AS WORDS — **correct two facts** | Says commands are model-stamped (0 of 22 are) and verifier is 1,050 lines (1,138) |
| `phases/01`–`phases/10` | 3,572 total | KEEP AS WORDS, all ten | Clearest writing here; costs nothing at run time |
| `templates/checklist-item-template.md` | 425 | **become a schema** — see §6 | The highest-leverage template in the set |
| `templates/checklist-metadata.yml` | 83 | KEEP — already a schema | Machine-readable and already enforced |
| `templates/deployment-steps-template.md` | 279 | become a schema | Absorbs `implement.md` #27–#31 |
| `templates/issues-file-template.md` | 311 | become a schema | Per-issue required fields |
| `templates/agents-md-template.md` | 776 | KEEP AS WORDS | Checked by the validator |
| `templates/verifier-agent.md` | 656 | DELETE | A 656-word description of the 8,630-word agent, shipped to nobody and pointed at by nothing |
| `templates/handoffs/*.md` (8 files) | 468 total | become one schema family | Eleven required fields, identical across all eight |
| `templates/commands/*.md` (15 + README) | 3,341 | KEEP AS WORDS | The adopter's reading path; checked as a pair |

---

## 6. The templates become schemas

A template that only advises produces a document that drifts. Each template gets a **schema
block**: required sections in order, optional sections, a word budget stated as a **target and a
maximum** per project size, and the rules every row must follow. The budget is always a pair
because a single hard number makes an agent truncate mid-thought to satisfy it.

### The schema shape, applied to all templates

```
SECTIONS REQUIRED (in this order): ...
SECTIONS OPTIONAL:                 ...
WORD BUDGET  small / medium / large:  target N  ·  maximum M
ROW RULES:   one rule per line, each one testable
```

Proposed budgets, where small is one screen or endpoint, medium is a feature of 10–30 items, and
large is a module of 30+ items:

| Template | Small (t/max) | Medium (t/max) | Large (t/max) |
|---|---|---|---|
| `checklist-item-template.md` (per item) | 90 / 140 | 90 / 140 | 90 / 140 |
| `deployment-steps-template.md` | 120 / 250 | 250 / 500 | 400 / 800 |
| `issues-file-template.md` (per issue) | 80 / 130 | 80 / 130 | 80 / 130 |
| `templates/handoffs/*.md` (each) | 90 / 150 | 120 / 200 | 150 / 250 |
| Developer flow guide (new, from `add-doc`) | 500 / 900 | 1,200 / 2,000 | 2,000 / 3,500 |
| Business verification reference (new) | 400 / 700 | 900 / 1,500 | 1,500 / 2,500 |

Per-item budgets do not scale with project size on purpose: a large project has more items, not
longer ones.

### The worked example, in full

**`templates/checklist-item-template.md` — schema**

```
SECTIONS REQUIRED (in this order):
  1. metadata comment      HTML comment, one line, valid JSON
  2. title line            "- [ ] <Item title>"
  3. Type                  one of: ui | backend-api | backend-service | db |
                           logging | infrastructure | cross-cutting
  4. Behavior              what the user or system observes when this works
  5. Location              exact file or project path
  6. Logging               required INFO / ERROR lines, or the literal "none"
  7. Acceptance            one line, in the sentence form below
  8. Verify                the concrete method a fresh agent executes to prove it
  9. Coding Standards      the specific standards section this must follow

SECTIONS OPTIONAL:
  UI ref                   mockup screen + position; required when Type = ui
  Depends on               "#<N>"; present only when a real dependency exists

WORD BUDGET per item:      target 90  ·  maximum 140
                           (identical for small, medium and large projects)

ROW RULES:
  R1  metadata JSON parses, and carries every key named in
      templates/checklist-metadata.yml required list
  R2  metadata "misses" is an array; it may only ever grow
  R3  id is unique within the file
  R4  Type is one of the seven listed values, lower case, exactly
  R5  Location names a path that exists, or is marked "(new)"
  R6  UI ref is present if and only if Type = ui
  R7  Verify names a command, a query, or a browser action — never
      "check that", "confirm that", or "review"
  R8  Depends on, when present, points at an id that exists in this file
  R9  Acceptance obeys the acceptance-line rule below
  R10 no credential, token, connection string or personal data anywhere in the item
```

**The acceptance-line rule.** In the solo edition, fourteen recorded misses traced back to
acceptance lines that permitted two honest readings. One sentence form removes that:

> **"When `<actor>` `<does what>` on `<screen>`, then `<a result a machine can observe>`"**
>
> - at most **30 words**, target **20**
> - holds exactly **one** behaviour

Made testable, five rules a lint can apply:

```
A1  the line matches:  When <...> then <...>
A2  word count is 30 or fewer  (warn above 20)
A3  the line contains no " and ", " also ", " as well as ", or ";" between
    the "then" and the end — those are how two behaviours smuggle in
A4  the text after "then" contains at least one observable:
    a number, a count, a status code, a file name, a table or column name,
    a log string in quotes, or an element the mockup names
A5  the text after "then" contains none of:
    "correctly", "properly", "as expected", "appropriately", "works",
    "is fine", "makes sense", "looks right"
```

Applied to the template's own worked example:

| Line | Verdict |
|---|---|
| *"clicking Export downloads a file whose row count equals the visible grid row count"* | **fails A1** — no "When … then …" form. Rewrite: *"When a user clicks Export on the Cost grid, then a .xlsx downloads whose row count equals the visible grid row count"* — 21 words, one behaviour, passes A1–A5. |

Note honestly what this costs: **the template's own example does not satisfy the rule it is
about to be given.** That is the normal result of turning advice into a schema, and it is the
reason to do it.

**How it is graded.** `acceptance-lint.mjs` reads a checklist, applies R1–R10 and A1–A5 to every
item, and prints one line per violation with the item id. It is Session 3's output. Until it
exists, this rule is marked **review** in §8, not **script**.

---

## 7. Documents: merge, shrink, or move out of the reader's path

A corporate adopter needs four things: a getting-started, the ten phases, the templates, and one
operating guide. Everything else must justify itself. Nothing is deleted without a home.

Today `docs/` holds 31 framework documents totalling 57,105 words, of which 16 ship in the npm
package. Every one has at least one inbound reference — there are no orphans in the strict sense
— but many are referenced only by each other or only by `scripts/test-install.mjs`, which is a
test asserting a file exists, not a reader's path.

**Keep in `docs/`, in the reader's path (7 documents, 18,262 words):**

| Document | Words | Audience |
|---|---:|---|
| `Getting-Started.md` | 5,351 | new adopter — first thing read |
| `Installation.md` | 393 | new adopter |
| `Usage.md` | 216 | new adopter |
| `Troubleshooting.md` | 389 | everyone, when stuck |
| `OpenCode-WSL-Setup-Guide.md` | 7,479 | corporate machine setup — the largest, and it earns it |
| `YOLO-Mode-Guide.md` | 2,217 | operator running unattended |
| `Security.md` | 123 | security reviewer signing off |

**Merge into one operating guide, `docs/Operating-Guide.md` (5 documents, 3,062 words → ~1,800):**
`Operating-Model.md` (76), `Handoffs.md` (35), `Environment-Profile.md` (35),
`Release-And-Operations.md` (38), `Repository-Structure.md` (795), plus `Adoption-Metrics.md`
(404). Five of these are under 100 words each. They are section headings pretending to be
documents, and a reader who opens `docs/` sees six files where they need one page.

**Move to `docs/design/` — out of the adopter's path, kept for maintainers (8 documents,
12,206 words):** `Adapter-Design.md` (1,449), `Capability-Matrix.md` (1,755),
`Coupling-Points.md` (999), `Decisions.md` (2,265), `Telemetry-Hooks.md` (1,036),
`OpenCode-Guide.md` (1,913), `Model-Routing-Guide.md` (1,814), `Npm-Publishing-Guide.md` (819)
and `Npm-Release-Guide.md` (625). These are good documents. They are the record of why the
framework is shaped as it is, and `Decisions.md` in particular should never be lost. They simply
are not what a team lead evaluating adoption needs to walk past.

**Move to `docs/design/telemetry/` (4 documents, 12,330 words):**
`Miss-Telemetry-TechieFlow.md` (5,024), `Miss-Telemetry-AI-First-Playbook.md` (4,201),
`Miss-Telemetry-TfLens-From-AIFP.md` (395), `Phase-Efficiency-TfLens-Contract.md` (2,710).
**Three of these four belong to the other framework or to the contract between the two.** They
are 22 percent of `docs/` and describe something this product is not. `Telemetry-Guide.md`
(2,235) is the shipped one and stays in the reader's path with the seven above.

**Retire outright (2 documents, 4,048 words), with their content folded first:**
`OpenCode-Setup-Guide.md` (680) is a strictly smaller version of `OpenCode-WSL-Setup-Guide.md`
and is referenced only by a test; fold anything unique and delete.
`OpenCode-Only-Framework-Implementation-Checklist.md` (3,368) is the *completed* checklist for
the work that produced today's repository — real historical evidence, but it is a finished
project artefact, not documentation. It moves to `docs/design/history/`. Note it is explicitly
excluded from the source scanner (`playbook-validate.mjs:34`), so moving it needs that path
updated in the same change.

**Two case studies stay but shrink:** `Greenfield-Case-Study.md` (3,847) and
`Brownfield-Case-Study.md` (4,419) are the sales material and they ship. Together with their
HTML renderings they are 20,555 words. Target 2,000 each in markdown; regenerate the HTML rather
than hand-maintaining it.

**Result:** `docs/` goes from 31 documents to **9 in the reader's path** (7 kept + 1 merged
operating guide + 1 telemetry guide) plus the two case studies, with 24,536 words moved into
`docs/design/` where a maintainer finds them and an adopter does not trip over them. Shipped
package contents are unchanged except that the merged operating guide replaces six entries in
`package.json`'s `files` list.

One packaging fix while you are in there: `harness/opencode/command/update-context.md` (834
words) is deliberately excluded from the install (`install.mjs:51`) and absent from
`package.json`, yet `playbook-validate.mjs:131-134` still requires it to have a spec partner.
Either ship it or remove both halves. Right now it is 1,017 words of maintained-but-undelivered
surface.

---

## 7b. What to do about `verification/`

`verification/` is **247 files, 174 of them markdown, 196,498 words — 62 percent of the
repository by word count**. It is 2.85 MB on disk. Almost all of it is three campaign
generations under `verification/opencode-only/`: `verify-01` (80 files, 892 KB), `verify-02`
(74 files, 860 KB), `verify-03` (89 files, 1.1 MB). Each contains a complete `installed-target/`
— a full copy of what the installer produced that day — plus a packed `.tgz` of the npm
tarball.

**What the campaigns prove.** They are the record that the harness-only rebuild was actually
verified rather than asserted: that a packed tarball installs into a clean target, that the
installed target contains exactly the expected files and none of the removed integration
artefacts, that every relative link resolves, and that the unattended supervisor ran end to end.
That is real evidence of a real milestone, and it is the only record that the one-harness install
was ever proven.

**Does anything still depend on them?** Yes, three things — and this is the part that changes
the recommendation:

1. `scripts/playbook-validate.mjs` and `scripts/test-guardrails.mjs` both reference
   `docs/OpenCode-Only-Framework-Implementation-Checklist.md`, which is the campaigns' contract
   document. That is a live coupling to the *checklist*, not to the stored output.
2. `verification/yolo/state.json` — outside the campaign folders — is referenced by the
   supervisor and by that checklist.
3. **Three of the campaign scripts are live, working checks that exist nowhere else**:
   `verify-01/link-audit.mjs`, `verify-01/source-scan.mjs`, and
   `verify-03/verify-doc-integrity.mjs`. I ran all three today. The first two pass. The third
   **fails** — `docs/Getting-Started.md` is 606 lines against its pinned 601.

**Recommendation.**

- **Promote the three scripts out of `verification/` into `scripts/`** and add them to
  `npm run validate`. They are 100 percent of the durable value in those folders. Once the
  doc-integrity script is in CI, either fix the drift or re-pin the number deliberately — but
  never both silently.
- **Keep the campaign folders, but stop committing new ones.** Add `/verification/opencode-only/`
  to `.gitignore` going forward. Future runs write to the same path and are swept after **seven
  days**; nothing about a run's *output* is durable proof once the *check* that produced it is
  re-runnable on demand.
- **Do not delete `verify-03` yet.** It is the only stored evidence that the packed tarball
  installed cleanly, and its `verify-installed-target.mjs` and `verify-doc-integrity.mjs` are the
  scripts being promoted. Archive it outside the repository — a release asset attached to the tag
  it verified is the natural home — and delete `verify-01` and `verify-02`, which are superseded
  generations of the same campaign, once their two unique scripts have been promoted.
- **Protect what is genuinely durable:** `verification/telemetry/misses.ndjson` stays committed,
  as `.gitignore` and `playbook-validate.mjs:178-184` already insist. Nothing in this section
  touches it.

**Effect:** the repository drops from 400 files to roughly **160**, and from 329,066 words to
roughly **135,000**, while gaining three CI checks it did not have.

---

## 8. Requirements for the Playbook itself — and its grader

Twenty-two lines. Each one is marked **script**, **fixture**, or **review**, and the three are
counted separately.

The rule I am holding myself to: **a line marked "script" names an artefact that exists and that
I ran in this session.** This review is analysis-only and creates no code, so nothing new can be
marked "script" today. Lines that *should* become scripts are marked **review** with the artefact
named as the work item. That is the difference between a requirement that is enforced and one
that reads as if it were.

### The list

| # | Requirement | Mark | Artefact | Graded today? |
|---|---|---|---|---|
| R1 | No agent can write a separate gap or verification report file, by any tool or shell redirect | script | `write-policy.mjs` `checkForbidden` | **yes — pass** |
| R2 | The verifier can write only the selected checklist, `verification/**`, and referenced `deploy/<feature>/**` | script | `write-policy.mjs` `checkWritePolicy` | **yes — pass** |
| R3 | No agent writes git history or publishes, in any mode | script | `yolo-policy.mjs` `yoloDecision` | **yes — pass** |
| R4 | The `.opencode/` runtime mirror is byte-identical to `harness/opencode/` | script | `test-guardrails.mjs:8-31` | **yes — pass** |
| R5 | Every runnable command has a spec and every spec a runnable command | script | `playbook-validate.mjs:131-134` | **yes — pass** |
| R6 | The miss stream is append-only, schema-valid, and its durability is protected by `.gitignore` | script | `playbook-validate.mjs:178-195` + `miss-lib.mjs` | **yes — pass** |
| R7 | Agents classify misses; they never author numbers, cost, or provenance | script | `test-misses.mjs` #7, #15, #16 | **yes — pass** |
| R8 | A default install writes only `.opencode/`, `.playbook/`, and the managed gitignore block | script | `test-install.mjs:121` | **yes — pass** |
| R9 | `--force` replaces only package-created files; uninstall without `--force` removes nothing | script | `test-install.mjs:170, 204-207` | **yes — pass** |
| R10 | Model stamps always agree with the tier map and its on/off flag | script | `apply-model-tiers.mjs --check` | **yes — pass** |
| R11 | No artefact or wording from any other harness appears in source | script | `playbook-validate.mjs` `openCodeOnlyErrors` + 20 fixtures | **yes — pass** |
| R12 | The release workflow keeps its publish contract and carries no approval gate | script | `playbook-validate.mjs:88-104` | **yes — pass** |
| R13 | Every relative markdown link in the repository resolves | fixture | `verification/.../link-audit.mjs` — **promote to `scripts/`** | **yes — pass** (not in CI) |
| R14 | Shipped documents keep their pinned structure | fixture | `verification/.../verify-doc-integrity.mjs` — **promote** | **yes — FAIL** (`Getting-Started.md` 606/601) |
| R15 | A packed tarball installs cleanly into an empty target | fixture | `verify-03/verify-installed-target.mjs` — **promote** | no — needs a packed tarball to run against |
| R16 | Every phase's instruction surface stays inside its tier budget | review → script | `phase-budget.mjs` (Session 2) | no — nothing measures it |
| R17 | Every acceptance line matches the sentence form, ≤30 words, one behaviour | review → script | `acceptance-lint.mjs` (Session 3) | no — the rule is not written down yet |
| R18 | Every checklist item satisfies R1–R10 of the item schema | review → script | `checklist-lint.mjs` (Session 3) | no |
| R19 | Every FAIL and DATA-GAP has a miss ID in its item metadata | review → script | `miss-link-lint.mjs` (Session 5) | no |
| R20 | `/implement` and `/fix` end with every item to-verify or explicitly blocker-tagged | review → script | `completion-gate.mjs` (Session 5) | no |
| R21 | Every gate that closed has a handoff record with its eleven fields | review | a person confirms; no artefact proposed | no — and honestly not automatable |
| R22 | The verifier used runtime evidence, not code audit, wherever the tool was reachable | review | a person reads the run log | no — reachability is not recorded |

### The headline number

**12 of 22 are graded by a script I ran. 3 more are graded by a fixture that exists (2 pass, 1
fails, 1 needs an input it does not have). 7 are ungraded.**

Counted as the brief asks — how many can be graded *at all*:

> ## **15 of 22 graded. 7 ungraded.**
>
> By mark: **script 12 · fixture 3 · review 7.**
> Of the 15 graded, **14 pass and 1 fails** (R14).

Seven ungraded lines is the backlog, not a footnote. Five of them (R16–R20) have a named
artefact and a session. Two (R21, R22) rest on a person, and they say so.

### The grader

**`scripts/playbook-grade.mjs` — Session 1's single output.** One command:

```
node scripts/playbook-grade.mjs            # human-readable
node scripts/playbook-grade.mjs --json     # machine-readable
```

Behaviour, exactly:

1. Read `docs/requirements.yml` — the 22 lines above as data, each with `id`, `text`, `mark`,
   `artefact`, and `command`.
2. For every line marked `script` or `fixture`, run its command and capture exit code and output.
3. Print one row per line: `id · mark · PASS | FAIL | UNGRADED · reason`.
4. **For every ungraded line, print the reason** — "no artefact", "artefact not written yet
   (Session 3)", "requires a packed tarball". **Never guess a verdict, and never leave a line off
   the report.**
5. Print the headline: `N of M graded · P pass · F fail · U ungraded`.
6. Append one verdict record per line to `verification/telemetry/grades.ndjson`:

   ```json
   {"kind":"grade","ts":"<UTC>","schema":1,"requirement":"R14",
    "mark":"fixture","verdict":"fail","reason":"Getting-Started.md lines=606/601",
    "artefact":"scripts/verify-doc-integrity.mjs","commit":null}
   ```

   Same stream conventions as the miss stream: append-only, never rotated, one line per record.
   The Playbook's own compliance then sits beside the projects it builds, readable by the same
   tools.
7. Exit non-zero if any graded line fails. Exit zero — but print the ungraded count loudly — if
   only ungraded lines remain. **The ungraded count is the backlog and must never be hidden by a
   green exit code.**

Add `node scripts/playbook-grade.mjs` to `.github/workflows/validate.yml` in the same session.

---

## 9. The miss protocol

Four questions, asked in order. The first one that lands is the answer; stop there.

| Order | Question | Answer | What happens | Framework touched? |
|---:|---|---|---|---|
| 1 | Did the project's spec say it clearly? | **no** | Fix the checklist line. | **No.** |
| 2 | Did the Playbook say it anywhere? | **no** | Add one requirement line **plus a check**. | Yes — one line, one check. |
| 3 | Was there a check, and did it fail to catch it? | **yes** | Fix the check, not the prose. | Yes — the check only. |
| 4 | Was it written and ignored anyway? | **yes** | Make it a script or a gate, **or delete it**. | Yes — the rule stops being prose. |

Question 3 earns its place from the solo edition's own sorted misses: roughly half were "the
check was too weak", a quarter "nobody said it", a quarter "said and ignored". **Half of a
framework's failures are its checks, not its words.** Any protocol that jumps from "we missed
something" to "add a paragraph" gets that half wrong every time.

Question 4 is the one with teeth. A rule that has been ignored twice does not get a third
paragraph — it becomes mechanical or it goes.

### How it is recorded

The record already exists. `verification/telemetry/misses.ndjson` carries `why_missed` from a
closed seven-value vocabulary (`miss-lib.mjs:44-47`). Two changes:

**One new field, `miss_route`,** storing which question fired — the four values `spec`,
`framework`, `check`, `ignored`. It joins `why_missed` in the amendable list so a null can be
completed later but never overwritten, exactly as `why_missed` works today
(`miss-lib.mjs:62`, Decision 3 in `docs/Decisions.md`).

**One new `why_missed` value, `framework-silent`,** for question 2. The current vocabulary has no
value meaning "the Playbook said nothing about this", so those misses fall into `other` and
become invisible. The mapping:

| Route | `why_missed` values that belong to it |
|---|---|
| `spec` | `missing-checklist-item`, `ambiguous-acceptance`, `dependency-not-declared` |
| `framework` | `framework-silent` *(new)* |
| `check` | `insufficient-verify-method`, `code-audit-limitation` |
| `ignored` | `instruction-ignored` *(already agent-origin-only — leave that constraint alone)* |

`miss_class`, `artifact`, `severity`, and every derived numeric field are untouched.

### How it is reported

`node scripts/playbook-miss.mjs report` — a verb the CLI does not have today; I checked, and it
answers `unknown command — open | close | amend | next-id | list`. Adding it is Session 5's job.
It prints three counts and nothing else:

```
route: spec 12 · framework 4 · check 19 · ignored 5
by phase:  plan 3 · build 14 · verify 18 · human-acceptance 5
found by:  verifier 22 · human 11 · self-review 5 · production 2
```

And one line that is the whole point:

```
of 40 misses, 19 (48%) were a check that was too weak
```

### The stream today

Ten records: five misses and five fixes. Every miss is closed with `verdict_after=pass`; the
backlog is zero. All five come from the framework's own construction — features
`opencode-only-framework` and `installer` — not from a project built with the Playbook.
`why_missed`: `instruction-ignored` ×3, `insufficient-verify-method` ×2. All five are
`severity: major`; found by human ×2, verifier ×2, agent-review ×1.

Say this plainly, because it is the second-most-important finding in this review: **the Playbook
has a working miss record and no data in it about building software.** The machinery is proven —
24 tests, a validator, a closed vocabulary, append-only correction. It has simply never been
pointed at a real project. Five records is not a sample; it is a smoke test that passed. The
framework can currently show what *it* got wrong while being built, and cannot yet show that
teams using it get less wrong over time.

---

## 10. The work sessions, in order

Eight sessions. **The first three are deliberately out of life-cycle order**, and it is worth
saying why in one sentence: the standing rules and the verifier prompt are loaded by every phase,
so shrinking them shrinks every phase at once, and the grader must exist before anything else is
claimed to be fixed. Everything after that follows the lifecycle.

| # | Goal | You bring | Output file(s) |
|---|---|---|---|
| **1** | **The grader exists.** Turn §8's 22 lines into data and build the command that walks them, runs what can be run, and names every reason a line is ungraded. Wire it into CI. | A ruling on the 22 lines: which you accept, which you want reworded, which you want dropped. | `docs/requirements.yml`, `scripts/playbook-grade.mjs`, `.github/workflows/validate.yml` |
| **2** | **Shrink what every phase loads.** Split `verifier.md` into a ~2,400-word core plus eight reference files per §5.1. Move `implement.md`/`fix.md`'s 1,082 shared words into `harness/opencode/reference/build-and-smoke.md`. Delete the cosmetic progress-reporting blocks (1,146 words across four files). Build `phase-budget.mjs` and grade R16. | Rulings on the DELETE rows in §5.1, §5.3 and §5.5 — 24 rows, one word each. | `harness/opencode/agent/verifier.md`, `harness/opencode/reference/*.md`, `harness/opencode/command/{implement,fix}.md`, `scripts/phase-budget.mjs` |
| **3** | **The checklist becomes a schema.** Write the item schema and the acceptance-line rule from §6 into the template; build `acceptance-lint.mjs` and `checklist-lint.mjs`; grade R17 and R18. Fix the template's own worked example. | One real checklist from a real project, to run the lint against. Without it this session is theoretical. | `templates/checklist-item-template.md`, `scripts/acceptance-lint.mjs`, `scripts/checklist-lint.mjs` |
| **4** | **Finish the block table.** Block-level verdicts for the eleven commands §5.6 covers only at file level, plus `harness/README.md`, `phases/` and `templates/`. Correct the two drifted facts in `harness/README.md`. Resolve `update-context.md`: ship it or remove both halves. | Rulings on whatever §5.6 leaves open, especially `archive-checklist` and `generate-html` becoming plain scripts. | `docs/claudereview/Playbook-Reset-Plan.md` (this file, §5 extended), `harness/README.md`, `package.json` |
| **5** | **Enforce the build and verify rules.** Build `completion-gate.mjs`, `miss-link-lint.mjs`, `verdict-lint.mjs` and `verify-scope-lint.mjs`. Add the `report` verb and the `miss_route` field per §9. Grade R19 and R20. This is the session that moves the ratio. | Confirmation of the four-question protocol and the `framework-silent` vocabulary addition. | `scripts/{completion-gate,miss-link-lint,verdict-lint,verify-scope-lint}.mjs`, `scripts/miss-lib.mjs`, `scripts/playbook-miss.mjs` |
| **6** | **Clean the document path.** Execute §7: merge six files into `Operating-Guide.md`, move 24,536 words into `docs/design/`, retire two documents, update `package.json` and the scanner exclusion path. | A ruling on the four telemetry documents that belong to the other framework — move or delete. | `docs/Operating-Guide.md`, `docs/design/**`, `package.json`, `scripts/playbook-validate.mjs` |
| **7** | **Sweep `verification/`.** Promote the three live scripts into `scripts/` and into CI. Fix or re-pin the doc-integrity drift. Ignore the campaign path going forward; archive `verify-03` as a release asset; delete `verify-01` and `verify-02`. Grade R13, R14, R15. | A decision on where the archived campaign lives, and whether `Getting-Started.md` should be 601 or 606 lines. | `scripts/{link-audit,source-scan,verify-doc-integrity}.mjs`, `.gitignore`, `.github/workflows/validate.yml` |
| **8** | **Point it at a real project and grade the result.** Run one feature end to end through all ten phases, record every miss with its route, then run the grader and read the numbers. | A real feature, a real repository, and the time to sit through it. | `verification/telemetry/{misses,grades}.ndjson`, and a short report |

Sessions 1 and 2 are worth doing even if nothing else happens. Session 1 makes the framework
gradeable; Session 2 makes every phase cheaper on the day it lands. Session 8 is the only one
that can tell you whether any of this worked, and it cannot start until Session 5 finishes.
