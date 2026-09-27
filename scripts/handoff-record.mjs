#!/usr/bin/env node
/**
 * handoff-record.mjs — create and validate gate handoff records against
 * playbook/handoff-schema.json (installed as .playbook/handoff-schema.json).
 *
 *   node .playbook/scripts/handoff-record.mjs kinds
 *   node .playbook/scripts/handoff-record.mjs template <kind>
 *   node .playbook/scripts/handoff-record.mjs create <kind> --out=<path> --set "Label=value" ...
 *   node .playbook/scripts/handoff-record.mjs validate <file.md> ...
 *
 * `create` refuses to write a record that fails validation. Values never
 * carry secrets: a value the shared redactor would change is rejected.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync, realpathSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { redact } from "./miss-lib.mjs";

const here = dirname(fileURLToPath(import.meta.url));
export function loadSchema() {
  for (const p of [join(here, "../handoff-schema.json"), join(here, "../playbook/handoff-schema.json")]) {
    if (existsSync(p)) return JSON.parse(readFileSync(p, "utf8"));
  }
  throw new Error("handoff-schema.json not found next to the scripts");
}

const UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?Z$/;
const DATE = /\b\d{4}-\d{2}-\d{2}\b/;
const LINK = /(https?:\/\/\S+|`[^`]+`|\b[\w.-]+\/[\w./#-]+)/;

export function template(kind, schema = loadSchema()) {
  const k = schema.kinds[kind];
  if (!k) throw new Error(`unknown kind ${kind}; one of ${Object.keys(schema.kinds).join(", ")}`);
  const hint = (label) => k.enums[label]?.join(" | ") ?? ({
    identity: "<name or role account>", transition: "<from-state> -> <to-state>", links: "<one or more paths or URLs>",
    decisions: "none | <decision; owner: <name>; due: YYYY-MM-DD>", expiry: "none | YYYY-MM-DD", utc: "YYYY-MM-DDTHH:MM:SSZ",
  }[schema.standing[label]] ?? `<${label.toLowerCase()}>`);
  return [`# ${k.title}`, `<!-- handoff: ${kind} -->`, ...k.fields.map((f) => `- ${f}: ${hint(f)}`), ""].join("\n");
}

export function parseRecord(text) {
  const kind = text.match(/<!--\s*handoff:\s*([a-z-]+)\s*-->/)?.[1] ?? null;
  const title = text.match(/^#\s+(.+)$/m)?.[1]?.trim() ?? null;
  const rows = [];
  for (const [i, line] of text.split("\n").entries()) {
    const m = line.match(/^- ([^:]+?(?: \(UTC\))?):\s*(.*)$/);
    if (m) rows.push({ label: m[1].trim(), value: m[2].trim(), line: i + 1 });
  }
  return { kind, title, rows };
}

export function validateRecord(text, schema = loadSchema()) {
  const problems = [];
  const { kind, title, rows } = parseRecord(text);
  const k = schema.kinds[kind];
  if (!k) return [`record has no known <!-- handoff: <kind> --> marker (${Object.keys(schema.kinds).join(", ")})`];
  if (title !== k.title) problems.push(`title must be "# ${k.title}"`);
  const labels = rows.map((r) => r.label);
  for (const f of k.fields) if (!labels.includes(f)) problems.push(`missing row "${f}"`);
  for (const r of rows) if (!k.fields.includes(r.label) && !(k.optional ?? []).includes(r.label)) problems.push(`line ${r.line}: unknown row "${r.label}"`);
  const present = labels.filter((l) => k.fields.includes(l));
  if (present.join("|") !== k.fields.filter((f) => present.includes(f)).join("|")) problems.push(`rows out of order; expected ${k.fields.join(", ")}`);
  const states = new Set(schema.feature_states);
  const recorded = rows.find((r) => r.label === "Recorded at (UTC)")?.value;
  for (const r of rows) {
    const at = `line ${r.line}: ${r.label}`;
    if (!r.value) { problems.push(`${at}: empty; write none where none is allowed`); continue; }
    if (/<[^>]+>/.test(r.value)) { problems.push(`${at}: still a template placeholder`); continue; }
    if (redact(r.value, 100000) !== r.value.replace(/\s+/g, " ").trim()) problems.push(`${at}: carries a secret-like value`);
    if (/^none$/i.test(r.value)) {
      if (!schema.none_allowed.includes(r.label)) problems.push(`${at}: "none" is not allowed here`);
      continue;
    }
    if (k.enums[r.label] && !k.enums[r.label].includes(r.value)) problems.push(`${at}: "${r.value}" not in ${k.enums[r.label].join(" | ")}`);
    switch (schema.standing[r.label]) {
      case "utc": if (!UTC.test(r.value)) problems.push(`${at}: must be UTC ISO-8601 ending in Z`); break;
      case "transition": {
        const m = r.value.match(/^([a-z-]+)\s*->\s*([a-z-]+)$/);
        if (!m || !states.has(m[1]) || !states.has(m[2])) problems.push(`${at}: must be "<state> -> <state>" from the feature states`);
        break;
      }
      case "links": if (!LINK.test(r.value)) problems.push(`${at}: needs at least one durable path or URL`); break;
      case "decisions": if (!/owner:/i.test(r.value) || !DATE.test(r.value)) problems.push(`${at}: each open decision names an owner and a due date`); break;
      case "expiry":
        if (!/^\d{4}-\d{2}-\d{2}$/.test(r.value)) problems.push(`${at}: none or a YYYY-MM-DD expiry`);
        else if (recorded && r.value <= recorded.slice(0, 10)) problems.push(`${at}: expiry is not after the record date`);
        break;
      default:
    }
    if (r.label === "Detected at (UTC)" && !UTC.test(r.value)) problems.push(`${at}: must be UTC ISO-8601 ending in Z`);
    if (r.label === "Open work" && !(/owner:/i.test(r.value) && DATE.test(r.value))) problems.push(`${at}: open work names an owner and a due date`);
  }
  if (kind === "verification-results") {
    const outcome = rows.find((r) => r.label === "Overall outcome")?.value;
    const nonPass = rows.find((r) => r.label === "Non-PASS items")?.value ?? "";
    if (outcome && outcome !== "PASS" && !/[A-Z][A-Z0-9]*-\d{3,}/.test(nonPass)) problems.push("a non-PASS outcome must name every non-PASS item ID");
    if (outcome === "PASS" && !/^none$/i.test(nonPass)) problems.push("a PASS outcome lists none under Non-PASS items");
  }
  if (kind === "acceptance") {
    const decision = rows.find((r) => r.label === "Decision")?.value;
    const expiry = rows.find((r) => r.label === "Exception expiry")?.value;
    if (decision === "accepted-with-expiring-exception" && /^none$/i.test(expiry ?? "")) problems.push("an expiring exception needs its expiry date");
  }
  return problems;
}

if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [verb, ...rest] = process.argv.slice(2);
  const schema = loadSchema();
  if (verb === "kinds") { console.log(Object.keys(schema.kinds).join("\n")); process.exit(0); }
  if (verb === "template") { process.stdout.write(template(rest[0], schema)); process.exit(0); }
  if (verb === "validate") {
    let bad = 0;
    for (const file of rest) {
      const problems = validateRecord(readFileSync(file, "utf8"), schema);
      for (const p of problems) console.log(`${file}: ${p}`);
      if (problems.length) bad += 1;
    }
    console.log(`handoff-record: ${rest.length - bad} of ${rest.length} record(s) valid`);
    process.exit(bad || !rest.length ? 1 : 0);
  }
  if (verb === "create") {
    const kind = rest[0];
    const out = rest.find((a) => a.startsWith("--out="))?.slice(6);
    if (!schema.kinds[kind] || !out) { console.log("usage: create <kind> --out=<path> --set \"Label=value\" ..."); process.exit(2); }
    const values = {};
    rest.forEach((a, i) => { if (a === "--set" && rest[i + 1]) { const [l, ...v] = rest[i + 1].split("="); values[l.trim()] = v.join("=").trim(); } });
    const k = schema.kinds[kind];
    const text = [`# ${k.title}`, `<!-- handoff: ${kind} -->`, ...k.fields.map((f) => `- ${f}: ${values[f] ?? ""}`), ...(k.optional ?? []).filter((f) => values[f]).map((f) => `- ${f}: ${values[f]}`), ""].join("\n");
    const problems = validateRecord(text, schema);
    if (problems.length) { for (const p of problems) console.log(`refused: ${p}`); process.exit(1); }
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, text);
    console.log(`handoff-record: wrote ${out}`);
    process.exit(0);
  }
  console.log("usage: handoff-record.mjs kinds | template <kind> | create <kind> --out=<path> --set ... | validate <file...>");
  process.exit(2);
}
