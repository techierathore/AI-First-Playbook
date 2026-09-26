#!/usr/bin/env node
/**
 * checklist-plan.mjs — group checklist items for a phase.
 *
 *   node .playbook/scripts/checklist-plan.mjs verify    <checklist> [--json]
 *   node .playbook/scripts/checklist-plan.mjs implement <checklist> [--json]
 *   node .playbook/scripts/checklist-plan.mjs fix       <checklist> [--json]
 *
 * `verify` buckets in-scope items by Type and names the one Verifier adapter
 * each bucket loads (.opencode/templates/verifier/<adapter>.md).
 * `implement` plans dependency-safe waves over items not yet built; `fix` does
 * the same over items whose latest Verifier Result is not a PASS. Items that
 * share a Location file form one slice with one owner, so parallel builders
 * never edit the same file; a slice runs in a later wave than every slice it
 * depends on. A dependency cycle or an unknown dependency stops the plan.
 */
import { readFileSync } from "node:fs";
import { itemType, parseChecklist } from "./checklist-lib.mjs";

export const ADAPTERS = {
  ui: "ui", "backend-api": "api", "backend-service": "api", db: "db",
  logging: "logging-infra", infrastructure: "logging-infra", desktop: "desktop", "cross-cutting": null,
};
const SKIPPED = new Set(["out-of-scope", "deferred", "abandoned"]);
const BUILT = new Set(["to-verify", "pass"]);
const idOf = (item) => item.metadata?.value?.id ?? `line-${item.line}`;
const statusOf = (item) => item.metadata?.value?.status ?? "planned";

export function latestVerdict(item) {
  const results = item.extra.filter((l) => /^- \*\*Verifier Result\*\*/.test(l));
  const last = results.at(-1);
  return last ? (last.match(/:\s*(PASS \(code-audit\)|FAIL \(code-audit\)|DATA-GAP|BLOCKED|PASS|FAIL)\b/)?.[1] ?? null) : null;
}

export function verifyPlan(text) {
  const { items } = parseChecklist(text);
  const buckets = {};
  const skipped = [];
  const untyped = [];
  for (const item of items) {
    const id = idOf(item);
    if (SKIPPED.has(statusOf(item))) { skipped.push(id); continue; }
    const type = itemType(item);
    if (!type || !(type in ADAPTERS)) { untyped.push(id); continue; }
    (buckets[type] ??= []).push(id);
  }
  const adapters = [...new Set(Object.keys(buckets).map((t) => ADAPTERS[t]).filter(Boolean))].sort();
  return { buckets, adapters, skipped, untyped };
}

function files(item) {
  return [...(item.fields.Location ?? "").matchAll(/`([^`]+)`/g)].map((m) => m[1].split(/[#:\s]/)[0]);
}

export function wavePlan(text, mode) {
  const { items } = parseChecklist(text);
  const byId = new Map(items.map((i) => [idOf(i), i]));
  const inScope = items.filter((i) => {
    if (SKIPPED.has(statusOf(i))) return false;
    if (mode === "implement") return !BUILT.has(statusOf(i));
    const v = latestVerdict(i);
    return (v && !v.startsWith("PASS")) || ["fail", "blocked", "data-gap"].includes(statusOf(i));
  });
  const scope = new Set(inScope.map(idOf));
  const errors = [];
  // one owner per shared file: union items that touch the same path
  const parent = new Map([...scope].map((id) => [id, id]));
  const find = (x) => (parent.get(x) === x ? x : (parent.set(x, find(parent.get(x))), parent.get(x)));
  const owner = new Map();
  for (const item of inScope) for (const f of files(item)) {
    if (owner.has(f)) parent.set(find(idOf(item)), find(owner.get(f)));
    else owner.set(f, idOf(item));
  }
  const slices = new Map();
  for (const id of scope) {
    const root = find(id);
    if (!slices.has(root)) slices.set(root, { items: [], files: new Set(), deps: new Set() });
    slices.get(root).items.push(id);
  }
  for (const item of inScope) {
    const slice = slices.get(find(idOf(item)));
    for (const f of files(item)) slice.files.add(f);
    for (const d of (item.fields["Depends on"] ?? "").split(/[,\s]+/).filter(Boolean)) {
      if (!byId.has(d)) { errors.push(`${idOf(item)} depends on unknown ${d}`); continue; }
      if (scope.has(d) && find(d) !== find(idOf(item))) slice.deps.add(find(d));
    }
  }
  const wave = new Map();
  const visiting = new Set();
  const waveOf = (root) => {
    if (wave.has(root)) return wave.get(root);
    if (visiting.has(root)) { errors.push(`dependency cycle through ${slices.get(root).items.join(", ")}`); return 1; }
    visiting.add(root);
    const w = 1 + Math.max(0, ...[...slices.get(root).deps].map(waveOf));
    visiting.delete(root);
    wave.set(root, w);
    return w;
  };
  for (const root of slices.keys()) waveOf(root);
  const waves = [];
  for (const [root, s] of slices) {
    const w = wave.get(root);
    (waves[w - 1] ??= { wave: w, slices: [] }).slices.push({ items: s.items.sort(), files: [...s.files].sort() });
  }
  return { mode, scope: [...scope], waves: waves.filter(Boolean), errors };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [mode, path] = process.argv.slice(2);
  if (!["verify", "implement", "fix"].includes(mode) || !path) {
    console.log("usage: checklist-plan.mjs verify|implement|fix <checklist> [--json]");
    process.exit(2);
  }
  const text = readFileSync(path, "utf8");
  if (mode === "verify") {
    const plan = verifyPlan(text);
    if (process.argv.includes("--json")) console.log(JSON.stringify(plan, null, 2));
    else {
      for (const [type, ids] of Object.entries(plan.buckets)) console.log(`bucket ${type}: ${ids.join(", ")}`);
      console.log(`adapters to load: ${plan.adapters.map((a) => `.opencode/templates/verifier/${a}.md`).join(", ") || "none"}`);
      if (plan.skipped.length) console.log(`skipped (out of scope): ${plan.skipped.join(", ")}`);
      if (plan.untyped.length) console.log(`no valid Type (FAIL the item's plan, do not guess): ${plan.untyped.join(", ")}`);
    }
    process.exit(plan.untyped.length ? 1 : 0);
  }
  const plan = wavePlan(text, mode);
  if (process.argv.includes("--json")) console.log(JSON.stringify(plan, null, 2));
  else {
    console.log(`${mode}: ${plan.scope.length} item(s) in scope, ${plan.waves.length} wave(s)`);
    for (const w of plan.waves) {
      console.log(`wave ${w.wave}:`);
      w.slices.forEach((s, i) => console.log(`  builder ${String.fromCharCode(65 + i)} -> ${s.items.join(", ")}  [${s.files.join(", ") || "no files named"}]`));
    }
    for (const e of plan.errors) console.log(`error: ${e}`);
  }
  process.exit(plan.errors.length ? 1 : 0);
}
