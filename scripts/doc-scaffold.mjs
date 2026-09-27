#!/usr/bin/env node
/**
 * doc-scaffold.mjs — write the skeleton of a human document from its schema.
 *
 *   node .playbook/scripts/doc-scaffold.mjs <kind> <out.md> --feature="<name>" [--subject=UI|Service/Job|Package|Mixed]
 *   node .playbook/scripts/doc-scaffold.mjs kinds
 *
 * The skeleton carries the metadata table and every required (and, for the
 * flow guide, subject-dependent) section in order, each with a `<...>`
 * placeholder that doc-check.mjs refuses until it is replaced. Never overwrites.
 */
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { loadDocSchemas } from "./doc-lib.mjs";

export function scaffold(kind, feature, subject = "Mixed", schemas = loadDocSchemas()) {
  const k = schemas.kinds[kind];
  if (!k) throw new Error(`unknown kind ${kind}; one of ${Object.keys(schemas.kinds).join(", ")}`);
  const sections = k.order.filter((s) => k.required.includes(s)
    || (s === "Screen / Tab flows" && /UI|Mixed/i.test(subject))
    || (s === "Service / package / job flows" && /Service|Package|Mixed/i.test(subject)));
  const meta = k.metadata.length
    ? ["| | |", "|---|---|", ...k.metadata.map((m) => `| ${m} | ${m === "Subject type" ? subject : m === "Updated by" ? "`/refresh-doc` (Mode B) on any code change" : `<${m.toLowerCase()}>`} |`), ""]
    : [];
  const body = sections.map((s, i) => {
    const diagram = (s === "Map" || s === "How to verify a value" || s === "System diagram")
      ? "\n```mermaid\nflowchart LR\n  A[<start>] --> B[<end>]\n```\n"
      : s === "ER diagram" ? "\n```mermaid\nerDiagram\n  <ENTITY> ||--o{ <CHILD> : has\n```\n" : "";
    const table = s === "Data sources"
      ? "\n| What you see | Comes from | Where to find it | What you see there |\n|---|---|---|---|\n| <value> | <source> | <portal> → <page> | <what is shown> |\n"
      : "";
    return `## ${i + 1}. ${s}\n\n<${s.toLowerCase()}>\n${table}${diagram}`;
  });
  return [`# ${feature} — ${k.title}`, `<!-- document: ${kind} -->`, "", ...meta, ...body].join("\n");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [kind, out] = process.argv.slice(2);
  const opt = (n) => process.argv.find((a) => a.startsWith(`--${n}=`))?.split("=").slice(1).join("=");
  if (kind === "kinds") { console.log(Object.keys(loadDocSchemas().kinds).join("\n")); process.exit(0); }
  if (!kind || !out || !opt("feature")) { console.log('usage: doc-scaffold.mjs <kind> <out.md> --feature="<name>" [--subject=UI|Service/Job|Package|Mixed]'); process.exit(2); }
  if (existsSync(out)) { console.log(`refused: ${out} exists; refresh it with /refresh-doc`); process.exit(1); }
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, scaffold(kind, opt("feature"), opt("subject") ?? "Mixed"));
  console.log(`doc-scaffold: wrote ${out}`);
}
