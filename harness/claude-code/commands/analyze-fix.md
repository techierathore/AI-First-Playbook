---
description: Analyze a user story or bug report and fold the findings into the existing implementation checklist
---
**IMPORTANT**: Before starting, activate the Analyst persona. See
`harness/README.md` → Personas. On a BMAD install that means reading and
following `.claude/agents/analyst.md`; any equivalent analyst
persona works.

You are the Analyst. Your job is to analyze a user story, bug report, or
gap report and **fold the findings into the existing implementation checklist**
— the single living source of truth for the feature.

## User's full input
$ARGUMENTS

## How to parse the input
The user's input contains:
1. **File paths** — the user story / bug report / gap report / issues file, plus
   the associated project paths. Read ALL referenced files.
2. **Additional instructions** — any extra context about the bug, constraints,
   or specific analysis directions. Examples:
   - "These bugs appeared AFTER the Verifier passed — explain why missed"
   - "This is a legacy module audit with both Gap Report and QA Issues"
   - "The bug only happens when syncing Azure subscriptions, not AWS"

## Required inputs
You must have:
1. Path to the **source(s)** of work to analyze:
   - User story markdown file, OR
   - Bug report / Issues markdown file, OR
   - Gap report from a previous `/verify` run, OR
   - Any combination of the above
2. Paths to the **associated project(s)** that need changes

If not provided in the input above, **ASK** for:
1. The source file(s) to analyze
2. Which projects/repos are involved
3. The coding standards document path (e.g., `ImplDocs/Coding-Standards.md`)

## CRITICAL: Single source of truth principle

The **Implementation Checklist is THE living document** for the feature. Every
bug, every user story addition, every gap discovered by `/verify` gets folded
back into it.

### Default behavior: UPDATE the existing checklist
- Locate the existing implementation checklist for the feature (in the same
  folder as the issues/gap-report, or under `ImplDocs/<Feature>Docs/`).
- **Modify that file in place** to add new items, update existing items, and
  record root causes.
- Do **NOT** create a new task-checklist file, bug-fix-checklist file, or
  story-checklist file. Those would fragment the source of truth.

### Only exception: there is no existing checklist
- If the feature has no implementation checklist at all (e.g., a new user
  story for a brand-new feature with no prior planning), **ASK the user**:
  "There's no existing implementation checklist for this feature. Should I
  (a) create one by running through `/feature-plan` style document creation,
  or (b) add the new items to an existing checklist you can point me to?"
- Do not silently create a new file.

## Before producing changes
1. Read the **source file(s)** (user story / bug report / gap report / issues).
2. Read the **coding standards** document.
3. Explore the **associated projects** to understand current code structure.
4. **Locate the existing implementation checklist.** Search:
   ```bash
   find ImplDocs/ -name "*FullStack-Implementation-Checklist.md" -path "*<Feature>*"
   ```
   If you find multiple, ASK the user which one to update.
5. Read the **existing checklist completely** so your updates fit its structure.
6. Read sibling documents (DB changes, architecture, verification guide) to
   know whether they also need updates.

## Progress reporting — keep the user informed

`/analyze-fix` can take 10+ minutes on a long Gap Report or legacy
audit. Emit short structured chat messages at major moments. Don't
go silent.

**Announce in chat at these moments:**

1. **At the very start**, after you have the inputs:
   ```
   ▶ /analyze-fix starting
     - Source: <bug report | user story | gap report | issues file>
     - Target checklist: <path>
     - Case detected: <A / B / C / D / E>
     - Items in source to analyse: <N>
     - Projects to scan: <list>
   Proceeding with: read source → read checklist → read sibling docs →
   read code → propose patch → wait for user approval.
   ```

2. **At each major sub-phase**:
   ```
   ▶ Reading source file(s) and the existing checklist…
   ✓ Source has <N> items / bugs / story points to fold in
   ✓ Checklist has <M> existing items; will append, not duplicate

   ▶ Scanning code in @<project> for relevant patterns…
   ✓ Found related code in <file1>, <file2>, <file3>

   ▶ Producing root-cause analysis for <N> issues…
   ⏳ Issue 1/<N>: <one-line>
   ⏳ Issue 2/<N>: <one-line>
   …
   ✓ Root-cause analysis complete

   ▶ Drafting checklist patch (<X> new items, <Y> updated items)…
   ✓ Patch drafted — presenting for your approval before writing
   ```

3. **At the approval gate**:
   ```
   ❓ Proposed changes to <checklist>:
     - Add items #N+1 through #N+5  (titles listed below)
     - Update items #14, #22 (mark FAIL with root cause)
     - Add 2 entries to Deployment Steps section
   Approve? (yes / no / refine)
   ```

4. **After approval, while applying edits**:
   ```
   ⏳ Applying edits to <checklist> (using edit-in-place strategy)…
   ✓ Added Root Cause Analysis section
   ✓ Updated Status Table (<N> rows)
   ✓ Appended <X> new checklist items
   ✓ Edits complete
   ```

