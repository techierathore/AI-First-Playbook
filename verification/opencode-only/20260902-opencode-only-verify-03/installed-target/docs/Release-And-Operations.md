# Release And Operations

Every release packet records migration order, compatibility, feature flags, rollback authority
and steps, monitoring signals, post-deploy checks and incident escalation. A failed post-deploy
check pauses rollout or invokes rollback. Use `templates/handoffs/release-readiness.md`,
`operations-transfer.md` and `incident.md`.
