---
description: Build a planned feature from its implementation checklist using parallel sub-agents and a build+smoke-test self-check before declaring done
---

Read `playbook/environment-profile.yml` before running any build, migration or start command.
Use only profile-declared topology and secret-safe commands; never guess stack, ports, config
files or migration tools.

**IMPORTANT**: Before starting, activate the Orchestrator persona. See
`harness/README.md` → Personas. On a BMAD install that means reading and
following `.opencode/agent/orchestrator.md`; any equivalent
orchestrator persona works.

You are the Orchestrator. **You are NOT a single developer working through a
list one item at a time.** You are a coordinator who spawns multiple parallel
sub-agents to work on independent groups of checklist items concurrently.
Single-threaded execution wastes the user's time and the entire point of
using a coding harness.

## User's full input
$ARGUMENTS

## How to parse the input
The user's input contains:
1. **File paths** — the implementation checklist and optionally other references.
   Read ALL referenced files.
2. **Additional instructions** — any extra constraints, priorities, or specific
   directions the user wants you to follow during implementation. These override
   the checklist where they conflict.

## YOLO mode (unattended) — check this first
YOLO mode is on if the input above contains the token `YOLO` (any case, `*YOLO*` counts),
a `/goal` is active, or `PLAYBOOK_YOLO=1` is set. When on, the `AGENTS.md` "YOLO mode"
rules apply to this whole run and to every builder you spawn (say so in each brief):

- Every approval gate below — the wave plan "Proceed?", the smoke-test "Approve?",
  deployment steps, tool installs, deletions, environment choices — is **pre-approved**.
  Do not pause. Decide, log one line under `## YOLO Decisions` in the checklist, continue.
- Git history writes are denied mechanically; everything else (deletes, read-only git,
  process kills, installs) is allowed.
- Do not stop until the **completion contract** (next section) is met. If the provider's
  usage limit interrupts you, the supervisor resumes this session after the reset; on
  resume re-read the Status Table and continue from the first unfinished item.
- Finish with the sentinel line `PLAYBOOK_RUN_COMPLETE: <summary>` (or
  `PLAYBOOK_RUN_BLOCKED: <missing thing + owner>` if only an external blocker remains).

## Completion contract — the whole checklist, in one run
`/implement` is finished only when **every item in scope** is implemented, built,
self-tested and its Status Table row reads to-verify — or carries an explicit
`[INFRA BLOCKER]` / `[EXTERNAL BLOCKER]` note naming what is missing and who supplies it.

- **Never** end with "items #1–#9 done; run `/implement` again for #10–#19". That is a
  violation of the phase, not a status. If the remaining items do not fit, plan **another
  wave** (Wave 4, Wave 5, …) with smaller slices and spawn it — the loop is
  `plan wave → spawn → aggregate → next wave` until the Status Table has no item left in
  planned / in-progress.
- Context pressure is handled by giving sub-agents smaller slices and by summarising wave
  results tersely, never by handing the remainder back to the human.
- Hand off to `/verify` **once**, with every item accounted for.
- Outside YOLO mode you may still pause *between* waves for a human question if one is
  truly required — but the answer must be "continue with the next wave", not "run the
  command again".

## Required inputs
You must have the path to the **Implementation Checklist** document.
For example: `ImplDocs/CostDocs/App-CostOptDashboard-FullStack-Implementation-Checklist.md`

If not provided, **ASK** for:
1. Path to the implementation checklist document
2. Path to the coding standards document (e.g., `ImplDocs/Coding-Standards.md`)

## Before writing any code
1. Read the **full implementation checklist** document.
2. Read the **coding standards** document and follow it for ALL code.
3. Read the **DB changes** document (sibling to the checklist) for schema details.
4. Read the **architecture** document (sibling to the checklist) for design decisions.
5. Read `AGENTS.md` at the repo root for standing rules (logging, UI fidelity,
   error handling, definition of done).

## Token discipline
- If the checklist is very large (>~2,000 lines), tell the user to run
  `/archive-checklist` first — implementing against a bloated checklist wastes
  tokens on every sub-agent.
- **Give each sub-agent ONLY its slice**: the specific checklist items and the
  files it owns — NOT the entire checklist or every sibling doc.
