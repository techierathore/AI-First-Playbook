---
description: Render human-readable Markdown documents to standalone HTML
---

Render the documents named in the input with
`node .playbook/scripts/render-docs.mjs <files or folders> [--overwrite]`.

## User's full input
$ARGUMENTS

- Pass `--overwrite` only when the user asked to replace existing pages; otherwise existing
  `.html` files are kept and listed as skipped.
- The script never renders checklists, Issues files or other agent documents; add
  `--include-agent-docs` only on the user's explicit, repeated request.
- The Markdown files are not changed. Report the rendered and skipped lists the script prints.
