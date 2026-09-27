#!/usr/bin/env node
/**
 * issues-file.mjs — render and check the transient Issues file.
 *
 *   node .playbook/scripts/issues-file.mjs render <issues.json> --out=<Feature-Issues.md> --feature="<name>"
 *   node .playbook/scripts/issues-file.mjs validate <Feature-Issues.md> [--keys=PROJ-1,PROJ-2]
 *
 * One `## Issue N: <title>` per defect, with Expected, Actual, Steps (ordered),
 * Severity (High | Medium | Low), optional Source key, Why missed and Miss ID.
 * A fact nobody supplied is written `[MISSING]`, never invented. `validate`
 * fails on a missing field, unordered steps, an unknown severity, a requested
 * key that is absent, or a secret-like value.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { redact, WHY_MISSED } from "./miss-lib.mjs";

const SEVERITY = ["High", "Medium", "Low"];
const FIELDS = ["Source", "Expected", "Actual", "Steps", "Severity", "Why missed", "Miss ID"];

export function renderIssues(issues, feature) {
  const out = [`# ${feature} - Issues`, "", "Transient input for `/analyze-fix`; delete only after every issue has a linked MISS ID in the checklist.", ""];
  issues.forEach((i, n) => {
    const steps = Array.isArray(i.steps) && i.steps.length ? i.steps.map((s, k) => `${k + 1}. ${s}`).join("  ") : "[MISSING]";
    out.push(`## Issue ${n + 1}: ${i.title || "[MISSING]"}`);
    if (i.key) out.push(`- **Source**: ${i.key}`);
    out.push(`- **Expected**: ${i.expected || "[MISSING]"}`, `- **Actual**: ${i.actual || "[MISSING]"}`, `- **Steps**: ${steps}`, `- **Severity**: ${SEVERITY.includes(i.severity) ? i.severity : "[MISSING]"}`);
    if (i.why_missed) out.push(`- **Why missed**: ${i.why_missed}`);
    out.push(`- **Miss ID**: ${i.miss_id ?? "pending"}`, "");
  });
  return out.join("\n");
}

export function parseIssues(text) {
  const issues = [];
  let cur = null;
  for (const line of text.split("\n")) {
    const h = line.match(/^##\s+Issue\s+(\d+):\s*(.*)$/);
    if (h) { cur = { n: Number(h[1]), title: h[2].trim(), fields: {} }; issues.push(cur); continue; }
    const f = line.match(/^- \*\*([^*]+)\*\*:\s*(.*)$/);
    if (f && cur) cur.fields[f[1]] = f[2].trim();
  }
  return issues;
}

export function validateIssues(text, keys = []) {
  const problems = [];
  const issues = parseIssues(text);
  if (!issues.length) problems.push('no "## Issue N: <title>" sections');
  for (const i of issues) {
    const at = `Issue ${i.n}`;
    for (const f of ["Expected", "Actual", "Steps", "Severity"]) if (!i.fields[f]) problems.push(`${at}: missing ${f}`);
    for (const f of Object.keys(i.fields)) if (!FIELDS.includes(f)) problems.push(`${at}: unknown field ${f}`);
    const steps = i.fields.Steps ?? "";
    if (steps && steps !== "[MISSING]") {
      const nums = [...steps.matchAll(/(?:^|\s)(\d+)\.\s/g)].map((m) => Number(m[1]));
      if (!nums.length || nums.some((n, k) => n !== k + 1)) problems.push(`${at}: Steps must be numbered 1., 2., …`);
    }
    if (i.fields.Severity && ![...SEVERITY, "[MISSING]"].includes(i.fields.Severity)) problems.push(`${at}: Severity "${i.fields.Severity}" is not High, Medium or Low`);
    if (i.fields["Why missed"] && !WHY_MISSED.includes(i.fields["Why missed"])) problems.push(`${at}: Why missed "${i.fields["Why missed"]}" is outside the closed list`);
    if (i.fields["Miss ID"] && !/^(MISS-\d{8}-\d+|pending)$/.test(i.fields["Miss ID"])) problems.push(`${at}: Miss ID must be MISS-… or pending`);
    for (const [f, v] of Object.entries(i.fields)) if (redact(v, 100000) !== v.replace(/\s+/g, " ").trim()) problems.push(`${at}: ${f} carries a secret-like value`);
  }
  for (const k of keys) if (!issues.some((i) => i.fields.Source === k)) problems.push(`requested key ${k} is not in the file`);
  return { issues, problems };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [verb, input, ...rest] = process.argv.slice(2);
  const opt = (n) => rest.find((a) => a.startsWith(`--${n}=`))?.split("=").slice(1).join("=");
  if (verb === "render" && input && opt("out")) {
    writeFileSync(opt("out"), renderIssues(JSON.parse(readFileSync(input, "utf8")), opt("feature") ?? "Feature"));
    const r = validateIssues(readFileSync(opt("out"), "utf8"));
    console.log(`issues-file: wrote ${opt("out")}; ${r.issues.length} issue(s), ${r.problems.length} problem(s)`);
    for (const p of r.problems) console.log(`  ${p}`);
    process.exit(r.problems.length ? 1 : 0);
  }
  if (verb === "validate" && input) {
    const r = validateIssues(readFileSync(input, "utf8"), opt("keys")?.split(",") ?? []);
    for (const p of r.problems) console.log(`issues: ${p}`);
    console.log(`issues-file: ${r.issues.length} issue(s), ${r.problems.length} problem(s)`);
    process.exit(r.problems.length ? 1 : 0);
  }
  console.log("usage: render <issues.json> --out=<md> --feature=<name> | validate <md> [--keys=A,B]");
  process.exit(2);
}
