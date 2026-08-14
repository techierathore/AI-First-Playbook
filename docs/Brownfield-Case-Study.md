# Brownfield Session: Legacy Inventory Screen

**Length:** 75 minutes. **Audience:** Engineering, QA, Product/BA, Security and Operations.

## Prepare

1. Install the framework and configure the profile for an imperfect inventory app.
2. Seed an undocumented React screen, API endpoint, legacy SQL procedure, missing tests and a
   known inactive-assets data defect. Use synthetic data and a feature flag
   `inventory-owner-filter`.
3. Prepare a baseline tag and rollback that disables the flag and restores database state.

## Present

1. **Safety rule, 5 min:** no implementation before observed behavior, ownership, data
   classification, risks and safe seams are recorded.
2. **Legacy audit, 15 min:** Run `/legacy-audit`. Capture inventory, dependency and ownership
   maps, baseline screenshots/API responses, characterization tests, data classification and
   risk/unknowns under `verification/legacy-inventory/legacy-audit-<run-id>/`.
3. **Change seam, 10 min:** Record behaviors that must not change: search ordering, permissions,
   audit events, inactive behavior and API compatibility. Choose an optional query parameter and
   flagged SQL branch; retain the old path.
4. **Evidence-based plan, 10 min:** Run `/feature-plan` with audit outputs. Add regression items
   for every baseline behavior and keep the known defect as an explicit requirement.
5. **Compatible implementation, 10 min:** Run `/implement`; add characterization tests first,
   preserve the old endpoint, and record migration and rollback order.
6. **Before/after verification, 15 min:** Run `/verify` against both paths. Compare baseline
   response/screenshot, filter, empty results, authorization, logging, flag and rollback. A
   `DATA-GAP` blocks acceptance and release.
7. **Acceptance and transfer, 10 min:** QA compares evidence, Product records accepted differences,
   and Operations accepts the release and ownership packets.

## Expected Tree

```text
features/legacy-inventory-owner-filter/
  legacy-audit.md
  baseline.md
  risk-register.md
  Legacy-Inventory-FullStack-Implementation-Checklist.md
  handoffs/{plan-approval,verification-results,acceptance,release-readiness,operations-transfer}.md
  verification/{legacy-audit-<run-id>,<verify-run-id>}/
deploy/legacy-inventory-owner-filter/01-compatible-procedure.sql
```

## Debrief

Ask which behaviors were discovered, what proves the old path did not change, where rollback is
recorded, and which baseline artifact helps the next owner.
