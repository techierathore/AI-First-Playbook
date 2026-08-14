---
agent: analyst
---

Read `AGENTS.md`, the selected `playbook/environment-profile.yml`, and the target module. Ask
for missing ownership, data classification, environment or acceptance context. Execute safe
baseline checks and create `verification/<feature>/legacy-audit-<run-id>/` evidence: system
inventory, dependency map, ownership map, baseline UI/API behavior, characterization tests,
risk and unknowns register, and safe change seams. Add a checklist item for every behavior that
must not change. Preserve secrets and PII through redaction; do not modify product code.
