# Enablement — why team rollouts stall, and what to do instead

Everything else in this repo is about fixing the *AI's* failure mode: an agent that
implements a checklist and then declares itself done without proof. The fix is structural —
move verification into the system and make it produce evidence.

This file is about the failure mode nobody builds for: **a team that reads about the
process and never runs it.**

It is the most likely way a framework like this dies in your organisation, and it looks
nothing like a tooling problem. The commands work. The Verifier catches real bugs. The
guides are good. And adoption sits at one or two people — the ones who built it — while
everyone else keeps working the way they always did.

If you are the process owner, read this before you roll anything out. The five sections
below are the structural reasons the gap opens, and each one has a cheaper fix than the
one you'll reach for after six months of nobody using it.

## 1. A setup runbook is not a people runbook

Rollout instructions almost always cover **machines**: commit these files, start Playwright
MCP, smoke-test the Verifier, here's the command list. All necessary. None of it moves a
person from *reading about the process* to *running their first feature through it* — which
is the only transition that matters.

What's missing is the people half: a paired first feature with the owner, a graduated
on-ramp that starts with a mechanical command rather than a full lifecycle, scheduled
enablement time, and a named champion per sub-team who is not you.

**Fix:** [`onboarding/first-week.md`](onboarding/first-week.md) — five rungs, roughly six
hours of the newcomer's time and four of yours.

## 2. The learning curve gets absorbed by one person and never repackaged

The owner of a framework like this accumulates scar tissue fast — every stalled run, every
bloated checklist, every place the agent reached for the wrong exit. That knowledge tends
to live in the owner's head and in a private context file that nobody else reads.

Teammates then hit the exact same cliffs with none of the context. And the first bad
experience — a `/verify` that comes back BLOCKED for a reason they can't interpret, a
4,000-line checklist that makes every command slow — ends the experiment. They don't file a
complaint; they just quietly stop.

**Fix:** write the cliffs down as a table of *symptom → what's happening → what to say*,
and hand it over before they hit them, not after. There's a starter version in
[`onboarding/first-week.md`](onboarding/first-week.md#cliffs-they-will-hit-in-week-one).
Add to it every time someone gets stuck.

## 3. Documentation gets mistaken for enablement

Two polished guides feel like a rollout. They aren't one.

A guide answers the questions people ask *after* they're invested. It does not create the
investment. Producing excellent documentation and then waiting is the single most common
way a good internal framework reaches an audience of one — because it feels like the work
is done, and the feedback that would say otherwise never arrives.

**Fix:** treat every hour of guide-writing as owing an hour of sitting next to someone
while they use it. Roughly: for every day spent building the framework, plan a day of
enablement.

## 4. Nothing measures adoption, so the stall is invisible until it's total

Without a definition of "adopted", slow adoption and zero adoption look identical from the
inside. You find out at the six-month mark, when the answer is no longer recoverable by a
small correction.

**Fix:** define it as a single observable thing — *a developer who has taken one feature
from `/feature-plan` to ALL PASS unassisted* — keep a list of names and dates, and review
it weekly for the first two months. Not "attended the session". Not "read the guide". One
feature, unassisted, verified. If a name has been stuck at the same rung for three weeks,
that's a signal about your framework or your time budget, not about the person.

## 5. The cost question goes unanswered for everyone except the owner

The owner knows what a run costs, because they watched it accrue. Nobody else does. What a
teammate sees is a process that spawns parallel sub-agents and writes many documents, and
their first question is never about architecture — it's *"will I get blamed for the bill?"*

If that goes unanswered, people don't argue. They opt out, and they give a different reason.

**Fix:** answer it unprompted on day one. Which commands are cheap (all the mechanical
ones), which are expensive (`/feature-plan`, `/implement`, `/verify`), and what the levers
are (archive the checklist first; give each sub-agent only its slice). There's a cost table
per command in [`templates/commands/README.md`](templates/commands/README.md).

## Make the first experience small and guaranteed to succeed

Underneath all five: nobody's first contact with this process should be a 4,000-line
checklist on a legacy module. That is the highest-leverage decision in the whole rollout,
and it costs nothing to get right.

Start someone on `/generate-html` — mechanical, no persona, cheap, and it produces
something they can open in a browser thirty seconds later. Only then work up to a feature.

## Close the loop on friction

The process already knows how to learn from failure: every bug that escapes `/verify` gets
root-caused, and the checklist is patched so that class of bug becomes a FAIL next time.
That loop is why the framework gets better instead of just older.

Apply the identical discipline to people. Every stall, complaint, or confused question in
someone's first week becomes a change to the framework — a clearer command prompt, another
standing rule in `AGENTS.md`, another row in the cliffs table.

**Enablement needs its own verification loop.**
[`onboarding/first-week.md`](onboarding/first-week.md) is the checklist, the adoption metric
is the verify step, and teammate friction is the FAIL annotation.
