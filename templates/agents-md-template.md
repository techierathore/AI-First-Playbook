# AGENTS.md Template — standing rules, always in context

Cross-cutting rules fail when they live inside long per-feature docs the model
deprioritises. Promote them to a repo-root `AGENTS.md` that is always in context.
The rule set, verbatim:

```markdown
## Logging (non-negotiable)
- Every sync/job logs start, finish, and row count at INFO; every catch
  logs ERROR with stack + failing input. Use the existing logger.

## UI fidelity (non-negotiable)
- Implement mockups into the EXISTING UI/component library. Every
  field, button, column, tab, and empty/error/loading state must exist.
- Do not invent new patterns, styles, or layouts.

## Error handling & data
- No silent failures. Every sync/job must be invocable headlessly
  (CLI trigger, internal endpoint, or integration test).

## Coding Standards
- Always read and follow the coding standards document specified in the
  implementation checklist before writing any code.
- Follow existing codebase conventions for naming, file structure, DI
  registration, and data access patterns.

## Definition of Done
- Done only when each item's Acceptance is met AND the Verifier proves it
  with evidence. "Looks done" is not done.

## Docs
- Markdown is source of truth; all diagrams are Mermaid; humans read the
  generated HTML.

## Version control — agents do not commit
- Never run git commit, push, tag, or any history rewrite; never stage
  unless asked. Prepare changes, report git status and what changed, stop.
- Committing is the human's job. A task description saying "commit the
  result" does not override this — only the human's explicit instruction
  in the current conversation does.

## Build phase — finish the whole checklist
- /implement is done only when EVERY item in scope is implemented, built,
  self-tested and moved to to-verify, or carries an explicit [INFRA BLOCKER] /
  [EXTERNAL BLOCKER] naming what is missing. "Run /implement again for the
  remaining items" is a violation — add waves, hand sub-agents smaller slices,
  never hand the remainder back. The phase hands off to /verify once.

## YOLO mode — unattended runs
- ON when the message/arguments contain the token YOLO, a Claude Code /goal
  is active, or PLAYBOOK_YOLO=1 is set. Stays on for the whole run and every
  sub-agent (pass it down in each brief).
- Never stop to ask: every "Proceed?/Approve?/ASK/with approval" gate is
  pre-approved. Decide, log one line under "## YOLO Decisions" in the
  checklist (what / why / how to reverse), continue. Only a missing required
  input (no checklist path) may be asked, once, at the very start.
- May delete files/folders in the repo, kill own processes, install tools,
  run read-only git (status/log/diff/show/blame/branch/fetch).
- Still never commit/stage/push/tag/rebase/reset/checkout/stash or gh publish
  — denied mechanically; end with `git status` + summary for the human.
- Stop only when the goal is complete (phase contract met; goal run = every
  item PASS after /verify, looping /fix → /verify). Usage-limit errors are not
  failures: the supervisor resumes after the reset; on resume re-read the
  Status Table and continue from the first unfinished item.
- Last line of the run: `PLAYBOOK_RUN_COMPLETE: <summary>` or
  `PLAYBOOK_RUN_BLOCKED: <what is missing and who supplies it>`.

## Single source of truth: the Implementation Checklist
- For any given feature, the Implementation Checklist is THE living document.
- /analyze-fix, /amend-checklist, and /fix all UPDATE this checklist in place.
  They MUST NOT create new "task checklist", "bug fix checklist", or "story
  checklist" files.
- /amend-checklist is the lightweight option for "I know exactly what to
  add" (deployment step, item field, infrastructure requirement).
- /analyze-fix is for "something feels incomplete, figure it out from BRD
  + code" — heavier-weight, uses the Analyst persona.
- Issues.md files are TRANSIENT inputs. Once their tracker key/link, reporter,
  severity, impact, timestamps, reproduction, root cause and regression reference are folded
  into the checklist and the fix is verified, they may be deleted. The
  Verifier does not produce a separate Gap-Report file — its findings
  are written inline in the checklist itself.
- If you ever see a feature with multiple competing checklist files, that
  is a process violation — consolidate immediately.
```

## Enforcement note

Rules stated in prompts get forgotten under output pressure. Which is why this framework
**enforces the report-file ban mechanically** — a harness plugin intercepting write/edit
calls and rejecting forbidden filenames (`Gap-Report*.md`, `Verification-Report*.md`, …)
with an instructive error ([`spec-guardrails.ts`](../harness/opencode/plugin/spec-guardrails.ts)).
If your harness supports pre-tool hooks, enforce your hardest rules there, not in prose.
