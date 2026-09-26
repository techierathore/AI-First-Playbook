# Verification Results Handoff
<!-- template-schema: {"produces":"docs/<feature>/handoffs/verification-results.md","required":["Feature","Run ID","Producer","Consumer","Accountable approver","Approver identity","Status transition","Overall outcome","Checklist","Non-PASS items","Evidence","Open decisions","Escalation owner","Exception expiry","Recorded at (UTC)"],"optional":["Environment"],"budget":{"small":[100,160],"medium":[140,210],"large":[180,260]},"rows":"Closed outcomes; every non-PASS names item IDs. Create and validate with node .playbook/scripts/handoff-record.mjs."} -->
<!-- handoff: verification-results -->
- Feature: <feature>
- Run ID: <run id>
- Producer: <name or role account>
- Consumer: <name or role account>
- Accountable approver: <name or role account>
- Approver identity: <name or role account>
- Status transition: <from-state> -> <to-state>
- Overall outcome: PASS | FAIL | DATA-GAP | BLOCKED
- Checklist: <checklist>
- Non-PASS items: <non-pass items>
- Evidence: <one or more paths or URLs>
- Open decisions: none | <decision; owner: <name>; due: YYYY-MM-DD>
- Escalation owner: <name or role account>
- Exception expiry: none | YYYY-MM-DD
- Recorded at (UTC): YYYY-MM-DDTHH:MM:SSZ
