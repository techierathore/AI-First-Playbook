# Team Inventory — BRD (INVENTED FIXTURE)

Invented from `docs/Greenfield-Case-Study.md` (Team Inventory). Not a real BRD.

## Requirements

- BRD-1: An operator filters the inventory list by owner.
- BRD-2: A CSV import that repeats an asset tag is rejected with a non-secret error.
- BRD-3: A rejected import writes no rows.
- BRD-4: An asset page shows its audit history newest first.
- BRD-5: Every owner change writes one audit event.
- BRD-6: Every import is logged with its accepted row count.

### Screen: Inventory screen

Filter bar, results grid, empty-state panel.

### Screen: Asset screen

Details and History tab.
