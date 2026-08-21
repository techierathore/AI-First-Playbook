---
description: Produce a Developer Flow Guide (code-flow per screen/tab, OR per service/package/job) and/or a Business Verification Reference (plain-English sources/calculation/mapping) for an EXISTING feature, function, or service — derived from the real code
---

**IMPORTANT**: Before starting, activate the Analyst persona. See
`harness/README.md` → Personas. On a BMAD install that means reading and
following `.opencode/agent/analyst.md`; any equivalent analyst
persona works.

You are the Analyst. Your job is to produce ONE (or both) of the two
**human-readable companion documents** that the framework was missing:

1. **Developer Flow Guide** — `<Prefix>-<Feature>-Developer-Flow-Guide.md`
   A code-flow document that lets a HUMAN developer understand and DEBUG the
   code without reading the whole codebase. It covers TWO classes of subject —
   you can produce one or both in the same guide depending on what the feature
   contains:
   - **Full-stack / UI flows** (a screen, tab, or page): trace every visible
     value and every action end to end — `UI element/button → frontend method →
     API endpoint → service method → data-access method → stored procedure /
     view → table`.
   - **Service / package / job flows** (a sync service, scheduled worker,
     background job, console app, or a reusable NuGet/core library that does
     work on a schedule or on demand): trace `trigger (scheduler / queue /
     manual / DI caller) → entrypoint method → orchestration method → core
     library class+method → external API or tool call → standardisation /
     transform logic → DB write (SP / table) → outcome (logs / status)`.
   A feature can be PURELY a service/package (no UI at all — e.g. an inventory
   sync, a monitoring-data sync, a NuGet package other modules consume), PURELY
   a UI, or BOTH. The guide must handle all three. See "Two flow classes" below.

   This command also accepts a **narrow starting point**: the user can say
   "create a Developer Flow Guide for this function" or "…for the
   `CostDataSyncSvc` service" or "…for the `CloudManagerCore` package" and
   you produce a focused guide for just that function/service/package rather
   than a whole feature.

2. **Business Verification Reference** — `<Prefix>-<Feature>-Business-Verification-Reference.md`
   A SINGLE plain-English document (for reports/dashboards) that a business
   stakeholder OR a QA person can use to verify every number on the screen.
   It covers, in simple English with NO code/DB/jargon: the data **source**,
   the **calculation logic**, the **mapping** (e.g. common threshold mapping
   across AWS / Azure / GCP / a third-party monitoring SaaS), and the **verification flow**. This
   ONE document replaces the old separate Business-Reference + QA-Validation-Guide
   for report features (see "Why one document" below).

## User's full input (file paths + additional instructions)
$ARGUMENTS

## How to parse the input
1. **File paths** — the feature's doc folder (e.g. `@ImplDocs/CostDocs/`),
   the implementation checklist, the actual project folders (frontend, API,
   service, DB scripts, the core/NuGet package source), the BRD, the mockup.
   Read what you need — see the token rule below.
2. **Additional instructions** — which document(s) to produce, the SCOPE
   (a whole feature, a single screen/tab, OR a single function / service /
   package), naming, anything specific. Treat every instruction as a hard
   requirement.