- When reading existing code to match patterns, `grep` to the relevant
  component/pattern and read a focused window; don't read whole large files.
- Right-size waves: don't spawn 8 sub-agents for 10 trivial items.

---

## Phase 1: Plan parallel execution

Before spawning ANY sub-agent, produce an execution plan:

1. **Group the checklist items by independence**. Two items are independent if
   they touch DIFFERENT files (or non-overlapping regions of the same file).
   Examples of natural groups:
   - DB layer: schema migrations, EF model changes, stored procedures
   - Backend domain: service classes in one project (`InventoryCore`)
   - Backend API: controller endpoints in the API project
   - Frontend components: React components in `src/frontend/src/...`
   - Frontend hooks/services: API client code
   - Cross-cutting: logging config, DI registration (must be coordinated)

2. **Detect conflicts**. If two items in different groups both modify
   `Program.cs` or `appsettings.json` or `Startup.cs`, those items MUST be
   sequenced within ONE group — never spawn two sub-agents that race on
   the same file.

3. **Identify ordering dependencies**. DB migrations must finish before
   backend code uses the new tables. Models must compile before services
   reference them. Plan a small DAG:
   - Wave 1 (foundational): DB migrations, new shared models, DI scaffolding
   - Wave 2 (independent in parallel): backend services, controllers,
     frontend components — each in its own group
   - Wave 3 (integration): wiring, end-to-end glue, anything that needs
     wave-2 outputs

4. **Tell the user the plan** before launching:
   ```
   Execution plan for <checklist>:

   Wave 1 (sequential foundation): items #3, #5, #11
     - DB migration, shared models, DI scaffolding

   Wave 2 (parallel, 4 sub-agents):
     Agent A → items #6, #7, #8 (CostDataSyncSvc + sync internals)
     Agent B → items #9, #10 (CostController + DTOs)
     Agent C → items #12, #13, #14, #15 (React dashboard components)
     Agent D → items #16, #17 (React API hooks + state)

   Wave 3 (sequential integration): items #18, #19
     - Wire controller to service, add routes to app shell

   Total: 19 items, 3 waves. Expected concurrency: 4 in wave 2.
   Proceed? (yes / no / refine)
   ```
   **YOLO mode:** print the plan, then proceed immediately — do not wait for an answer.

5. After approval (or immediately in YOLO mode), launch wave by wave. **Inside each wave, use the `task` tool
   to spawn sub-agents in PARALLEL** (multiple tool calls in a single message)
   — never sequentially. **Always spawn the `builder` subagent type for wave
   work** — it carries its own (cheaper) model tier, so wave workers never
   silently inherit your model. Use a different subagent type only if the user
   explicitly asks for one.

---

## Progress reporting — keep the user informed during long runs

Long silent agents look hung. The HARD RULE that fixes this:
**before any group of tool calls, emit a plain text message saying
what you are about to do. Tool calls and text-to-the-user must
ALTERNATE, not interleave.**

### The mandatory alternating pattern

Every cycle of work looks like this:

```
[text: "▶ what I'm about to do"]
[tool call 1]
[tool call 2]
[tool call 3]
[text: "✓ what I found / what's next"]
[tool call 4]
...
```

Never go more than ONE tool-call batch (3-5 related calls max)
without a plain text message. If your previous response was a tool
call and your next response is also a tool call, you have violated
this rule — back up and emit a text message first.

This is non-negotiable. The model has a habit of stringing 20 tool
calls together silently. Fight that habit.

### Required announcements (each is its own text turn)

1. **At the very start**, after reading the checklist:
   ```
   ▶ /implement starting against <checklist>
     - Items in scope: <N>
     - Waves planned: <W>
     - Concurrent agents in Wave 2: <K>
     - Expected runtime: ~<X> minutes

   Note for the user: sub-agents (Wave 2 parallel agents) run in
   child sessions in the OpenCode TUI. Their detailed chat lives
   in those child sessions, not here. To watch live per-item
   progress, open another terminal and:
       tail -f <checklist-path>
   The Status Table rows update as each item completes.
   ```

