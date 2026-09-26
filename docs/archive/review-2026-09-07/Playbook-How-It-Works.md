# How the Playbook Works

This is the plain-English tour. No YAML, no harness jargon. If you lead a team and have never
used an AI coding agent, you should be able to read this once and explain the process to a
colleague.

Read this first. The companion document, `Playbook-Reset-Plan.md`, is the engineering plan and
assumes you have read this one.

## The one idea

A developer asks an AI agent to build something. The agent says it is done. Nobody knows whether
it is. The Playbook's answer is: **write the requirement down in a form a second, independent
agent can prove or disprove by running the code** — then have that second agent do exactly that,
with no memory of the first one.

Everything else in the Playbook exists to make that one loop reliable.

## The vocabulary you need (five terms, one line each)

- **OpenCode** — the program the agents run inside. It is open source and works with several AI
  providers, which is why a corporate team can adopt it without betting on one vendor.
- **Command** — a slash instruction you type, like `/implement`. Behind each one is a file of
  instructions the agent reads before it starts.
- **Agent** — a role. The Playbook ships four: analyst, orchestrator, builder, verifier. Each is
  a file of instructions that sets what that role may and may not do.
- **The checklist** — one markdown file per feature, holding every requirement as a numbered
  item. It is the contract. Build works from it, verification scores against it, fixes are driven
  by its annotations. There is no second report file anywhere in the process.
- **Sub-agent** — a helper the main agent starts to work on part of the job in parallel. Build
  and verification both use them.

## What a team installs

You run one command in your project folder:

```
npx @techierathore/ai-first-playbook@latest install
```

It writes two hidden folders, `.opencode/` and `.playbook/`, and adds a few lines to your
`.gitignore`. Nothing else. Your project's own folders are untouched. Thirty-three files land in
total. `.opencode/` holds the fifteen commands, the four agents, and the guard plugins.
`.playbook/` holds the standing rules, the environment description you fill in, and three small
telemetry scripts.

Before your first run you replace the placeholders in `.playbook/environment-profile.yml` — your
build command, your test command, your ports, where your config lives. The agents are told never
to guess any of it.

## The ten phases

### Phase 1 — Plan

**You run:** `/feature-plan`. **Role:** analyst. **Fresh chat.**

You hand the analyst your business requirements document, a mockup of the screens if there is a
user interface, and the paths to your coding-standards and database-architecture documents. The
defining behaviour of this command is that it **asks for anything it is missing rather than
inventing it**. What comes back is a set of documents: database changes, architecture, guides for
QA and for the business — and the one that matters most, the implementation checklist. Every item
in the checklist is written in a fixed seven-field shape (behaviour, location, screen reference,
logging, acceptance, how to verify, which coding standard applies), taken from
`templates/checklist-item-template.md`. OpenCode's part here is small: it loads the analyst role,
the standing rules, and the command file, then gets out of the way while the analyst writes files.

### Phase 2 — Plan review gate

**You run:** nothing. **A human reads.** **This is a gate.**

You read the plan before a line of code exists. Four questions: does the checklist cover every
line of the requirements document; does every element of the mockup — every field, button,
column, tab, and empty or error state — appear as a checklist item; does every cross-cutting rule
have an acceptance condition rather than just a mention; and could a fresh agent actually execute
the "verify" line on each item. You send corrections back into the same chat and loop until you
approve. The Playbook is blunt about why this gate is worth your time: a missing requirement
caught here costs two minutes; caught after the code is built it costs hours and money. OpenCode
does nothing in this phase — it is you, reading.

### Phase 3 — Build

**You run:** `/implement`. **Role:** orchestrator. **Fresh chat.**

The orchestrator is a coordinator, not a typist. It reads the approved checklist, groups the
items into waves by which files they touch, shows you the wave plan, and then starts several
**builder** sub-agents at once — typically four to six — each given only its own slice of the
checklist rather than the whole thing. Cross-cutting edits, such as dependency registration or
one shared configuration file, are collapsed into a single item so two parallel agents can never
fight over the same file. The phase has a hard completion rule: it ends when **every** item in
scope is built or is explicitly tagged as blocked by something outside the team, naming who must
supply it. Handing back "I did items one to nine, run me again for ten to nineteen" is named a
violation, not a status update. OpenCode supplies the parallelism through its task tool, and a
guard plugin refuses any attempt to write to git history.

### Phase 4 — Self-review

**You run:** nothing separately — it happens inside `/implement`. **Role:** orchestrator.

Before the orchestrator declares itself done it re-reads the checklist against its own changes
and then proves the thing actually runs: build every project it touched, start the applications,
call each new endpoint once and check the response, **query the real database** for anything that
was supposed to write data, take one browser snapshot per new screen, and grep the logs for the
lines the checklist required. The rule that earns its place here is one sentence: *a 200 response
with no data written is a failure, not a pass.* The orchestrator then stops anything it started
and reports a smoke-test summary. This is a cheap catch, not a substitute — the independent audit
still comes next.

### Phase 5 — Verify

**You run:** `/verify`. **Role:** verifier. **Fresh chat, and this one is enforced.**

