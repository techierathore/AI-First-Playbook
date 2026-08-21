---
description: Create a structured Issues markdown file from Jira tickets or manual input
---
**IMPORTANT**: Before starting, activate the Analyst persona. See
`harness/README.md` → Personas. On a BMAD install that means reading and
following `.claude/agents/analyst.md`; any equivalent analyst
persona works.

You are the Analyst. Your job is to create a structured **Issues Markdown file**
that can be used as input for `/analyze-fix` or `/fix`.

## User's full input
$ARGUMENTS

## How to parse the input
The user's input will be ONE of (or a mix of):
1. **Jira issue keys or URLs** — e.g., `PROJ-1234 PROJ-1235` or
   `https://<your-jira-host>/browse/PROJ-1234`. You will fetch these
   directly from Jira using the REST API (see below).
2. **A list of bugs described in plain text** — the user describes the bugs
   directly in the prompt without Jira references.
3. **A reference to an existing markdown file** — e.g., `@path/to/raw-bugs.md`
   that already has some bug descriptions you need to restructure.

You can also receive a **mix** of these (some Jira keys + some plain-text bugs).
Handle all of them in a single output file.

---

## Fetching from Jira — direct REST API via bash

DO NOT use any MCP server for Jira. Use `curl` directly with the project's
`jira-config.json` file. This is leaner and avoids context bloat.

### Step 1: Locate the config file
The config file is typically at the **shared root folder** as
`jira-config.json`. If not provided in the user's input, search for it:
```bash
find . -maxdepth 3 -name "jira-config.json" -type f 2>/dev/null
```

If you cannot find it, **ASK** the user for the path to their
`jira-config.json` file. Do NOT proceed without it for Jira-based input.

### Step 2: Parse the config
The file structure is:
```json
{
  "baseUrl": "https://<your-jira-host>",
  "email": "<user>@<org>.com",
  "apiToken": "<api-token>",
  "confluence": {
    "apiBase": "/wiki/rest/api",
    "apiVersion": "v2"
  },
  "jira": {
    "apiBase": "/rest/api/3"
  }
}
```

Read the file with the `read` tool. Extract `baseUrl`, `email`, `apiToken`,
and `jira.apiBase`.

### Step 3: Fetch each Jira issue
For each issue key the user provided, run:
```bash
# Replace placeholders with values from the config + the issue key
  curl -s -H "Authorization: Bearer $JIRA_TOKEN" \
  -H "Accept: application/json" \
  "<baseUrl><jira.apiBase>/issue/<ISSUE-KEY>?fields=summary,description,priority,status,assignee,reporter,issuetype,labels,components,attachment"
```

Notes:
- Use `-s` to suppress progress output (keeps your context clean).
- The query string `?fields=...` limits the response size. If a field you
  need is missing, re-fetch without the filter for that specific issue.
- If the response is HTML or contains an error message, the credentials are
  wrong or the issue key is invalid. Report the failure and ask the user
  to verify their config.
- **NEVER echo or log the apiToken.** It only goes into the `-u` argument.

### Step 4: Extract from each issue's JSON
From the JSON response, extract:
- `key` — the issue key (e.g., `PROJ-1234`)
- `fields.summary` — the title
- `fields.description` — the description (Jira rich-text document format / ADF —
  see below for parsing)
- `fields.priority.name` — Priority (Highest / High / Medium / Low / Lowest)
- `fields.status.name` — Status (Open / In Progress / Done / etc.)
- `fields.assignee.displayName` — Who it's assigned to (or "Unassigned")
- `fields.reporter.displayName` — Who reported it
- `fields.issuetype.name` — Bug / Task / Story / etc.
- `fields.labels` — Array of labels
- `fields.components[].name` — Components
- `fields.attachment[]` — Attached files with `filename` and `content` URL

#### Parsing ADF descriptions
The `description` field in Jira REST API v3 uses Jira rich-text document format.
It is a JSON tree of `{type, content, text, ...}` nodes. Walk the tree and
extract plain text from all `text` nodes, preserving:
- Paragraph breaks from `paragraph` and `heading` type nodes
- Bullet structure from `bulletList` / `orderedList` / `listItem` nodes
- Code blocks from `codeBlock` type nodes (preserve language if present)

Render the result as plain markdown.

If parsing ADF is too complex for a given issue, fall back to including the
raw description JSON as a fenced code block in the output and flag it as
`[ADF — needs manual reformatting]`.

---

## Fetching from Jira via URL
If the user provides a Jira URL instead of a bare issue key:
```
https://<your-jira-host>/browse/PROJ-1234
https://<your-jira-host>/jira/software/projects/PROJ/boards/1?selectedIssue=PROJ-1234
```
Extract the issue key (the `PROJ-1234` part) and use the API method above.

