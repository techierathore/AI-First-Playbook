#!/usr/bin/env node
/**
 * doc-check.mjs — check a human document against its schema in
 * playbook/document-schemas.json (installed as .playbook/document-schemas.json).
 *
 *   node .playbook/scripts/doc-check.mjs <doc.md> [--kind=<kind>] [--size=small|medium|large]
 *
 * The kind comes from the `<!-- document: <kind> -->` marker or the file name.
 * Checks: required sections present and in order; subject-dependent flow-guide
 * sections; metadata rows; the word MAXIMUM for the size (TARGET is reported);
 * unfilled `<...>` placeholders; Mermaid instead of ASCII diagrams; per-kind
 * row rules (named flow rows, plain English, portal paths, ER diagram, no
 * secrets). One line per problem; exit 1 on any.
 */
import { readFileSync } from "node:fs";
import { fencedBlocks, headings, kindOf, loadDocSchemas, matches, metadataRows, proseWords } from "./doc-lib.mjs";
import { redact } from "./miss-lib.mjs";

const SQL = /\b(SELECT\s+.+\s+FROM|INSERT\s+INTO|UPDATE\s+\w+\s+SET|DELETE\s+FROM|CREATE\s+(TABLE|VIEW|PROCEDURE))\b/i;
const INTERNAL = /(`[^`]+`|\b\w+\.(cs|ts|tsx|js|py|sql|java)\b|\busp[A-Z]\w+|\bvw[A-Z]\w+|\[\w+\]\.\[\w+\])/;

export function checkDocument(text, { kind, size = "medium", schemas = loadDocSchemas() } = {}) {
  const problems = [];
  kind ??= text.match(/<!--\s*document:\s*([a-z-]+)\s*-->/)?.[1];
  const k = schemas.kinds[kind];
  if (!k) return { kind: null, problems: [`unknown document kind; mark it <!-- document: <kind> --> (${Object.keys(schemas.kinds).join(", ")})`] };
  const h2 = headings(text, 2);
  const meta = metadataRows(text);
  for (const m of k.metadata) if (!meta.has(m)) problems.push(`metadata row "${m}" is missing`);
  const subject = meta.get("Subject type") ?? "";
  const expected = k.order.filter((s) => k.required.includes(s)
    || (s === "Screen / Tab flows" && /UI|Mixed/i.test(subject))
    || (s === "Service / package / job flows" && /Service|Package|Mixed/i.test(subject)));
  let cursor = -1;
  for (const s of expected) {
    const at = h2.findIndex((h) => matches(h.title, s));
    if (at === -1) { problems.push(`missing section "## ${s}"`); continue; }
    if (at < cursor) problems.push(`section "## ${s}" is out of order; expected ${expected.join(", ")}`);
    cursor = Math.max(cursor, at);
  }
  const [target, max] = k.budget[size] ?? k.budget.medium;
  const words = proseWords(text);
  if (words > max) problems.push(`${words} words; the ${size} maximum is ${max} (target ${target})`);
  for (const [i, line] of text.split("\n").entries()) {
    if (/<[a-z][^>]*>/.test(line) && !/<!--|<br\s*\/?>|<\/?(details|summary|sub|sup|kbd|code)>/.test(line)) problems.push(`line ${i + 1}: unfilled placeholder ${line.match(/<[a-z][^>]*>/)[0]}`);
  }
  const prose = text.replace(/```[\s\S]*?```/g, "");
  if (/(\+-{3,}\+|[┌┐└┘│─]{2,}|-{2,}>\s*\[)/.test(prose)) problems.push("an ASCII diagram outside a Mermaid block; use ```mermaid");
  const blocks = fencedBlocks(text);
  if (k.rules.includes("no-code-listing")) for (const b of blocks) if (b.lang !== "mermaid" && b.body.split("\n").length > 4) problems.push(`a ${b.lang || "plain"} code listing of ${b.body.split("\n").length - 1} lines; the guide is a map, quote at most 3 lines`);
  if (k.rules.includes("flow-rows-named")) {
    let section = "";
    for (const line of text.split("\n")) {
      const h = line.match(/^##\s+(.*)$/);
      if (h) section = h[1];
      if (!/Screen|Service/i.test(section) || !/^\|/.test(line) || /^\|[-\s|]+\|$/.test(line)) continue;
      const cells = line.split("|").slice(1, -1).map((c) => c.trim());
      if (cells.length < 3 || /^(UI element|#|Action)/i.test(cells[0])) continue;
      if (!/`[^`]+`|\[(VERIFY|PLANNED|KNOWN ISSUE)/.test(line)) problems.push(`flow row "${cells[0].slice(0, 40)}" names no identifier and no [VERIFY]/[PLANNED] mark`);
    }
  }
  if (k.rules.includes("plain-english")) {
    if (SQL.test(prose) || blocks.some((b) => b.lang !== "mermaid")) problems.push("SQL or code appears; this document is plain English only");
    const internal = prose.split("\n").find((l) => INTERNAL.test(l));
    if (internal) problems.push(`internal name or path in a plain-English document: "${internal.trim().slice(0, 60)}"`);
  }
  if (k.rules.includes("portal-paths")) {
    const sources = text.split(/^##\s+.*Data sources.*$/m)[1]?.split(/^##\s/m)[0] ?? "";
    const rows = sources.split("\n").filter((l) => /^\|/.test(l) && !/^\|[-\s|]+\|$/.test(l)).slice(1);
    if (!rows.length) problems.push("Data sources has no table rows");
    for (const r of rows) if (!/→|->|>/.test(r)) problems.push(`data source row without a portal path: "${r.slice(0, 50)}"`);
  }
  if (k.rules.includes("er-diagram") && !blocks.some((b) => b.lang === "mermaid" && /erDiagram/.test(b.body))) problems.push("no Mermaid erDiagram");
  if (k.rules.includes("mermaid-only") && ["Map", "System diagram", "How to verify a value"].some((s) => expected.includes(s)) && !blocks.some((b) => b.lang === "mermaid")) problems.push("no Mermaid diagram where the schema requires one");
  if (k.rules.includes("no-secrets") && redact(text, 1e9) !== text.replace(/\s+/g, " ").trim()) problems.push("a secret-like value appears");
  return { kind, words, target, max, problems };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const file = process.argv[2];
  const opt = (n) => process.argv.find((a) => a.startsWith(`--${n}=`))?.split("=")[1];
  if (!file) { console.log("usage: doc-check.mjs <doc.md> [--kind=<kind>] [--size=small|medium|large]"); process.exit(2); }
  const text = readFileSync(file, "utf8");
  const r = checkDocument(text, { kind: opt("kind") ?? kindOf(file) ?? undefined, size: opt("size") ?? "medium" });
  for (const p of r.problems) console.log(`${file}: ${p}`);
  console.log(`doc-check: ${r.kind ?? "unknown"} ${r.words ?? 0} words (target ${r.target ?? "-"}, max ${r.max ?? "-"}); ${r.problems.length} problem(s)`);
  process.exit(r.problems.length ? 1 : 0);
}
