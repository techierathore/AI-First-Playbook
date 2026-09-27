#!/usr/bin/env node
/**
 * template-lint.mjs — every template under templates/ declares its shape in a
 * `<!-- template-schema: {...} -->` block: what it produces, required
 * sections in order, optional parts, TARGET/MAXIMUM word budgets per size and
 * the rule every row follows. Handoff templates must match
 * playbook/handoff-schema.json field for field.
 *
 *   node scripts/template-lint.mjs [templates-dir]
 */
import { readdirSync, readFileSync, statSync, realpathSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));

export function templateFiles(dir) {
  const out = [];
  for (const name of readdirSync(dir).sort()) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...templateFiles(p));
    else if (name.endsWith(".md")) out.push(p);
  }
  return out;
}

export function readBlock(text) {
  const m = text.match(/<!--\s*template-schema:\s*(\{.*\})\s*-->/);
  if (!m) return { error: "no <!-- template-schema: {...} --> block" };
  try { return { block: JSON.parse(m[1]) }; } catch (e) { return { error: `schema block is not JSON: ${e.message}` }; }
}

export function lintTemplates(dir = join(root, "templates"), handoffSchema = JSON.parse(readFileSync(join(root, "playbook/handoff-schema.json"), "utf8"))) {
  const problems = [];
  const files = templateFiles(dir);
  for (const file of files) {
    const rel = relative(dir, file).replaceAll("\\", "/");
    const { block, error } = readBlock(readFileSync(file, "utf8"));
    if (error) { problems.push(`${rel}: ${error}`); continue; }
    if (typeof block.produces !== "string" || !block.produces) problems.push(`${rel}: "produces" must name the output`);
    if (!Array.isArray(block.required) || !block.required.length || block.required.some((s) => typeof s !== "string" || !s)) problems.push(`${rel}: "required" must list sections in order`);
    if (!Array.isArray(block.optional)) problems.push(`${rel}: "optional" must be a list (empty when none)`);
    let previous = [0, 0];
    for (const size of ["small", "medium", "large"]) {
      const b = block.budget?.[size];
      if (!Array.isArray(b) || b.length !== 2 || !b.every(Number.isInteger)) { problems.push(`${rel}: budget.${size} must be [TARGET, MAXIMUM]`); continue; }
      if (b[0] > b[1]) problems.push(`${rel}: budget.${size} TARGET is above MAXIMUM`);
      if (b[1] < previous[1]) problems.push(`${rel}: budget.${size} MAXIMUM is below the smaller size's`);
      previous = b;
    }
    if (typeof block.rows !== "string" || !block.rows.trim()) problems.push(`${rel}: "rows" must state the rule every row follows`);
    const kind = rel.match(/^handoffs\/([a-z-]+)\.md$/)?.[1];
    if (kind) {
      const k = handoffSchema.kinds[kind];
      if (!k) problems.push(`${rel}: no handoff kind "${kind}" in handoff-schema.json`);
      else if (JSON.stringify(block.required) !== JSON.stringify(k.fields)) problems.push(`${rel}: required rows differ from handoff-schema.json`);
    }
  }
  return { files: files.length, problems };
}

if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { files, problems } = lintTemplates(process.argv[2] ?? join(root, "templates"));
  for (const p of problems) console.log(p);
  console.log(`template-lint: ${files - new Set(problems.map((p) => p.split(":")[0])).size} of ${files} template(s) declare a valid schema`);
  process.exit(problems.length ? 1 : 0);
}
