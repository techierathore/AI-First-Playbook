// Generates the small, medium and large checklist fixtures. They are INVENTED
// from the two case studies (Team Inventory greenfield, Legacy Inventory Owner
// Filter brownfield); no real project supplied them. Re-run after a schema
// change: node tests/checklist/make-fixtures.mjs
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { repoRoot } from "../lib.mjs";

// [type, title, behavior, location, uiRef, acceptance, verify]
const BASE = [
  ["ui", "Filter the inventory list by owner", "Choosing an owner shows only that owner's assets.", "src/web/inventory/OwnerFilter.tsx", "Inventory screen, filter bar left of Search; reuse the select filter.", "When an operator selects owner Ana Ruiz on the Inventory screen, then every visible row shows owner Ana Ruiz", "Playwright selects the owner, reads every owner cell, asserts one distinct value, keeps the trace."],
  ["backend-api", "Reject a CSV import that repeats an asset tag", "The import endpoint rejects a file whose rows share an asset tag.", "src/api/imports/CsvImportController.ts", null, "When an operator posts a CSV with two rows tagged TAG-7 to the import endpoint, then the response status is 422", "curl posts the two-row fixture, asserts status 422 and code DUPLICATE_TAG, keeps the response body."],
  ["db", "Write no rows when a duplicate import is rejected", "A rejected duplicate import leaves the assets table unchanged.", "src/api/imports/ImportRepository.ts", null, "When an operator posts a CSV with two rows tagged TAG-7 to the import endpoint, then the assets row count is unchanged", "The DB runner counts assets before and after the request, asserts equal counts, keeps both counts."],
  ["ui", "Show an asset's audit history", "The asset page lists audit events newest first.", "src/web/assets/AuditHistory.tsx", "Asset screen, History tab; reuse the timeline list.", "When an operator opens the History tab on the Asset screen for TAG-2, then three audit rows appear newest first", "Playwright opens TAG-2 history, asserts three rows in descending time order, keeps the screenshot."],
  ["backend-api", "Return an asset by tag", "GET /assets/{tag} returns the asset with its owner.", "src/api/assets/AssetsController.ts", null, "When an operator requests TAG-1 from the assets endpoint, then the response owner field is Ana Ruiz", "curl requests TAG-1, asserts status 200 and owner Ana Ruiz, keeps the response body."],
  ["backend-service", "Record an audit event for each owner change", "Changing an owner writes one audit event.", "src/api/assets/OwnerService.ts", null, "When an operator changes the owner of TAG-3 through the owner endpoint, then one audit event names the new owner", "The integration runner changes the owner, asserts one new audit row, keeps the runner output."],
  ["logging", "Log each import with its row count", "Every import writes one INFO line with the accepted row count.", "src/api/imports/CsvImportController.ts", null, "When an operator imports a five-row CSV through the import endpoint, then the log holds one INFO line with count 5", "grep searches the run app.log for the import line, asserts count=5, keeps the matching line."],
  ["infrastructure", "Provision the import staging folder", "The import staging folder exists with write access for the API.", "deploy/team-inventory/staging-folder.sh", null, "When the deployment step creates the staging folder on the test host, then the API account can write a probe file", "The runner writes and deletes a probe file as the API account, asserts success, keeps the runner log."],
  ["ui", "Show the unknown-asset message", "Searching for an unknown tag shows a not-found message.", "src/web/inventory/SearchResults.tsx", "Inventory screen, results area; reuse the empty-state panel.", "When an operator searches for TAG-404 on the Inventory screen, then the empty-state panel reads No asset TAG-404", "Playwright searches TAG-404, asserts the panel text, keeps the screenshot."],
  ["cross-cutting", "Register the import services in one place", "Import services are registered once in the service container.", "src/api/Program.ts", null, "When the API starts on the test host, then the import endpoint answers the health probe with 200", "curl calls the import health probe, asserts status 200, keeps the response line."],
  ["db", "Add the owner index to the assets table", "The assets table has an index on owner for the filter query.", "db/migrations/0004_owner_index.sql", null, "When the migration runs on the test database, then the owner filter query plan uses the owner index", "The DB runner reads the query plan, asserts the index name appears, keeps the plan text."],
  ["backend-api", "Page the inventory list", "The list endpoint returns fifty rows per page with a next link.", "src/api/assets/AssetsController.ts", null, "When an operator requests page two of the inventory list endpoint, then the response holds fifty rows", "curl requests page two, asserts fifty rows, keeps the response hash."],
];

const OWNERS = ["inventory-ui", "inventory-api", "inventory-data", "inventory-ops"];
function item(n, base, variant) {
  const [type, title, behavior, location, uiRef, acceptance, verify] = base;
  const suffix = variant ? ` (variant ${variant})` : "";
  const id = `INV-${String(n).padStart(3, "0")}`;
  const meta = { schema: 1, id, owner: OWNERS[n % OWNERS.length], priority: `P${n % 3 + 1}`, risk: ["low", "medium", "high"][n % 3], status: "planned", created_at: "2026-09-26T00:00:00Z", updated_at: "2026-09-26T00:00:00Z", evidence: [], misses: [] };
  const lines = [
    `<!-- metadata: ${JSON.stringify(meta)} -->`,
    `- [ ] ${title}${suffix}`,
    `  - Type: ${type}`,
    `  - Behavior: ${behavior}`,
    `  - Location: \`${location}\``,
  ];
  if (uiRef) lines.push(`  - UI ref: ${uiRef}`);
  lines.push(
    `  - Logging: INFO at start and completion; ERROR with the asset tag on failure.`,
    `  - Acceptance: ${acceptance}`,
    `  - Verify: ${verify}`,
    `  - Coding Standards: \`docs/coding-standards.md\`, section ${n % 7 + 1}.1.`,
  );
  if (n > 1 && n % 4 === 0) lines.push(`  - Depends on: INV-${String(n - 1).padStart(3, "0")}`);
  return { id, text: lines.join("\n") };
}

function checklist(name, count) {
  const items = Array.from({ length: count }, (_, i) => item(i + 1, BASE[i % BASE.length], Math.floor(i / BASE.length)));
  return `# Team Inventory — ${name} Checklist (INVENTED FIXTURE)

Invented from \`docs/Greenfield-Case-Study.md\` and \`docs/Brownfield-Case-Study.md\` for the checklist
schema tests; generated by \`tests/checklist/make-fixtures.mjs\`. Not a real project.

## Status Table

| ID | Status |
|---|---|
${items.map((i) => `| ${i.id} | planned |`).join("\n")}

## Items

${items.map((i) => i.text).join("\n\n")}

## Infrastructure Requirements

- Import staging folder (INV-008).

## Deployment Steps

### Automated

None.

### Manual

None.

## Verifier Run Log
`;
}

const dir = join(repoRoot, "tests/checklist/fixtures");
mkdirSync(dir, { recursive: true });
for (const [name, count] of [["small", 6], ["medium", 14], ["large", 34]]) {
  writeFileSync(join(dir, `${name}-checklist.md`), checklist(name[0].toUpperCase() + name.slice(1), count));
}
console.log("fixtures written");
