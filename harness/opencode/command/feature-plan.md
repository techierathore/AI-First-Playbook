---
description: Plan a new feature - produces the full verifiable document set
---

**IMPORTANT**: Before starting, you MUST activate the Analyst persona by reading and
following `.opencode/agent/analyst.md`; any equivalent analyst persona works.

You are now the Analyst. Your job is to produce a complete, verifiable document
set for a new feature.

## User's full input (file paths + additional instructions)
$ARGUMENTS

## How to parse the input above
The user's input contains TWO kinds of information:
1. **File paths** — references starting with `@` or plain paths to BRDs, mockups,
   project folders, and reference docs. Read ALL of them.
2. **Additional instructions** — free-form text describing specific requirements,
   constraints, service names, method names, API details, architectural decisions,
   or anything else the user wants you to follow. These are EQUALLY IMPORTANT as
   the file paths. Treat every instruction as a hard requirement and incorporate
   it into the documents you produce.

For example, the user might say:
```
@ImplDocs/BRDs/BRD-004.md @mockups/.../Mockup.tsx
Also verify any Cloud API methods you plan to use in CloudManagerCore
against actual cloud documentation. The sync service should be named
'CostDataSyncSvc' with methods 'SyncOrgCostData' and 'SyncAllCostData'.
```
In this case you MUST: read both files, name the service exactly as specified,
use those exact method names, AND verify Cloud API methods against cloud docs.

## Required context (ASK if not provided)
Before producing any documents, you need:
- A **requirements source** — ONE of these is enough (a BRD is NOT mandatory):
  - The **BRD** (Business Requirements Document) — the classic source; OR
  - An **integration doc / project specification** — common for integrations
    that came out of a brainstorming session with an analyst rather than a
    formal BRD. Treat it as authoritative for intent EXACTLY as you would a
    BRD: every requirement / integration point / endpoint / data mapping in it
    must map to a checklist item.
  - (An existing hand-written checklist may also accompany the spec — use it as
    the starting point and reconcile/expand it rather than inventing a new one.)
- The **mockup** (React TSX file or screenshot) — if UI is involved. Many
  integrations/services have NO UI; that's fine, skip the mockup.
- The **DB Architecture doc** (e.g., `ImplDocs/ArchDocs/App-DB-Architecture.md`)
- The **Coding Standards doc** (e.g., `ImplDocs/Coding-Standards.md`)
- Any **existing project files** referenced in the user's instructions

