---
description: Analyze a user story or bug report and fold the findings into the existing implementation checklist
---

You are the Analyst (`.opencode/agent/analyst.md`). Fold the findings of a user story, bug
report, Issues file or legacy gap report into the existing implementation checklist — the single
living source of truth. Standing rules: `AGENTS.md`.

## User's full input
$ARGUMENTS

## Inputs

The source(s) to analyze, the project paths involved and the coding standards; ask once for
what is missing. Update the existing checklist in place; never create a bug-fix, task or story
checklist. Only when no checklist exists for the feature, ask whether to create one.

## Cases

Locate the checklist with `node .playbook/scripts/feature-context.mjs locate <feature folder>`.

**A. Bug found before or during build.** `node .playbook/scripts/checklist-ingest.mjs bug
<checklist> <Issues file>` adds one `### Issue:` block per issue; fill its `Root cause:` and
`Affected items:`. Reopen a broken item or add a new one with `checklist-amend.mjs`.

**B. Bug that escaped verification.** Everything in A, plus for each bug:

1. Answer the four questions in order and stop at the first fixed response:
   spec clear? Playbook said it? a check existed and missed it? written and ignored?
2. Patch the checklist so a fresh `/verify` would fail on this exact bug: add the missing item,
   or strengthen the existing item's Verify line. If no executable check can catch it, mark the
   item `[REQUIRES MANUAL TESTING]`.
3. Record it, one issue at a time:
   `node .playbook/scripts/checklist-miss-coordinator.mjs open <checklist> <item-id>
   --miss-class=<value> --artifact=<value> --severity=<value> --why-missed=<value>
   --found-by=<human|production> --found-phase=<post-verification-bugs|production-bugs>
   --protocol=<answers, e.g. spec=yes,playbook=yes,check=yes> --harness=opencode`.
   `instruction-ignored` applies only when an agent had loaded the ignored rule.
4. Keep an escape table: `| Issue | Root cause | Why verification missed it | Checklist patch |`.

**C. Legacy audit (gap report plus Issues file).** Everything in B, plus: merge duplicates
citing both sources; mark code-audit false positives
`[FALSE POSITIVE — code-audit limitation, runtime is correct]` and drop them from the fix list;
mark failures only the audit found `[GAP — not user-reported, found by audit]`.

**D. User story.** `checklist-ingest.mjs story <checklist> <story file> --name="<story>"`; fill
Summary, Impact and Items, adding the items with `checklist-amend.mjs add`.

**E. Vague documentation gap.** Read the requirements, mockup, code, checklist and sibling
documents; reply with a gap analysis (missing items, missing sibling content, suggested edits)
and apply the edits after confirmation. Sibling documents are changed with `/refresh-doc`; an
exact, known edit belongs to `/amend-checklist`.

## Finish

`checklist-ingest.mjs validate <checklist> [<Issues file>]` and, when a requirements source is
involved, `plan-coverage.mjs` must pass. Flag sibling documents that need review. An Issues file
is deleted only when `escaped-bug-workflow.mjs status … --require-retire` passes.
