# Team Playbook Standing Rules

The implementation checklist is the single living build-and-verify contract. Markdown is the
source of truth; HTML is derived for humans. Read `playbook/environment-profile.yml` before
running commands. Never guess topology, ports, config files, migration tools or data.

Secrets use an approved secret manager, environment reference, protected stdin or protected
temporary file. Never put values in command arguments, Markdown, logs, URLs or evidence.

The Verifier may annotate the selected checklist, write `verification/<feature>/<run-id>/`
evidence, and append miss records by invoking the approved standalone
`playbook-miss.mjs` CLI, which writes the durable default
`verification/telemetry/misses.ndjson` stream. It must not edit that stream directly or use
path overrides, and must not edit product source, configuration, lockfiles or arbitrary files.
Fixes are made by `/fix` and then independently verified.

Every gate persists a handoff packet with producer, consumer, accountable approver, identity,
UTC timestamp, status transition, evidence links, open decisions, escalation owner and exception
expiry. A checkbox is not authoritative status; item metadata and the status table are.

## Version control — agents do not commit

Agents never run `git commit`, `git push`, `git tag`, or any history rewrite, and never
stage changes unless asked. Committing is the human's job: the agent prepares changes in the
working tree, reports `git status` and what changed, and stops. A task description that says
"commit the result" does not override this rule — only the human's explicit instruction in
the current conversation does.

## Build phase — finish the whole checklist, not part of it

`/implement` (and `/fix` for its FAIL set) is done only when **every item in scope** is
implemented, built, self-tested and moved to the to-verify state, or carries an explicit
`[INFRA BLOCKER]` / `[EXTERNAL BLOCKER]` annotation naming what is missing and who supplies
it. "Implemented items #1–#9; run `/implement` again for #10–#19" is a **violation**, not a
status update: context pressure is solved by adding waves and handing sub-agents smaller
slices, never by handing the remainder back to the human. The phase hands off to `/verify`
exactly once, with the Status Table showing every item.

## YOLO mode — unattended runs

YOLO mode is on when **either** of these holds: the user's message or command arguments contain
the token `YOLO` (any case, with or without `*`), or `PLAYBOOK_YOLO=1` is set in the environment (the optional supervisor in a full framework source
checkout sets it). Once on, it stays on for the whole run and for every
sub-agent spawned in it — pass it down explicitly in each sub-agent brief.

In YOLO mode the human has pre-approved everything except git history. Therefore:

- **Never stop to ask.** Every "Proceed? (yes/no)", "Approve?", "ASK the user" and
  "with approval" gate in any command or agent file is **pre-approved**. Do not pause for
  the wave plan, the smoke-test start, deployment steps, deletions, tool installs, port
  choices or environment choices. Make the sensible decision, record it as one line under
  `## YOLO Decisions` in the checklist (what / why / how to reverse), and continue. Missing
  required *input* (no checklist path at all) is the only legitimate question — ask it
  once at the very start, never mid-run.
- **You may delete** files and folders inside the repository and its build/verification
  output, kill processes you started, install tools, and write anywhere the guardrail
  plugin permits. Read-only git (`status`, `log`, `diff`, `show`, `blame`, `branch`,
  `fetch`) is allowed and encouraged.
- **You still never commit.** `git commit/push/tag/add/rebase/reset/merge/checkout/stash`
  and `gh pr create` are denied mechanically by the OpenCode YOLO plugin; do not work around it.
  End the run with `git status` and a summary for the human to commit.
- **Stop only when the goal is complete.** A phase ends when the completion contract above
  is met; a goal run ends when `/verify` reports every item PASS (loop `/fix` → `/verify`
  as many times as needed). Ending early is allowed only when a genuine external blocker
  remains *after* everything else is finished — then say what is missing and who must
  supply it.
- **Usage limits are not failures.** If the provider's 5-hour/weekly limit stops the run,
  the supervisor waits for the stated reset (+15 min) and resumes the same session. On
  resume, re-read the checklist Status Table and continue from the first unfinished item;
  never redo finished work and never start a new checklist.
- **End with a sentinel line** so the supervisor can tell the outcome apart from a pause:
  `PLAYBOOK_RUN_COMPLETE: <one-line summary>` when everything is done, or
  `PLAYBOOK_RUN_BLOCKED: <what is missing and who must supply it>` when only an external
  blocker remains. Print it as the very last line of the run.

Outside YOLO mode nothing changes: gates ask, approvals are waited for.

## Windows / WSL note — stale root-owned file metadata

Repos under `/mnt/c` can carry stale root-owner Linux metadata (typically left by earlier
root-running container sessions). Symptoms: files/directories show `root:root`, writes fail
with EACCES, and `chown`/`chmod` succeed but change nothing (the default drvfs mount lacks
the `metadata` option, so it reads stored attributes but cannot update them).

- **Agent behaviour:** do not fight it — write the file into a user-owned staging directory
  and move it into place from the Windows side (`cmd.exe /c move`); files created inside WSL
  carry no stale metadata. Windows `copy` copies the metadata and does NOT fix it. Report
  the condition to the human.
- **Permanent fix (human, once per machine):** add to `/etc/wsl.conf`:

  ```ini
  [automount]
  options = "metadata"
  ```

  then from Windows run `wsl --shutdown`, reopen the distro, and run
  `sudo chown -R $USER:$USER <repo-path>`. If the machine has multiple distros (e.g.
  `docker-desktop`), make sure commands target the right one: `wsl -d <distro>`.
  Better still, keep working repos in the WSL filesystem (`~/work`), where none of this
  applies and file I/O is much faster.
