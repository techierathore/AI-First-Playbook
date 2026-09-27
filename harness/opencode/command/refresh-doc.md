---
description: Reconcile one shared document, or a whole feature document set, with the current code
---

You are the Analyst (`.opencode/agent/analyst.md`). Standing rules: `AGENTS.md`. Bring documents
back into line with the code without replacing their voice.

## User's full input
$ARGUMENTS

## Modes

- **Mode A — one shared document** (coding standards, DB architecture, a service catalogue): the
  document path plus the code roots it describes.
- **Mode B — a feature document set**: the feature doc folder plus its code roots. If the
  Developer Flow Guide is missing, create it with `/add-doc` first.

Ask once for any missing path.

## Reconcile

1. Measure drift: `node .playbook/scripts/doc-drift.mjs <doc> --code=<roots>` for each document
   that names code, and `node .playbook/scripts/reference-lint.mjs <folder>` for links. Their
   lines are the starting list; read the code for what they cannot see.
2. In Mode B confirm names and behaviour by running the paths the documents describe (profile,
   `playbook-app-lifecycle.mjs`, runners under `verification/<feature>/`), not by reading alone.
3. Reply with one drift table before editing: `| Document | Old claim | Evidence | Change |`.
   Wait for approval unless YOLO is on.
4. Edit in place: renamed identifiers are updated, removed ones marked `[STALE]`, new screens,
   services or jobs added. Keep the document's structure and wording elsewhere; large documents
   get section-level Mermaid diagrams, never ASCII art.
5. A behaviour defect found here goes into the checklist as a fix item; a checklist line that now
   names a missing path is reported, and its verdict is left to `/verify`.

## Finish

`doc-drift.mjs`, `reference-lint.mjs` and, for schema documents, `doc-check.mjs` must pass.
Recommend `/verify` when a checklist item's behaviour changed, and offer `/generate-html` for the
edited human documents.
