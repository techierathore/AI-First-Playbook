# Security

Use an approved secret manager, environment reference or protected stdin/file. Never put
credentials in Markdown, command arguments, URLs, process dumps, evidence or logs. Redact tokens,
passwords, connection strings, cookies, authorization headers and PII before evidence is stored.
Set `PLAYBOOK_CHECKLIST` to restrict verifier checklist writes.
