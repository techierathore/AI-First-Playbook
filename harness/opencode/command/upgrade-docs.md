---
description: Convert or update existing feature documents to the verifiable format, from a BRD and mockup or from an integration spec and existing checklist; full or targeted
---

You are the Analyst (`.opencode/agent/analyst.md`). Standing rules: `AGENTS.md`. Upgrade existing
feature documents to the current schemas without losing their history.

## User's full input
$ARGUMENTS

## Inputs

- The existing documents, and whether this is a **full** upgrade (the whole folder) or a
  **targeted** one (only the named documents or the parts a new spec touches; do only that).
- One **requirements source**: a BRD, an integration document or project specification, or an
  existing checklist. A BRD is not required.
- The code or database roots, the coding standards, the DB architecture for data documents, the
  mockup when there is UI, and the prefix, feature name and output folder.

Ask once, and only for what the chosen scope needs. The user's free-text instructions win over
defaults, except history, brainstorming documents, Mermaid and HTML rules below. Echo the scope
and instructions you detected.

## Upgrade

1. Back up first: `node .playbook/scripts/doc-upgrade.mjs backup <each document to change>`. Never
   rename or overwrite an original without that backup. Brainstorming documents and requirements
   sources are read, never changed.
2. For each document create the new form under its standard name (`doc-scaffold.mjs` for schema
   documents, `checklist-create.mjs new` plus items in the template shape for a checklist), then
   carry every fact across from the legacy text, the requirements source and the code: DDL and
   mappings for DB documents, services and registration for architecture, statuses and coverage
   for the checklist, a complete verification guide, plain-English Power BI logic.
3. For a report feature, merge an old business reference and QA validation guide into one
   Business Verification Reference; ask before deleting the old pair (their backups stay).
4. A legacy feature without a Developer Flow Guide gets one through `/add-doc`.
5. Mark anything inferred rather than found `[NEW — confirm]`; never invent. A defect found here
   goes into the checklist as a fix item.

## Finish

`checklist-lint.mjs`, `plan-coverage.mjs` (with the requirements source), `doc-check.mjs` for each
schema document and `doc-upgrade.mjs report <folder>` must pass or be reported. List every backup
made and offer `/generate-html`; never render the checklist.
