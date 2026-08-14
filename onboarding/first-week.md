# The First Week — an on-ramp for one developer

[Enablement.md](../Enablement.md) argues that a rollout of this framework fails
on enablement, not tooling — that the usual runbook covers machines and nothing covers
people. This file is the missing half.

**Scope:** one developer, one week, ending with them taking a small feature from
`/feature-plan` to ALL PASS without help. It is written for the **process owner** to run,
not for the newcomer to read alone — a document nobody walks you through is precisely the
thing that doesn't work.

> **If you skip everything else, don't skip this:** budget your own time. Roughly a day of
> sitting with someone for every day you spent building the framework. The ladder below is
> about 6–8 hours of the newcomer's week and about 4 of yours. If you can't spare that,
> onboard one person now rather than five people never.

## The ladder

The single biggest mistake available here is starting someone on a full `/feature-plan`
lifecycle against a legacy module. Each rung is small, ends in a visible win, and only then
adds surface area.

| Day | Rung | Time | They finish with |
|---|---|---|---|
| 1 | Setup + one mechanical command | 60–90 min | The harness working, one rendered HTML doc they made |
| 2 | Read a real checklist + run `/verify` on finished work | 60 min | Having watched the Verifier find something real |
| 3 | Assisted: `/analyze-fix` → `/fix` → `/verify` on a genuine bug | 2 hrs | One bug fixed and independently proven, with you beside them |
| 4 | Paired feature: you drive `/feature-plan`, they review the gate | 2 hrs | Understanding why the plan gate is the cheap one |
| 5 | Solo small feature, end to end | 2–3 hrs | **Adopted** (see the definition below) |

Days need not be consecutive. The order does matter.

---

### Day 1 — Setup, and one command that just works

Goal: the tooling is real and their first contact succeeds.

1. Install the harness with them watching, not beforehand — see
   [`harness/README.md`](../harness/README.md). They should see where the command files
   live, because the commands *are* the process.
2. Have them run **`/generate-html`** against an existing markdown doc in your repo.
   It is mechanical, activates no persona, costs almost nothing, and produces something
   they can open in a browser thirty seconds later.
3. Then run **`/create-issue-list`** against two or three real tickets.

Both commands are on the cheap end of the [cost table](../templates/commands/README.md).
That is deliberate: the first day should establish "this works and it's not scary",
not "this is powerful".

**Answer the money question now, unprompted.** Nobody's first question is about
architecture; it's *"will I get blamed for the token bill?"* Tell them the actual per-run
shape: the mechanical commands are trivial, `/feature-plan` and `/verify` are the expensive
ones, and the cost lever is archiving the checklist and giving each sub-agent only its
slice. Left unanswered, this question doesn't get argued — people just opt out and give a
different reason.

### Day 2 — Watch the Verifier work

Goal: they see the keystone before they have to operate it.

1. Walk them through a **real, finished** implementation checklist from your own work —
   preferably one with FAIL annotations still visible in its history. The inline
   `**Verifier Result**` lines with evidence are the whole idea in one screen.
2. Run **`/verify`** against a feature that is already done. Two outcomes are both fine:
   it comes back ALL PASS (they see what "proven" looks like), or it finds something you
   didn't know about (better).
3. Say out loud why the Verifier is a fresh-context agent that did not write the code, and
   why *"a 200 response with zero rows written is a FAIL"*.

Don't explain the ten phases yet. They'll meet them on day 4.

### Day 3 — Assisted: fix one real bug

Goal: their first complete loop, on something they care about, with you in the room.

Pick a bug that is genuinely theirs, genuinely small, and has a visible symptom.

1. `/analyze-fix` — folds the bug into the existing checklist with root-cause analysis.
   Stop and read the proposed patch together before approving it. This is where they learn
   that the checklist is the living document and that nothing gets a separate file.
2. `/fix` — fixes only the FAIL-annotated items.
3. `/verify` — the same command from day 2, now proving *their* change.

**Point at the feedback loop explicitly:** if this bug escaped a previous verify run,
`/analyze-fix` asks *why the Verifier missed it* and tightens the checklist so it can't
happen again. That loop is the reason the process gets better instead of just older.

### Day 4 — Paired: plan a feature together

Goal: understand the plan gate before it costs them anything.

1. You drive **`/feature-plan`** on a small upcoming feature; they watch, including the
   parts where the command refuses to guess and **asks** for a missing input.
2. They then review the generated document set as the human at the
   [plan-review gate](../phases/02-plan-review-gate.md) — and are expected to find
   something. Give them the frame: *cheap to fix a plan, expensive to fix built code.*
3. Skim the [ten phases](../phases/) together, now that eight of them have a memory
   attached.

### Day 5 — Solo: one small feature, end to end

Goal: the graduation run. You are available but not driving.

They take a genuinely small feature through `/feature-plan` → review → `/implement` →
`/verify` → `/fix` until ALL PASS. Small means: one screen or one service method, not a
module.

Two rules for you: don't take the keyboard, and don't rescue them from the cliffs below —
walk them through the fix instead, because that's the scar tissue transferring.

---

## Cliffs they will hit in week one

These are the moments where a first experiment dies. Every one of them is answered
somewhere in the artifacts, and none of them is discoverable at the moment it bites.

| What they see | What's happening | What to tell them |
|---|---|---|
| `/verify` marks things **BLOCKED** and stops | The agent hit an obstacle and reached for the nearest exit | The Verifier must answer five questions before BLOCKED is legal, and "no SQL access" / "can't run the app" / "can't run the Windows app" are explicitly forbidden. Re-run and make it show its work |
| A command keeps asking questions instead of doing the thing | Working as designed | Commands demand their inputs. Guessing was the old failure mode; the asking *is* the fix |
| `/verify` or `/implement` is slow and silent | Sub-agents run in child sessions | `tail -f` the checklist — items annotate as they finish. The file is the live progress view, not the chat |
| The checklist has become enormous and everything is slow | It's past ~2,000 lines | `/archive-checklist` rotates PASS items into Verified History. Do it *before* the next big run, not after |
| An HTML doc is out of date immediately | They generated HTML for the checklist | HTML is for human docs only. The checklist is an AI working document and its HTML goes stale on the next `/fix` |
| The agent wants to write a Gap-Report file | Trained behaviour, blocked at the tool layer | Findings go inline in the checklist. The plugin will reject the write; the error message says what to do instead |

## Define "adopted", then measure it

Without a definition, total non-adoption looks identical to slow adoption until it's too
late to correct cheaply.

**Definition:** a developer has adopted the process when they have taken **one feature from
`/feature-plan` to ALL PASS without assistance**. Not "attended the session". Not "read the
guide". One feature, unassisted, verified.

Track it as a list of names and dates. Review it weekly for the first two months. If a name
has been stuck at day 3 for three weeks, that's a signal about the framework or about your
time budget — not about the person.

## Close the loop on friction

Every stall, complaint, or confused question during someone's first week becomes a change
to the framework — a clearer command prompt, a new standing rule in `AGENTS.md`, another
row in the cliffs table above.

This is exactly the loop the process already runs on escaped bugs: every bug that gets past
`/verify` tightens the checklist so it cannot get past again. Applying that discipline to
code while never applying it to people is the asymmetry that sinks most rollouts.

**Enablement needs its own verification loop.** This file is the checklist; the adoption
metric is the verify step; teammate friction is the FAIL annotation.
