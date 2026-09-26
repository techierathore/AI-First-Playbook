#!/usr/bin/env node
/**
 * archive-manifest.mjs — hash an archived evidence folder so any later change
 * to the historical record is detectable.
 *
 *   node scripts/archive-manifest.mjs <folder>           # write <folder>/MANIFEST.sha256
 *   node scripts/archive-manifest.mjs <folder> --check   # exit 1 on any difference
 *
 * One `sha256  relative/path` line per file (sorted), then `tree <sha256>` over
 * those lines. README.md and MANIFEST.sha256 themselves are not hashed.
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";

const sha = (b) => createHash("sha256").update(b).digest("hex");
function files(dir, root = dir, out = []) {
  for (const e of readdirSync(dir).sort()) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) files(p, root, out);
    else out.push(relative(root, p).replaceAll("\\", "/"));
  }
  return out;
}
export function manifest(folder) {
  const lines = files(folder).filter((f) => f !== "MANIFEST.sha256" && f !== "README.md").map((f) => `${sha(readFileSync(join(folder, f)))}  ${f}`);
  return `${lines.join("\n")}\ntree ${sha(lines.join("\n"))}\n`;
}
if (import.meta.url === `file://${process.argv[1]}`) {
  const folder = process.argv[2];
  if (!folder) { console.log("usage: archive-manifest.mjs <folder> [--check]"); process.exit(2); }
  const text = manifest(folder);
  const path = join(folder, "MANIFEST.sha256");
  if (process.argv.includes("--check")) {
    const ok = existsSync(path) && readFileSync(path, "utf8") === text;
    console.log(ok ? `archive-manifest: ${folder} matches ${text.trim().split("\n").at(-1)}` : `archive-manifest: ${folder} differs from its MANIFEST.sha256`);
    process.exit(ok ? 0 : 1);
  }
  writeFileSync(path, text);
  console.log(`archive-manifest: wrote ${path} (${text.trim().split("\n").length - 1} files, ${text.trim().split("\n").at(-1)})`);
}
