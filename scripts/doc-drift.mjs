#!/usr/bin/env node
/**
 * doc-drift.mjs — compare the code identifiers a document names with the code.
 *
 *   node .playbook/scripts/doc-drift.mjs <doc.md> --code=<dir>[,<dir>...] [--json]
 *
 * Every backticked `path/file.ext` must exist under a code root, and every
 * `File.ext:method` or `path/file.ext:method` must name a file whose text
 * contains the method name. Rows marked [PLANNED], [VERIFY] or [STALE] are
 * counted, not checked. The report lists stale references by line — the
 * input for /refresh-doc; exit 1 when anything is stale.
 */
import { existsSync, readFileSync, readdirSync, statSync, realpathSync } from "node:fs";
import { basename, join } from "node:path";
import { fileURLToPath } from "node:url";

function index(roots) {
  const byName = new Map();
  const walk = (dir) => {
    for (const entry of readdirSync(dir)) {
      if (entry === "node_modules" || entry.startsWith(".")) continue;
      const p = join(dir, entry);
      if (statSync(p).isDirectory()) walk(p);
      else (byName.get(entry) ?? byName.set(entry, []).get(entry)).push(p);
    }
  };
  for (const r of roots) walk(r);
  return byName;
}

export function drift(text, roots) {
  const files = index(roots);
  const find = (ref) => {
    if (ref.includes("/")) for (const r of roots) if (existsSync(join(r, ref))) return [join(r, ref)];
    return files.get(basename(ref)) ?? [];
  };
  const stale = [];
  let checked = 0, marked = 0;
  text.split("\n").forEach((line, i) => {
    if (/\[(PLANNED|VERIFY|STALE)/.test(line)) { marked += 1; return; }
    for (const m of line.matchAll(/`([A-Za-z0-9_./-]+\.[A-Za-z0-9]+)(?::([A-Za-z_][\w]*))?`/g)) {
      const [, ref, method] = m;
      if (/^https?:/.test(ref) || !/[A-Za-z]\.[a-z]{1,5}$/.test(ref)) continue;
      checked += 1;
      const hits = find(ref);
      if (!hits.length) { stale.push({ line: i + 1, ref: m[1] + (method ? `:${method}` : ""), reason: "file not found" }); continue; }
      if (method && !hits.some((h) => readFileSync(h, "utf8").includes(method))) stale.push({ line: i + 1, ref: `${ref}:${method}`, reason: "method not found in the file" });
    }
  });
  return { checked, marked, stale };
}

if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const doc = process.argv[2];
  const code = process.argv.find((a) => a.startsWith("--code="))?.slice(7).split(",");
  if (!doc || !code) { console.log("usage: doc-drift.mjs <doc.md> --code=<dir>[,<dir>...] [--json]"); process.exit(2); }
  const r = drift(readFileSync(doc, "utf8"), code);
  if (process.argv.includes("--json")) console.log(JSON.stringify(r, null, 2));
  else {
    for (const s of r.stale) console.log(`stale line ${s.line}: \`${s.ref}\` — ${s.reason}`);
    console.log(`doc-drift: ${r.checked} reference(s) checked, ${r.stale.length} stale, ${r.marked} marked [PLANNED]/[VERIFY]/[STALE]`);
  }
  process.exit(r.stale.length ? 1 : 0);
}
