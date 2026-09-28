#!/usr/bin/env node
/**
 * checklist-create.mjs — scaffold a checklist and keep its Status Table true.
 *
 *   node .playbook/scripts/checklist-create.mjs new  <out.md> --feature="<Feature name>"
 *   node .playbook/scripts/checklist-create.mjs sync <checklist.md>
 *
 * `new` writes the required sections in schema order (Status Table,
 * Infrastructure Requirements, Deployment Steps with Automated and Manual,
 * Verifier Run Log) and refuses to overwrite. `sync` rewrites the Status Table
 * from item metadata (ID, title, status), so no command hand-edits status rows.
 */
import { existsSync, readFileSync, writeFileSync, realpathSync } from "node:fs";
import { parseChecklist } from "./checklist-lib.mjs";
import { fileURLToPath } from "node:url";

export function skeleton(feature) {
  return `# ${feature} — Implementation Checklist

## Status Table

| ID | Item | Status |
|---|---|---|

## Items

## Infrastructure Requirements

_To be completed by /implement and /fix._

## Deployment Steps

### Automated

### Manual

## Verifier Run Log
`;
}

export function syncStatusTable(text) {
  const { items, sections } = parseChecklist(text);
  const s = sections.find((x) => x.level === 2 && x.title === "Status Table");
  if (!s) throw new Error('no "## Status Table" section');
  const lines = text.split("\n");
  const rows = items.filter((i) => i.metadata?.value?.id).map((i) => `| ${i.metadata.value.id} | ${i.title.replace(/\|/g, "/")} | ${i.metadata.value.status} |`);
  const table = ["| ID | Item | Status |", "|---|---|---|", ...rows];
  // Replace only the table itself: the first run of `|` lines after the
  // heading. Everything else in the section (items included) is kept.
  let start = s.line;
  while (start < lines.length && !/^\|/.test(lines[start]) && !/^#{1,2}\s/.test(lines[start])) start += 1;
  if (start >= lines.length || /^#{1,2}\s/.test(lines[start])) return [...lines.slice(0, s.line), "", ...table, ...lines.slice(s.line)].join("\n");
  let end = start;
  while (end < lines.length && /^\|/.test(lines[end])) end += 1;
  return [...lines.slice(0, start), ...table, ...lines.slice(end)].join("\n");
}

if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [verb, path] = process.argv.slice(2);
  const feature = process.argv.find((a) => a.startsWith("--feature="))?.slice(10);
  if (verb === "new" && path && feature) {
    if (existsSync(path)) { console.log(`refused: ${path} exists; amend it instead`); process.exit(1); }
    writeFileSync(path, skeleton(feature));
    console.log(`checklist-create: wrote ${path}`);
    process.exit(0);
  }
  if (verb === "sync" && path) {
    writeFileSync(path, syncStatusTable(readFileSync(path, "utf8")));
    console.log(`checklist-create: Status Table synced from metadata in ${path}`);
    process.exit(0);
  }
  console.log('usage: checklist-create.mjs new <out.md> --feature="<name>" | sync <checklist.md>');
  process.exit(2);
}
