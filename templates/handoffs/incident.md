# Incident Record
<!-- template-schema: {"produces":"docs/<feature>/handoffs/incident.md","required":["Incident","Severity","Detected at (UTC)","Producer","Consumer","Accountable approver","Approver identity","Incident commander","Communications owner","Rollback authority","Status transition","Customer impact","Timeline (UTC)","Root cause","Regression item","Actions","Postmortem due","Evidence","Open decisions","Escalation owner","Exception expiry","Recorded at (UTC)"],"optional":["Detection","Related incidents"],"budget":{"small":[150,230],"medium":[220,320],"large":[300,450]},"rows":"UTC timeline; separate fact from theory; link regression item. Create and validate with node .playbook/scripts/handoff-record.mjs."} -->
<!-- handoff: incident -->
- Incident: <incident>
- Severity: sev1 | sev2 | sev3 | sev4
- Detected at (UTC): <detected at (utc)>
- Producer: <name or role account>
- Consumer: <name or role account>
- Accountable approver: <name or role account>
- Approver identity: <name or role account>
- Incident commander: <incident commander>
- Communications owner: <communications owner>
- Rollback authority: <rollback authority>
- Status transition: <from-state> -> <to-state>
- Customer impact: <customer impact>
- Timeline (UTC): <timeline (utc)>
- Root cause: <root cause>
- Regression item: <regression item>
- Actions: <actions>
- Postmortem due: <postmortem due>
- Evidence: <one or more paths or URLs>
- Open decisions: none | <decision; owner: <name>; due: YYYY-MM-DD>
- Escalation owner: <name or role account>
- Exception expiry: none | YYYY-MM-DD
- Recorded at (UTC): YYYY-MM-DDTHH:MM:SSZ
