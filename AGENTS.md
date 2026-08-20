# Team Playbook Standing Rules

The implementation checklist is the single living build-and-verify contract. Markdown is the
source of truth; HTML is derived for humans. Read `playbook/environment-profile.yml` before
running commands. Never guess topology, ports, config files, migration tools or data.

Secrets use an approved secret manager, environment reference, protected stdin or protected
temporary file. Never put values in command arguments, Markdown, logs, URLs or evidence.

The Verifier may annotate the selected checklist and write `verification/<feature>/<run-id>/`
evidence only. It must not edit product source, configuration, lockfiles or arbitrary files.
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
