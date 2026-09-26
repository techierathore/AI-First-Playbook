# Team Playbook Standing Rules

The implementation checklist is the single living build-and-verify contract. Markdown is the
source of truth; HTML is derived for humans. Item metadata and the Status Table are authoritative
status; a checkbox is not. Read `playbook/environment-profile.yml` before running commands. Never
guess topology, ports, config files, migration tools or data.

Secrets come only from an approved secret manager, an environment reference, protected stdin or a
protected temporary file. Never put values in command arguments, Markdown, logs, URLs or evidence.

The Verifier may annotate the selected checklist, write `verification/<feature>/<run-id>/`
evidence, and record misses only through `scripts/playbook-miss.mjs` (default stream, no path
overrides, no direct edits). It never edits product source, configuration, lockfiles or other
files. Fixes are made by `/fix` and then independently verified.

Every gate persists a handoff packet: producer, consumer, accountable approver, identity, UTC
timestamp, status transition, evidence links, open decisions, escalation owner and exception expiry.

## Version control

Agents never run `git commit`, `git push`, `git tag` or any history rewrite, and never stage
changes unless asked. The agent leaves changes in the working tree, reports `git status` and what
changed, and stops. Only the human's explicit instruction in the current conversation overrides
this; a task description does not.

## Build phase completion

`/implement` (and `/fix` for its FAIL set) is done only when every item in scope is implemented,
built, self-tested and moved to the to-verify state, or carries an `[INFRA BLOCKER]` /
`[EXTERNAL BLOCKER]` annotation naming what is missing and who supplies it. Handing the remainder
back ("run `/implement` again for #10–#19") is a violation: add waves and smaller sub-agent slices
instead. The phase hands off to `/verify` once, with the Status Table showing every item.

## YOLO mode

On when the user's message or arguments contain the token `YOLO` (any case) or
`PLAYBOOK_YOLO=1` is set. It stays on for the whole run; pass it explicitly into every sub-agent
brief. The human has pre-approved everything except git history:

- Never stop to ask. Every approval gate is pre-approved; decide, record one line under
  `## YOLO Decisions` in the checklist (what / why / how to reverse), and continue. Ask only for a
  missing checklist path, once, at the start.
- You may delete files inside the repository and its build/verification output, kill processes you
  started, and install tools, within what the guardrail plugin permits. Read-only git is allowed.
- Git writes stay denied mechanically; do not work around it. End with `git status` and a summary.
- Stop only when the goal is complete (every item PASS, looping `/fix` → `/verify`) or only a
  genuine external blocker remains. Provider usage limits are pauses: on resume, re-read the Status
  Table and continue from the first unfinished item.
- The very last line is `PLAYBOOK_RUN_COMPLETE: <summary>` or
  `PLAYBOOK_RUN_BLOCKED: <what is missing and who must supply it>`.

Outside YOLO mode gates ask and approvals are waited for. Windows/WSL file-permission problems:
see `docs/OpenCode-WSL-Setup-Guide.md` §10f.
