---
description: Produce a Developer Flow Guide and/or a Business Verification Reference for an existing feature, service, package or function, derived from the running code
---

You are the Analyst (`.opencode/agent/analyst.md`). Standing rules: `AGENTS.md`. Produce one or
both human companion documents for an existing subject:

1. **Developer Flow Guide** (`<Prefix>-<Feature>-Developer-Flow-Guide.md`): a map a developer uses
   to understand and debug the code. UI flows trace each visible value and action from the UI
   element to the table; service, job and package flows trace trigger, entrypoint, steps,
   external calls, transforms, writes and outcome. A subject may be UI, service or both; the user
   may also name one screen, service, package or function.
2. **Business Verification Reference** (`<Prefix>-<Feature>-Business-Verification-Reference.md`):
   one plain-English document for business stakeholders and QA, giving each number's source (with
   the portal path), calculation, mapping and how to verify it. It replaces the old separate
   business reference and QA guide.

## User's full input (file paths + additional instructions)
$ARGUMENTS

## Inputs

Which document(s), the scope (feature, screen, service, package or function), the doc folder with
prefix and feature name, and read access to the code. The business reference also needs the BRD,
the mockup or rendered screen, and any older business or QA documents. Ask once for what is
missing; never guess a path or invent a flow. Read the checklist, DB changes and architecture
first and open code surgically.

## Build it by executing the code

1. `node .playbook/scripts/doc-scaffold.mjs <developer-flow-guide|business-verification-reference>
   <out> --feature="<name>" --subject=<UI|Service/Job|Package|Mixed>` (it refuses to overwrite;
   an existing guide is updated with `/refresh-doc`).
2. Fill it one unit at a time (screen by screen, service by service). Confirm each row by running
   the path it describes, using the profile, `playbook-app-lifecycle.mjs` and small runners under
   `verification/<feature>/`: the screen, the API and the data must agree; a service run that
   should write rows and writes none is a defect. Name real identifiers in backticks; mark a row
   `[VERIFY — not found in code]` only when the code cannot be found.
3. A defect found while building is added to the existing checklist as a fix item in the template
   shape (source: this guide build), and the guide marks the value
   `[KNOWN ISSUE — see <item-id>]`.
4. The business reference names no SQL, code, file, procedure or table; storage is "the
   application database". Every source row names its portal path, and a mapping table is required
   whenever values from several sources are normalised.

## Finish

`node .playbook/scripts/doc-check.mjs <doc> --size=<checklist size>` and
`node .playbook/scripts/doc-drift.mjs <flow guide> --code=<code roots>` must pass. Report the
`[VERIFY]` marks and any checklist items added, recommend `/refresh-doc` (Mode B) after later code
changes, and offer `/generate-html` for the documents.
