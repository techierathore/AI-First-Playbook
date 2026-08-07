# AGENTS.md Template — standing rules, always in context

Cross-cutting rules fail when they live inside long per-feature docs the model
deprioritises. Promote them to a repo-root `AGENTS.md` that is always in context.
This is the production rule set, verbatim (paths genericized):

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

## Single source of truth: the Implementation Checklist
- For any given feature, the Implementation Checklist is THE living document.
- /analyze-fix, /amend-checklist, and /fix all UPDATE this checklist in place.
  They MUST NOT create new "task checklist", "bug fix checklist", or "story
  checklist" files.
- /amend-checklist is the lightweight option for "I know exactly what to
  add" (deployment step, item field, infrastructure requirement).
- /analyze-fix is for "something feels incomplete, figure it out from BRD
  + code" — heavier-weight, uses the Analyst persona.
- Issues.md files are TRANSIENT inputs. Once their content is folded into
  the checklist and the fix is verified, they should be deleted. The
  Verifier does not produce a separate Gap-Report file — its findings
  are written inline in the checklist itself.
- If you ever see a feature with multiple competing checklist files, that
  is a process violation — consolidate immediately.
```

## Enforcement note (learned in production)

Rules stated in prompts get forgotten under output pressure. The production
implementation eventually **enforced the report-file ban mechanically** — a harness
plugin intercepting write/edit calls and rejecting forbidden filenames
(`Gap-Report*.md`, `Verification-Report*.md`, …) with an instructive error. If your
harness supports pre-tool hooks, enforce your hardest rules there, not in prose.
