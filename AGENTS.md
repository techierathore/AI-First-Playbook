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
