/**
 * checklist-edit-lib.mjs — the one place that changes a checklist's text.
 * Every writer (result, self-test, infra, deploy, amend, archive, ingest)
 * goes through these helpers so edits land in the same shape: metadata stays
 * valid JSON in schema key order, annotations append at the end of the item
 * block, `misses` and `evidence` only grow, and the Status Table is re-synced
 * from metadata after each change.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { syncStatusTable } from "./checklist-create.mjs";
import { redact } from "./miss-lib.mjs";

export const OUTCOME_STATUS = {
  PASS: "pass", "PASS (code-audit)": "pass", FAIL: "fail", "FAIL (code-audit)": "fail", "DATA-GAP": "data-gap", BLOCKED: "blocked",
};
export const utcNow = (now = new Date()) => now.toISOString().replace(/\.\d+Z$/, "Z");
export const today = (now = new Date()) => now.toISOString().slice(0, 10);

/** Locate an item by stable ID: metadata line index, item line and last line of its block. */
export function findItem(lines, id) {
  for (let i = 0; i < lines.length; i += 1) {
    const m = lines[i].match(/^\s*<!--\s*metadata:\s*(\{.*\})\s*-->\s*$/);
    if (!m) continue;
    let meta;
    try { meta = JSON.parse(m[1]); } catch { continue; }
    if (meta.id !== id) continue;
    let end = i + 1;
    while (end + 1 < lines.length && (/^\s{2,}\S/.test(lines[end + 1]) || (/^\s*$/.test(lines[end + 1]) && /^\s{2,}\S/.test(lines[end + 2] ?? "")))) end += 1;
    return { metaIndex: i, itemIndex: i + 1, end, meta };
  }
  return null;
}

export function writeMeta(lines, found, meta) {
  lines[found.metaIndex] = `<!-- metadata: ${JSON.stringify(meta)} -->`;
}

/** Refuse free text that carries a credential; the checklist is committed. */
export function cleanText(text, what) {
  const value = String(text ?? "").replace(/\s+/g, " ").trim();
  if (redact(value, 100000) !== value) throw new Error(`${what} carries a secret-like value; store it redacted`);
  return value;
}

export class Checklist {
  constructor(path) {
    this.path = path;
    this.lines = readFileSync(path, "utf8").split("\n");
  }
  item(id) {
    const found = findItem(this.lines, id);
    if (!found) throw new Error(`no item ${id} in ${this.path}`);
    return found;
  }
  append(id, line) {
    const found = this.item(id);
    this.lines.splice(found.end + 1, 0, `  ${line}`);
    return found;
  }
  update(id, change) {
    const found = this.item(id);
    const meta = { ...found.meta };
    change(meta);
    writeMeta(this.lines, found, meta);
    return meta;
  }
  sectionRange(title) {
    const start = this.lines.findIndex((l) => l.trim() === `## ${title}`);
    if (start === -1) return null;
    let end = this.lines.length;
    for (let i = start + 1; i < this.lines.length; i += 1) if (/^#{1,2}\s/.test(this.lines[i])) { end = i; break; }
    return { start, end };
  }
  save({ sync = true } = {}) {
    let text = this.lines.join("\n");
    if (sync && this.sectionRange("Status Table")) text = syncStatusTable(text);
    writeFileSync(this.path, text);
    this.lines = text.split("\n");
  }
}
