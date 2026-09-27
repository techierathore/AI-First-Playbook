#!/usr/bin/env node
/**
 * checklist-lint.mjs — check an implementation checklist against
 * playbook/checklist-schema.json (installed as .playbook/checklist-schema.json).
 *
 *   node .playbook/scripts/checklist-lint.mjs <checklist.md> [--json]
 *
 * Prints one line per problem as `<line>: <item or section>: <problem>` and a
 * summary with the size class. Exit 1 on any problem.
 */
import { existsSync, readFileSync, realpathSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { itemType, parseChecklist, wordCount } from "./checklist-lib.mjs";

const here = dirname(fileURLToPath(import.meta.url));
export function loadSchema() {
  for (const p of [join(here, "../checklist-schema.json"), join(here, "../playbook/checklist-schema.json")]) {
    if (existsSync(p)) return JSON.parse(readFileSync(p, "utf8"));
  }
  throw new Error("checklist-schema.json not found next to the scripts");
}

const words = (s) => wordCount(s);

export function lintChecklist(text, schema = loadSchema()) {
  const problems = [];
  const add = (line, where, message) => problems.push({ line, where, message });
  const { items, sections } = parseChecklist(text);
  const titles = new Map();
  const ids = new Map();
  const sectionTitles = new Set(sections.filter((s) => s.level === 2).map((s) => s.title));
  const S = schema.item;
  const M = schema.metadata;

  for (const name of schema.checklist.required_sections) {
    if (!sectionTitles.has(name)) add(0, "checklist", `missing required section "## ${name}"`);
  }

  for (const item of items) {
    const meta = item.metadata;
    let id = `line ${item.line}`;
    if (!meta) add(item.line, id, "missing <!-- metadata: {...} --> line above the item");
    else if (meta.error) add(meta.line, id, `metadata is not valid JSON: ${meta.error}`);
    else {
      const m = meta.value;
      id = m.id ?? id;
      const keys = Object.keys(m);
      const expected = M.keys.filter((k) => keys.includes(k));
      for (const k of M.keys) if (!keys.includes(k)) add(meta.line, id, `metadata is missing "${k}"`);
      if (JSON.stringify(keys.filter((k) => M.keys.includes(k))) !== JSON.stringify(expected)) add(meta.line, id, `metadata keys out of order; expected ${M.keys.join(", ")}`);
      if (m.id && !new RegExp(M.id_pattern).test(m.id)) add(meta.line, id, `id "${m.id}" is not a stable ID like REQ-014`);
      if (m.priority && !M.priority.includes(m.priority)) add(meta.line, id, `priority "${m.priority}" not in ${M.priority.join("|")}`);
      if (m.risk && !M.risk.includes(m.risk)) add(meta.line, id, `risk "${m.risk}" not in ${M.risk.join("|")}`);
      if (m.status && !M.status.includes(m.status)) add(meta.line, id, `status "${m.status}" not in the closed list`);
      for (const k of ["created_at", "updated_at"]) if (m[k] && !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/.test(m[k])) add(meta.line, id, `${k} is not UTC ISO-8601`);
      if (!Array.isArray(m.evidence)) add(meta.line, id, "evidence must be an array");
      if (!Array.isArray(m.misses)) add(meta.line, id, "misses must be an array");
      else for (const x of m.misses) if (!new RegExp(M.miss_pattern).test(x)) add(meta.line, id, `misses holds a non-MISS value "${x}"`);
      if (ids.has(m.id)) add(meta.line, id, `duplicate id (also line ${ids.get(m.id)})`);
      ids.set(m.id, meta.line);
    }
    item.id = id;
    const inactive = schema.checklist.inactive_status.includes(meta?.value?.status);
    const title = item.title;
    if (titles.has(title.toLowerCase())) add(item.line, id, `duplicate title (also line ${titles.get(title.toLowerCase())})`);
    titles.set(title.toLowerCase(), item.line);
    if (S.title_forbidden_first_words.includes(title.split(/\s+/)[0].toLowerCase())) add(item.line, id, "title must start with the verb of the one behaviour");
    if (inactive) continue;

    const type = itemType(item);
    for (const f of S.required) if (!item.fields[f]) add(item.line, id, `missing field "${f}"`);
    for (const [f, types] of Object.entries(S.required_for_type)) if (types.includes(type) && !item.fields[f]) add(item.line, id, `missing field "${f}" (required for ${type})`);
    if (item.fields.Type && !S.types.includes(type)) add(item.line, id, `Type "${item.fields.Type}" not in ${S.types.join("|")}`);
    const known = item.order.filter((f) => S.field_order.includes(f));
    const sorted = [...known].sort((a, b) => S.field_order.indexOf(a) - S.field_order.indexOf(b));
    if (known.join("|") !== sorted.join("|")) add(item.line, id, `fields out of order; expected ${S.field_order.join(", ")}`);
    for (const f of item.order) if (!S.field_order.includes(f)) add(item.line, id, `unknown field "${f}"`);

    const behavior = item.fields.Behavior ?? "";
    if ((behavior.match(/[.!?](\s|$)/g) ?? []).length > 1) add(item.line, id, "Behavior must be one sentence");
    if (item.fields.Location && !/`[^`]+`/.test(item.fields.Location)) add(item.line, id, "Location must name an exact path in backticks");
    if (item.fields["Coding Standards"] && !(/`[^`]+`/.test(item.fields["Coding Standards"]) && /section/i.test(item.fields["Coding Standards"]))) add(item.line, id, "Coding Standards must name the document in backticks and a section");

    const acc = item.fields.Acceptance ?? "";
    if (acc) {
      const A = S.acceptance;
      if (!new RegExp(A.pattern).test(acc)) add(item.line, id, 'Acceptance must read "When <actor> <does what> on <screen>, then <observable result>"');
      const n = words(acc);
      if (n > A.max_words) add(item.line, id, `Acceptance has ${n} words; maximum ${A.max_words} (target ${A.target_words})`);
      const then = acc.split(/, then /)[1] ?? "";
      for (const joiner of A.one_behavior_forbids) if (then.includes(joiner)) add(item.line, id, `Acceptance joins outcomes with "${joiner.trim()}"; one behaviour per item`);
      for (const w of A.subjective_words) if (new RegExp(`\\b${w}\\b`, "i").test(acc)) add(item.line, id, `Acceptance uses the subjective word "${w}"`);
    }
    const verify = (item.fields.Verify ?? "").toLowerCase();
    if (verify) {
      if (!S.verify.assertion_words.some((w) => new RegExp(`\\b${w}\\b`).test(verify))) add(item.line, id, "Verify names no assertion (assert/compare/check)");
      if (!S.verify.evidence_words.some((w) => new RegExp(`\\b${w}\\b`).test(verify))) add(item.line, id, "Verify names no retained evidence");
    }
    const body = Object.values(item.fields).join(" ");
    const n = words(`${title} ${body}`);
    if (n > S.budget_words.max) add(item.line, id, `item has ${n} words; maximum ${S.budget_words.max} (target ${S.budget_words.target})`);
  }

  const byId = new Map(items.filter((i) => i.metadata?.value?.id).map((i) => [i.metadata.value.id, i]));
  const deps = new Map();
  for (const item of items) {
    const dep = item.fields["Depends on"];
    if (!dep) continue;
    const list = dep.split(/[,\s]+/).filter(Boolean);
    for (const d of list) if (!byId.has(d)) add(item.line, item.id, `Depends on "${d}" is not a stable ID in this checklist`);
    deps.set(item.id, list.filter((d) => byId.has(d)));
  }
  const state = new Map();
  const visit = (node, path) => {
    if (state.get(node) === "done") return;
    if (state.get(node) === "active") { add(byId.get(node)?.line ?? 0, node, `dependency cycle: ${[...path, node].join(" -> ")}`); return; }
    state.set(node, "active");
    for (const d of deps.get(node) ?? []) visit(d, [...path, node]);
    state.set(node, "done");
  };
  for (const node of deps.keys()) visit(node, []);

  const statusSection = sections.find((s) => s.level === 2 && s.title === "Status Table");
  if (statusSection) {
    const lines = text.split("\n");
    const next = sections.find((s) => s.level <= 2 && s.line > statusSection.line);
    const table = lines.slice(statusSection.line, next ? next.line - 1 : lines.length).join("\n");
    for (const id of byId.keys()) if (!table.includes(id)) add(statusSection.line, id, "item is missing from the Status Table");
  }

  const active = items.filter((i) => !schema.checklist.inactive_status.includes(i.metadata?.value?.status)).length;
  const size = Object.entries(schema.checklist.sizes).find(([, [lo, hi]]) => active >= lo && active <= hi)?.[0] ?? (active > schema.checklist.split_above ? "over" : "empty");
  if (size === "over") add(0, "checklist", `${active} active items; above ${schema.checklist.split_above}, split or archive`);
  if (size === "empty") add(0, "checklist", "no active items");
  return { problems, items: items.length, active, size };
}

if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const file = process.argv[2];
  if (!file) { console.log("usage: checklist-lint.mjs <checklist.md> [--json]"); process.exit(2); }
  const result = lintChecklist(readFileSync(file, "utf8"));
  if (process.argv.includes("--json")) console.log(JSON.stringify(result, null, 2));
  else {
    for (const p of result.problems) console.log(`${p.line}: ${p.where}: ${p.message}`);
    console.log(`checklist-lint: ${result.problems.length} problem(s); ${result.active} active item(s), size ${result.size}`);
  }
  process.exit(result.problems.length ? 1 : 0);
}
