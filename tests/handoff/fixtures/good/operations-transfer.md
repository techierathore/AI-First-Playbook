# Operations and Ownership Transfer
<!-- INVENTED example built from docs/examples/Greenfield-Case-Study.md (Team Inventory); not a real record. -->
<!-- handoff: operations-transfer -->
- Service: team-inventory API and web
- Outgoing owner: Feature team (Ana Ruiz)
- Incoming owner: Operations (Rita Gomez)
- Producer: release owner
- Consumer: operations owner
- Accountable approver: Operations manager (Lee Park)
- Approver identity: lpark@example.invalid
- Status transition: post-deploy-validated -> operations-owned
- Resources: runbook `docs/team-inventory/Runbook.md`, dashboard https://dash.example.invalid/d/inv
- Risks and support hours: duplicate-tag rejections may spike on month-end imports; support 08:00-18:00 UTC
- Last verified run: `verification/team-inventory/verify-20260927T0900Z/`
- Open work: tune the 422 alert; owner: Rita Gomez; due: 2026-10-15
- Acceptance by incoming owner: Rita Gomez, 2026-09-29T09:00:00Z
- Evidence: `docs/team-inventory/Runbook.md`
- Open decisions: none
- Escalation owner: Operations manager (Lee Park)
- Exception expiry: none
- Recorded at (UTC): 2026-09-29T09:05:00Z
