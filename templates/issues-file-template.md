# Issues File Template (transient input)

Created by `/create-issue-list` (from Jira) or written by hand; consumed by
`/analyze-fix`, which folds every issue into the existing implementation checklist —
then the file is **deleted**. It is an input, never a record.

```markdown
# <Feature> - Post-Verification Issues

## Issue 1: <short title>
- **Expected**: <what should happen>
- **Actual**: <what happens instead>
- **Steps**: <numbered steps to reproduce>
- **Severity**: High | Medium | Low

## Issue 2: <short title>
- **Expected**: Export respects the active date filter
- **Actual**: Export always contains the full unfiltered dataset
- **Steps**: 1. Open the report  2. Set a date filter  3. Click Export
- **Severity**: Medium
```

## Pulling from Jira

`/create-issue-list PROJ-1234 PROJ-1235` (keys, URLs, or mixed with manual additions)
reads credentials from a gitignored `.atlassian-config.json`, calls the Jira REST API
directly with `curl` (a deliberate design choice over an MCP server — leaner, no context
pollution, full API access), parses the description into plain markdown, and structures
each ticket into the Expected / Actual / Steps format above. The API token is never
echoed or logged. It can also restructure an existing unstructured bug-list file into
this format.
