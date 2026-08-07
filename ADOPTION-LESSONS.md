# Adoption Lessons — the 2-of-15 stall

This playbook was not a thought experiment. It ran in production at a mid-size
engineering org on a real multi-cloud product: features were planned, built, verified,
and shipped through it, and its 42 documented "gotchas" were all learned the hard way.

And yet: offered to a team of ~15 developers, **only 2 adopted it**.

This file is the honest post-mortem. It exists because the stall was *not* caused by the
tooling — and if you copy this repo without reading this file, you will likely repeat it.

## What actually happened

- The process owner built the framework, used it daily, and kept improving it. For the
  owner it worked: verification caught real bugs, escaped bugs tightened the checklist,
  docs stayed current.
- The team received two excellent artifacts: a design-spec Playbook (why + architecture)
  and a Team Workflow Guide (every command, four workflows, cheat sheets, real examples).
- Almost nobody crossed the gap from *reading about the process* to *running their first
  feature through it*.

## Diagnosis: enablement, not tooling

Looking at the artifacts themselves, the gap is visible in hindsight:

1. **There was a setup runbook, but no people runbook.** The rollout section covered
   machines — commit these files, start Playwright MCP, smoke-test the Verifier. Nothing
   covered humans: no "your first feature, paired with the owner", no graduated on-ramp
   (start with `/generate-html` or `/create-issue-list`, not a full `/feature-plan`
   lifecycle), no scheduled enablement sessions, no named champion per sub-team.
2. **The learning curve was absorbed by one person and never repackaged.** The owner's
   context file accumulated 42 numbered war stories. Teammates faced the same cliffs
   without that scar tissue — and the first bad experience with a stalled `/verify` or a
   bloated checklist ended their experiment.
3. **Documentation was mistaken for enablement.** Two polished HTML guides feel like a
   rollout. They aren't. A guide answers questions people ask *after* they're invested;
   it doesn't create the investment.
4. **Nothing measured adoption, so the stall was invisible until it was total.** No
   definition of "adopted" (e.g. "ran one feature end-to-end through the loop"), no
   check-ins, no feedback channel that fed teammate friction back into the framework the
   way the owner's own friction fed the 42 gotchas.
5. **Token anxiety was answered for the owner, not the team.** A token-efficiency guide
   existed, but daily users mostly saw that the process spawns parallel agents and writes
   many documents — and nobody's first question ("will I get blamed for the bill?") was
   answered up front.

## What we'd do differently (and what the team edition should ship)

- **Enablement is part of the framework, not an afterthought.** An `onboarding/` track:
  first-day setup, first-week ladder (mechanical commands → assisted feature → solo
  feature), paired first feature with the process owner.
- **Define and measure "adopted".** One metric: developers who have taken a feature from
  `/feature-plan` to ALL PASS unassisted. Review it weekly for the first two months.
- **Budget the owner's time for enablement.** Roughly: for every day spent building the
  framework, plan a day of sitting with teammates while they use it.
- **Make the first experience small and guaranteed to succeed.** Nobody's first contact
  should be a 4,000-line checklist on a legacy module.
- **Close the loop on teammate friction.** Every stall or complaint becomes a framework
  issue, the same way every escaped bug becomes a checklist item. The process already
  knew how to learn from bugs; it never learned from non-adoption.

## The general lesson

A verification-first AI process fixes the *AI's* failure mode (declaring itself done
without proof). Team adoption fails on the *human* side for the same structural reason:
we declared the rollout done without proof. **Enablement needs its own verification
loop.**