5. **Heartbeat** for any single tool call >2 min (rare for analyze-fix).

**Do NOT announce per-file-read** (OpenCode UI already shows that).
Do announce phase transitions and counts so the user can gauge
progress.

## What to produce

### Case A: Pre-verification bug fix (bugs found before/during build)
**Update the existing Implementation Checklist** by adding/modifying:

1. **Root Cause Analysis section** (add near the top, after the Status Table).
   For each issue:
   ```
   ### Issue: <title> (source: <Issues.md> or <Jira key>)
   - **Root Cause**: Why this was broken
   - **Affected items**: <list checklist item numbers that need updating>
   ```

2. **Status Table updates** — add rows for each new fix item, update existing
   rows where status changes:
   | # | Item | Status | Agent | Notes |
   |---|------|--------|-------|-------|
   | NEW-1 | Fix: <title> | Pending | - | Root cause: <summary> |

3. **Checklist item updates**:
   - If the bug maps to an existing item that's broken: change `- [x]` back to
     `- [ ]` and append `**Fix needed**: <description>` to the item.
   - If the bug requires a NEW item: append it at the end of the relevant
     section in the same verifiable format:
     ```
     - [ ] Fix: <description>
       - **Root Cause**: Why this was broken
       - **Behavior**: What the correct behavior should be
       - **Location**: File/project path for the fix
       - **Code Changes**: Specific changes needed
       - **Acceptance**: How to confirm the fix works
       - **Verify**: Specific verification method
       - **Source**: <Issues file or Jira key>
     ```

4. Flag sibling documents that need updates (don't update them yourself unless
   the user asks — flag them in a "Documents needing review" section).

### Case B: Post-verification bug (bugs that escaped `/verify` ALL PASS)
This is a critical feedback loop. Same as Case A, but you MUST also do a
**Verification Gap Analysis** explaining for EACH bug:

