# Security

Use an approved secret manager, environment reference or protected stdin/file. Never put
credentials in Markdown, command arguments, URLs, process dumps, evidence or logs. Redact tokens,
passwords, connection strings, cookies, authorization headers and PII before evidence is stored.
Set `PLAYBOOK_CHECKLIST` to restrict verifier checklist writes.

OpenCode telemetry must exclude prompts, source, raw command arguments, secrets, and PII. Retain
only approved closed-vocabulary records and redacted evidence.

YOLO mode (`PLAYBOOK_YOLO=1`) broadly approves ordinary OpenCode permissions but still denies git
history/index/ref writes and publishing. Run it in a dedicated working copy with development-scoped
credentials. The secret and evidence rules above remain unchanged. See
[YOLO-Mode-Guide.md](YOLO-Mode-Guide.md).
