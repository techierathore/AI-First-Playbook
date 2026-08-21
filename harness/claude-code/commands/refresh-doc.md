---
description: Refresh documents against the CURRENT code — either a single shared/reference doc, or an entire feature doc set (checklist, dev-flow, business-verification, DB-changes, architecture). Reconciles drift, flags deleted/broken/stale references.
---
**IMPORTANT**: Before starting, activate the Analyst persona. See
`harness/README.md` → Personas. On a BMAD install that means reading and
following `.claude/agents/analyst.md`; any equivalent analyst
persona works.

You are the Analyst. Your job is to **bring documents back in sync with the
CURRENT state of the code.** Code drifts after docs are written: things get
refactored, files get deleted, methods/SPs get renamed, behaviour changes
during bug fixes. This command detects that drift and fixes the docs.

This command has TWO modes:

### Mode A — single shared/reference document (original behaviour)
Cross-module reference docs like:
- `App-DB-Architecture.md` — full database design across all modules
- `App-Overall-Architecture.md` — system architecture
- `App-Models.md` — data model/entity documentation
- `App-DataAccess.md` — data access layer documentation

### Mode B — an entire FEATURE doc set (NEW)
Point this at a feature's doc folder (e.g. `@ImplDocs/CostDocs/`) and it
reconciles ALL of that feature's docs with the current code in one pass:
- the Implementation Checklist (statuses, file:line references, deployment steps)
- the Developer-Flow-Guide (every UI→API→service→DA→SP→table chain)
- the Business-Verification-Reference (sources, calculations — only if the
  underlying logic changed; keep it plain-English)
- the DB-Changes doc (tables/views/SPs vs the actual SQL)
- the Architecture / DataSync doc (services, DI, flows)

Use Mode B when a feature was built/changed and you want every doc to match
reality again — including after "something got broken in between" or "a file
got deleted" since the docs were last written.

## Required inputs
$ARGUMENTS

The user provides either a single doc path (Mode A) or a feature doc folder
(Mode B), plus the code to sync against.

If not provided, **ASK** the user:
1. Mode A: path to the document to refresh. Mode B: path to the feature doc
   folder.
2. Path(s) to the **actual codebase/projects** to sync against
   (e.g., `@src/frontend/`, `@InventoryCore/`, the API project, the
   `deploy/<feature>/` SQL scripts).
3. Path to the coding standards document (if relevant).

**Auto-detect the mode**: if the path is a folder containing multiple
`App-<Feature>-*.md` docs → Mode B. If it's a single `.md` file → Mode A.
If ambiguous, ASK.

## What to do — Mode A (single shared/reference document)

### Step 1: Read and understand the existing document
- Read the document top to bottom.
- Identify every section, table, entity, relationship, class, method,
  and diagram currently in the document.
- Note the document's current structure and style.

### Step 2: Scan the actual codebase
- Read the relevant project(s) the user pointed you to.
- For a **DB architecture doc**: scan the actual database schema files,
  EF models, migration scripts, SQL files, stored procedures, views.
- For a **models doc**: scan the actual C# model/entity classes.
- For a **data-access doc**: scan the actual repository/DAL classes.
- For an **architecture doc**: scan service classes, controllers, DI setup,
  configuration files.

### Step 3: Identify discrepancies
- List tables/entities/classes in the code but NOT in the document.
- List tables/entities/classes in the document but NOT in the code (possibly deleted).
- List fields/properties/methods that differ between code and document.
- Produce a **Discrepancy Report** section at the bottom of the document.

### Step 4: Update the document
- **Add** any entities/tables/classes that are in the code but missing from the doc.
- **Update** any entries where the code has changed (new fields, renamed methods, etc.).
- **Flag** (do not delete) any entries in the doc that no longer exist in code
  as `[POSSIBLY REMOVED — verify]`.
- **Replace ALL ASCII/pipe-art diagrams** with Mermaid equivalents:
  - `erDiagram` for database/entity relationships
  - `flowchart` for architecture and data flows
  - `classDiagram` for class hierarchies and relationships
  - `sequenceDiagram` for process/API call sequences
