# Phase 10 — Production Bugs

**Path:** `/analyze-fix` → `/fix` → `/verify` → redeploy

User-reported bugs after deployment follow **exactly the same loop as
[Phase 9](09-post-verification-bugs.md)** — production is just a later discovery point
for the same class of escape:

1. Log the bug(s) in a transient Issues file (`/create-issue-list` can pull them straight
   from Jira with full fields, parsing descriptions into Expected / Actual / Steps).
2. `/analyze-fix` — root cause, why verification missed it, checklist patch.
3. Human review → `/fix` → `/verify` until ALL PASS.
4. Redeploy. Delete the Issues file.

## The long game

The implementation checklist **accumulates every real-world failure as a verifiable
item**. Over months, that means:

- The same class of bug cannot recur without turning up as a FAIL on the next `/verify`.
- The checklist grows — which is why `/archive-checklist` exists: once a checklist
  crosses ~2,000 lines with 30+ PASS items, rotate verified items into a compact
  `## Verified History` section (restorable), keeping active context small and token
  costs sane.
- For **legacy modules** that predate the process, the same machinery runs as a one-time
  audit: upgrade the docs to the verifiable format (`/upgrade-docs`), run a first
  `/verify` as a discovery exercise ("expect significant gaps beyond what QA found"),
  then the standard fix loop. One large effort upfront, years of avoided bug tickets.