2. **Before each wave** (separate text turn before the task calls):
   ```
   ▶ Wave <N> starting: <description>, <K> parallel sub-agents
     - Agent A → items #6, #7, #8 (CostDataSyncSvc)
     - Agent B → items #9, #10 (CostController)
     - Agent C → items #12, #13 (React components)
   Launching them now via task tool.
   ```
   Then call `task` (multiple parallel calls in one tool batch).

3. **After the wave returns** (separate text turn before next wave):
   ```
   ✓ Wave <N> complete:
     - Agent A: 3 items implemented, build PASS              (4m 12s)
     - Agent B: 2 items implemented, build PASS              (2m 38s)
     - Agent C: 2 items implemented, build PASS              (5m 41s)
   ```

4. **Before the build+smoke self-test** (separate text turn):
   ```
   ▶ Phase 3: build + smoke self-test
   Will run: dotnet build → start apps locally (with approval) →
   curl each new endpoint → snapshot each new page → grep logs →
   kill the apps.
   ```

5. **Before each long single tool call** (>30s), emit a text turn
   like:
   ```
   ⏳ Running `<command>` — expected ~<estimate>. Will report when done.
   ```

6. **Heartbeat**: if >2 minutes since your last text turn and you're
   about to make a new tool call, emit a one-line text turn first:
   ```
   ⏳ Still working. Last action: <one-line>. Elapsed: <Nm>. No errors yet.
   ```

### What NOT to announce

- **Per-item in chat** ("now implementing item #14"): NO. The Status
  Table in the checklist is the per-item log; each sub-agent updates
  its row as it goes. Tell the user to `tail -f` the checklist.
- **Echoing tool output**: NO. Summarise (one line) and move on.
- **OpenCode tool-call lines**: the TUI already shows these. Don't
  echo them.

### Reality about parallel sub-agents in OpenCode TUI

When you spawn parallel sub-agents via `task`, those run in CHILD
SESSIONS. The parent (you) sees `task` results as structured
returns, but the child sessions' running chat lives in the TUI's
session tree (user navigates with session keys), NOT in your
session's chat.

Three implications:
- The PARENT must emit text turns between waves (your job).
- The user can navigate into a child session to see what an
  individual agent is doing right now.
- For passive monitoring, `tail -f <checklist-path>` is the live
  view — sub-agents update the Status Table and item annotations
  as they finish each item.

State this explicitly in your start-of-run message (point 1).

---

## Phase 2: Implementation rules (apply to every sub-agent)

Each sub-agent you spawn is given a SUBSET of checklist items and the
following constraints:

- Implement ONLY the items in your assigned group. Do not touch items in
  other groups.
- For **UI items**: match the mockup EXACTLY. Implement into the EXISTING
  UI structure, component library, and coding patterns. Do not invent new
  patterns, styles, or layouts.
- For **backend items**: follow the existing project structure for services,
  controllers, DI registration, and data access patterns.
- For **DB items**: use the exact DDL/SQL from the DB changes document.
- **Logging** is non-negotiable: every sync/job logs start, finish with row
  count at INFO; every catch logs ERROR with stack and failing input.
- **Error handling** is non-negotiable: no silent failures.
- Follow the coding standards document for naming, formatting, and patterns.
- Return a structured summary: files created, files modified, build status.
- If the approved plan or checklist left behavior required by the slice unspecified,
  return a **miss candidate** with related item ID (if any), artifact `plan` or
  `checklist`, severity, and a one-line reason. Do not invoke `playbook-miss.mjs`, edit
  the checklist, or write the stream from a parallel worker.

After each wave finishes, **aggregate** the sub-agents' results before
launching the next wave. If any sub-agent failed, decide whether to
proceed or stop.

### Centralized miss recording for builder-discovered specification gaps

After each wave returns, the Orchestrator deduplicates genuine miss candidates. Record
only required behavior that the plan/checklist left unspecified, not ordinary coding
questions or implementation churn. Process candidates **serially**, never from builders:

```bash
PLAYBOOK_TELEMETRY=1 node scripts/playbook-miss.mjs open --if-new \
  --miss-class=unspecified-gap --artifact=<plan|checklist> --severity=<blocker|major|minor> \
  --found-by=agent-review --found-phase=build [--item-id=<id>] [--feature=<token>] \
  [--origin-phase=<plan|plan-review-gate>] [--origin-agent=<token>] \
  [--origin-run-id=<exact-id>] --harness=opencode
```

