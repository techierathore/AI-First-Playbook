# /create-issue-list

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

- Reads credentials from a **gitignored** `jira-config.json` (baseUrl, email, API
  token). Direct REST calls via `curl` — a deliberate choice over an MCP server:
  leaner, no context pollution, full API access. The token is never echoed or logged.
- Pulls summary, description, priority, status, assignee, reporter, type, labels,
  components, attachments; parses the rich-text description into plain markdown;
  structures each ticket into **Expected / Actual / Steps / Severity**.
- The output file is transient: after `/analyze-fix` folds it into the checklist and the
  fix reaches ALL PASS, delete it.
