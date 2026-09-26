#!/usr/bin/env node
/**
 * checklist-plan.mjs — group checklist items for a phase.
 *
 *   node .playbook/scripts/checklist-plan.mjs verify <checklist> [--json]
 *
 * `verify` buckets the in-scope items by Type and names the one Verifier
 * adapter each bucket loads (.opencode/templates/verifier/<adapter>.md). An
 * adapter is loaded only when its bucket is non-empty. Items with metadata
 * status `out-of-scope`, `deferred` or `abandoned` are skipped and counted.
 */
import { readFileSync } from "node:fs";
import { itemType, parseChecklist } from "./checklist-lib.mjs";

export const ADAPTERS = {
  ui: "ui", "backend-api": "api", "backend-service": "api", db: "db",
  logging: "logging-infra", infrastructure: "logging-infra", desktop: "desktop", "cross-cutting": null,
};
const SKIPPED = new Set(["out-of-scope", "deferred", "abandoned"]);

export function verifyPlan(text) {
  const { items } = parseChecklist(text);
  const buckets = {};
  const skipped = [];
  const untyped = [];
  for (const item of items) {
    const id = item.metadata?.value?.id ?? `line ${item.line}`;
    if (SKIPPED.has(item.metadata?.value?.status)) { skipped.push(id); continue; }
    const type = itemType(item);
    if (!type || !(type in ADAPTERS)) { untyped.push(id); continue; }
    (buckets[type] ??= []).push(id);
  }
  const adapters = [...new Set(Object.keys(buckets).map((t) => ADAPTERS[t]).filter(Boolean))].sort();
  return { buckets, adapters, skipped, untyped };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [mode, path] = process.argv.slice(2);
  if (mode !== "verify" || !path) {
    console.log("usage: checklist-plan.mjs verify <checklist> [--json]");
    process.exit(2);
  }
  const plan = verifyPlan(readFileSync(path, "utf8"));
  if (process.argv.includes("--json")) console.log(JSON.stringify(plan, null, 2));
  else {
    for (const [type, ids] of Object.entries(plan.buckets)) console.log(`bucket ${type}: ${ids.join(", ")}`);
    console.log(`adapters to load: ${plan.adapters.map((a) => `.opencode/templates/verifier/${a}.md`).join(", ") || "none"}`);
    if (plan.skipped.length) console.log(`skipped (out of scope): ${plan.skipped.join(", ")}`);
    if (plan.untyped.length) console.log(`no valid Type (FAIL the item's plan, do not guess): ${plan.untyped.join(", ")}`);
  }
  process.exit(plan.untyped.length ? 1 : 0);
}
