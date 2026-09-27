---
description: Add or correct items, deployment steps, infrastructure requirements, or sections in an existing checklist when you spot a gap
---

Make the exact change the user names to an existing checklist. A vague request ("something is
off") goes to `/analyze-fix` instead. Ask once for the checklist path if it is missing.

## User's full input
$ARGUMENTS

State the planned changes and wait for approval, then make each with its script
(`node .playbook/scripts/<script>`):

| Change | Command |
|---|---|
| New item | write the fields to `verification/runs/<run-id>/item.json` (`title`, `Type`, `Behavior`, `Location`, `UI ref`, `Logging`, `Acceptance`, `Verify`, `Coding Standards`, `Depends on`, `owner`, `priority`, `risk`), then `checklist-amend.mjs add <checklist> --item=<item.json>` |
| One field of an item | `checklist-amend.mjs update <checklist> <ID> --field="<Field>" --value="<text>"` |
| Drop an item | `checklist-amend.mjs remove <checklist> <ID> --reason="<why>"` |
| Infrastructure | `checklist-infra.mjs add <checklist> --name=… --what=… --configured=… --setup=…` or `none` |
| Deployment step | `checklist-deploy.mjs add <checklist> --automated --title=… --command="…"` or `--manual --title=…`, or `none` |

A refusal writes nothing; fix the input and rerun, or report it. Report each change and the next
command the script prints, and name sibling documents that may need `/refresh-doc`.
