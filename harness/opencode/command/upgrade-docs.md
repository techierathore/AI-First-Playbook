---
description: Convert/update existing feature documents to the new verifiable format with Mermaid diagrams. Works from a BRD+mockup OR from alternative specs (integration doc / project specification) + an existing checklist. Supports a full upgrade or a targeted/partial update.
---

**IMPORTANT**: Before starting, activate the Analyst persona. See
`harness/README.md` → Personas. On a BMAD install that means reading and
following `.opencode/agent/analyst.md`; any equivalent analyst
persona works.

You are the Analyst. Your job is to **upgrade/update existing feature
documents** to the new standardised format with Mermaid diagrams,
field-to-mockup mappings, verifiable checklist items, and optionally generate
HTML versions.

## Specification sources — NOT every feature has a BRD (read this first)
The classic path is "BRD + mockup → full document set". But real work doesn't
always have a BRD. Some features — especially **integrations** — start from a
brainstorming session with an analyst that produced an **integration document**
or a **project specification**, and the team then hand-wrote an **Implementation
Checklist** from it. This command must work from EITHER source of truth:

- **Source A — BRD-driven** (classic): a BRD (+ mockup) defines intent. Use it
  to cross-check that the checklist/docs cover every requirement.
- **Source B — Spec-driven** (no BRD): an **integration doc** / **project
  specification** (+ possibly a brainstorming summary) defines intent, plus an
  **existing checklist** the team already wrote. Treat the integration doc /
  project spec as the requirements source EXACTLY as you would a BRD: every
  requirement / integration point / endpoint / data mapping in it must map to a
  checklist item and to the docs. Cross-reference against the existing checklist
  rather than inventing a new one.

**A BRD is NOT mandatory.** If the user supplies an integration doc / project
spec / existing checklist instead, proceed with those — do NOT block waiting
for a BRD. Only ASK for a requirements source if you have NEITHER a BRD NOR an
integration doc/project spec NOR an existing checklist (i.e. you'd be guessing
intent entirely).

