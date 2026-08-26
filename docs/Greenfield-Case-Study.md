# Greenfield Session: Team Inventory

**Length:** 90 minutes. **Audience:** Product, Engineering, QA, Security and Operations.

## Prepare

1. Install with `npx @techierathore/ai-first-playbook@latest --target="/path/to/demo"`.
2. Configure the demo profile with a local synthetic database and no credentials in files.
3. Seed a Team Inventory app: React UI, API, database, authentication, audit logging and CSV
   import. Plant a duplicate-asset-tag defect that reports success but writes zero rows.

## Present

1. **Problem, 5 min:** Product states the outcome: operations can locate an asset, owner and
   audit history. Explain that the checklist is the contract.
2. **Plan, 10 min:** Run `/feature-plan`. Let the Analyst ask for roles, duplicate behavior,
   import schedule and retention. Record answers rather than guessing.
3. **Plan gate, 5 min:** Product, engineering, QA and security approve the checklist using
   `templates/handoffs/plan-approval.md`.
4. **Build, 15 min:** Run `/implement`. Show schema/shared-model Wave 1, UI/API/import Wave 2,
   and integration Wave 3. Persist the implementation summary.
5. **Self-review, 5 min:** Run profile build/tests and explain what self-review cannot prove:
   fresh-context runtime behavior.
6. **Verify, 15 min:** Run `/verify`. Show UI/API/database/import evidence under a run ID and an
   inline `PASS`. Show that product source writes are denied.
7. **Defect, 10 min:** Run the duplicate-tag import. Show `FAIL`, run `/fix`, then re-run `/verify`.
   Explain that `DATA-GAP` blocks acceptance and release; it is not success.
8. **Acceptance, 10 min:** QA and Product use the Verification Guide and persist `acceptance.md`.
9. **Release, 10 min:** Release/Ops reviews migration order, rollback, flags, monitoring and
   post-deploy checks using `release-readiness.md`.
10. **Transfer, 5 min:** A replacement owner finds the next action, evidence and rollback from
    the checklist and operations-transfer packet without asking the original developer.

## Expected Tree

```text
features/team-inventory/
  Team-Inventory-FullStack-Implementation-Checklist.md
  verification-guide.md
  handoffs/{plan-approval,implementation-summary,verification-results,acceptance,release-readiness,operations-transfer}.md
  verification/<run-id>/{environment.json,api.json,ui.png,import.log}
deploy/team-inventory/01-schema.sql
```

## Debrief

Ask which claim needed runtime evidence, which decision would be lost from chat alone, and where
the successor finds rollback and monitoring.
