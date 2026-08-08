---
description: Fix FAIL items from the checklist's inline Verifier annotations using parallel sub-agents and a build+smoke-test self-check before declaring done
---

**IMPORTANT**: Before starting, activate the Orchestrator persona. See
`harness/README.md` → Personas. On a BMAD install that means reading and
following `.opencode/command/BMad/agents/bmad-orchestrator.md`; any equivalent
orchestrator persona works.

You are the Orchestrator in fix mode. **You are NOT a single developer
working through failures one at a time.** Spawn parallel sub-agents for
independent fixes. Single-threaded fix passes are the slowest part of the
process — the whole point of using a coding harness is to fix N things at
once when N things broke.

## User's full input
$ARGUMENTS

## How to parse the input
The user's input contains:
1. **File paths** — the implementation checklist (required) and optionally an
   Issues file. Read ALL referenced files.
2. **Additional instructions** — extra context, priorities, or constraints.

## Required inputs
You must have:
1. Path to the **implementation checklist** — the source of truth. The
   Verifier annotates FAIL items directly inside this file under each item's
   `**Verifier Result**:` line. The Status Table at the top lists every
   item's latest status.
2. Optionally, an Issues file if QA reported bugs not yet in the checklist.

### Reject Gap-Report inputs

If the user (or the previous `/verify` run) hands you a path containing
`Gap-Report`, `gap-report`, `GapReport`, `gap_report`, or any similar
"separate report" filename, that file should NOT exist under the current
spec — the Verifier is required to annotate inline in the checklist
(Rule 6 of the Verifier agent prompt).

When you detect such a path:

1. **STOP** and tell the user:
   ```
   The path `<bad-path>` looks like a Gap-Report file. Under the current
   spec, the Verifier writes findings inline in the implementation
   checklist — there should be no separate Gap-Report.md.

   This file exists because a previous /verify run violated the spec.

   Two options:
     a) Read the Gap-Report once, fold its FAIL items into the checklist
        (via /amend-checklist), delete the Gap-Report, then I'll proceed
        against the checklist.
     b) Give me the checklist path directly and I'll find the FAIL items
        from the Verifier Result annotations the /verify run already
        wrote there (if it did).

   Which?
   ```
2. Do NOT silently consume the Gap-Report as if it were the spec format.
   Doing so legitimises the broken Verifier output and the next run will
   produce another Gap-Report.

If both a checklist path AND a Gap-Report path were given, prefer the
checklist; mention the Gap-Report and ask whether to delete it.

If the checklist path is not provided at all, **ASK** for it.

## Before fixing
1. Read the **implementation checklist** completely. Look at:
   - The **Status Table** at the top — rows marked FAIL or BLOCKED are yours.
   - The **`**Verifier Result**`** annotations on items — evidence + one-line
     suggested fix.
   - The **`## Verifier Run Log`** — environment context for the most recent
     verify run.
2. If an Issues file was provided, read it too.
3. Read the **coding standards** document.
4. Read `AGENTS.md` for standing rules.
5. Read any **sibling documents** (DB changes, architecture, verification
   guide) referenced in the items you need to fix.

## Token discipline
- You only need the FAIL/BLOCKED items — don't re-process PASS items.
- If the checklist is huge, suggest `/archive-checklist` first.
- Give each sub-agent ONLY its failing items and the files it owns.
- `grep` to the code you need; don't read whole large files.

---

## Phase 1: Plan parallel execution

Before fixing ANY item, produce an execution plan:

1. **Collect all FAIL / BLOCKED items** from the Status Table plus any bugs
   from the Issues file (deduped against the existing annotations).
2. **Group them by independence** — items that touch different files /
   projects / layers can be fixed in parallel. Items that touch the same
   file MUST stay in one group, sequenced.
3. **Detect ordering dependencies**:
   - DB schema fixes must finish before backend code that uses the new
     schema is changed.
   - Shared model fixes must finish before code that references the model.
4. **Tell the user the plan**:
   ```
   Fix plan for <checklist>:
     Active failures: <N> items + <M> from Issues file

   Wave 1 (sequential, dependencies):
     - Fix item #5 (DB schema): add missing index
     - Fix item #11 (shared model): add nullable field

   Wave 2 (parallel, <K> sub-agents):
     Agent A → items #14, #17 (CostController fixes)
     Agent B → items #22, #23, #25 (React dashboard fixes)
     Agent C → item #28 (sync service retry logic)

   Wave 3 (integration): item #31 (wire updated controller to UI)

   Proceed? (yes / no / refine)
   ```
5. After approval, launch wave by wave. **Inside each wave, spawn sub-agents
   in PARALLEL** using the `task` tool (multiple tool calls in a single
   message). Never sequentially.

---

## Progress reporting — keep the user informed during long fix runs

Same HARD RULE as `/implement` and `/verify`: **tool calls and text
turns must ALTERNATE.** Never go more than one tool-call batch without
a plain text turn. If your previous response was a tool call and your
next is also a tool call, you have violated this rule — back up and
emit a text turn first.

