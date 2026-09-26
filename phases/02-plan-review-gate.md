# Phase 2 — Plan Review Gate

**Driven by:** a human (you) · **Type: GATE**

Before any code is written, a human reviews the planned document set. This is the
highest-leverage moment in the whole lifecycle:

> Catching a missing requirement in a document costs 2 minutes.
> Catching it after code is built costs tokens and hours.

## Gate checklist

`node .playbook/scripts/gate-check.mjs plan-review <checklist> --requirements=<BRD>
[--handoff=<plan-approval record>]` checks that every requirement and screen maps to an item,
that every item lints (including a concrete Verify method) and that the approval is recorded.
It prints READY or each blocker. The reviewer still judges:

- [ ] Every cross-cutting rule (logging, error handling, coding standards, UI fidelity)
      has an **acceptance criterion**, not just a mention.
- [ ] Document names follow the project convention; output folder and prefix are right.

## Mechanics

Open the generated HTML versions in a browser (or read the markdown), and request
changes **in the same chat** that ran `/feature-plan`. Loop until approved.

Gaps found → back to [Phase 1](01-plan.md). Approved → [Phase 3 — Build](03-build.md).