## Scope — full upgrade OR targeted/partial update (read this second)
The user does not always want the whole document set rebuilt. Detect which they
want from `$ARGUMENTS`:
- **Full upgrade**: convert/refresh the entire feature doc set. (Default when
  they point you at a whole doc folder and don't narrow it.)
- **Targeted / partial update**: update only specific document(s) or only the
  parts touched by a new spec — e.g. "update the checklist and DB-Changes from
  this new integration doc", or "fold this project spec's new endpoints into the
  existing checklist and refresh the Developer-Flow-Guide". When the user names
  specific docs or a specific spec to drive the update, do ONLY that — don't
  rewrite unrelated docs. Confirm the scope in your start message and stick to it.

## Preserve history — BACK UP old docs, never silently overwrite (read this third)
Upgrading must NOT destroy the record of what the old document said. The old
format and its content are valuable history (what was written, what changed).
So the rule is **back up first, then create the new-format document fresh**:

1. **Before touching any existing document**, copy it to a backup name so the
   original is preserved verbatim. Backup naming convention:
   `<original-filename-stem>-OLD-<YYYYMMDD>.md`
   e.g. `App-CostOpt-DB-Changes.md` → `App-CostOpt-DB-Changes-OLD-20260701.md`.
   If a backup with that exact name already exists (re-run same day), append a
   numeric suffix: `-OLD-20260701-2.md`.
2. **Then produce the new-format document under its correct standard name**
   (`<Prefix>-<Feature>-<DocType>.md`). The new doc is a clean, properly-named
   new-format file; the old content lives on in the `-OLD-<date>` backup.
3. **Do the backup with a shell `cp`** (via the bash tool), NOT by renaming the
   original in place — renaming loses the historical record the user explicitly
   wants kept. Example:
   `cp "ImplDocs/FooDocs/App-Foo-Architecture.md" "ImplDocs/FooDocs/App-Foo-Architecture-OLD-20260701.md"`
4. **Report every backup created** in your progress messages and final summary
   so the user knows exactly what was preserved and where.

**Concrete outcomes:**
- If an **Architecture doc** or **DB-Changes doc** already exists → back up the
  old one as `-OLD-<date>` and create the new-format doc under the standard
  name.
- If a **Checklist** already exists → back up the old one as `-OLD-<date>` and
  create the new-format checklist under the standard name.
- **Brainstorming docs are LEFT UNTOUCHED** — do not back up, rename, upgrade,
  or modify any brainstorming / brainstorm-summary document. They are input
  context only. The same hands-off treatment applies to any pure requirements
  source the user hands you (BRD, integration doc, project spec) — read it, do
  not rewrite it.

**Exception — genuinely new documents.** If a doc type does not yet exist (e.g.
there's no Developer-Flow-Guide), there's nothing to back up; just create it.
**Exception — the report consolidation** (Business-Reference + QA-Validation-
Guide → Business-Verification-Reference) still asks before DELETING the two old
files, per that section below; back them up as `-OLD-<date>` first so nothing is
lost even if the user says delete.

## Custom instructions are FIRST-CLASS — read and honour anything the user adds
This command accepts free-form additional instructions in `$ARGUMENTS`
alongside the `@`-prefixed file paths. **Read them and act on them.** Common
uses:
- **"BRD is not mandatory"** / "this is an integration component, there's no
  BRD" — proceed with the integration doc / project spec / existing checklist as
  the requirements source (see the Specification-sources section above). Do NOT
  block waiting for a BRD.
- **Scope narrowing** — "only update the checklist and DB-Changes", "just fold
  these new endpoints in" (see the Scope section).
- **Any extra context / constraints** the user writes in prose — treat these
  free-form notes as authoritative direction for this run. If a custom
  instruction conflicts with a default in this command, the user's explicit
  instruction wins (except the hard rules: never overwrite without backup, never
  touch brainstorming docs, Mermaid-only, no HTML for AI docs).

Echo back the custom instructions you detected in your start message so the
user can confirm you understood them.

## Required inputs
The user will provide:
- Path(s) to the **existing documents** to upgrade/update
- A **requirements source**: a BRD, OR an integration doc / project
  specification, OR an existing checklist (any one is enough)
- **Optionally, free-form instructions** (e.g. "no BRD — integration component",
  "only the checklist + DB-Changes") — honour them per the section above.

$ARGUMENTS

If inputs are missing, **ASK** the user — but only for what you actually need
for the chosen scope:
1. Which existing documents to upgrade/update? (full paths) — and is this a
   FULL upgrade or a TARGETED/PARTIAL update (which docs)?
2. Path to the current codebase / DB so you can verify document accuracy
3. Path to the coding standards document
4. Path to the DB architecture document (for DB-related docs)
5. A **requirements source** — ONE of: the **BRD**, OR an **integration doc /
   project specification** (for integrations with no BRD), OR an **existing
   checklist** to reconcile against. Do NOT insist on a BRD if a spec or
   checklist is provided.
6. Path to the **mockup** (React TSX file or screenshot), **if** the feature
   has a UI — needed for field-to-mockup mapping. (Integrations/services often
   have no mockup; that's fine — skip mockup cross-referencing.)
7. The project prefix and feature name for file renaming (e.g., `App-CostOptDashboard`)
8. Output folder for the upgraded documents

## What to do for each document type

### For DB Changes / DB Design documents
1. Read the existing document completely.
2. Read the **current database** structure from the DB architecture doc and any
   referenced SQL files, migration scripts, or EF model files in the codebase.
3. Cross-reference the **requirements source** (BRD, OR integration doc /
   project specification) — every data requirement, integration field, or
   payload mapping in it — against the tables/views in the document. Flag any
   data requirement that has no corresponding table, view, or stored procedure.
4. Produce an upgraded version that includes:
   - A **Mermaid `erDiagram`** showing all entities, relationships, PKs, and FKs
     mentioned in the document. Derive this from the table definitions in the doc
     and cross-reference with the actual code/DB structure.
   - A **field-to-mockup mapping table** — if a **mockup** is available, read it
     and map every visible data point in the mockup to its source DB field/view:
     | DB Field | Table/View | Mockup Element | UI Location |
     |----------|-----------|----------------|-------------|
     If no mockup is provided, leave this section with a `[MOCKUP NOT PROVIDED]`
     note so it can be filled in later.
   - A **view-to-report mapping table** if Power BI or reports are involved:
     | View/SP | Column | Report Data Point | Business Logic |
     |---------|--------|-------------------|----------------|
   - All DDL (CREATE TABLE, ALTER, CREATE VIEW, CREATE PROCEDURE) preserved
     and formatted consistently.
    - Any pipe-art or ASCII diagrams **replaced** with Mermaid equivalents.
4. **Preserve the old doc**: if a DB-Changes doc already exists, `cp` it to
   `<stem>-OLD-<YYYYMMDD>.md` FIRST (see "Preserve history" above), then write
   the new-format content into `<Prefix>-<Feature>-DB-Changes.md`. Never
   overwrite or in-place-rename the original without leaving the `-OLD-<date>`
   backup behind.

### For Architecture / DataSync documents
1. Read the existing document completely.
2. Read the **actual code** for the services, controllers, and DI registrations
   mentioned in the document to verify accuracy.
3. Produce an upgraded version that includes:
   - A **Mermaid `flowchart`** for the system architecture / data flow.
   - A **Mermaid `sequenceDiagram`** for API call sequences if applicable.
   - Service class and method listings verified against actual code.
   - Any pipe-art or ASCII diagrams **replaced** with Mermaid equivalents.
   - Flag any discrepancies between the document and the actual code.
4. **Preserve the old doc**: if an Architecture / DataSync doc already exists,
   `cp` it to `<stem>-OLD-<YYYYMMDD>.md` FIRST (see "Preserve history" above),
   then write the new-format content into
   `<Prefix>-<Feature>-DataSync-Architecture.md` or
   `<Prefix>-<Feature>-Architecture.md` as appropriate. Never overwrite or
   in-place-rename the original without leaving the `-OLD-<date>` backup behind.

### For Implementation Checklists
1. Read the existing checklist completely.
2. Cross-reference against whichever **requirements source** you have:
   - If a **BRD** is available: cross-reference every BRD requirement against
     the checklist. Flag any with no corresponding item; add as
     `[NEW — from BRD cross-reference]`.
   - If an **integration doc / project specification** is the source (no BRD):
     cross-reference every requirement, integration point, endpoint, message/
     event, data mapping, and external system in it against the checklist. Flag
     any with no corresponding item; add as
     `[NEW — from integration-doc/project-spec cross-reference]`. Treat the
     spec as authoritative for intent exactly as you would a BRD.
   - If only an **existing checklist** is given (no BRD and no spec): treat the
     checklist itself as the source of truth — reconcile it against the CODE
     (do items match what's actually built?) and upgrade its FORMAT, rather
     than cross-referencing against an external requirements doc.
3. If a **mockup** is available, cross-reference every UI element (field, button,
   column, tab, state) in the mockup against the checklist. Flag any mockup
   element that has no corresponding UI checklist item. Add missing items as
   `[NEW — from mockup cross-reference]`. (Skip this for integrations/services
   with no UI/mockup.)
4. For each item, add the missing fields to match the new format:
   ```
   - [ ] <Item title>
     - **Behavior**: What it does
     - **Location**: File/project path where the change goes
     - **UI ref**: Mockup element reference (if UI item)
     - **Logging**: Required log statements
     - **Acceptance**: How to confirm it works
     - **Verify**: Specific method to verify
     - **Coding Standards**: Reference to relevant coding standard rule
   ```
5. Add a **Status Table** at the top if one doesn't exist.
6. Add a **Deployment Steps** section at the bottom if one doesn't exist.
   Look at the existing doc, the DB Changes doc, the verification guide,
   and the README to identify what side effects the original build required
   (SQL migrations, npm installs, service restarts, config changes).
   Document each step in the standard format:
   ```
   - [ ] <Step title>
     - **What**: One-line description
     - **Command**: The exact shell command, or "Manual:" + instructions
     - **Where**: Working directory or host
     - **Required for**: Which checklist items depend on this step
     - **Idempotent**: Yes/No
     - **Owner**: dev / DBA / DevOps
   ```
   If you cannot determine the deployment steps from the available context,
   add a `[NEEDS VERIFICATION — confirm with implementer]` note next to
   each guessed step. If the feature has no deployment side effects, write
   `_None required — code-only feature._` in the section body.
7. **Preserve the old doc**: if an Implementation Checklist already exists,
   `cp` it to `<stem>-OLD-<YYYYMMDD>.md` FIRST (see "Preserve history" above),
   then write the new-format content into
   `<Prefix>-<Feature>-FullStack-Implementation-Checklist.md`. Never overwrite
   or in-place-rename the original without leaving the `-OLD-<date>` backup
   behind. (Note: this backup is a one-time upgrade action; the ongoing
   single-source-of-truth rule that `/analyze-fix`/`/fix`/`/verify` update the
   checklist in place still holds afterwards.)

### For Verification / Testing guides
1. Read the existing document.
2. Ensure it includes: prerequisites, base URL, connection profile,
   step-by-step testing, data verification steps, local setup guide.
3. Add any missing sections.
4. **Preserve the old doc**: if a verification/testing guide already exists,
   `cp` it to `<stem>-OLD-<YYYYMMDD>.md` FIRST (see "Preserve history" above),
   then write the new-format content into
   `<Prefix>-<Feature>-Verification-Guide.md` or
   `<Prefix>-<Feature>-Dev-Testing-N-Deployment-Guide.md`. Never overwrite or
   in-place-rename the original without leaving the `-OLD-<date>` backup behind.

### For Power BI Mapping documents
1. Read the existing document.
2. Add/verify mapping tables with plain English business logic.
3. Add Mermaid diagrams if data flow is complex.
4. **Preserve the old doc**: if a Power BI mapping doc already exists, `cp` it
   to `<stem>-OLD-<YYYYMMDD>.md` FIRST (see "Preserve history" above), then
   write the new-format content into `<Prefix>-<Feature>-PowerBI-Mapping.md`.
   Never overwrite or in-place-rename the original without leaving the
   `-OLD-<date>` backup behind.

### For Business-Reference + QA-Validation-Guide (REPORT features) — CONSOLIDATE
If the feature is a report/dashboard and has BOTH a `*-Business-Reference.md`
and a `*-QA-Validation-Guide.md`, the new framework replaces them with a SINGLE
`<Prefix>-<Feature>-Business-Verification-Reference.md` (one plain-English doc
for both business stakeholders AND QA). When upgrading:
1. Read both existing docs.
2. Produce the consolidated `*-Business-Verification-Reference.md` with the
   structure from `/add-doc` Document 2: data sources (cloud/tool + exact
   portal navigation path, every cloud), plain-English calculation logic,
   common cross-cloud mapping tables, how-to-verify steps, worked scenarios,
   glossary.
3. **Plain English only — strip ALL code/SQL/internal class/SP/table names.**
   Replace internal references with "the application database" and "an
   application Key Vault setting". The Business-Reference docs in legacy
   features had drifted technical (file:line references) — clean those out.
4. **Back up both old files FIRST** — `cp` each to `<stem>-OLD-<YYYYMMDD>.md`
   before writing the consolidated doc, so nothing is lost regardless of the
   delete decision below.
5. ASK the user before DELETING the two old files: "I've consolidated
   Business-Reference + QA-Validation-Guide into Business-Verification-
   Reference (old copies preserved as `-OLD-<date>.md`). Delete the two
   original files? (yes/no)". Do not delete silently.

### Producing a Developer-Flow-Guide for a legacy feature (by EXECUTING code)
If the feature has no `*-Developer-Flow-Guide.md`, CREATE it — it's the human
debugging doc the team needs most. Build it the same way `/add-doc` Document 1
prescribes: from the REAL code, confirmed by EXECUTING it. Cover the flow
class(es) that apply: **UI / full-stack** (§2 screen/tab flows) AND/OR
**service / package / job** (§3 — for sync services, scheduled workers,
background jobs, console apps, reusable NuGet/core packages). A pure backend
service or package feature gets §3 only (no §2). You CAN run code in this
container (no excuses — same rules as the Orchestrator/Verifier):
- **SQL**: connection string is in `appsettings.Development.json`; run the
  named stored procs / query tables via `sqlcmd` or a
  `Microsoft.Data.SqlClient` console under `verification/<feature>Runner/`.
- **Web app**: `dotnet run` + `npm run start:local`; `curl` endpoints;
  the profile's Playwright endpoint for UI.
- **Windows desktop app**: exercise the .NET library logic headlessly via a
  `verification/<feature>Runner/` console; optional host GUI bridge if present
  (probe the profile's declared bridge URL `/health`).
- **Service / scheduled job / NuGet package**: invoke the entrypoint directly
  from a `verification/<feature>Runner/` console with real `appsettings` config
  (don't wait for the scheduler), then confirm the DB rows it should write via
  `sqlcmd`. Document the ordered step table, trigger/registration site, inputs,
  standardisation, and failure behaviour. "Can't run the scheduler" is not a
  valid skip reason — call the method directly.
Trace each screen/tab value or service step end to end and confirm the chain
runs. "No SQL / can't run app / Windows app / can't run the scheduler" are NOT
acceptable reasons to skip execution. If running a specific flow is genuinely
impossible, mark that row `[NOT RUN — <real reason>]` — but try the headless
path first.

### Fold any bugs/gaps found during the upgrade into the checklist
When reading or executing the code to upgrade docs you may discover the
implementation is broken or incomplete (a documented feature isn't wired up, a
stored proc returns wrong data, an endpoint 500s). Don't just flag it in a doc
— fold it into the EXISTING Implementation Checklist as a FAIL/fix item
(single source of truth, no separate bug file): standard verifiable format with
Root Cause, Location, Acceptance, an executable Verify method, and
`**Source**: upgrade-docs execution (<date>)`. Update the Status Table. Report
the count in your summary and recommend `/fix` then `/verify`.

## Progress reporting — keep the user informed

Upgrading multiple docs can take 15+ minutes. Don't go silent. Emit
short structured chat messages at major moments.

**Announce in chat at these moments:**

1. **At the start**:
   ```
   ▶ /upgrade-docs starting
     - Scope: <FULL upgrade | TARGETED update of: <docs>>
     - Documents to upgrade: <N>  (<list filenames>)
     - Requirements source: <BRD | integration doc | project spec | existing checklist only>
     - Custom instructions detected: <echo them, or "none">
     - Reference inputs: Mockup <yes|no|n-a (no UI)>, Code paths <N>
     - Project prefix: <Prefix>
     - Output folder: <folder>
     - Backup policy: existing docs will be preserved as `-OLD-<date>.md`;
       brainstorming docs left untouched.
   Proceeding now.
   ```

2. **For each document being upgraded** (one announcement per doc):
   ```
   ▶ Upgrading <doc-name>…
     ✓ Backed up original → <stem>-OLD-<date>.md
     ⏳ Reading existing content (<X> lines)
     ⏳ Cross-referencing against code at <paths>
     ⏳ Cross-referencing against BRD / mockup
     ✓ Found <N> discrepancies, <M> additions needed
     ⏳ Applying edits in-place (skeleton-first strategy)
     ✓ Done. New-format doc: <new-name>. <X> lines now.
   ```

3. **At the end, before asking about HTML**:
   ```
   ✓ All <N> documents upgraded/updated. Summary:
     - Scope: <FULL | TARGETED: docs touched>
     - Requirements source used: <BRD | integration doc | project spec | existing checklist>
     - Backups created (old content preserved): <list of -OLD-<date>.md files>
     - Brainstorming docs: left untouched
     - Diagrams converted to Mermaid: <K>
     - [NEEDS VERIFICATION] flags: <Y>
     - Items flagged from requirements-source cross-ref: <A>
     - Items flagged from mockup cross-ref: <B> (n/a if no UI)
   ```

## CRITICAL: How to write large documents (prevents "Tool execution aborted")
When producing the upgraded document:
- **NEVER rewrite the entire file in a single write call.** Large file writes
  will abort mid-stream and lose all your work.
- **Use the EDIT tool** to make changes in place. Work section by section:
  1. First, `cp` the original to its `-OLD-<YYYYMMDD>.md` backup (preserve
     history — see "Preserve history" above). Then `cp` the original to the new
     standard filename to seed the new-format doc, and edit THAT copy — never
     the backup.
  2. Then use sequential edit operations to update each section of the
     new-format file — replace ASCII diagrams with Mermaid, add mapping tables,
     restructure headings, etc.
  3. Add new sections (like the Status Table or field-to-mockup mapping) as
     individual edit operations.
- If you must write a new file from scratch (e.g., the original doesn't exist
  at the target path), **break the content into logical sections** and write
  the file with a skeleton first, then use edit operations to fill in each
  section one at a time.
- **Test your approach**: if a document is longer than ~200 lines, always use
  the edit-in-place strategy.

## Accuracy rules
- **Do NOT invent data.** If you cannot determine a relationship, table
  structure, or mapping from the existing document + codebase, flag it as
  `[NEEDS VERIFICATION]` and move on.
- **Preserve all content** from the original document. You are upgrading
  the format, not rewriting the content. Only add structure, diagrams,
  and missing fields.
- **Cross-reference with code.** If the document says a table has 5 columns
  but the code shows 7, flag the discrepancy.
- **Cross-reference with the requirements source** (BRD, OR integration doc /
  project specification, OR — if neither exists — the existing checklist
  reconciled against code). If a requirement / integration point in it has no
  corresponding checklist item or DB structure, flag it.
- **Cross-reference with mockup** (UI features only). If the mockup shows a UI
  element that has no corresponding checklist item or DB field mapping, flag it.
  Skip for integrations/services with no UI.

## Diagram rules
- ALL diagrams MUST be fenced ` ```mermaid ` blocks. NEVER use ASCII/pipe art.
- Use `erDiagram` for data models
- Use `flowchart` for architecture and data flows
- Use `sequenceDiagram` for API/service interactions

## When done
1. List all changes made to each document.
2. List every backup created (`-OLD-<date>.md`) and confirm brainstorming docs
   were left untouched.
3. List all discrepancies found between documents and code.
4. List all items flagged as `[NEEDS VERIFICATION]`.
5. ASK: "Generate the human-readable HTML versions now, or markdown only?
   You can always run `/generate-html` later to create HTML versions."
   - If markdown only: stop. Remind the user they can run
     `/generate-html @<output-folder>/` later when they want HTML.
   - If HTML too: generate HTML ONLY for HUMAN-readable documents
     (DB-Changes, Architecture, Developer-Flow-Guide,
     Business-Verification-Reference, Verification-Guide / Dev-Testing guide,
     PowerBI-Mapping). For EACH such document, create `<name>.html` by copying
     `.opencode/templates/doc-shell.html`, replacing `{{TITLE}}` with the
     document title and `{{MARKDOWN}}` with the raw markdown text.
   - **NEVER generate HTML for the Implementation Checklist or Issues files** —
     they are AI-agent working documents and HTML goes stale immediately.
   - **NEVER generate HTML for the `-OLD-<date>.md` backups** — they are
     preserved legacy content, not current human-readable docs.