- **Add new Mermaid diagrams** where the document has text-only descriptions
  of relationships or flows that would benefit from a visual.
- **Preserve the document's existing structure and voice.** You are updating
  content, not rewriting style.

### Step 5: Generate section-level ER diagrams for large docs
For large documents like the full DB architecture, a single ER diagram may be
unreadable. Instead:
- Create **one ER diagram per logical module/area** (e.g., Identity tables,
  Inventory tables, Cost tables, Monitoring tables).
- Place each diagram at the top of its respective section.
- At the very top of the document, create a **high-level overview diagram**
  showing just the modules and their inter-module relationships.

## What to do — Mode B (entire feature doc set)

Goal: every doc in the feature folder matches the CURRENT code. This includes
catching things that broke or got deleted since the docs were written.

### Step B1: Inventory the doc folder and build a code map
- List every `App-<Feature>-*.md` in the folder. Identify each by type
  (checklist, developer-flow-guide, business-verification-reference,
  db-changes, architecture, verification-guide, powerbi-mapping).
- **Read the lighter docs first** (Developer-Flow-Guide, DB-Changes) — they
  already name the components, endpoints, SPs, views, and tables. Use them as
  the MAP of what to confirm in code. This saves tokens vs. scanning blind.

### Step B1a: CREATE the Developer-Flow-Guide if it's missing
If there is NO `*-Developer-Flow-Guide.md` in the folder (common for features
built before this doc type existed), CREATE it now — it's the human debugging
map the team needs most. Build it exactly as `/add-doc` Document 1 describes:
**by EXECUTING the code**, not from the other docs. Cover the flow class(es)
that apply:
- **UI / full-stack** (§2): trace each screen/tab value `UI element → frontend
  file:method → API endpoint → service method → data-access method → stored
  proc/view → table`.
- **Service / package / job** (§3): for each sync service, scheduled worker,
  background job, console app, or reusable NuGet/core package, trace `trigger
  (scheduler/queue/manual/DI) → entrypoint → orchestration → core library
  class.method → external call → standardisation → DB write`, with the ordered
  step table, trigger/registration site, inputs, success/failure behaviour.
A pure service/package feature gets §3 only (no §2). Confirm each link by
running it (see "Execute the code" below). Then continue with Step B2 to keep
it (and everything else) in sync.

### Step B2: Reconcile each doc against the real code — by EXECUTING it
For EACH doc, verify its concrete references against the current code. Use
`grep` to jump to each named identifier; read a focused window — do NOT read
whole large files end to end. But "reading" is not enough for flows and data:
**run the code to confirm reality.** You CAN, in this container — there are no
valid excuses (same rules as the Orchestrator/Verifier):
- **SQL**: read the connection string from `appsettings.Development.json`; run
  the named stored procs / query the named tables via `sqlcmd` or a
  `Microsoft.Data.SqlClient` console under `verification/<feature>Runner/`.
- **Web app**: `dotnet run --project <ApiProject>` + `npm run start:local`;
  `curl` the endpoints; the profile's Playwright endpoint drives the UI.
- **Windows desktop app**: exercise the .NET library logic headlessly via a
  `verification/<feature>Runner/` console; optional host GUI bridge if present
  (probe `${WINAPP_BRIDGE_URL}/health` when declared in the profile).
- **Service / scheduled job / NuGet package**: don't wait for the scheduler —
  invoke the work directly from a `verification/<feature>Runner/` console that
  news up the service/package class with real `appsettings` config and calls
  its entrypoint (e.g. `await new CostDataSyncSvc(...).SyncAllCostData(...)`),
  then confirm the expected DB rows were written via `sqlcmd`/SQL console. A
  run that writes 0 rows when it should write some is a BUG → fold into the
  checklist (Step B3). "Can't run the scheduler / no trigger" is NOT a valid
  reason to skip — call the method directly.
"No SQL access / can't run app / can't run Windows app / can't run the
scheduler" are NOT acceptable reasons to skip execution — the connection
strings are in the code and you have `dotnet`.

