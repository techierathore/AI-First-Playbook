# Security

Use an approved secret manager, environment reference or protected stdin/file. Never put
credentials in Markdown, command arguments, URLs, process dumps, evidence or logs. Redact tokens,
passwords, connection strings, cookies, authorization headers and PII before evidence is stored.
Set `PLAYBOOK_CHECKLIST` to restrict verifier checklist writes.

**YOLO mode** (`PLAYBOOK_YOLO=1`) auto-approves every harness permission prompt — file
deletion, shell commands, tool installs — except git history writes (`commit`, `push`, `tag`,
`add`, `rebase`, `reset`, `checkout`, `stash`, `gh pr create`), which the carriers deny
mechanically. Run it only on a VM or container holding the working copy and dev-scoped
credentials; commit your own work before starting so `git checkout --` / `git clean` can
restore any state. The secret rules above apply unchanged. Details:
[`YOLO-Mode-Guide.md`](YOLO-Mode-Guide.md) §7.
