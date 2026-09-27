# /create-issue-list
<!-- template-schema: {"produces":"/create-issue-list issues file","required":["Contract","usage","sources","protected credentials","extraction","output","lifecycle"],"optional":["Manual items","attachments"],"budget":{"small":[150,220],"medium":[180,260],"large":[220,320]},"rows":"One ticket; preserve source ID; mark missing facts."} -->

**Persona:** Analyst · **Cost:** 🟡

Create a structured, transient Issues markdown file from Jira tickets or manual input —
the input format `/analyze-fix` consumes ([template](../issues-file-template.md)).

## Usage

```
/create-issue-list PROJ-1234 PROJ-1235 PROJ-1236
Output to docs/CostDocs/Cost-Issues.md

/create-issue-list @path/to/raw-bugs.md  Structure into Expected/Actual/Steps format
```

Accepts issue keys, full Jira URLs, or a mix with manual additions.

## Key behaviors

- `jira-issues.mjs` fetches the tickets; credentials come from the environment references
  `JIRA_BASE_URL`, `JIRA_EMAIL`, `JIRA_API_TOKEN` or a protected untracked file named by
  `JIRA_CONFIG` (mode 0600). The token is never printed or passed on a command line.
- The rich-text description becomes Markdown and is split into **Expected / Actual / Steps**;
  priority maps to **Severity**. `issues-file.mjs` renders and validates the file; a fact
  nobody supplied stays `[MISSING]`.
- The output file is transient: after `/analyze-fix` folds it into the checklist and the
  fix reaches ALL PASS, delete it.