---

## Progress reporting — keep the user informed

Fetching many Jira issues sequentially can take a while. Emit short
progress messages so the user sees motion.

**Announce in chat at these moments:**

1. **At the start**:
   ```
   ▶ /create-issue-list starting
     - Jira issues to fetch: <N>  (keys: PROJ-1234, PROJ-1235, …)
     - Manual issues from prompt: <M>
     - Existing file to restructure: <yes|no, path if yes>
     - Output: <path>
   Reading jira-config.json…
   ✓ Config OK; will call <baseUrl>/rest/api/3/
   ```

2. **Per Jira fetch** (one line per issue — Jira fetches are usually
   under 2s so one line is fine):
   ```
   ⏳ Fetching PROJ-1234… ✓ "<title>" (Bug, High)
   ⏳ Fetching PROJ-1235… ✓ "<title>" (Bug, Medium)
   ⏳ Fetching PROJ-1236… ✗ 404 (issue not found or no access)
   ```

3. **During ADF parsing**:
   ```
   ▶ Parsing Jira rich-text document format descriptions for <N> issues…
   ✓ Done — <K> needed manual reformatting flag
   ```

4. **At the end**:
   ```
   ✓ Issues file written: <path>
     - From Jira: <N>  (<successful>) / <failed>
     - Manual: <M>
     - Needs QA input (no steps): <K> — flagged in file
   Next: /analyze-fix @<output> @<projects> @<checklist>
   ```

---

## Output format
Create a markdown file at the path the user specifies. If not specified,
**ASK** for the output path. Name it: `<Prefix>-<Feature>-Issues.md` (e.g.,
`ImplDocs/CostDocs/Cost-Issues.md`).

Use this exact structure:

```markdown
# <Feature Name> - Issue List
Source: Jira (<count> issues) + Manual (<count> issues)
Generated: <today's date>
Related checklist: <path if known, else N/A>

## Summary
| # | Issue Key | Title | Severity | Status | Assignee |
|---|-----------|-------|----------|--------|----------|
| 1 | PROJ-1234 | <title> | High | Open | <name> |
| 2 | PROJ-1235 | <title> | Medium | Open | <name> |
| 3 | (manual) | <title> | High | N/A | N/A |

## Issue 1: <Title>
- **Jira**: [PROJ-1234](https://<your-jira-host>/browse/PROJ-1234)
- **Type**: Bug
- **Severity**: High
- **Status**: Open
- **Assignee**: <name>
- **Reporter**: <name>
- **Components**: <list>
- **Labels**: <list>

### Expected
What should happen (derived from issue description)

### Actual
What actually happens (derived from issue description)

### Steps to Reproduce
1. Step 1
2. Step 2
3. Step 3

### Attachments
- [screenshot1.png](<download url>)
- [logs.txt](<download url>)

### Raw Description (for reference)
> (Full description as it was in Jira, lightly formatted)

---

## Issue 2: <Title>
...
```

### When the Jira issue lacks structure
If a Jira issue's description doesn't clearly separate Expected / Actual / Steps:
- Put the entire description in the "Raw Description" section
- Make your best attempt to derive Expected, Actual, and Steps from it
- Mark any section you couldn't fill as `[STEPS NEEDED — ask QA <reporter name>]`

### For manual issues (no Jira key)
- Use `(manual)` in the Issue Key column
- Skip the Jira link, Assignee, Reporter, Components, Labels fields
- Use the same Expected / Actual / Steps structure

---

## Important rules
1. **Always read the jira-config.json file first** if any Jira keys/URLs
   are involved. Never hardcode credentials or guess them.
2. **Never put the apiToken in any output file or log it to terminal.** It
   only goes into the `-u "email:token"` argument for curl.
3. **Every issue MUST have Expected, Actual, and Steps to Reproduce** — even
   if you have to mark them as `[STEPS NEEDED]`.
4. **This file is usually short enough for a single write.** Do not use the
   edit-in-sections strategy unless you have more than ~30 issues.
5. **Validate** by counting: number of issue keys in user input should equal
   number of `## Issue N:` sections in the output.

---

## When done
Tell the user:
1. The path to the generated issues file
2. A summary: `<X> issues fetched from Jira, <Y> manual issues, <Z> need QA input`
3. The next step:
   ```
   /analyze-fix @<path>/<FeatureName>-Issues.md @<project-folders>/
   ```
4. Any issues flagged as `[STEPS NEEDED]` that should be filled in before
   running `/analyze-fix`.
