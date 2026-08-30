# Issues File Template (transient input)

Created by `/create-issue-list` (from Jira) or written by hand; consumed by
`/analyze-fix`, which folds every issue into the existing implementation checklist —
then the file is **deleted**. It is an input, never a record. Deletion is allowed only
after every issue has a linked `MISS-*` ID in the corresponding checklist item metadata.

```markdown
# <Feature> - Post-Verification Issues

## Issue 1: <short title>
- **Expected**: <what should happen>
- **Actual**: <what happens instead>
- **Steps**: <numbered steps to reproduce>
- **Severity**: High | Medium | Low
- **Why missed**: missing-checklist-item | insufficient-verify-method | code-audit-limitation | ambiguous-acceptance | dependency-not-declared | instruction-ignored | other
- **Miss ID**: MISS-YYYYMMDD-NN

## Issue 2: <short title>
- **Expected**: Export respects the active date filter
- **Actual**: Export always contains the full unfiltered dataset
- **Steps**: 1. Open the report  2. Set a date filter  3. Click Export
- **Severity**: Medium
- **Why missed**: insufficient-verify-method
- **Miss ID**: MISS-20260829-01
```

`Why missed` should normally be populated for post-verification and production issues.
Use `instruction-ignored` only when the origin was an agent that had loaded the ignored
written rule; never use it to classify a human. IDs are allocated with `open --if-new`, so
the field may contain the returned still-live collapsed ID. Telemetry failure never blocks
issue capture or changes a workflow verdict; leave the ID visibly pending and continue.

## Pulling from Jira

`/create-issue-list PROJ-1234 PROJ-1235` (keys, URLs, or mixed with manual additions)
reads credentials from a gitignored `jira-config.json`, calls the Jira REST API
directly with `curl` (a deliberate design choice over an MCP server — leaner, no context
pollution, full API access), parses the description into plain markdown, and structures
each ticket into the Expected / Actual / Steps format above. The API token is never
echoed or logged. It can also restructure an existing unstructured bug-list file into
this format.
