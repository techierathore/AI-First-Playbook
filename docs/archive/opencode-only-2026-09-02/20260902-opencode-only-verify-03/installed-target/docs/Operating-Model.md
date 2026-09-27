# Operating Model

Roles are Product/BA, Analyst, Orchestrator/Developer, Verifier, QA, Security, Release/Ops and
Process Owner. Every gate records producer, consumer, accountable approver, identity, UTC time,
status transition, evidence, open decisions, escalation owner and exception expiry.

`Proposed -> Planned -> Plan Approved -> Building -> Self-Reviewed -> Verification In Progress`
`-> Verification Failed | Data Gap | Blocked -> Human Accepted -> PR Ready -> PR Approved`
`-> Release Ready -> Deployed -> Post-Deploy Validated -> Closed`.
