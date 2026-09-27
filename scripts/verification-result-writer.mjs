#!/usr/bin/env node
/**
 * verification-result-writer.mjs — write the Verifier's outcomes into the
 * checklist, one item at a time, in checklist order.
 *
 *   node .playbook/scripts/verification-result-writer.mjs <checklist> --results=<results.json> --run-id=<id>
 *
 * results.json (written by the Verifier under verification/runs/<id>/) is
 *   { "environment": "...", "deployment": "...", "results": [
 *       { "item": "INV-002", "outcome": "FAIL", "evidence": "...", "fix": "...",
 *         "data_setup": "...", "links": ["verification/..."], "blocked_audit": "..." } ] }
 *
 * For each result: append `- **Verifier Result** (<date>): <outcome> — Evidence: ...`
 * (plus Suggested fix / Test-data setup lines), set metadata status and
 * updated_at, append an evidence entry; then append `### Run on <UTC>` to
 * `## Verifier Run Log` with per-type counts, and re-sync the Status Table.
 * Refuses an unknown outcome, a BLOCKED without its audit trail, a DATA-GAP
 * without a setup line, or any secret-like text. Nothing is written on refusal.
 */
import { readFileSync } from "node:fs";
import { Checklist, OUTCOME_STATUS, cleanText, today, utcNow } from "./checklist-edit-lib.mjs";
import { itemType, parseChecklist } from "./checklist-lib.mjs";

export function applyResults(path, data, runId, now = new Date()) {
  const c = new Checklist(path);
  const errors = [];
  const results = Array.isArray(data?.results) ? data.results : [];
  if (!results.length) errors.push("results.json has no results");
  const types = new Map(parseChecklist(c.lines.join("\n")).items.map((i) => [i.metadata?.value?.id, itemType(i)]));
  const order = [...types.keys()];
  const sorted = [...results].sort((a, b) => order.indexOf(a.item) - order.indexOf(b.item));
  for (const r of sorted) {
    if (!types.has(r.item)) errors.push(`${r.item}: not an item in the checklist`);
    if (!(r.outcome in OUTCOME_STATUS)) errors.push(`${r.item}: outcome "${r.outcome}" is not one of ${Object.keys(OUTCOME_STATUS).join(", ")}`);
    if (!r.evidence) errors.push(`${r.item}: evidence is required`);
    if (r.outcome === "BLOCKED" && !r.blocked_audit) errors.push(`${r.item}: BLOCKED needs its audit trail (config read, workaround tried, environment not data, in scope, asked once)`);
    if (r.outcome === "DATA-GAP" && !r.data_setup) errors.push(`${r.item}: DATA-GAP needs the test-data setup line`);
    try { for (const k of ["evidence", "fix", "data_setup", "blocked_audit"]) if (r[k]) cleanText(r[k], `${r.item} ${k}`); } catch (e) { errors.push(e.message); }
  }
  if (errors.length) return { errors };
  const counts = {};
  for (const r of sorted) {
    c.append(r.item, `- **Verifier Result** (${today(now)}): ${r.outcome} — Evidence: ${cleanText(r.evidence, "evidence")}`);
    if (/FAIL/.test(r.outcome) && r.fix) c.append(r.item, `  - Suggested fix: ${cleanText(r.fix, "fix")}`);
    if (r.outcome === "DATA-GAP") c.append(r.item, `  - Test-data setup needed: ${cleanText(r.data_setup, "setup")}`);
    c.update(r.item, (m) => {
      m.status = OUTCOME_STATUS[r.outcome];
      m.updated_at = utcNow(now);
      m.evidence = [...(m.evidence ?? []), { run_id: runId, verdict: r.outcome, observed_at: utcNow(now), links: r.links ?? [] }];
    });
    const t = types.get(r.item) ?? "other";
    (counts[t] ??= {})[r.outcome] = ((counts[t] ??= {})[r.outcome] ?? 0) + 1;
  }
  const log = c.sectionRange("Verifier Run Log");
  const entry = [
    "", `### Run on ${utcNow(now)} (${runId})`,
    `- Environment: ${cleanText(data.environment ?? "see probe.json", "environment")}`,
    `- Deployment steps: ${cleanText(data.deployment ?? "none", "deployment")}`,
    ...Object.entries(counts).map(([t, o]) => `- ${t}: ${Object.entries(o).map(([k, v]) => `${v} ${k}`).join(", ")}`),
    ...sorted.filter((r) => r.outcome === "DATA-GAP").map((r) => `- DATA-GAP ${r.item}: ${cleanText(r.data_setup, "setup")}`),
    ...sorted.filter((r) => r.outcome === "BLOCKED").map((r) => `- BLOCKED ${r.item} audit: ${cleanText(r.blocked_audit, "audit")}`),
    `- Verdict: ${sorted.every((r) => r.outcome.startsWith("PASS")) ? "ALL PASS" : `${sorted.filter((r) => !r.outcome.startsWith("PASS")).length} not PASS`}`,
    "- Deliverables: this checklist only.",
  ];
  if (log) c.lines.splice(log.end, 0, ...entry);
  else c.lines.push("", "## Verifier Run Log", ...entry);
  c.save();
  return { written: sorted.length, counts };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [checklist, ...rest] = process.argv.slice(2);
  const resultsPath = rest.find((a) => a.startsWith("--results="))?.slice(10);
  const runId = rest.find((a) => a.startsWith("--run-id="))?.slice(9);
  if (!checklist || !resultsPath || !runId) { console.log("usage: verification-result-writer.mjs <checklist> --results=<json> --run-id=<id>"); process.exit(2); }
  const r = applyResults(checklist, JSON.parse(readFileSync(resultsPath, "utf8")), runId);
  if (r.errors) { for (const e of r.errors) console.log(`refused: ${e}`); console.log("result-writer: nothing written"); process.exit(1); }
  console.log(`result-writer: ${r.written} result(s) written, run log appended, Status Table synced`);
}
