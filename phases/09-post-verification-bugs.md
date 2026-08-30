# Phase 9 — Post-Verification Bugs — GATE

**Command:** `/analyze-fix` · **Persona:** Analyst · **Chat:** fresh

For bugs found in manual testing *after* the Verifier said ALL PASS. The defining move:
don't just fix the bug — **fix the checklist that let it escape.**

## The loop

1. **Log the bugs** in a transient Issues markdown file — pulled from your tracker via
   `/create-issue-list`, or written manually
   ([template](../templates/issues-file-template.md): per-issue Expected / Actual /
   Steps / Severity / linked Miss ID).
2. **`/analyze-fix`** with the Issues file + the existing checklist + the associated
   projects. Tell the analyst these bugs **escaped the Verifier**. For each bug it
   produces:
   - the root cause;
   - **why the Verifier missed it** — missing checklist item? insufficient Verify
     method? code-audit limitation?;
   - a checklist patch: new/updated items whose Verify methods **would have caught this
     bug**, folded into the existing checklist (never a new file);
   - flags on sibling docs needing updates.
3. **Human review** of the updated checklist ("Verification Gap Analysis") — check the
   new Verify methods would actually catch the bug.
4. **`/fix`** → **`/verify`** (now includes the new items) → loop until ALL PASS.
5. Re-test manually, accept, and delete the transient Issues file only after its tracker key,
   reporter, severity, customer impact, timestamps, reproduction, root cause and regression
   reference are copied into the checklist **and every issue has a `MISS-*` ID linked in the
   corresponding checklist item metadata**.

Every issue is recorded serially with `open --if-new`; `why_missed` is normally populated
from the Verification Gap Analysis. `instruction-ignored` is legal only when the origin was
an agent that had loaded the ignored written rule, never for a human. Telemetry is
fire-and-forget and never changes analysis, fix, verification, or release verdicts.

## Why this makes the process better over time

The checklist becomes a comprehensive regression contract. *"The Verifier gets better
not because the model improves, but because the specification it verifies against
improves."* Every missed bug tightens the checklist for the next run — the same class of
bug cannot recur silently.