The harness flag is mandatory and set explicitly above as `--harness=opencode`; never rely
on the CLI default. Capture either `opened MISS-*` or
`collapsed: MISS-*` and append that ID once to the related item's metadata `misses` array.
Never remove IDs. If there is no related item, retain the ID in the wave summary / Run Log.
The CLI is fire-and-forget and exits zero on refusal: note a telemetry refusal and continue;
it must never change implementation, build, self-test, Status Table, or phase outcome.

---

## Phase 3: Build + smoke-test self-check (MANDATORY before declaring done)

Building successfully is **not enough**. After all waves complete, the
Orchestrator must prove the code actually runs. This catches obvious
runtime breakage during /implement instead of three commands later.

### NO EXCUSES — you CAN run things in this container (read first)
The smoke test is NOT optional and the following excuses are NOT acceptable
for skipping it (they have been abused before):
- **"I don't have SQL Server access"** — FALSE. The connection string is in
  `appsettings.Development.json`. You have `dotnet`. Query the DB with a tiny
  `Microsoft.Data.SqlClient` console under `verification/<feature>Runner/`,
  or `sqlcmd` if present. Read the real connection string and use it.
- **"I can't run the web app"** — FALSE. `dotnet run --project <ApiProject>`
  and `npm run start:local` both run IN this container; Playwright is on
  the profile's Playwright endpoint.
- **"I can't run the Windows desktop app"** — NOT a blocker. The real logic is
  in .NET class libraries the container CAN execute. Write a console runner
  under `verification/<feature>Runner/` that calls the exact library method/
  data-access method/stored proc the item is about, using real `appsettings`
  config, and capture the DB rows it produces. Use the optional Windows-host
  GUI bridge only if one is configured — probe the profile's declared bridge URL;
  if it doesn't return 200, it's not configured, so use the headless runner.
  Its absence never blocks logic verification.

The only legitimate reason to defer is the user explicitly saying "skip the
smoke test". Anything else, you run it.

### Smoke-test against the Developer-Flow-Guide
If a `*-Developer-Flow-Guide.md` exists for this feature, use its per-screen/
tab flow rows as your smoke-test script: for each value you touched, confirm
the screen, the API endpoint, and the DB (stored proc / table) AGREE. The
flow guide names the exact endpoint, SP, and table — execute them and compare.

### Step 3.1: Build everything you touched
- `dotnet build` on each .NET project that any sub-agent modified. Must
  pass with zero errors.
- `npm run build` (or equivalent) on the frontend project if you touched it.
- **STOP if any build fails.** Annotate the failing items in the checklist
  as `BUILD FAILED` and hand back to the user — do not attempt smoke tests.

### Step 3.2: Start the apps locally (web) / build a runner (desktop/logic)
Use the project's **own start commands** (look in `package.json` /
`launchSettings.json` / the Verification Guide):
- Backend: `dotnet run --project <ApiProject>` in background (capture PID)
- Frontend: `npm run start:local` in `src/frontend/` (background, PID)
- Desktop/library logic: build a `verification/<feature>Runner/` console that
  references the same library project and invokes the methods you implemented,
  using the real `appsettings` config.

**ASK the user ONCE**: "I'm about to start the backend (`<cmd>`) and frontend
(`<cmd>`) locally for a smoke test. Approve? (yes/no)"
**YOLO mode:** announce the commands and start them — pre-approved. Pick the
environment variant the profile marks as default (else the first `start:*` script) and
log the choice under `## YOLO Decisions`.

Only the USER may say skip. You do NOT self-skip with an excuse about SQL,
running the app, or the Windows app (see "NO EXCUSES" above). If a process
won't start, that's a real finding: capture the exact error into the
checklist (`SMOKE FAIL — could not start <service>: <error>`) — do NOT
relabel it as "can't test / blocked".

