# Release Readiness Record
<!-- template-schema: {"produces":"docs/<feature>/handoffs/release-readiness.md","required":["Feature and release","Producer","Consumer","Accountable approver","Approver identity","Status transition","Rollback authority","Approvals","Migration order and compatibility","Feature flag state","Rollback steps and recovery point","Monitoring signals and thresholds","Post-deploy checks","Decision","Evidence","Open decisions","Escalation owner","Exception expiry","Recorded at (UTC)"],"optional":["Window"],"budget":{"small":[120,180],"medium":[170,250],"large":[220,320]},"rows":"Every action has an owner; thresholds are observable. Create and validate with node .playbook/scripts/handoff-record.mjs."} -->
<!-- handoff: release-readiness -->
- Feature and release: <feature and release>
- Producer: <name or role account>
- Consumer: <name or role account>
- Accountable approver: <name or role account>
- Approver identity: <name or role account>
- Status transition: <from-state> -> <to-state>
- Rollback authority: <rollback authority>
- Approvals: <approvals>
- Migration order and compatibility: <migration order and compatibility>
- Feature flag state: <feature flag state>
- Rollback steps and recovery point: <rollback steps and recovery point>
- Monitoring signals and thresholds: <monitoring signals and thresholds>
- Post-deploy checks: <post-deploy checks>
- Decision: go | no-go
- Evidence: <one or more paths or URLs>
- Open decisions: none | <decision; owner: <name>; due: YYYY-MM-DD>
- Escalation owner: <name or role account>
- Exception expiry: none | YYYY-MM-DD
- Recorded at (UTC): YYYY-MM-DDTHH:MM:SSZ
