# Issues File Template (transient input)
<!-- template-schema: {"produces":"docs/<feature>/<Name>-Issues.md","required":["Title","lifecycle","repeated issues","ingestion"],"optional":["Jira metadata","attachments","labels"],"budget":{"small":[180,280],"medium":[450,700],"large":[900,1400]},"rows":"One defect; Expected, Actual, Steps, Severity; ordered reproduction."} -->

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
runs `jira-issues.mjs`, which reads credentials from the environment references
`JIRA_BASE_URL`, `JIRA_EMAIL` and `JIRA_API_TOKEN` or a protected untracked file named by
`JIRA_CONFIG`, converts each description to Markdown and splits it into Expected / Actual
/ Steps. `issues-file.mjs render` writes this format and `validate` checks it. The token
is never printed. It can also restructure an existing unstructured bug-list file.
