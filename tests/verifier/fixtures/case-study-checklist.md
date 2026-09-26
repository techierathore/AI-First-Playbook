# Team Inventory — Verification Fixture Checklist

Items come from the two case studies; the desktop item is SYNTHETIC because neither case study has
a desktop application. Sources: UI — `docs/Brownfield-Case-Study.md` (Legacy Inventory Owner
Filter); API and DB — `docs/Greenfield-Case-Study.md` (Team Inventory duplicate asset-tag import).

## Status Table

| ID | Status |
|---|---|
| INV-001 | planned |
| INV-002 | planned |
| INV-003 | planned |
| INV-004 | planned |
| INV-005 | out-of-scope |

<!-- metadata: {"schema":1,"id":"INV-001","owner":"inventory-ui","priority":"P1","risk":"medium","status":"planned","created_at":"2026-09-26T00:00:00Z","updated_at":"2026-09-26T00:00:00Z","evidence":[],"misses":[]} -->
- [ ] Filter the inventory list by owner
  - Type: ui
  - Behavior: Choosing an owner in the Owner filter shows only that owner's assets.
  - Location: `src/web/inventory/OwnerFilter.tsx`
  - UI ref: Inventory screen, filter bar left of Search; reuse the existing select filter.
  - Logging: INFO with owner id and row count when the filter changes.
  - Acceptance: When an operator selects owner Ana Ruiz on the Inventory screen, then every visible row shows owner Ana Ruiz
  - Verify: Playwright selects the owner, reads every row's owner cell, asserts one distinct value, keeps the trace.
  - Coding Standards: `docs/coding-standards.md`, section 3.1, Filters.

<!-- metadata: {"schema":1,"id":"INV-002","owner":"inventory-api","priority":"P1","risk":"high","status":"planned","created_at":"2026-09-26T00:00:00Z","updated_at":"2026-09-26T00:00:00Z","evidence":[],"misses":[]} -->
- [ ] Reject a CSV import that repeats an asset tag
  - Type: backend-api
  - Behavior: The import endpoint rejects a file whose rows share an asset tag, with a non-secret error.
  - Location: `src/api/imports/CsvImportController.ts`
  - Logging: WARN with the duplicate tag count; ERROR only on unexpected failure.
  - Acceptance: When an operator posts a CSV with two rows tagged TAG-7 to the import endpoint, then the response status is 422
  - Verify: curl posts the two-row fixture, asserts status 422 and the error code DUPLICATE_TAG, keeps the response body.
  - Coding Standards: `docs/coding-standards.md`, section 5.2, Validation errors.

<!-- metadata: {"schema":1,"id":"INV-003","owner":"inventory-data","priority":"P1","risk":"high","status":"planned","created_at":"2026-09-26T00:00:00Z","updated_at":"2026-09-26T00:00:00Z","evidence":[],"misses":[]} -->
- [ ] Write no rows when a duplicate import is rejected
  - Type: db
  - Behavior: A rejected duplicate import leaves the assets table unchanged.
  - Location: `src/api/imports/ImportRepository.ts`
  - Logging: None — the API item logs the rejection.
  - Acceptance: When an operator posts a CSV with two rows tagged TAG-7 to the import endpoint, then the assets row count is unchanged
  - Verify: The DB runner counts assets before and after the INV-002 request and asserts equal counts, keeps both counts.
  - Coding Standards: `docs/coding-standards.md`, section 6.1, Transactions.
  - Depends on: INV-002

<!-- metadata: {"schema":1,"id":"INV-004","owner":"inventory-desktop","priority":"P2","risk":"low","status":"planned","created_at":"2026-09-26T00:00:00Z","updated_at":"2026-09-26T00:00:00Z","evidence":[],"misses":[]} -->
- [ ] Export the inventory from the desktop client (SYNTHETIC)
  - Type: desktop
  - Behavior: The desktop client's Export action writes a CSV of all assets.
  - Location: `src/desktop/ExportService.cs`
  - UI ref: Main window, File menu, Export.
  - Logging: INFO with the exported row count.
  - Acceptance: When an operator runs Export in the desktop client, then the CSV row count equals the assets row count
  - Verify: A console runner calls ExportService.Export with the real configuration and compares its row count with the DB count, keeps the CSV hash.
  - Coding Standards: `docs/coding-standards.md`, section 7, Desktop services.

<!-- metadata: {"schema":1,"id":"INV-005","owner":"inventory-ui","priority":"P3","risk":"low","status":"out-of-scope","created_at":"2026-09-26T00:00:00Z","updated_at":"2026-09-26T00:00:00Z","evidence":[],"misses":[]} -->
- [ ] Phase 2: bulk-edit owners
  - Type: ui
  - Behavior: Phase 2 only.

## Infrastructure Requirements

None.

## Deployment Steps

### Automated

None.

### Manual

None.

## Verifier Run Log
