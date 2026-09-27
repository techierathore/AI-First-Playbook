---
description: Update Context-Prompt.md to reflect recent changes to the AI-first development process
---

Keep `Context-Prompt.md` in step with the process.

## User's full input
$ARGUMENTS

1. `node scripts/context-sync.mjs sync` rewrites the generated command block from the commands'
   `description:` lines; `node scripts/context-sync.mjs diff` must then exit 0. A command with no
   description or a dead file path is named: fix the source, not the primer.
2. Hand-written sections change only for what the user states in the input: append a gotcha or
   history line in past tense; never rewrite or renumber earlier ones.
3. Report the script's output and each hand edit.
