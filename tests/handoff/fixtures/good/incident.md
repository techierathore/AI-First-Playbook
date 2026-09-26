# Incident Record
<!-- INVENTED example built from docs/Greenfield-Case-Study.md (Team Inventory); not a real record. -->
<!-- handoff: incident -->
- Incident: INC-2026-0412 duplicate CSV import reported success while writing zero rows
- Severity: sev3
- Detected at (UTC): 2026-10-02T08:14:00Z
- Producer: on-call engineer
- Consumer: feature team
- Accountable approver: Incident commander (Rita Gomez)
- Approver identity: rgomez@example.invalid
- Incident commander: Rita Gomez
- Communications owner: Lee Park
- Rollback authority: Sam Diaz
- Status transition: incident-open -> incident-resolved
- Customer impact: three operators re-ran imports; no data lost; 40 minutes
- Timeline (UTC): 08:14 detected; 08:30 flag off; 08:54 fix verified
- Root cause: fact — the import returned 200 on a rejected transaction; theory — none
- Regression item: INV-013 in `docs/team-inventory/Team-Inventory-Implementation-Checklist.md`
- Actions: add INV-013; owner: Ana Ruiz; due: 2026-10-09
- Postmortem due: 2026-10-09
- Evidence: `verification/team-inventory/incident-INC-2026-0412/`
- Open decisions: none
- Escalation owner: Operations manager (Lee Park)
- Exception expiry: none
- Recorded at (UTC): 2026-10-02T09:30:00Z