- **Developer-Flow-Guide**: for every flow row/step, confirm the named
  `file:method`, API endpoint route, service method, data-access method,
  stored procedure, view, table, package class+method, and trigger/cron STILL
  EXIST with those names. For each:
  - Exists and matches → leave it.
  - Renamed/moved → update the reference.
  - Deleted / not found → flag `[STALE — referenced X not found in code]`
    and, if you can find the replacement, propose it.
  - New screen/tab/value in code not in the doc → add a flow row.
  - New service/job/package entrypoint, or new/removed/reordered service STEP,
    changed trigger/cadence, or changed standardisation logic → update the §3
    step table accordingly (add/remove/reorder steps, fix the trigger row).
- **DB-Changes**: confirm tables/columns/views/SPs against the actual SQL in
  `deploy/<feature>/` and the DB scripts. Flag added/removed/changed objects.
- **Architecture / DataSync**: confirm service classes, methods, DI
  registrations, and flows. Update diagrams that no longer match.
- **Business-Verification-Reference**: only update if the underlying SOURCE,
  CALCULATION, or MAPPING logic changed in code (e.g. a threshold mapping was
  fixed). Keep it PLAIN ENGLISH — never introduce code/SQL/internal names.
  If a calculation changed, update the plain-English formula and any mapping
  table row, and note it in the doc's change log.
- **Implementation Checklist**: this is the AI-agent source of truth. Reconcile
  carefully:
  - If an item references a `file:line` that no longer exists or has moved,
    update or flag it `[STALE]`.
  - If Deployment Steps reference `deploy/<feature>/*.sql` scripts that are
    missing, flag `[MISSING SCRIPT]`.
  - Do NOT flip PASS/FAIL verdicts — that's the Verifier's job. Only fix
    references and obvious staleness. If you suspect real regressions, add a
    note recommending a fresh `/verify` run rather than changing verdicts.

