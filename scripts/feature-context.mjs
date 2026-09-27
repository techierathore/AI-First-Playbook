#!/usr/bin/env node
/**
 * feature-context.mjs — find a feature's checklist and the documents beside it.
 *
 *   node .playbook/scripts/feature-context.mjs locate <feature-folder|checklist> [--json]
 *   node .playbook/scripts/feature-context.mjs inventory-docs <feature-folder> [--json]
 *
 * `locate` names the one implementation checklist (exit 1 when there are none
 * or several — ask which, never pick), then the companion documents by kind,
 * Issues files and handoff records. `inventory-docs` lists every Markdown file
 * with its kind: agent document, schema document (and its kind), handoff,
 * Issues file, or other; the input for /refresh-doc Mode B.
 */
import { existsSync, readdirSync, statSync, realpathSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { isAgentDocument, kindOf } from "./doc-lib.mjs";
import { fileURLToPath } from "node:url";

function walk(dir, out = []) {
  for (const e of readdirSync(dir).sort()) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) { if (!e.startsWith("_") && !e.startsWith(".")) walk(p, out); }
    else if (e.endsWith(".md")) out.push(p);
  }
  return out;
}

export function classify(path) {
  if (/handoffs?\//.test(path)) return "handoff";
  if (/Issues\.md$/.test(path)) return "issues";
  if (/Implementation-Checklist\.md$/.test(path)) return "checklist";
  const kind = kindOf(path);
  if (kind) return `document:${kind}`;
  return isAgentDocument(path) ? "agent" : "other";
}

export function locate(target) {
  const folder = statSync(target).isDirectory() ? target : dirname(target);
  const files = walk(folder).map((p) => ({ path: p, kind: classify(p) }));
  const checklists = statSync(target).isDirectory() ? files.filter((f) => f.kind === "checklist").map((f) => f.path) : [target];
  return {
    folder,
    checklist: checklists.length === 1 ? checklists[0] : null,
    checklists,
    documents: files.filter((f) => f.kind.startsWith("document:")).map((f) => ({ kind: f.kind.slice(9), path: f.path })),
    issues: files.filter((f) => f.kind === "issues").map((f) => f.path),
    handoffs: files.filter((f) => f.kind === "handoff").map((f) => f.path),
  };
}

if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [verb, target] = process.argv.slice(2);
  if (!["locate", "inventory-docs"].includes(verb) || !target || !existsSync(target)) { console.log("usage: locate|inventory-docs <folder|checklist> [--json]"); process.exit(2); }
  const json = process.argv.includes("--json");
  if (verb === "inventory-docs") {
    const rows = walk(target).map((p) => ({ path: p, kind: classify(p) }));
    if (json) console.log(JSON.stringify(rows, null, 2)); else for (const r of rows) console.log(`${r.kind.padEnd(38)} ${r.path}`);
    process.exit(0);
  }
  const r = locate(target);
  if (json) console.log(JSON.stringify(r, null, 2));
  else {
    console.log(`checklist: ${r.checklist ?? (r.checklists.length ? `ambiguous — ${r.checklists.map((c) => basename(c)).join(", ")}` : "none found")}`);
    for (const d of r.documents) console.log(`${d.kind}: ${d.path}`);
    for (const i of r.issues) console.log(`issues: ${i}`);
    for (const h of r.handoffs) console.log(`handoff: ${h}`);
  }
  process.exit(r.checklist ? 0 : 1);
}
