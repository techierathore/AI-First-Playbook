/**
 * doc-lib.mjs — shared reading of human documents for the document tools
 * (doc-scaffold, doc-check, render-docs, doc-drift, reference-lint, doc-upgrade).
 */
import { existsSync, readFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
export function loadDocSchemas() {
  for (const p of [join(here, "../document-schemas.json"), join(here, "../playbook/document-schemas.json")]) {
    if (existsSync(p)) return JSON.parse(readFileSync(p, "utf8"));
  }
  throw new Error("document-schemas.json not found next to the scripts");
}

export function kindOf(path, schemas = loadDocSchemas()) {
  const name = basename(path);
  return Object.entries(schemas.kinds).find(([, k]) => name.endsWith(k.file))?.[0] ?? null;
}

export function isAgentDocument(path, schemas = loadDocSchemas()) {
  const name = basename(path);
  return schemas.agent_documents.some((suffix) => name === suffix || name.endsWith(suffix)) || /checklist/i.test(name);
}

/** Level-2 headings with numbering and trailing notes removed. */
export function headings(text, level = 2) {
  const out = [];
  let fence = false;
  for (const [i, line] of text.split("\n").entries()) {
    if (/^\s*```/.test(line)) { fence = !fence; continue; }
    if (fence) continue;
    const m = line.match(/^(#{1,6})\s+(.*)$/);
    if (m && m[1].length === level) out.push({ line: i + 1, raw: m[2], title: m[2].replace(/^\d+(\.\d+)*\.?\s*/, "").replace(/\s*_\(.*\)_\s*$/, "").replace(/\s*[—-]\s.*$/, "").replace(/["“”?]/g, "").trim() });
  }
  return out;
}

export const matches = (heading, name) => heading.toLowerCase().startsWith(name.toLowerCase().replace(/["“”?]/g, ""));

/** Prose words outside fenced code blocks and HTML comments. */
export function proseWords(text) {
  const prose = text.replace(/```[\s\S]*?```/g, " ").replace(/<!--[\s\S]*?-->/g, " ");
  return (prose.match(/\S+/g) ?? []).length;
}

export function fencedBlocks(text) {
  return [...text.matchAll(/```(\w*)\n([\s\S]*?)```/g)].map((m) => ({ lang: m[1], body: m[2] }));
}

export function metadataRows(text) {
  const rows = new Map();
  for (const m of text.matchAll(/^\|\s*([^|]+?)\s*\|\s*([^|]*?)\s*\|\s*$/gm)) rows.set(m[1], m[2]);
  return rows;
}
