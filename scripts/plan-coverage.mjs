#!/usr/bin/env node
/**
 * plan-coverage.mjs — every requirement in the requirements source maps to a
 * checklist item, and every screen maps to a UI item.
 *
 *   node .playbook/scripts/plan-coverage.mjs <requirements.md> <checklist.md> [--json]
 *
 * Requirement IDs are the source's own IDs (BRD-1, FR-12, US-3, INT-4 …); each
 * must appear in some active item (metadata `trace`, title or fields). Screens
 * are headings of the form `### Screen: <name>`; each must be named in the UI
 * ref of a `ui` or `desktop` item. Unmapped entries are listed; exit 1.
 */
import { readFileSync } from "node:fs";
import { itemType, parseChecklist } from "./checklist-lib.mjs";

const REQ = /\b(?:BRD|FR|US|INT|NFR)-\d+\b/g;

export function coverage(sourceText, checklistText) {
  const required = [...new Set(sourceText.match(REQ) ?? [])];
  const screens = [...sourceText.matchAll(/^#{2,4}\s+Screen:\s*(.+?)\s*$/gm)].map((m) => m[1]);
  const { items } = parseChecklist(checklistText);
  const active = items.filter((i) => !["out-of-scope", "abandoned"].includes(i.metadata?.value?.status));
  const haystack = active.map((i) => [i.title, JSON.stringify(i.metadata?.value?.trace ?? []), ...Object.values(i.fields)].join(" ")).join("\n");
  const found = new Set(haystack.match(REQ) ?? []);
  const uiRefs = active.filter((i) => ["ui", "desktop"].includes(itemType(i))).map((i) => (i.fields["UI ref"] ?? "").toLowerCase());
  return {
    requirements: required.length,
    unmapped: required.filter((r) => !found.has(r)),
    screens: screens.length,
    unmappedScreens: screens.filter((s) => !uiRefs.some((u) => u.includes(s.toLowerCase()))),
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [source, checklist] = process.argv.slice(2);
  if (!source || !checklist) { console.log("usage: plan-coverage.mjs <requirements.md> <checklist.md> [--json]"); process.exit(2); }
  const r = coverage(readFileSync(source, "utf8"), readFileSync(checklist, "utf8"));
  if (process.argv.includes("--json")) console.log(JSON.stringify(r, null, 2));
  else {
    for (const id of r.unmapped) console.log(`unmapped requirement: ${id}`);
    for (const s of r.unmappedScreens) console.log(`unmapped screen: ${s}`);
    console.log(`plan-coverage: ${r.requirements - r.unmapped.length} of ${r.requirements} requirement(s) and ${r.screens - r.unmappedScreens.length} of ${r.screens} screen(s) mapped`);
  }
  process.exit(r.unmapped.length || r.unmappedScreens.length || !r.requirements ? 1 : 0);
}
