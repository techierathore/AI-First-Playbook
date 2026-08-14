# Phase 8 — Human Acceptance

**Driven by:** you / QA / BA — the final quality gate before deploy

The Verifier proves structure and execution; humans test what automated checks can't
reliably catch: **runtime behaviour, business-logic correctness, edge cases, timing
issues, cross-browser quirks, and usability.**

## What to do

1. Review the ALL-PASS checklist: Status Table, inline `**Verifier Result**:` evidence,
   Run Log.
2. Test manually using the feature's **Verification Guide** (deep technical steps for
   QA/dev) and — for report features — the **Business-Verification-Reference** (plain
   English: data sources with portal navigation paths, calculation logic, cross-cloud
   mapping tables; *"a layman must be able to verify any number with simple
   arithmetic"*).
3. Review the generated HTML docs if requested (human docs only — the checklist is
   never rendered).

## Durable gate record

The approver writes `acceptance.md` from [the handoff template](../templates/handoffs/acceptance.md)
in the feature folder or links the equivalent tracker record. Chat is evidence of discussion,
not the durable decision. The record includes producer, consumer, accountable approver,
identity, timestamp, scope, evidence links, exceptions and expiry.

## Outcomes

- **Accepted** → [Release readiness](../docs/Release-And-Operations.md). (Definition of Done: every item PASS with evidence; every
  mockup element present; every sync/job headlessly invocable with its target view
  populated; every data path returns data or logs why not; required logging fires; build
  and touched tests green; Status Table current; HTML docs current if requested.)
- **Bugs found** → this *will* happen sometimes, and the process expects it:
  [Phase 9 — Post-verification bugs](09-post-verification-bugs.md). Each escaped bug
  makes the next run stronger.
