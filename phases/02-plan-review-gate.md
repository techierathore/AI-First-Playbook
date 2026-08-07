# Phase 2 — Plan Review Gate

**Driven by:** a human (you) · **Type: GATE**

Before any code is written, a human reviews the planned document set. This is the
highest-leverage moment in the whole lifecycle:

> Catching a missing requirement in a document costs 2 minutes.
> Catching it after code is built costs tokens and hours.

## Gate checklist

- [ ] The implementation checklist covers **every line of the BRD**.
- [ ] **Every mockup element** (field, button, column, tab, empty/error/loading state)
      maps to a checklist item.
- [ ] Every cross-cutting rule (logging, error handling, coding standards, UI fidelity)
      has an **acceptance criterion**, not just a mention.
- [ ] Checklist items are verifiable: each has a concrete **Verify** method a
      fresh-context agent could execute.
- [ ] Document names follow the project convention; output folder and prefix are right.

## Mechanics

Open the generated HTML versions in a browser (or read the markdown), and request
changes **in the same chat** that ran `/feature-plan`. Loop until approved.

Gaps found → back to [Phase 1](01-plan.md). Approved → [Phase 3 — Build](03-build.md).