This is the keystone. `/verify` is the only command that names a specific agent and runs it as a
separate task with no memory of the build, so the agent auditing the work has no reason to
believe it was done well. It reads the checklist's deployment steps first and asks before running
each automated one — which removes the classic "did anyone remember to run the migration?"
failure. Then it checks which tools actually exist on the machine rather than assuming, reads
your real configuration rather than inventing connection strings, drives the browser against the
running application for screen items, and for data items follows a five-step path: find the real
connection, find how the job is triggered, run it for real, count the rows that landed, and prove
the required log lines fired. It may write in exactly two places: annotations inside the
checklist, and a `verification/` folder for the small test programs it writes. Everything else is
blocked mechanically, not merely discouraged.

### Phase 6 — Verification results gate

**You run:** nothing — this is what `/verify` produces. **This is a gate.**

There is no separate report. Each checklist item gets a result line with the evidence behind it:
`PASS`, `FAIL`, `PASS (code-audit)`, `FAIL (code-audit)`, `DATA-GAP`, or `BLOCKED`. `DATA-GAP`
means the behaviour could not be exercised because the test data was not there — it never quietly
counts as a pass. The checklist's status table is brought in line with reality and a run-log
entry is appended, keeping the history of every run. A plugin blocks any attempt to create a file
named like a gap report or a verification report; that rule became mechanical because three
rounds of louder wording in the prompt did not stop it happening.

### Phase 7 — Fix

**You run:** `/fix`. **Role:** orchestrator. **Same or fresh chat.**

`/fix` works only on the items annotated `FAIL`. It reads the annotations straight out of the
checklist — no gap report is created or accepted as input — groups the failures into parallel
waves the same way the build phase does, applies the fixes, and runs the same build-and-smoke
self-check before declaring done. It updates the checklist in place. It never creates a second
checklist file. Then you run `/verify` again. The loop is `/fix` → `/verify` → `/fix` → `/verify`
until every item passes.

### Phase 8 — Human acceptance

**You run:** nothing. **You, QA, or a business analyst test by hand.** **This is a gate.**

The verifier proves that the code runs and does what the checklist said. People test what
automated checks are bad at: whether the business logic is actually right, edge cases, timing,
browser quirks, and whether the thing is pleasant to use. You work from the feature's verification
guide, and for reporting features from the business verification reference, which is written so
that someone non-technical can re-derive any number on the screen with simple arithmetic. The
approver then writes a short acceptance record from `templates/handoffs/acceptance.md` — a chat
message is a discussion, not a decision.

### Phase 9 — Post-verification bugs

**You run:** `/analyze-fix`. **Role:** analyst. **Fresh chat. This is a gate.**

Sometimes a bug survives all of that. The Playbook expects it and treats it as information. You
list the bugs in a temporary issues file, then run `/analyze-fix` and tell the analyst plainly
that these bugs got past the verifier. For each one it produces three things: the root cause, an
explanation of **why verification missed it** — was the checklist item absent, or was its verify
method too weak — and a patch to the checklist adding items whose verify methods *would* have
caught it. You review that patch, then run `/fix` and `/verify` again. The temporary issues file
is deleted only after its content has been folded into the checklist. The point is stated
directly: the verifier gets better not because the model improves, but because the specification
it verifies against improves.

### Phase 10 — Production bugs

**You run:** `/analyze-fix`, then `/fix`, then `/verify`. **Same loop as phase 9.**

A bug reported by a real user is treated as the same class of escape, just found later. What is
added here is incident handling: four severity levels with acknowledgement and mitigation
targets, a rule to preserve logs and the original reproduction before changing anything, and a
postmortem within five business days for the two most serious levels. Over months the checklist
accumulates every real-world failure as a verifiable item, which is why `/archive-checklist`
exists — past roughly two thousand lines it rotates passed items into a compact history section
so the working file stays cheap to read.

## What runs around all of this

Three things sit underneath every phase.

**The standing rules.** `.playbook/AGENTS.md` is loaded into every session automatically. It is
about 950 words and holds the rules that apply everywhere: agents never commit to git; secrets
never appear in command arguments, markdown, or logs; the build phase finishes what it started;
and what unattended mode means.

**The guards.** Two small plugins enforce mechanically what prose could not. One blocks writes to
forbidden filenames and keeps the verifier inside its allowed folders. The other, active only in
unattended mode, auto-approves every permission prompt except anything that writes git history.
Both were tested live while this review was written: a write to `Gap-Report.md` is refused, a
verifier edit to application source is refused, `git commit` is refused, `git status` is allowed.

**The miss record.** When something is found that should have been caught earlier, a one-line
record is appended to `verification/telemetry/misses.ndjson` saying what class of miss it was and
why it was missed. It is append-only. The stream currently holds ten records covering five
misses, all from the framework's own construction. Nothing about this record can change a pass or
fail verdict — it is there to make the process improvable, not to grade anybody.

## The honest summary

The parts of this that are real and working today are the checklist contract, the independent
verifier, the mechanical guards, the installer, and the miss record. The part that is not yet
real is the Playbook grading itself: there is no single command that walks the Playbook's own
requirements and reports how many can even be checked. The reset plan's first sessions build
exactly that.
