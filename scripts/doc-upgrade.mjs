#!/usr/bin/env node
/**
 * doc-upgrade.mjs — back up legacy documents before /upgrade-docs replaces
 * them, and report what an upgrade changed.
 *
 *   node .playbook/scripts/doc-upgrade.mjs backup <doc.md> ... [--run-id=<id>]
 *   node .playbook/scripts/doc-upgrade.mjs report <folder>
 *
 * `backup` copies each file byte-for-byte to <folder>/_legacy/<run-id>/ and
 * refuses to overwrite an existing backup; the original stays in place for the
 * upgrade to edit. `report` lists every backup with its size and the current
 * document it was taken from, plus current documents that doc-check rejects.
 * Deleting a backup is a human decision; this script never deletes.
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { createHash } from "node:crypto";
import { checkDocument } from "./doc-check.mjs";
import { kindOf } from "./doc-lib.mjs";

const hash = (p) => createHash("sha256").update(readFileSync(p)).digest("hex").slice(0, 12);
const [verb, ...rest] = process.argv.slice(2);
const runId = rest.find((a) => a.startsWith("--run-id="))?.slice(9) ?? `upgrade-${new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z")}`;

if (verb === "backup") {
  const files = rest.filter((a) => !a.startsWith("--"));
  if (!files.length) { console.log("usage: backup <doc.md> ... [--run-id=<id>]"); process.exit(2); }
  let bad = 0;
  for (const f of files) {
    if (!existsSync(f)) { console.log(`missing ${f}`); bad += 1; continue; }
    const dir = join(dirname(f), "_legacy", runId);
    const dest = join(dir, basename(f));
    if (existsSync(dest)) { console.log(`refused ${f}: backup ${dest} already exists`); bad += 1; continue; }
    mkdirSync(dir, { recursive: true });
    copyFileSync(f, dest);
    if (hash(f) !== hash(dest)) { console.log(`failed ${f}: backup differs`); bad += 1; continue; }
    console.log(`backed up ${f} -> ${dest} (sha256 ${hash(dest)})`);
  }
  process.exit(bad ? 1 : 0);
}

if (verb === "report") {
  const folder = rest.find((a) => !a.startsWith("--"));
  if (!folder) { console.log("usage: report <folder>"); process.exit(2); }
  const legacy = join(folder, "_legacy");
  if (existsSync(legacy)) for (const run of readdirSync(legacy).sort()) for (const f of readdirSync(join(legacy, run)).sort()) {
    const current = join(folder, f);
    console.log(`backup ${run}/${f} ${statSync(join(legacy, run, f)).size} bytes; current ${existsSync(current) ? (hash(current) === hash(join(legacy, run, f)) ? "unchanged" : "upgraded") : "removed"}`);
  }
  let rejected = 0;
  for (const f of readdirSync(folder).filter((x) => x.endsWith(".md")).sort()) {
    const kind = kindOf(f);
    if (!kind) continue;
    const r = checkDocument(readFileSync(join(folder, f), "utf8"), { kind });
    if (r.problems.length) { rejected += 1; console.log(`doc-check ${f}: ${r.problems.length} problem(s)`); }
  }
  console.log(`doc-upgrade: ${rejected} document(s) still fail their schema`);
  process.exit(0);
}
console.log("usage: doc-upgrade.mjs backup <doc.md> ... [--run-id=<id>] | report <folder>");
process.exit(2);