### Step 3.3: Hit each new/touched endpoint and confirm status
For each new or modified controller method, fire one HTTP request using
`curl` (with a dev token if your appsettings has one configured):
```
curl -s -o /dev/null -w '%{http_code}\n' \
  -H "Authorization: Bearer $DEV_TOKEN" \
  http://localhost:<port>/<route>
```
Expected: 200, 201, 204, 401 (if auth needed and no token), or another
documented status. Anything else (especially 500) is a smoke FAIL.

### Step 3.4: Verify the DATA reached the database (don't trust HTTP 200 alone)
For any item that writes/reads DB data (sync, stored proc, data-access method):
read the real connection string from `appsettings.Development.json` and confirm
the rows. Use `sqlcmd` if present, else a tiny `Microsoft.Data.SqlClient`
console under `verification/<feature>Runner/`. Example check: after triggering
a sync endpoint, `SELECT COUNT(*)` on the target table and confirm it grew /
matches expectation. A 200 with zero rows written is a smoke FAIL, not a pass.
This is the step that catches the "looks done but does nothing" class of bug.

### Step 3.5: One frontend snapshot
If the profile's Playwright MCP endpoint is reachable (`curl "$PLAYWRIGHT_MCP_URL/mcp"`
returns success), use it to navigate to the new page and take a snapshot
that confirms the page rendered without an error boundary. Just one
snapshot — this is a smoke test, not full verification.

### Step 3.6: Stop the processes you started
Kill the backend and frontend PIDs you captured. Do NOT leave processes
running.

### Step 3.7: Record smoke-test outcomes
For each item:
- If smoke test passed: annotate `- **Self-test** (<date>): PASS — <one-line evidence incl. DB row count where relevant>`.
- If smoke test failed: annotate `- **Self-test** (<date>): FAIL — <reason>` AND update Status Table.
- If smoke test was skipped because the USER said skip:
  annotate `- **Self-test** (<date>): SKIPPED — user requested`.
- "Environment can't support it" is NOT a valid skip reason here — if you
  believe that, you haven't tried the headless path in "NO EXCUSES".

If this self-review catches a genuine defect rather than routine implementation churn,
the Orchestrator may serially open/link it with `found-by=self-review` and
`found-phase=self-review`. If repaired and self-tested, append a close with
`--verdict-after=deferred --fix-phase=self-review`; never claim `pass` before independent
verification. Include a run ID only when exact. All calls use `PLAYBOOK_TELEMETRY=1` and
the harness-specific flag above and remain fire-and-forget.

---

## Phase 4: Update the checklist — Infrastructure & Deployment Steps

The checklist must record TWO kinds of side effects so `/verify` and the
team know about them.

### A. `## Infrastructure Requirements` — external resources that must exist

Examples: Azure Blob containers, Service Bus queues, KeyVault secrets,
SQL databases with specific permissions, DNS entries, certificates,
RBAC roles for managed identities, firewall openings.

Append entries like this:
```
- **<Requirement>**: <one-line what + where it's referenced in code>
  - Where configured: <appsettings key or env var name>
  - Setup: <one-line how to create it>
```

If the resource doesn't exist and you can't create it yourself, mark the
relevant checklist items with `[INFRA BLOCKER]` and list the requirement.

### B. `## Deployment Steps` — actions to apply the code changes

Slim format with two subsections so `/verify` knows what it can run vs
what's manual:

```markdown
## Deployment Steps

### Automated (Verifier runs these with your approval)
- [ ] Run cost schema migration
  - `sqlcmd -S "$DB_SERVER" -d "$DB_NAME" -U "$DB_USER" -i deploy/cost/01-schema.sql < "$DB_PASSWORD_FILE"`
- [ ] (only if you ADDED new npm packages this run)
      Install new dependencies
  - `npm install` in src/frontend/

### Manual (you do these)
- [ ] Restart the InventoryCore service on the API host
- [ ] Add the new `Cost:ApiKey` secret to dev KeyVault
- [ ] Start the frontend pointing at the right environment:
      `npm run start:local` (dev DB / dev APIs) OR
      `npm run start:local:uat` (UAT DB / UAT APIs) — pick based on which
      DB you want to test against
```

### Critical rules — read these to avoid common mistakes