### Step B3: Fold any bugs/gaps found during execution into the checklist
Executing the flows WILL sometimes reveal that the implementation is broken or
incomplete (endpoint 500s, stored proc returns wrong data, screen value ≠ DB,
a documented feature isn't actually wired up). This is exactly the class of
bug that "the doc says done and the Verifier said done" misses. When you find
one:
1. Append a FAIL/fix item to the EXISTING Implementation Checklist (single
   source of truth — never a separate bug file) in the standard verifiable
   format, with Root Cause, Location, Acceptance, an executable Verify method
   (endpoint + DB query that should agree), and `**Source**: refresh-doc
   execution (<date>)`.
2. Update the checklist Status Table with the new item(s) as FAIL/Pending.
3. In the affected human doc, mark the value `[KNOWN ISSUE — see checklist
   item #N]` so it doesn't mislead debuggers.
4. In your summary, report how many gaps you folded in and recommend
   `/fix @<checklist>` then `/verify @<checklist>`.

### Step B3b: Produce a single drift report (in your chat reply, not a new file)
Summarise per doc: what was updated, what was flagged `[STALE]` /
`[MISSING SCRIPT]` / `[POSSIBLY REMOVED]`, what new code wasn't documented, and
how many bugs were folded into the checklist. Do NOT create a separate report
file — keep the framework's single-source-of-truth principle. Put the per-doc
change log inside each doc's own change-log section.

### Step B4: Apply edits doc by doc, with approval
Show the proposed edits per doc and ASK before applying (see Progress
reporting approval gate). Apply with `edit` in place, never full rewrites.
Recommend the user run `/verify @<checklist>` afterward if any code references
changed materially.

## Progress reporting — keep the user informed

Refreshing a large shared doc (full DB architecture, models, etc.)
can take 20+ minutes. Emit short structured chat messages at major
moments. Don't go silent.

**Announce in chat at these moments:**

1. **At the start**:
   ```
   ▶ /refresh-doc starting
     - Document: <path>  (<X> lines)
     - Codebase to scan: <project paths>
     - Existing sections: <list section headings>
   Proceeding with: read doc → scan code → identify deltas → apply edits.
   ```

2. **During scan**:
   ```
   ▶ Scanning <project> against doc section "<heading>"…
     ⏳ Looking at <file pattern>
     ✓ Found <N> entities in code; <M> in doc
     ✓ Deltas: <K> new in code, <L> in doc but not in code, <P> different
   ```
   Repeat per section.

3. **Before applying edits**:
   ```
   ❓ Proposed changes to <doc>:
     - Add <X> new entries (listed below)
     - Update <Y> entries with new fields
     - Flag <Z> entries as [POSSIBLY REMOVED]
     - Replace <K> ASCII diagrams with Mermaid
   Proceed? (yes / no / refine)
   ```

4. **While applying**:
   ```
   ⏳ Applying edits in-place…
     ✓ Section 1 of <N>: <heading>  (<K> edits)
     ✓ Section 2 of <N>: <heading>  (<K> edits)
     …
   ✓ All edits complete
   ```

5. **At end**:
   ```
   ✓ Refresh complete. Summary:
     - File size: <before> → <after> lines
     - Mermaid diagrams added/replaced: <K>
     - Discrepancies flagged: <list count by type>
   ```

## CRITICAL: How to write large documents (prevents "Tool execution aborted")
When updating the document:
- **NEVER rewrite the entire file in a single write call.** Large file writes
  will abort mid-stream and lose all your work.
- **Use the EDIT tool** to make changes to the existing file in place. Work
  section by section:
  1. Replace ASCII diagrams with Mermaid blocks via targeted edits.
  2. Add new sections (new entities, discrepancy report) as individual edits.
  3. Update existing entries (new fields, renamed methods) via targeted edits.
  4. Add the high-level overview diagram at the top as a separate edit.
- **If adding a large new section** (e.g., a whole new module area with 50+
  lines), break it into 2-3 edit operations rather than one massive insert.
- **Test your approach**: if the document is longer than ~200 lines, always
  use the edit-in-place strategy rather than a full rewrite.

## Accuracy rules
- **Do NOT invent data.** If you cannot determine a relationship or structure
  from code or doc, flag it as `[NEEDS VERIFICATION]`.
- **Preserve all existing content** that is still accurate. Do not delete
  unless clearly obsolete (and even then, flag rather than delete).
- **Cross-reference everything** against the actual code.

## Token discipline (important for Mode B feature sets)
Reconciling a whole feature doc set against code can read a LOT. Stay lean:
- Use the existing docs (DB-Changes, Developer-Flow-Guide) as your map of what
  to confirm, then `grep` straight to each identifier and read a focused
  window. Never read whole large files end to end.
- Confirm references; don't re-derive whole sections that haven't changed.
- Reconcile one doc at a time and apply its edits before moving on, so a
  single aborted read doesn't lose other work.
- Don't produce HTML for AI-only docs (checklist, issues).

## Diagram rules
- ALL diagrams MUST be fenced ` ```mermaid ` blocks. NEVER use ASCII/pipe art.
- Use `erDiagram` for data models and database tables
- Use `flowchart` for architecture and data flows
- Use `classDiagram` for class structures
- Use `sequenceDiagram` for process sequences

## When done
1. Summarise what was added, updated, and flagged (per doc in Mode B).
2. List the Discrepancy / drift items.
3. ASK: "Generate the human-readable HTML version(s) now, or markdown only?
   You can always run `/generate-html` later to create the HTML version."
   - If markdown only: stop. Remind the user they can run
     `/generate-html @<path-to-md>` later when ready to publish.
   - If HTML too: create `<name>.html` from `.opencode/templates/doc-shell.html`
     **only for HUMAN-readable docs** (DB-Changes, Architecture,
     Developer-Flow-Guide, Business-Verification-Reference, Verification-Guide,
     PowerBI-Mapping). **NEVER generate HTML for the Implementation Checklist
     or Issues files** — they are AI-agent working documents and HTML goes
     stale immediately.
     For large documents, the HTML version with Mermaid rendered in-browser
     is especially valuable — it's the version you publish to Confluence.
4. If any material code references changed in Mode B, recommend a fresh
   `/verify @<checklist>` run to confirm the feature still works end to end.