If the requirements source is missing entirely, **ASK** — but accept a BRD OR
an integration doc / project spec; do NOT block waiting for a BRD when a spec
is provided. Do not assume paths. DO proceed with what you have if the user has
explicitly said certain docs are not needed (e.g., "no Power BI mapping
needed", "backend only, no mockup", "integration only, no BRD — use this
project spec").

## Documents to produce

Create all documents in the folder the user specifies (e.g., `ImplDocs/<FeatureName>Docs/`).
Use descriptive, feature-specific names following the project convention:
`<ProjectPrefix>-<FeatureName>-<DocType>.md`

For example, for a "Cost Optimization Dashboard" feature in the product:
- `App-CostOptDashboard-DB-Changes.md`
- `App-CostOptDashboard-DataSync-Architecture.md`
- `App-CostOptDashboard-FullStack-Implementation-Checklist.md` (AI-agent doc)
- `App-CostOptDashboard-Developer-Flow-Guide.md` (human — see §6)
- `App-CostOptDashboard-Business-Verification-Reference.md` (human — see §7, report features)
- `App-CostOptDashboard-Verification-Guide.md` / `-Dev-Testing-N-Deployment-Guide.md` (deep technical, for engineers)
- `App-CostOptDashboard-PowerBI-Mapping.md` (only if Power BI is involved)

### Which documents are for HUMANS vs for the AI agent
This matters for HTML generation (we only ever produce HTML for human docs):
- **AI-agent documents** (NO HTML — they are working files for the agents):
  the Implementation Checklist, any Issues files.
- **Human-readable documents** (HTML when requested): DB-Changes,
  Architecture, Developer-Flow-Guide, Business-Verification-Reference,
  Verification-Guide / Dev-Testing guide, PowerBI-Mapping.

### Is this a REPORT / dashboard feature?
If the feature is primarily a report or dashboard (values pulled from clouds/
tools and displayed), produce a single **Business-Verification-Reference**
(§7) and do NOT produce separate `*-Business-Reference.md` and
`*-QA-Validation-Guide.md` files. Those two duplicated each
other and confused QA — QA is also a stakeholder who just wants source +
calculation + how-to-verify. For non-report UI features (data entry, list
pages, workflows), the Developer-Flow-Guide (§6) is the key human doc and the
Business-Verification-Reference is usually not needed (the BRD covers intent).

### 1. DB Changes Document (`*-DB-Changes.md`)
- All new tables, columns, indexes, constraints with full DDL
- Updates to existing tables
- New stored procedures and views with full SQL
- Mermaid ER diagram (`erDiagram`) showing new and modified entities
- Field-to-mockup mapping table: which DB field feeds which UI element

### 2. Architecture / DataSync Document (`*-Architecture.md` or `*-DataSync-Architecture.md`)
- System architecture with a Mermaid `flowchart` diagram
- Service design: classes, methods, DI registration
- Data flow: source -> sync -> DB -> API -> UI
- Error handling and logging strategy
- Integration points with existing codebase

### 3. Full-Stack Implementation Checklist (`*-FullStack-Implementation-Checklist.md`)
This is the BUILD AND VERIFY CONTRACT. Every item must be verifiable.

Format each checklist item as:
```
- [ ] <Item title>
  - **Behavior**: What it does
  - **Location**: File/project path where the change goes
  - **UI ref**: Mockup element reference (if UI item)
  - **Logging**: Required log statements (INFO on start/finish with counts, ERROR with stack on failure)
  - **Acceptance**: How to confirm it works
  - **Verify**: Specific method to verify (Playwright step, dotnet test assertion, log grep, etc.)
  - **Coding Standards**: Reference to relevant coding standard rule
  - **Type**: One of `ui` | `backend-api` | `backend-service` | `db` | `logging` | `infrastructure` | `cross-cutting`
```

### Write the checklist for PARALLEL execution

The Orchestrator (`/implement`, `/fix`) spawns parallel sub-agents grouped
by independence, and the Verifier spawns parallel sub-verifiers grouped by
type. Your job is to make those groupings possible.

**Hard rules for item grouping:**

1. **Group items by clear file/project ownership.** A cost dashboard
   feature should have separate item groups for:
   - DB schema items (touch SQL/migrations)
   - Shared model items (touch `AppModels`)
   - Backend service items (touch one service class in one project)
   - Backend controller items (touch one controller in the API project)
   - Frontend component items (touch one or two React components each)
   - Frontend hooks/api-client items
   - Cross-cutting items (DI registration, `Program.cs`, `appsettings.json`,
     routing config — these block parallelism, so consolidate them into
     ONE item per file)

2. **Don't write 10 items that all modify `Program.cs`.** That forces the
   Orchestrator to serialise them. Instead, write ONE consolidated item
   ("Register all cost services in DI: `ICostDataSyncSvc`,
   `ICostReportSvc`, `ICostExportSvc`") that names everything to add.

3. **Include the `Type` field on every item.** The Verifier uses it to
   bucket items for parallel sub-verifiers. Without it, the Verifier
   has to guess from the Verify field, which is error-prone.

4. **State dependencies explicitly when they exist.** If item #14 (controller)
   depends on item #11 (service interface), say so in item #14:
   `**Depends on**: #11`. The Orchestrator will schedule them across waves.

5. **Avoid micro-items.** "Add `using` statement" is not a checklist item.
   Bundle it into the larger item that needs the using.

Include a **Status Table** at the top:
| # | Item | Status | Agent | Notes |
|---|------|--------|-------|-------|

Include an **Infrastructure Requirements** section AND a **Deployment Steps**
section near the bottom (both initially placeholders that `/implement` and
`/fix` fill in as they discover requirements):

```
## Infrastructure Requirements

_External resources this feature depends on — to be populated by /implement
and /fix as they identify needs (Blob containers, KeyVault secrets, Service
Bus queues, RBAC roles, etc.). The /verify command reads this section to
confirm the resources exist before testing items that depend on them. If
the feature uses only pre-existing infrastructure, this section will say
"None required"._

## Deployment Steps

_Actions a developer/QA must run to apply the code changes (SQL migrations,
service restarts, npm installs, config changes, etc.) — to be populated by
/implement and /fix. The /verify command processes this section before
checklist verification. If a feature is pure code-only with no deployment
side effects, this section will say "None required"._

## Verifier Run Log

_Each /verify run appends a dated entry here recording: environment probe
results (which tools were available), app start outcome, deployment steps
outcome, and overall verdict. Run history is preserved — do not delete
prior entries._
```

EVERY requirement in the requirements source (BRD, OR integration doc /
project specification) must map to at least one checklist item.
EVERY mockup element (field, button, column, tab, state) must map to a UI
checklist item — for UI features (skip for integrations/services with no UI).
EVERY cross-cutting concern (logging, error handling, auth) must have explicit items.

### 4. Verification & Testing Guide (`*-Verification-Guide.md` or `*-Dev-Testing-N-Deployment-Guide.md`)
- Prerequisites: required access, roles, API keys, cloud permissions
- Base URL for the running app
- Dev/test DB connection profile name (NOT the actual connection string)
- Step-by-step testing instructions for each major feature
- Data verification steps: how to confirm data on actual cloud UIs
- Local development setup guide (for non-specialists, step-by-step)

### 5. Power BI Mapping Document (`*-PowerBI-Mapping.md`) - ONLY if feature feeds Power BI
- View/table to Power BI dataset mapping
- Business logic per data point in plain English (no DAX)
- Filter and parameter mapping

### 6. Developer Flow Guide (`*-Developer-Flow-Guide.md`) — ALWAYS for UI features AND for service/package/job features
A HUMAN-readable code-flow document so a developer can understand and DEBUG the
feature without reading the whole codebase. It covers TWO flow classes — write
the one(s) that apply:
- **Full-stack / UI flows** — for a screen or tab.
- **Service / package / job flows** — for a sync service, scheduled worker,
  background job, console app, or reusable NuGet/core package. A feature can be
  PURELY a service/package (no UI — e.g. an inventory or monitoring-data sync),
  PURELY a UI, or BOTH. Always produce this guide for backend service features
  too, not just UI ones.

At plan time the code doesn't exist yet, so write it from the PLANNED design
(the checklist + architecture + DB-Changes) and mark it `[PLANNED — sync to
code after /implement]`.

**How it stays current (lifecycle):** after implementation, run `/add-doc` to
build it from the real (running) code, then run **`/refresh-doc` (Mode B)** on
this file after ANY code change to reconcile it with reality (renamed
`file:method`/endpoint/SP → updated, deleted → flagged `[STALE]`, new
screen/service/job → added). That is the explicit "update on code change" path.

Structure (see `/add-doc` for the full template):
- **Map** — one simple Mermaid `flowchart`: screens/tabs + layers for UI, OR
  trigger → entrypoint → steps → DB write for a service/package.
- **Per screen/tab** (skip if no UI): a table with one row per visible value
  tracing `UI element → frontend file:method → API endpoint → service method →
  data-access method → stored proc/view → table`, plus an actions table, a
  simple flow diagram, and "debugging notes".
- **Service / package / job flows** (skip if no background/service work): for
  EACH service/job/package entrypoint — its trigger (scheduler/cron/queue/
  manual/DI caller + the registration site), the config/inputs it reads, an
  ordered STEP table (`# | step | file:method / package class.method |
  external call/SP | writes to | notes`), what it standardises/transforms,
  the success outcome + log line, failure/partial-failure behaviour, a simple
  diagram, and debugging notes. For a reusable package, document its public
  entrypoints, internal flow, consumers, and side effects.
- **Cross-cutting flows**: RBAC, global filters, error boundaries.
- **"I have this bug — where do I look?" index**: symptom → layer → start here.
  Include service symptoms (job didn't run, wrote 0 rows, wrong values, one
  cloud/org skipped, package returned empty), not just UI ones.

Rules: name REAL identifiers once code exists (until then `[PLANNED]`);
diagrams are SIMPLE flowcharts, not complex sequence diagrams; never dump code
— this is a MAP. This is a human doc → it gets HTML.

### 7. Business Verification Reference (`*-Business-Verification-Reference.md`) — for REPORT features
A SINGLE plain-English document for BOTH business stakeholders AND QA. It
replaces the old separate Business-Reference + QA-Validation-Guide for report
features. QA is also a stakeholder; everyone just wants source +
calculation + how-to-verify.

Structure (see `/add-doc` for the full template):
- **What this report shows** (plain English, per screen/tab).
- **Data sources** — per value: which cloud/tool + exact portal navigation
  path, for EVERY cloud the feature supports (GCP, AWS, Azure, a third-party monitoring SaaS, ...).
  This is the section most often gotten wrong — be precise.
- **Calculation logic** — plain-English formula per number. No SQL/DAX.
- **Mapping tables** — common mapping across clouds (e.g. threshold labels)
  in tabular form, with a plain-English reason per row. MANDATORY when the
  feature normalises values from different sources.
- **How to verify a value** — simple step-by-step + a simple flow diagram.
- **Verification scenarios** — worked examples with simple arithmetic.
- **Glossary** — non-technical.

HARD rule: NO SQL, NO code, NO internal class/SP/table names. Refer to storage
as "the application database" and to secrets as "an application Key
Vault setting". A layman must be able to verify a number with simple
arithmetic using ONLY this document. This is a human doc → it gets HTML.

## CRITICAL: How to write large documents (prevents "Tool execution aborted")
- **NEVER write a document longer than ~200 lines in a single write call.**
  Large file writes will abort mid-stream and lose all your work.
- **Strategy for each document**: write a skeleton/outline first (headings +
  brief placeholders, ~50-80 lines), then use EDIT operations to fill in each
  section one at a time.
- **If a document is short** (<150 lines), a single write is fine.
- **For the Implementation Checklist** (usually the longest): write the Status
  Table + first 5-8 checklist items, then edit to append the remaining items in
  batches of 5-8.

## Diagram rules
- ALL diagrams MUST be fenced ` ```mermaid ` blocks. NEVER use ASCII/pipe art.
- Use `erDiagram` for data models
- Use `flowchart` for architecture and data flows
- Use `sequenceDiagram` for API/service interactions

## Self-check before returning
1. Every requirement in the requirements source (BRD OR integration doc /
   project spec) maps to a checklist item
2. Every mockup element maps to a UI checklist item (UI features only)
3. Every checklist item has a Verify method
4. Every sync/service has logging items (start, finish, error)
5. The coding standards are referenced in relevant items
6. A Developer-Flow-Guide was produced (marked `[PLANNED]` since code doesn't
   exist yet) so the team will have a debugging map after build — covering the
   right flow class(es): §2 screen/tab flows for UI, §3 service/package/job
   flows for any sync service, scheduled job, or NuGet/core package (a pure
   backend service feature still gets this guide, with §3 as its core)
7. For report features, a single Business-Verification-Reference was produced
   (NOT separate Business-Reference + QA-Validation-Guide)
8. List anything from the requirements source (BRD / integration doc /
   project spec) you could NOT map and explain why

## Finally
ASK the user: "Generate the human-readable HTML versions now, or markdown only?
You can always run `/generate-html` later to create HTML versions."

- If markdown only: stop. Remind the user they can run
  `/generate-html @<output-folder>/` later when they want HTML versions
  (e.g., before publishing to Confluence).
- If HTML too: generate HTML ONLY for the **human-readable** documents
  (DB-Changes, Architecture, Developer-Flow-Guide,
  Business-Verification-Reference, Verification-Guide / Dev-Testing guide,
  PowerBI-Mapping). For EACH such document, create `<name>.html` by copying
  `.opencode/templates/doc-shell.html`, replacing `{{TITLE}}` with the
  document title and `{{MARKDOWN}}` with the document's raw markdown text.
  Save beside the `.md` file. Do NOT run any external converter.
- **NEVER generate HTML for the Implementation Checklist or any Issues file.**
  Those are AI-agent working documents — HTML versions just waste tokens and
  go stale. If the user explicitly asks for checklist HTML, confirm they
  really want it before producing it.
