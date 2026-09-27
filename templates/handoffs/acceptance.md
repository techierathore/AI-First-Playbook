# Human Acceptance Record
<!-- template-schema: {"produces":"docs/<feature>/handoffs/acceptance.md","required":["Feature and scope","Producer","Consumer","Accountable approver","Approver identity","Status transition","Decision","Accepted differences","Evidence","Open decisions","Escalation owner","Exception expiry","Recorded at (UTC)"],"optional":["Notes"],"budget":{"small":[100,150],"medium":[130,190],"large":[160,230]},"rows":"Separate accepted differences from expiring exceptions. Create and validate with node .playbook/scripts/handoff-record.mjs."} -->
<!-- handoff: acceptance -->
- Feature and scope: <feature and scope>
- Producer: <name or role account>
- Consumer: <name or role account>
- Accountable approver: <name or role account>
- Approver identity: <name or role account>
- Status transition: <from-state> -> <to-state>
- Decision: accepted | rejected | accepted-with-expiring-exception
- Accepted differences: <accepted differences>
- Evidence: <one or more paths or URLs>
- Open decisions: none | <decision; owner: <name>; due: YYYY-MM-DD>
- Escalation owner: <name or role account>
- Exception expiry: none | YYYY-MM-DD
- Recorded at (UTC): YYYY-MM-DDTHH:MM:SSZ
