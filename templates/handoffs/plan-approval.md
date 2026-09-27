# Plan Approval Handoff
<!-- template-schema: {"produces":"docs/<feature>/handoffs/plan-approval.md","required":["Feature","Producer","Consumer","Accountable approver","Approver identity","Status transition","Decision","Scope and checklist","Evidence","Open decisions","Escalation owner","Exception expiry","Recorded at (UTC)"],"optional":["Notes"],"budget":{"small":[100,150],"medium":[130,190],"large":[160,230]},"rows":"One field per row; enum decision; owner and date for open work. Create and validate with node .playbook/scripts/handoff-record.mjs."} -->
<!-- handoff: plan-approval -->
- Feature: <feature>
- Producer: <name or role account>
- Consumer: <name or role account>
- Accountable approver: <name or role account>
- Approver identity: <name or role account>
- Status transition: <from-state> -> <to-state>
- Decision: approved | changes-required
- Scope and checklist: <scope and checklist>
- Evidence: <one or more paths or URLs>
- Open decisions: none | <decision; owner: <name>; due: YYYY-MM-DD>
- Escalation owner: <name or role account>
- Exception expiry: none | YYYY-MM-DD
- Recorded at (UTC): YYYY-MM-DDTHH:MM:SSZ
