---
description: Update Context-Prompt.md to reflect recent changes to the AI-first development process
model: anthropic/claude-haiku-4-5
---

You are a documentation maintainer. Your job is to keep `Context-Prompt.md`
in sync with the current state of the AI-first development process. **No BMAD
persona needed** — this is a careful sync task, not an authoring task.

## User's full input
$ARGUMENTS

## How to parse the input
The user's input may contain:
1. **A summary of what changed** — e.g., "I added a new command /xyz" or
   "I changed how /verify handles Windows apps".
2. **Specific file paths** — e.g., `@.opencode/command/new-thing.md`.
3. **Nothing** — meaning "scan everything and detect what changed since the
   last update".

If the user's input is empty, ASK: "What changed since the last update? Tell
me briefly, or say 'scan everything' if you want a full sweep."

## Where to find current state
The authoritative state of the process lives in these files. Read them all:

Paths below assume the repo is mounted at `/app`; adjust to your own root.

1. `/app/Context-Prompt.md` — the current version (what you're updating)
2. `/app/.opencode/command/*.md` — all custom commands
3. `/app/.opencode/agent/verifier.md` — the Verifier agent
4. `/app/.opencode/command/<personas>/analyst.md` — the analyst persona, if
   your install uses one (its customization field is the key part)
5. `/app/.opencode/templates/doc-shell.html` — HTML template
6. Your team's long-form process doc, if you keep one (skim the table of
   contents and section headings only)
7. Your team's short-form usage / workflow guide (skim section headings)
8. Your team's token-efficiency guidance, if you keep one (skim headings)
9. The persona source-of-truth files, if your personas come from an upstream
   library — the customization block there must mirror the `.opencode` copy

## What to update in Context-Prompt.md

### Section 4: Command library
- Add any new commands that exist in `.opencode/command/` but are not yet
  listed.
- Remove any commands that no longer exist.
- Update purpose / when-to-use descriptions if they've drifted.

### Section 5: Workflows
- Add new workflows or update existing ones to match the Workflow sections
  of your team's usage guide.

### Section 6: Core principles
- Add new non-negotiable principles enforced by AGENTS.md or by commands.
- The principles list should match what's actually written in the commands —
  if a command says "ASK for missing inputs", that principle belongs here.

### Section 7: Critical files
- Add new files (commands, templates, agents) to the table.
- Remove deleted files.
- Update purposes if they've drifted.

### Section 8: Common gotchas
- Add any new failure mode you (the human) mentioned in $ARGUMENTS.
- Don't remove existing entries — they're institutional memory.

### Section 9: Conversation history
- APPEND a new numbered bullet for each notable change since the last update.
- Each entry: one or two sentences, written in past tense ("Added X
  because Y").
- Do NOT renumber or rewrite existing entries — they are the record.

### Section 10: How to evolve this process
- Usually no changes here unless the meta-process changed.

### Section at the bottom (Last updated line)
- Update the "_Last updated_" line to reflect the current state. Mention
  what was added in this update (one short sentence).

## How to detect changes when user says "scan everything"

Compare the lists in `Context-Prompt.md` to the actual filesystem:

```bash
# Commands currently in the system
ls -1 /app/.opencode/command/*.md | xargs -n1 basename | sort

# Compare to the list in Context-Prompt.md Section 4
grep -oE '`/[a-z-]+`' /app/Context-Prompt.md | sort -u
```

Identify additions and removals. For each one, determine its purpose by
reading its description line (`description:` field in frontmatter).

For workflows, look at the workflow headings in your team's usage guide:
```bash
grep -oE 'WORKFLOW [1-9]' <your-usage-guide> | sort -u
```

For principles, look for "Single source of truth" / "non-negotiable" /
"CRITICAL" callouts in your team's process documents.

## Rules

1. **Update in place** — use `edit` operations on `/app/Context-Prompt.md`,
   never rewrite the whole file with `write` (it's >300 lines and would risk
   the "Tool execution aborted" issue).
2. **Preserve formatting** — section numbering, table structures, callout
   boxes must remain consistent with the existing document.
3. **Don't invent history** — when adding to Section 9 (Conversation history),
   only record changes the user explicitly mentioned or that you can confirm
   from the filesystem. Do not speculate.
4. **No agent activation needed** — this command does not run any BMAD
   persona. It's a careful, mechanical sync task.
5. **Diff-and-confirm** — after each edit operation, summarize what you
   changed. Don't do many edits silently.

## When done

1. Show a summary of what changed:
   - Commands added/removed in Section 4
   - Workflows updated in Section 5
   - Principles added in Section 6
   - Files added/removed in Section 7
   - Gotchas appended in Section 8
   - New history entries appended in Section 9
2. Remind the user: "If you also want your long-form process docs updated to
   match, those are separate manual edits — this command only syncs
   `Context-Prompt.md`."
3. Suggest committing the updated `Context-Prompt.md` if you're using git.
