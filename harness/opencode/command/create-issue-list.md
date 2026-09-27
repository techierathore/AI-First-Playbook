---
description: Create a structured Issues markdown file from Jira tickets or manual input
---

Act as the Analyst (`.opencode/agent/analyst.md`). Produce an Issues file for `/analyze-fix`.

## User's full input
$ARGUMENTS

1. Ask once for the output path if none is given (`docs/<feature>/<Feature>-Issues.md`).
2. Jira keys or browse URLs:
   `node .playbook/scripts/jira-issues.mjs fetch <KEY|URL>... --out=verification/runs/<run-id>/jira.json`.
   Credentials come from the environment references or the protected file the script names; on
   `BLOCKED`, tell the user which to set and stop the Jira part. Never ask for or handle a token.
3. Plain-text bugs or an existing bug list: write the same JSON shape yourself (`key`, `title`,
   `expected`, `actual`, `steps[]`, `severity`), using only facts the user gave; leave the rest
   `null`.
4. `node .playbook/scripts/issues-file.mjs render <issues.json> --out=<path> --feature="<name>"`,
   then `node .playbook/scripts/issues-file.mjs validate <path> --keys=<every requested key>`.
5. Report the path, the counts (Jira, manual, fields left `[MISSING]`), each failed fetch as
   printed, and the next step: `/analyze-fix <path> <checklist>`.
