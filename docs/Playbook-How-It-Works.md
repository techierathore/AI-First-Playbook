# How the AI-First Playbook Works

The Playbook is a ten-phase way to turn a written requirement into tested software. OpenCode is
the working tool. Its installed commands live in `.opencode/command/`. Its standing rules and
project profile live in `.playbook/`. A harness is the set of commands, agents, and plugins that
OpenCode runs. The npm package installs those hidden folders without replacing project files.

## 1. Plan

The team starts a fresh OpenCode chat and runs `/feature-plan`. OpenCode loads the standing rules,
the environment profile, the planning command, and the Analyst role. The Analyst reads the business
requirement, UI mockup when one exists, coding standards, database design, and named project files.
It writes the feature document set and the implementation checklist. The checklist is the build and
test contract. Each item follows `templates/checklist-item-template.md`. Database work also uses
`templates/deployment-steps-template.md`. OpenCode asks for missing facts instead of guessing them.
The fixed instruction load is 4 files and 3,675 words before project inputs.

## 2. Review the Plan

A person reviews the documents in the same chat. The reviewer checks every requirement, mockup
element, acceptance line, test method, file name, and output path. The decision is recorded with
`templates/handoffs/plan-approval.md`, or in a tracker with the same fields. OpenCode keeps the plan
and the review discussion together. Rejected plans return to Phase 1. Approved plans move to build.
No new OpenCode file is loaded; the chat retains the 4-file, 3,675-word planning instructions plus
the documents it just produced.

## 3. Build

The team starts a fresh OpenCode chat and runs `/implement` with the checklist. OpenCode loads the
standing rules, profile, implementation command, and Orchestrator role. The Orchestrator reads the
whole checklist and the relevant standards, architecture, and database documents. It groups work
into ordered waves. A wave is a set of tasks that can run without editing the same files. Builder
subagents receive only their assigned checklist items and product files. The Orchestrator owns shared
checklist and telemetry writes. It writes code, tests, deployment steps, infrastructure needs, item
status, and an implementation handoff based on `templates/handoffs/implementation-summary.md`. The
fixed parent load is 4 files and 5,198 words before project documents.

## 4. Self-Review

Self-review runs inside `/implement`, and later inside `/fix`; it is not a separate command. The
Orchestrator rereads each item and checks the changed code. It builds touched projects, starts the
configured application, probes changed behavior, checks data and logs when relevant, and stops any
process it started. The Developer Flow Guide is used when the feature has one. Results are written
back into the implementation checklist. A real defect found here may be logged as a miss, which is a
record of something the process failed to catch earlier. The phase retains the 4-file, 5,198-word
build instruction set plus the project's files and tool results.

## 5. Verify

The team runs `/verify` in a fresh context. OpenCode creates the independent Verifier subagent and
loads the standing rules, profile, thin verify command, and full Verifier instructions. The Verifier
reads the checklist and any testing or database guide. It runs approved deployment steps, checks the
real environment, and tests each item through the UI, API, database, logs, or code as appropriate.
It must not change product code. It may update the selected checklist and write test evidence under
`verification/`. Deployment rows follow `templates/deployment-steps-template.md`. This is the
largest fixed phase load: 4 files and 10,054 words before the checklist and its guides.

## 6. Decide the Verification Result

The Verifier records one evidence-backed outcome on every checklist item. It updates the Status
Table and appends one run entry. It does not create a separate gap report. Failures and missing test
data also create linked miss records through the supplied command-line tool. A verification handoff
uses `templates/handoffs/verification-results.md`. Any failure goes to Phase 7. Missing data or a
blocked environment must be resolved or formally accepted. Only an all-pass result moves to human
acceptance. This phase uses the same retained 4-file, 10,054-word Verifier context as Phase 5.

## 7. Fix

The team runs `/fix` against the same checklist. OpenCode loads the standing rules, profile, fix
command, and Orchestrator role. The Orchestrator reads only active failed items and their evidence,
then creates safe work waves for Builder subagents. It changes code and tests, records any new
deployment or infrastructure need, performs the Phase 4 self-review, and marks each repair ready for
independent testing. It never marks its own repair as verified. The same checklist remains the only
contract. The fixed parent load is 4 files and 3,933 words before project inputs. The team repeats
Phases 5 to 7 until every item passes.

## 8. Accept the Feature

QA, a business analyst, or another accountable person reviews the all-pass checklist and runs the
manual checks that automation cannot settle. These include business meaning, usability, timing,
edge cases, and cross-browser behavior. The person uses the Verification Guide and, for reports, the
Business Verification Reference. The decision is stored with `templates/handoffs/acceptance.md` or
an equivalent tracker record. OpenCode supplies the evidence but does not approve its own work.
Accepted work moves to release readiness. Bugs move to Phase 9. This human phase has 0 newly loaded
OpenCode files and 0 new instruction words.

## 9. Learn From Escaped Bugs

A bug found after verification is first written in an Issues file using
`templates/issues-file-template.md`, often through `/create-issue-list`. The team then runs
`/analyze-fix` in a fresh OpenCode chat. The Analyst reads the issue, existing checklist, related
documents, and relevant code. It finds the root cause, explains why verification missed the bug,
and strengthens the existing checklist with a test that would have caught it. It does not create a
second checklist. `/fix` and `/verify` then run again. The fixed `/analyze-fix` load is 4 files and
3,484 words before project inputs; optional issue collection has its own 4-file, 2,430-word load.

## 10. Handle Production Bugs

Production bugs use the same learning loop with incident controls added. The team preserves logs,
traces, deployment facts, impact, ownership, and the original reproduction before changing
anything. `templates/handoffs/incident.md` records the incident. The Analyst runs `/analyze-fix`,
the Orchestrator runs `/fix`, and the independent Verifier runs `/verify`. Release and operations
records use `templates/handoffs/release-readiness.md` and
`templates/handoffs/operations-transfer.md`. These are three separate OpenCode contexts. Together
they load 12 framework file instances and 17,471 fixed words, not one single prompt. The checklist
keeps the new regression requirement so the same failure cannot pass silently next time.

## OpenCode Installation Note

The repository is packaging source, not an installed project. Its root `.opencode/` contains the
four agents and plugins, but no command folder. Therefore this source checkout resolves 0 custom
slash commands. A normal npm installation creates all 14 commands under the target project's
`.opencode/command/` and places the standing rules, profile, model map, and runtime scripts under
`.playbook/`. OpenCode remains the primary and only shipped coding harness.
