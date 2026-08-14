# Phase 10 — Production Bugs

**Path:** triage → `/analyze-fix` → `/fix` → `/verify` → release gate → redeploy

## Incident policy

| Severity | Target | Authority and communication |
|---|---|---|
| SEV1: outage, security incident, or material data loss | acknowledge 15 min; mitigate 1 hr | incident commander may rollback/hotfix; status updates every 30 min |
| SEV2: major workflow unavailable or broad customer impact | acknowledge 1 hr; mitigate 4 hrs | service owner may rollback; customer-support owner communicates |
| SEV3: degraded behavior or workaround exists | acknowledge 1 business day; fix next planned release | product owner prioritizes |
| SEV4: cosmetic or low impact | acknowledge 3 business days | normal backlog |

Preserve logs, traces, deployment metadata and the original reproduction before changing
anything. Record customer impact, detection time, owner, communications owner and rollback
authority. SEV1/SEV2 incidents require a postmortem within five business days; amend the
checklist when the root cause was not already covered by a passing requirement.

User-reported bugs after deployment follow **exactly the same loop as
[Phase 9](09-post-verification-bugs.md)** — production is just a later discovery point
for the same class of escape:

1. Log the bug(s) in the tracker and optionally a transient Issues file (`/create-issue-list` can pull them straight
   from Jira with full fields, parsing descriptions into Expected / Actual / Steps).
2. `/analyze-fix` — root cause, why verification missed it, checklist patch.
3. Human review → `/fix` → `/verify` until ALL PASS.
4. Pass the release readiness and post-deploy validation gates, then redeploy. Delete the
   transient file only after copying the tracker key/link, severity, impact, timestamps,
   root cause and regression-test reference into the checklist.

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