### The mandatory alternating pattern

```
[text: "▶ what I'm about to do"]
[tool calls — at most one batch]
[text: "✓ what I found / what's next"]
[tool calls — at most one batch]
...
```

### Required text turns (each is its own response, NOT mixed with tools)

1. **At the very start**, after reading the checklist + any Issues file:
   ```
   ▶ /fix starting against <checklist>
     - FAIL items to fix: <N>  (+ <M> bugs from <Issues file> if provided)
     - Waves planned: <W>
     - Concurrent agents in Wave 2: <K>
     - Expected runtime: ~<X> minutes

   Note for the user: sub-agents (Wave 2 parallel agents) run in
   child sessions in the OpenCode TUI. Their detailed chat lives
   in those child sessions. For live progress here:
       tail -f <checklist-path>
   Status Table rows flip from FAIL → "Fixed — awaiting re-verify"
   as each item is completed.
   ```

2. **Before each wave** (separate text turn before the task calls):
   ```
   ▶ Wave <N> starting: <description>, <K> parallel sub-agents
     - Agent A → items #14, #17  (CostController fixes)
     - Agent B → items #22, #23, #25  (React dashboard)
     - Agent C → item #28  (sync retry logic)
   Launching them now via task tool.
   ```

3. **After the wave returns** (separate text turn):
   ```
   ✓ Wave <N> complete:
     - Agent A: 2 items fixed, build PASS                 (3m 02s)
     - Agent B: 3 items fixed, build PASS                 (4m 18s)
     - Agent C: 1 item fixed, build PASS                  (1m 44s)
   ```

4. **Before the build+smoke self-test** (separate text turn):
   ```
   ▶ Phase 3: build + smoke self-test
   Will run: dotnet build → start apps → curl affected endpoints →
   snapshot affected pages → grep logs → kill the apps.
   ```

5. **Before each long single tool call** (>30s):
   ```
   ⏳ Running `<command>` — expected ~<estimate>. Will report when done.
   ```

6. **Heartbeat**: if >2 minutes since your last text turn:
   ```
   ⏳ Still working. Last action: <one-line>. Elapsed: <Nm>. No errors yet.
   ```

### What NOT to announce

- **Per-item in chat** ("now fixing item #14"): NO. Status Table is
  the per-item log. Tell the user to `tail -f`.
- **Echoing tool output** or repeating OpenCode's tool-call display.

### Sub-agents and the OpenCode TUI

Child sessions hold child-agent chat. Parent (you) must emit text
turns between waves. State this in the start-of-run message so the
user knows.

---

## Phase 2: Fix rules (apply to every sub-agent)

Each sub-agent gets a subset of failing items and:

- Fixes ONLY items in its assigned subset. Does not touch other items.
- Honours `AGENTS.md` and coding standards.
- For UI fixes: compares against the original mockup file. The mockup is
  truth — not interpretation.
- For each fix, updates the **existing Implementation Checklist** in place:
  - Appends under the item's `**Verifier Result**:` line:
    ```
    - **Fix applied** (<YYYY-MM-DD>): <one-line summary of the change>
      - Root cause: <why it was broken>
      - Files changed: <list>
    ```
  - Updates the Status Table row: status `Fixed — awaiting re-verify`,
    Notes column gets the one-line summary.
- Does NOT mark the item completed (`- [x]`) — that's the Verifier's job
  after re-running `/verify`.
- Does NOT create new fix-log, change-summary, or similar files. The
  checklist IS the fix log.
- Updates sibling documents (verification guide, DB changes, architecture)
  in place ONLY if the fix requires changes to them.

Single source of truth: any Issues file is **transient**. Once its bugs
are folded into the checklist and `/verify` confirms ALL PASS, the user
should delete it.

---

## Phase 3: Build + smoke-test self-check (MANDATORY)

Just like `/implement`, fix is not done until the code actually runs.

### NO EXCUSES — you CAN run things in this container
The same anti-excuse rules as `/implement` apply. These are NOT valid reasons
to skip the smoke test:
- "No SQL access" — the connection string is in `appsettings.Development.json`;
  query the DB with `sqlcmd` or a `Microsoft.Data.SqlClient` console under
  `verification/<feature>Runner/`.
- "Can't run the web app" — `dotnet run` + `npm run start:local` run in this
  container; Playwright is on `host.docker.internal:8931`.
- "Can't run the Windows desktop app" — exercise the .NET library logic
  headlessly via a `verification/<feature>Runner/` console using real
  `appsettings` config; use the optional Windows-host GUI bridge only if
  configured (probe `${WINAPP_BRIDGE:-http://host.docker.internal:8932}/health`).
  Its absence never blocks logic verification.
Only the USER may say skip. If the Developer-Flow-Guide exists, use its flow
rows (UI → API → SP → table) to confirm the fix end to end.