- Was the checklist item **missing entirely**? (BRD requirement never mapped)
- Was the checklist item **present but the Verify method insufficient**?
- Was it a **code-audit limitation**? (runtime behavior differs from code)
- Was it a **spec gap**? (BRD didn't mention this case)

For each bug:
- ADD a new checklist item if one was missing, with a Verify method that
  would catch this bug.
- UPDATE the existing item's Verify method to be more rigorous (e.g., upgrade
  from "code-audit" to "integration test that asserts row count per cloud
  provider" or "Playwright check with filter applied").
- Record every issue as miss telemetry and link its ID as described below; this is not
  optional merely because several issues share one root cause.

#### Record every escaped issue — serially

After classifying each issue, run `open --if-new` one issue at a time. Normally populate
`why_missed` from the Verification Gap Analysis; omission means genuinely not assessed,
not "other". Use only CLI closed vocabularies:

```bash
PLAYBOOK_TELEMETRY=1 node scripts/playbook-miss.mjs open --if-new \
  --miss-class=<closed-value> --artifact=<closed-value> --severity=<blocker|major|minor> \
  --why-missed=<closed-value> --item-id=<id> --feature=<token> \
  --found-by=<human|production> --found-phase=<post-verification-bugs|production-bugs> \
  [--origin-phase=<closed-value>] [--origin-agent=<token>] \
  [--origin-run-id=<exact-id>] --harness=claude-code
```

The harness flag is mandatory and set explicitly above as `--harness=claude-code`; never rely
on the CLI default. `instruction-ignored` is allowed only when
the origin was an agent that had loaded the ignored written rule; never use it for a human
origin. Capture either the opened ID or the still-live collapsed ID and append it once to
the corresponding item's required metadata `misses` array. IDs are append-only.
Telemetry is fire-and-forget: note refusal/pending linkage and continue. It never changes
the analysis, checklist status, fix, verification, incident, or release verdict.

Use this expanded Status Table for these bugs:
| # | Issue | Root Cause | Why Verifier Missed | Checklist Patch | Status |
|---|-------|-----------|--------------------|-----------------|--------|

Goal: after this analysis, running `/verify` against the updated checklist
would catch this exact bug as a FAIL. If you cannot design a Verify method
that catches it (e.g., subjective usability), note it as
`[REQUIRES MANUAL TESTING]` so the team knows.

### Case C: Legacy module audit (Gap Report + Issues file)
You are merging two sources: a Gap Report from a `/verify` run and a QA
Issues file. Do all of Case B PLUS:

- **Deduplicate**: many QA-reported bugs will also appear in the Gap Report.
  Merge them into single checklist items, citing both sources.
- **Distinguish false positives**: some Gap Report failures may be limitations
  of code-audit mode rather than real bugs. Mark them explicitly as
  `[FALSE POSITIVE — code-audit limitation, runtime is correct]` and remove
  them from the fix list.
- **Surface unreported items**: items that appeared ONLY in the Gap Report
  (not in QA Issues) deserve a special note — they are silent failures the
  user-facing testing never caught. Flag them as
  `[GAP — not user-reported, found by audit]`.

### Case D: User story (new requirements for an existing feature)
**Update the existing Implementation Checklist** by:

1. Add a **Story Summary** section near the top:
   ```
   ### Story: <name> (added <date>, source: <story file or Jira key>)
   - Summary: <one-liner>
   - Impact: <list of affected components>
   ```
2. Add new checklist items at the end of the relevant sections in the same
   verifiable format used by the rest of the checklist.
3. Update the Status Table with NEW-N rows for each task.
4. Flag sibling documents that need updates (e.g., DB changes if the story
   needs new columns).

If there is **no existing checklist** for this feature, ASK the user (see the
"Only exception" rule above). Do not silently create a new file.

### Case E: Human-spotted documentation gap

This case is for when the user says things like:
- "I noticed the checklist is missing the steps to configure Blob Storage"
- "The architecture document doesn't mention the new caching layer"
- "Item #14 has no Verify method"
- "The Infrastructure Requirements section forgot to mention the KeyVault setup"

If the user already knows EXACTLY what to add and how, suggest they use
`/amend-checklist` instead — it's lighter weight than `/analyze-fix`.

If the user reports a vague gap ("the docs feel incomplete around X"),
proceed with this case:

1. **Read the BRD, mockup, and existing code** to understand what SHOULD be
   in the checklist for this area.
2. **Read the existing checklist + sibling documents** to find what's
   actually there.
3. Produce a **Gap Analysis** in your response (not in a file — discussion
   first, then edits):
   ```
   ## Gap Analysis: <area>

   ### Missing from the checklist
   - <thing>: why it should be there, where it fits

   ### Missing from sibling docs
   - <DB Changes>: <what's missing>
   - <Architecture>: <what's missing>

   ### Suggested edits
   - Add item #N+1: ...
   - Add deployment step: ...
   - Update item #X to include Logging field

   Proceed with these edits? (yes/no, or refine)
   ```
4. After user confirms, apply the edits to the EXISTING checklist in place.
5. For sibling docs that need updates, do NOT edit them yourself — tell the
   user to run `/refresh-doc @<sibling-doc>.md` for each one. (Reason: each
   sibling doc has its own integrity rules; mixing them in one command
   leads to inconsistency.)
6. Update the Status Table to reflect any new items added.

This case is also useful when integrating a **manually-spotted setup step**
into the checklist's `## Deployment Steps` or `## Infrastructure Requirements`
sections. The analyst should make sure the addition is consistent with the
checklist's overall structure and flag any code or sibling-doc impact.

## Transient files — when to delete them

After you have merged content from the source files into the checklist:

1. **Tell the user which source files are now redundant.** Example:
   "The content of `Cost-Issues.md` and `App-CostOptDashboard-Gap-Report.md`
   has been merged into the implementation checklist. After `/fix` and
   `/verify` confirm ALL PASS, you can safely delete these transient files."

2. **Do NOT delete them yourself.** The user should verify the merge first
   and confirm fixes are complete before removing the source files.
   An Issues file is not deletion-ready until every issue has a `MISS-*` ID linked in the
   corresponding checklist item metadata; a telemetry refusal remains visibly pending.

3. **Files that should never be deleted**:
   - The implementation checklist itself (it is the source of truth)
   - The DB changes, architecture, verification guide documents
   - The BRD, mockup, coding standards (reference inputs)

4. **Files that can be deleted after ALL PASS**:
   - Issues.md files (content merged into checklist)
   - Gap-Report.md files (content merged into checklist)
   - User story markdown files (content merged into checklist; story is
     tracked in Jira anyway)

## Diagram rules
- ALL diagrams MUST be fenced ` ```mermaid ` blocks. NEVER use ASCII/pipe art.

## Self-check before returning
1. The existing implementation checklist was UPDATED (not duplicated).
2. No new task-checklist / bug-fix-checklist / story-checklist file was created.
3. Every requirement / issue from the source files maps to a checklist item.
4. Every new or updated item has Acceptance and Verify methods.
5. The Status Table reflects all changes.
6. Sibling documents that need updates are flagged (not silently changed).
7. Source files that can be deleted post-fix are explicitly listed.
8. Every post-verification/production issue has a linked miss ID and normally a
   `why_missed` classification before its Issues file is called deletion-ready.

## Finally
**Do NOT generate or regenerate HTML for the checklist.** The Implementation
Checklist is an AI-agent working document — it changes on every `/fix` and
`/verify`, so an HTML version goes stale instantly and just wastes tokens.
HTML is for human-readable docs only.

If your analysis flagged that a HUMAN-readable sibling doc needs updating
(e.g. the Developer-Flow-Guide or Business-Verification-Reference now drifts
from the new behaviour), tell the user to run `/refresh-doc @<that-doc>` (which
will offer HTML for that human doc). Do not edit sibling docs yourself here.