1. **DB migrations: use `sqlcmd`, NOT Entity Framework.** These commands assume applications that
   use raw SQL (no EF Core / no `dotnet ef`). Write SQL scripts under
   `deploy/<feature>/` and reference them via `sqlcmd`. The user has
   `sqlcmd` available on their Windows host (comes with SSMS). The
   command pattern is:
   ```
   sqlcmd -S "$DB_SERVER" -d "$DB_NAME" -U "$DB_USER" -i deploy/<feature>/01-name.sql < "$DB_PASSWORD_FILE"
   ```
   The actual server / db / credentials come from the project's
   `appsettings.Development.json` connection string — DO NOT bake them
   into the step; show them as `<placeholders>` so the user (or
   Verifier) substitutes from real config at run time.

2. **`npm install` only if you added new packages.** Check whether
   `package.json` gained any new dependencies (or `package-lock.json`
   changed) during this implementation. If yes, add `npm install` to
   Automated. If no, do NOT add it — it's noise that wastes the user's
   time.

3. **Starting the frontend is environment-specific.** The frontend has
   multiple start scripts that pick different API endpoints. DO NOT
   default to one. Always frame the start step so the user picks:
   ```
   - [ ] Start the frontend pointing at the right environment:
         `npm run start:local`     (dev DB / dev APIs)
         `npm run start:local:uat` (UAT DB / UAT APIs)
   ```
   Look at the frontend's `package.json` `scripts` section to enumerate
   the actual variants the project supports — don't invent ones that
   don't exist. List every `start:*` variant in the step so the user
   knows their options.

4. **Backend start is one command, but the user chooses the project.**
   List the dotnet command but let the user pick which API project to
   run:
   ```
   - [ ] Start the API: `dotnet run --project <ApiProject>`
   ```
   If there's only one API project and it's obvious, name it directly.

5. **An Automated step MUST include the exact shell command** in a
   fenced inline `code` block. Without a runnable command, the step
   belongs in Manual.

6. **A Manual step is just a one-line action** — no Command field, no
   Idempotent field, no Owner field. The user reads it and decides.

7. **Don't include trivial steps that are part of a build** — don't list
   `dotnet build` as a deployment step; that's implied.

8. **Scripts created during /implement** go under `deploy/<feature>/`
   (e.g., `deploy/cost/01-schema.sql`, `deploy/cost/02-grants.sql`)
   and are referenced inline from the Automated step.

### Decision: Infrastructure vs Deployment Step
- "Run this SQL migration" → Deployment Step (Automated, has a command)
- "A SQL database named X must exist with these permissions" → Infrastructure
- "Restart the API service" → Deployment Step (Manual)
- "A Blob container named `cost-exports` must exist" → Infrastructure
- "Set this env var" → Deployment Step (Manual, usually)

### Empty sections
- No deploy steps needed: `## Deployment Steps\n\n_None required._`
- No new infra needed: `## Infrastructure Requirements\n\n_None required._`

Both sections must exist so `/verify` knows nothing was forgotten.

---

## When done
0. **Completion check first**: scan the Status Table. If ANY item is still
   planned / in-progress and has no `[INFRA BLOCKER]` / `[EXTERNAL BLOCKER]`
   note, you are NOT done — plan the next wave and go back to Phase 1 step 5.
   Do not write the summary below until that is true.
1. Update the Status Table in the checklist: mark items as complete with
   the agent ID (e.g., "Agent B"), build status, and self-test status.
2. If any item could NOT be implemented, explain why in the Notes column
   (and the blocker tag — the reason must be external, never "ran out of
   context" or "next run").
3. Verify the Deployment Steps and Infrastructure Requirements sections
   are complete.
4. Tell the user explicitly:
   ```
   Implementation complete. Status:
     - Wave 1: <count> items implemented, builds passing
     - Wave 2: <count> items implemented across <N> parallel agents
     - Wave 3: <count> items implemented
     - Self-test: <smoke results>
     - Deployment steps to run before /verify: <count> automated, <count> manual
   Next: run `/verify @<checklist>` to do the independent audit.
   ```
5. **YOLO mode only:** finish with the sentinel as the very last line —
   `PLAYBOOK_RUN_COMPLETE: <N>/<N> items to-verify, self-test <summary>` or
   `PLAYBOOK_RUN_BLOCKED: <what is missing and who supplies it>`. Report
   `git status`; do not commit.