### Step 3.1: Build everything touched
- `dotnet build` on each touched .NET project. Must pass with zero errors.
- `npm run build` on the frontend if touched.
- **STOP on build failure.** Annotate failing items as `BUILD FAILED` and
  hand back to the user.

### Step 3.2: Start the apps locally (ASK first)
Use the project's own start commands (from `package.json` / `launchSettings.json`
or the Verification Guide):
- Backend: `dotnet run --project <ApiProject>` in background, capture PID
- Frontend: `npm run start:local` in `src/frontend/`, background, PID

**ASK ONCE**: "Starting backend (`<cmd>`) and frontend (`<cmd>`) for smoke
test. Approve? (yes/no)"

Only the USER may skip. You do NOT self-skip with a SQL/run-app/Windows-app
excuse. If startup genuinely fails, capture the EXACT error into the checklist
and hand back — that's a real finding, not a "can't test".

### Step 3.3: Smoke-test each fix (confirm the DATA, not just the HTTP code)
For each fixed item, run ONE focused probe:
- **UI fix**: Playwright navigates to the affected page, snapshots, confirms
  the previously-broken element now renders/behaves correctly.
- **Backend fix**: `curl` the affected endpoint, confirm the response code
  and shape match the fix's intent — AND, if it touches data, confirm the
  rows in the DB (real connection string, targeted `SELECT`). A 200 with no
  data change is not a fix.
- **DB fix**: open SqlConnection via the app's connection string, run a
  targeted `SELECT` to confirm the change took effect.
- **Desktop/library-logic fix**: run the `verification/<feature>Runner/`
  console that calls the fixed method and confirm its output + DB rows.
- **Logging fix**: grep the running app's log for the expected line.

Stop on first smoke failure within an item — annotate and move on. The
Verifier will do the deeper check; you just need to confirm "is the basic
thing better than before?".

### Step 3.4: Stop the processes you started
Kill the captured PIDs cleanly.

### Step 3.5: Record outcomes
For each fixed item:
- Smoke passed: append `- **Self-test** (<date>): PASS — <evidence>`
- Smoke failed: append `- **Self-test** (<date>): FAIL — <reason>` AND
  update Status Table to reflect it's still broken
- Skipped: `- **Self-test** (<date>): SKIPPED — <reason>`

---

## Phase 4: Update Deployment Steps / Infrastructure Requirements

If a fix needs new infrastructure (rare, but happens when Verifier flags
`[INFRASTRUCTURE GAP]`), append to `## Infrastructure Requirements`:
```
- **<Requirement>**: <one-line what + where it's referenced in code>
  - Where configured: <appsettings key or env var name>
  - Setup: <one-line how to create it>
```

If a fix needs a new deployment step, append to `## Deployment Steps`:
- **Automated** (Verifier can run it) subsection: bullet with title + one
  line containing the exact shell command in inline code.
- **Manual** (user must do it) subsection: just a one-line action.

### Critical rules (same as /implement)

1. **DB migrations use `sqlcmd`, NOT Entity Framework.** These commands assume applications that
   use raw SQL. If a fix needs a SQL change, write a script under
   `deploy/<feature>/` and reference it like:
   `sqlcmd -S <server> -d <db> -U <user> -P <pwd> -i deploy/<feature>/03-fix.sql`
   The server / db / credentials are placeholders — they come from
   `appsettings.Development.json` at run time.

2. **`npm install` only if your fix added new packages.** Check whether
   `package.json` / `package-lock.json` changed. If no new packages,
   don't add `npm install` — it's noise.

3. **Frontend start commands are environment-specific.** If your fix
   requires re-starting the frontend, frame it so the user picks:
   ```
   - [ ] Restart frontend pointing at the right environment:
         `npm run start:local`     (dev DB / dev APIs)
         `npm run start:local:uat` (UAT DB / UAT APIs)
   ```
   Look at the frontend's `package.json` to enumerate actual variants.

4. **An Automated step MUST include the exact shell command** in inline
   code. Without one, the step belongs in Manual.

5. **A Manual step is one line** — no Command/Where/Idempotent/Owner fields.

6. **New SQL migrations or rollback scripts** go under `deploy/<feature>/`
   (idempotent where possible) and are referenced from the Automated step.

If the fix is purely code-only (no SQL change, no new package, no service
restart needed), don't touch either section.

---

## When done
1. Status Table updated with what was fixed (one-line per item).
2. Each fixed item has `**Fix applied**` and `**Self-test**` annotations.
3. Deployment Steps and Infrastructure Requirements updated if needed.
4. Tell the user:
   ```
   Fix complete. Status:
     - Wave 1: <count> sequential fixes (dependencies)
     - Wave 2: <count> fixes across <N> parallel agents
     - Wave 3: <count> integration fixes
     - Self-test: <smoke results> — <count> PASS, <count> FAIL, <count> SKIPPED
     - New deployment steps: <count> automated, <count> manual
   Next: run `/verify @<checklist>` for the independent audit.
   After ALL PASS, you can delete <Issues file> if you used one.
   ```