3. **Scope detection** — decide up front what you are documenting:
   - A **whole feature** with UI → produce full-stack screen/tab flows
     (§ "Full-stack / UI flows") plus any service/job flows it depends on.
   - A **service, package, scheduled job, or single function** (with or
     without a UI) → produce the service/package flow (§ "Service / package /
     job flows"). If the user named a specific service/package/function, scope
     the guide to just that and the code it calls. ASK only if the scope is
     genuinely ambiguous.
   - **Both** → produce both classes of flow in the one guide.

## How this guide is created AND kept up to date (lifecycle)
The Developer Flow Guide is GROUND TRUTH for debugging, so it must track the
code over its whole life. Here is the explicit create/update story so nobody
has to guess:

| Phase | Command | What happens to the guide |
|---|---|---|
| Plan time (UI/feature) | `/feature-plan` | Creates it from the PLANNED design, marked `[PLANNED — sync to code after /implement]` |
| First build / existing feature | **`/add-doc`** (this command) | Creates it (or replaces the `[PLANNED]` version) by EXECUTING the real code |
| **Any code change afterwards** | **`/refresh-doc` (Mode B)** | RECONCILES it against current code: renamed `file:method`/endpoint/SP → updated; deleted → flagged `[STALE]`; new screen/service/job not in the guide → added. This is the "update on code change" path. |
| Legacy feature with no guide | `/upgrade-docs` or `/refresh-doc` (Mode B) | CREATES it if missing, then keeps it current |
| New service/package/function only | **`/add-doc`** (this command) | Creates a focused guide for just that subject |

**So the answer to "how does the guide get updated when code changes?" is:
run `/refresh-doc` (Mode B) pointed at the feature doc folder + the changed
code.** It reconciles every flow row against the current code and updates,
flags, or adds rows. `/add-doc` itself can also be re-run to rebuild a guide
from scratch when drift is large. Whenever `/implement` or `/fix` changes code
in a way that alters a flow (new endpoint, renamed SP, new sync step), the
team should run `/refresh-doc` (Mode B) afterward to bring the guide back in
sync — recommend this in your closing summary.

## Required inputs (ASK if missing)
Before producing anything, you need:
- **Which document** to produce: Developer Flow Guide, Business Verification
  Reference, or both. If not stated, ASK.
- **The scope** — whole feature, a single screen/tab, or a specific
  function / service / package. If the user gave a narrow subject (e.g. "the
  monitoring sync service"), confirm you're scoping to it.
- The **feature doc folder** and **project prefix + feature name** for naming.
- For the **Developer Flow Guide**: read access to the actual code. For
  full-stack flows that's frontend components, API controllers, service
  classes, data-access classes, stored procedures / views. For service /
  package / job flows that's the service/worker entrypoint (scheduler
  registration, `IHostedService`, console `Main`, queue trigger, or the DI
  consumer that calls it), the orchestration method, the core/NuGet library
  classes it calls, the external cloud/tool API calls, the standardisation /
  transform code, and the DB-write SP/table. ASK for the project paths if you
  don't have them. You CANNOT write an accurate flow from the checklist alone —
  the flow must come from the real code, **and you must EXECUTE that code to
  confirm the flow is real** (see "Build by executing").
- For the **Business Verification Reference**: the BRD, the mockup (or the
  rendered screen), and the existing Business-Reference / QA-Validation-Guide
  if they exist (to harvest sources/calculations already documented). The
  data-source facts come from the BRD + the sync/architecture docs + the
  actual code that calls each cloud/tool API.

If a required input is missing, **ASK** — do not guess paths or invent flows.

## TOKEN DISCIPLINE — read this before you start reading code
This command reads real code, which is token-heavy. Stay efficient:
- **Read the checklist, DB-Changes, and Architecture docs FIRST** — they
  already name most of the components, endpoints, SPs, and views. Use them as
  your map so you know exactly which code files to open.
- **Open code files surgically.** Use `grep` to jump to the method/endpoint/SP
  you need; read a focused window around it. Do NOT read entire large files
  end to end when a targeted read will do.
- **Do not dump code into the document.** The Developer Flow Guide names
  `file.cs:methodName` and what it does — it is a MAP, not a code listing.
  Quote at most a 1-3 line snippet only when it clarifies a non-obvious step.
- If the feature is large, produce the document **one unit at a time** —
  screen by screen / tab by tab for UI, and service by service / job by job /
  package by package for backend work — finishing one before starting the
  next, so a single aborted read doesn't lose everything.

---

## Document 1 — Developer Flow Guide

**Audience**: human developers who must debug a bug in this feature/service.
**Goal**: from any symptom — UI ("the Total Budget tile shows wrong number")
OR service/job ("the monitoring sync isn't importing GCP rows", "the inventory
sync ran but wrote nothing", "the NuGet package's standardisation dropped a
field") — a developer can find the exact code path in seconds.

**Naming**: `<Prefix>-<Feature>-Developer-Flow-Guide.md` (for a single service
or package documented on its own, `<Prefix>-<ServiceOrPackageName>-Developer-Flow-Guide.md`).

### Two flow classes — pick the ones that apply
A subject is one (or both) of:
- **Full-stack / UI flow** — there is a screen/tab a user looks at. Document
  it in §2 (Screen / Tab flows). The chain ends at a value on screen.
- **Service / package / job flow** — there is code that runs on a trigger
  (scheduler, queue message, manual run, DI caller) and performs work
  (sync, import, transform, export, calculation) without necessarily having a
  UI. Document it in §3 (Service / package / job flows). The chain ends at a
  DB write, an external call, or a returned result.

A pure sync service or NuGet package has NO §2 at all — its §3 is the heart of
the document. A pure UI feature has a light §3 (or none). Most real features
have both: a screen (§2) AND the sync that fills its data (§3). Do not force a
service into the UI table shape — services get their own richer structure
below (they have steps, retries, batching, standardisation, partial failure —
none of which fit a "UI element → table" row).

### Build the Developer Flow Guide by EXECUTING the code (not just reading it)
A flow guide written only from documents repeats the documents' lies. The
whole point of this doc is to be GROUND TRUTH for debugging, so you must
confirm each flow by running it. You CAN do this in the container — there are
NO valid excuses (same rules the Orchestrator/Verifier follow):
- **SQL**: the connection string is in `appsettings.Development.json`. Use
  `sqlcmd` or a tiny `Microsoft.Data.SqlClient` console under
  `verification/<feature>Runner/` to run the stored procs / query the tables
  named in each flow and confirm they exist and return what the flow claims.
- **Web app**: `dotnet run --project <ApiProject>` + `npm run start:local` run
  in the container; use the profile's Playwright endpoint. Hit each
  endpoint with `curl`, drive each screen with Playwright, and confirm the
  value on screen matches the API response matches the DB.
- **Windows desktop app**: exercise the .NET library logic headlessly via a
  `verification/<feature>Runner/` console that calls the exact data-access
  method / service method, using real `appsettings` config. Use the optional
  Windows-host GUI bridge only if one is configured — probe
  the profile's declared bridge URL `/health` (200 = up);
  endpoints: `/launch`, `/click`, `/type`, `/text`, `/screenshot`, `/stop`.
- **Service / scheduled job / NuGet package**: you don't need the scheduler or
  the host to fire — invoke the work directly. Write a tiny console under
  `verification/<feature>Runner/` (or `verification/<service>Runner/`) that
  news up the service / hosted-service / package class with real config
  (`appsettings.Development.json`) and calls its entrypoint or orchestration
  method (e.g. `await new CostDataSyncSvc(...).SyncAllCostData(...)`). Then
  confirm with `sqlcmd` / a SQL console that the expected rows were written /
  updated. A run that completes with NO rows written (when it should have
  written some) is a BUG — fold it into the checklist (see below), do not
  document it as "works". If the service calls a real cloud/tool API, use the
  same library code the product uses with real `appsettings` credentials; do
  NOT shell out to `az`/`aws`/`gcloud`. "Can't run the scheduler / no trigger"
  is NOT a valid excuse — call the method directly.

For EACH flow row/step you write, you should have actually traced it. For a UI
row: confirmed the endpoint responds, the service/DA method is called, the
stored proc/view exists and returns data, and the value lines up end to end.
For a service/job step: confirmed the entrypoint runs, the core library method
is called, the external call (if any) returns, the transform produces the
expected shape, and the DB write actually happened. Mark a row/step
`[VERIFY — not found in code]` only if you genuinely could not locate it; mark
it `[NOT RUN — <reason>]` only if execution was truly impossible (and that
reason must NOT be "no SQL / can't run app / can't run the scheduler / Windows
app").

### Fold any gaps/bugs you discover into the checklist
While executing the flows you WILL sometimes find that the implementation is
broken or incomplete (an endpoint 500s, a stored proc returns wrong data, a
screen value doesn't match the DB — the exact class of bug that slips past the
checklist and the Verifier). When that happens:
1. Do NOT silently "document around" it. Capture it.
2. Append a FAIL/fix item to the EXISTING Implementation Checklist (single
   source of truth — do not create a separate bug file), in the standard
   verifiable format:
   ```
   - [ ] Fix: <symptom found while building the flow guide>
     - **Root Cause**: <what the execution showed>
     - **Behavior**: <correct behavior>
     - **Location**: <file:method / SP / view>
     - **Acceptance**: <how to confirm fixed>
     - **Verify**: <executable check — endpoint + DB query that should agree>
     - **Source**: Developer-Flow-Guide build (<date>)
   ```
3. Update the checklist Status Table with the new item(s) as FAIL/Pending.
4. In the flow guide itself, note the affected value as
   `[KNOWN ISSUE — see checklist item #N]` so debuggers aren't misled.
5. Tell the user in your summary how many gaps you folded in and recommend
   `/fix @<checklist>` then `/verify @<checklist>`.

### Structure

```markdown
# <Feature> — Developer Flow Guide

| | |
|---|---|
| Purpose | Help a developer understand and debug the code flow of this feature/service |
| Scope | <whole feature \| screen "X" \| service "Y" \| package "Z" \| function "W"> |
| Subject type | <UI \| Service/Job \| Package \| Mixed> |
| Audience | Developers (debugging, maintenance, onboarding) |
| Companion docs | Implementation Checklist, DB-Changes, Architecture |
| Updated by | `/refresh-doc` (Mode B) on any code change; re-run `/add-doc` to rebuild |
| Last synced to code | <date> |

## 1. Map (one diagram)
<A single Mermaid `flowchart`. For a UI/full-stack subject: screens/tabs and
the layers they pass through (UI → API → Service → Data Access → DB). For a
service/package/job subject: the trigger(s), the entrypoint, the orchestration
method, the core library/package classes, the external call(s), and the DB
write — one box per stage. For a mixed feature, show both the screen(s) AND the
sync(s) that feed them. High level — one box per unit, one box per layer.>

> Omit §2 entirely if the subject has no UI (a pure service or package). Omit
> §3 if the subject does no background/service work. Keep only what applies.

## 2. Screen / Tab flows  _(skip if no UI)_
For EACH screen or tab, one subsection:

### 2.1 <Screen / Tab name>
**What the user sees**: <one-line>.

**Per-element flow table** — one row per tile / value / column / chart:

| UI element (what the user sees) | Frontend file:component/method | API endpoint | Service method | Data-access method | Stored proc / View | Source table(s) |
|---|---|---|---|---|---|---|
| Total Budget tile | `OverviewTab.tsx` → `useCostData()` | `GET /api/cost/overview` | `CostReportDataSvc.GetOverview` | `CostDataDa.GetOverview` | `uspGetCostOverview` → `vwCostOverview` | `[Inventory].[CostRecord]` |

**Actions** — one row per button / filter / interaction:

| Action (button/filter) | Frontend handler | What it calls | Effect |
|---|---|---|---|

**A small Mermaid `flowchart` or `sequenceDiagram`** for this screen showing
the request path for the primary value. Keep it SIMPLE — a normal flowchart,
not a 30-node sequence diagram.

**Debugging notes**: the 2-3 places a value most often goes wrong on this
screen, and where to look first (which log line, which SP, which mapping).

## 3. Service / package / job flows  _(skip if no background/service work)_
This is the heart of the document for sync services, scheduled workers,
background jobs, console apps, and reusable NuGet/core packages. For a PURE
service/package feature this section IS the document. For EACH service /
job / package entrypoint, one subsection using the structure below. Unlike a
UI value (one row, one chain), a service has STEPS — document them as an
ordered step table plus the surrounding facts a debugger needs.

### 3.1 <Service / Job / Package entrypoint name> (e.g. SyncAllCostData)
- **What it does**: <one plain line — e.g. "imports cost data for every org
  from AWS/Azure/GCP and writes standardised rows to CostRecord">.
- **Subject type**: hosted service `IHostedService` / scheduled job / queue
  consumer / console `Main` / on-demand DI method / NuGet package API.
- **Where it lives**: `<project> → <Class.cs:Method>`. For a NuGet/core
  package, name the package and the public class+method consumers call.
- **Trigger / who invokes it**: <scheduler + cron/interval, e.g. Hangfire
  `*/30 * * * *` | Service Bus queue `<queue>` | a UI button → endpoint |
  another service's DI call | manual console run>. Name the exact registration
  site (`Program.cs` / `Startup.cs` / scheduler config) so a debugger can
  confirm it's actually wired and on what cadence.
- **Inputs / config it reads**: appsettings keys, KeyVault settings (by
  purpose, not value), connection strings, feature flags, the orgs/scopes it
  iterates. Name where each is read (`file.cs:method`).
- **Step-by-step flow table** — one row per meaningful step, in order:

  | # | Step | Code (`file:method` / package class.method) | External call / SP | Writes to | Notes (batching, retry, idempotency) |
  |---|---|---|---|---|---|
  | 1 | Resolve orgs to sync | `CostDataSyncSvc.cs:GetOrgs` | — | — | skips inactive orgs |
  | 2 | Pull cost data per cloud | `CloudManagerCore` → `AwsCostClient.GetCosts` | AWS Cost Explorer API | — | paged; retries 3x |
  | 3 | Standardise resource types/currency | `CostStandardiser.cs:Normalise` | — | — | mapping table below |
  | 4 | Upsert rows | `CostDataDa.cs:UpsertCostRecords` | `uspUpsertCostData` | `[Inventory].[CostRecord]` | idempotent on (Org,Date,Resource) |

- **What it standardises / transforms**: resource types, currencies, labels,
  thresholds, etc., and WHERE that logic lives (`file.cs:method`). If a mapping
  table applies, show it (or reference the Business-Verification-Reference).
- **Outcome & how to tell it succeeded**: rows written / updated, status it
  records, the exact INFO log line emitted on success (with counts).
- **Failure & partial-failure behaviour**: what happens if one cloud/org fails
  — does it abort the whole run or continue? Where is that decision in code?
  Which ERROR log line is emitted, and does the run still mark "complete"?
- **A simple Mermaid `flowchart`** of the service path (trigger → entrypoint →
  steps → DB write → outcome). Keep it simple, not a 30-node diagram.
- **Debugging notes**: the 2-3 places this service most often goes wrong (e.g.
  "0 rows for one cloud → check the cloud client's credentials in §inputs and
  the ERROR line in step 2"; "rows written but values wrong → check the
  standardisation in step 3"), and which log line / SP / table to inspect first.

### For a reusable NuGet / core package documented on its own
When the subject is a package (e.g. `CloudManagerCore`) rather than a running
service, document it as the public surface a consumer calls:
- **Public entrypoints**: the classes/methods other modules call, what each
  does, expected inputs/outputs.
- **Internal flow per entrypoint**: same step table as above (the package's own
  steps: auth → call cloud → transform → return / write).
- **Consumers**: which services/apps call this package and for what — so a
  debugger tracing a service flow knows where the package fits.
- **Side effects**: does the package write to the DB / cloud itself, or only
  return data for the caller to persist? State it clearly.

## 4. Cross-cutting flows
RBAC checks, filters that apply to every screen, error boundaries, caching —
named with their code location, so a developer knows where a global behaviour
comes from.

## 5. "I have this bug — where do I look?" index
A quick table mapping common symptoms to the section/flow above:

| Symptom | Likely layer | Start here |
|---|---|---|
| A tile shows the wrong number | SP or view | §2.x row for that tile → the SP |
| A whole tab is empty | API or sync | §2.x flow → check endpoint → check sync log |
| Sync imported nothing for one cloud | sync/core library | §3.x step that pulls that cloud → its credentials + ERROR line |
| Sync ran but wrote 0 rows | service/DA | §3.x → confirm steps reached the upsert; check the success INFO line |
| Sync wrote rows but values are wrong | standardisation/transform | §3.x standardisation step + the mapping table |
| Job didn't run at all | trigger/scheduler | §3.x trigger row → confirm registration + cadence |
| Package returns wrong/empty data to a caller | package internals | §3 package subsection → its step table |
| One org/scope skipped | service iteration logic | §3.x step that resolves orgs/scopes |
```

### Hard rules for the Developer Flow Guide
- It must be derived from the **actual current code**, not from the checklist
  text. Open the real files and confirm the method/endpoint/SP/class names.
- Every flow row/step must name REAL identifiers (`file:method`, endpoint
  route, SP name, view name, table name, package class+method, trigger/cron).
  If you can't confirm one from the code, mark it `[VERIFY — not found in
  code]` rather than inventing it.
- **Cover the right flow class(es).** A pure service/package gets §3 only (no
  §2). A pure UI gets §2 (and §3 only if it has background work). A mixed
  feature gets both. Never force a service into the UI table shape.
- Diagrams are **simple flowcharts**, not complex
  sequence diagrams. One per screen/tab + one per service/job/package + one
  map. All Mermaid, never ASCII.
- This IS a human-readable document → it GETS an HTML version (see Finally).

---

## Document 2 — Business Verification Reference

**Audience**: BOTH business stakeholders AND QA. (See "Why one document".)
**Goal**: anyone — even a layman — can read it and verify any number on the
report by doing simple lookups and arithmetic.

**Naming**: `<Prefix>-<Feature>-Business-Verification-Reference.md`

### Why one document (read this)
QA is also a stakeholder: QA does not care about the
database or how things were built. QA (and the business) want exactly three
things per number: **the source**, **the calculation**, and **how to verify
it**. The old two-document split (Business-Reference for stakeholders +
QA-Validation-Guide for QA) duplicated content, drifted apart, and confused
QA. For REPORT features this single document REPLACES both. (A deep technical
cloud-portal cross-check guide for engineers may still exist separately as
the `*-Verification-Guide.md` / `*-Dev-Testing-N-Deployment-Guide.md` — that
is for developers, not for this audience.)

### Structure

```markdown
# <Feature> — Business Verification Reference

| | |
|---|---|
| Purpose | Verify every number on the report: source, calculation, how to check it |
| Audience | Business stakeholders AND QA |
| Plain English | No SQL, no code, no internal class/table names |
| Last reviewed | <date> |

## 1. What this report shows (at a glance)
Plain-English description of each screen/tab and the questions it answers.

## 2. Data sources — where each number comes from
For EACH screen/tab, a table. The "source" is the cloud / tool the data
comes from and WHERE in that tool's portal you can see it yourself.

| What you see on the report | Comes from | Where to find it (portal navigation) | What you'll see there |
|---|---|---|---|
| Total Resources Monitored | Azure Monitor | Azure Portal → Monitor → Alerts → Alert rules | The list of alert rules |
| (AWS equivalent) | AWS CloudWatch | AWS Console → CloudWatch → All alarms | The list of alarms |
| (GCP equivalent) | Google Cloud Monitoring | GCP Console → Monitoring → Alerting → Policies | The list of policies |
| (monitoring-SaaS equivalent) | a third-party monitoring SaaS | its console → Admin → Inventory → Monitors | The list of monitors |

This is the section most often gotten wrong. Be PRECISE about
which cloud/tool each value comes from and the exact navigation path, for
EVERY cloud the feature supports (GCP, AWS, Azure, a third-party monitoring SaaS, etc.).

## 3. Calculation logic — how each number is computed (plain English)
For EACH number / KPI: a plain-English formula and rules. No SQL, no DAX.
Example:
> **Overall Compliance %** = Monitored ÷ (Monitored + Unmonitored) × 100.
> A resource counts as "monitored" only if an active alert covers it.
> Colour: Red below 70%, Amber 70–89%, Green 90% or above.

## 4. Mapping tables
Where the feature maps different cloud/tool values onto one common report
concept, show the COMMON MAPPING in a table. This is critical and was a pain
point. Example — common threshold mapping:

| Report column | Azure | AWS | GCP | Monitoring SaaS |
|---|---|---|---|---|
| Critical Threshold | severity ≤ 1 | the alarm's threshold | the policy condition | severity = 3 entry |
| Trouble Threshold | severity ≥ 2 | (not used — always blank) | (not used — always blank) | severity = 2 entry |

Explain in one plain-English line per row WHY the mapping is what it is, so a
verifier understands what to expect to be blank vs filled per cloud.

## 5. How to verify a value (step by step)
A simple, repeatable procedure anyone can follow:
1. Pick the value on the report.
2. Look up its source in §2 and open that cloud/tool portal.
3. Apply the calculation from §3 (simple arithmetic).
4. Compare. If within tolerance → PASS. If not → record it as a discrepancy.

Include a **verification flow** as a simple Mermaid `flowchart` (open report
→ look up source → check portal → apply calculation → compare → pass/flag).

## 6. Verification scenarios (worked examples)
2-4 worked examples: "For customer X, Azure showed N resources with alerts,
M without → expected compliance = N ÷ (N+M) × 100 = P%. The report shows P%
→ PASS." Use realistic, simple numbers.

## 7. Glossary (non-technical)
Plain-English definitions of every business term used.
```

### Hard rules for the Business Verification Reference
- **Plain English only.** NO SQL, NO code, NO internal class names, NO stored
  procedure names, NO actual table names. When you must refer to where data is
  stored, say "the application database". When you refer to a
  secret/setting, say "an application Key Vault setting" — never the real key.
- It must cover **every cloud / tool** the feature supports, with the exact
  portal navigation path for each — this is the part most often gotten wrong.
- Mapping tables (common mapping across clouds) are MANDATORY whenever the
  feature normalises values from different sources.
- Anyone (a layman) must be able to verify a number with simple arithmetic
  using only this document. If verifying a number truly requires internals,
  that's a sign the report logic is too opaque — flag it, don't leak code.
- This IS a human-readable document → it GETS an HTML version.

---

## CRITICAL: How to write large documents (prevents "Tool execution aborted")
- NEVER write >~200 lines in a single `write`. Write a skeleton (headings +
  the metadata table + section placeholders), then fill each section with
  `edit` operations, one unit at a time (one screen/tab, or one service/job).

## Progress reporting — keep the user informed
Tool calls and text turns must ALTERNATE. Never go more than one tool-call
batch (3-5 calls) without a short text update. Announce:
1. At start: which document(s), which subject + scope (feature / screen /
   service / package), which code paths you'll read, that you'll work
   unit-by-unit.
2. Per screen/tab/service/job as you finish it.
3. At end: a summary + the `[VERIFY]` flags you couldn't confirm from code, and
   a reminder that `/refresh-doc` (Mode B) keeps this guide in sync on future
   code changes.

## Self-check before returning
- Developer Flow Guide: the correct flow class(es) are present (§2 for UI, §3
  for services/packages/jobs — a pure service has §3 and no §2). Every flow
  row/step names real `file:method` / endpoint / SP / view / table / package
  class / trigger confirmed from code (or flagged `[VERIFY]`). Service flows
  include trigger, inputs, step table, outcome, and failure behaviour.
  Diagrams are simple. The "where do I look" index covers both UI and service
  symptoms. The metadata table states Subject type and that `/refresh-doc`
  updates it.
- Business Verification Reference: zero code/SQL/internal names. Every cloud/
  tool source has a portal path. Mapping tables present. A layman could verify.

## Finally
Both documents are HUMAN-READABLE → generate HTML for them.
ASK: "Generate the HTML version(s) now, or markdown only? (Run `/generate-html`
later if you prefer.)"
- If HTML: for each NEW human-readable doc, create `<name>.html` by copying
  `.opencode/templates/doc-shell.html`, replacing `{{TITLE}}` and `{{MARKDOWN}}`.
- Never generate HTML for AI-only docs (checklists, issues files).
