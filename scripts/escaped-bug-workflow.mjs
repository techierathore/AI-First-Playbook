#!/usr/bin/env node
/**
 * escaped-bug-workflow.mjs — where each escaped bug stands in the loop
 * logged → analyzed → fixed → verified → miss-linked, and whether the Issues
 * file may be deleted.
 *
 *   node .playbook/scripts/escaped-bug-workflow.mjs status <checklist> <Feature-Issues.md> [--require-retire]
 *
 * An issue is `logged` when its Analysis block exists, `analyzed` when its
 * root cause and affected items are filled, `fixed` when every affected item
 * carries a Fix applied line, `verified` when every affected item's latest
 * Verifier Result is PASS, and `miss-linked` when its MISS ID sits in an
 * affected item's metadata. The Issues file is deletable only when every
 * issue is verified and miss-linked; --require-retire exits 1 otherwise.
 */
import { readFileSync, realpathSync } from "node:fs";
import { parseChecklist } from "./checklist-lib.mjs";
import { latestVerdict } from "./checklist-plan.mjs";
import { blocks, issueSource } from "./checklist-ingest.mjs";
import { parseIssues } from "./issues-file.mjs";
import { fileURLToPath } from "node:url";

export const STAGES = ["missing", "logged", "analyzed", "fixed", "verified", "miss-linked"];

export function status(checklistText, issuesText, issuesFile) {
  const items = new Map(parseChecklist(checklistText).items.filter((i) => i.metadata?.value?.id).map((i) => [i.metadata.value.id, i]));
  const bs = blocks(checklistText).filter((b) => b.kind === "Issue");
  return parseIssues(issuesText).map((issue) => {
    const src = issueSource(issue, issuesFile);
    const b = bs.find((x) => x.source === src);
    const row = { issue: issue.n, title: issue.title, source: src, stage: "missing", miss: issue.fields["Miss ID"] ?? null };
    if (!b) return row;
    row.stage = "logged";
    const affected = (b.affected ?? "").match(/\b[A-Z][A-Z0-9]*-\d{3,}\b/g) ?? [];
    if (!b.cause || /\[ANALYZE\]/.test(b.cause) || !affected.length || affected.some((id) => !items.has(id))) return row;
    row.stage = "analyzed";
    if (!affected.every((id) => items.get(id).extra.some((l) => /\*\*Fix applied\*\*/.test(l)))) return row;
    row.stage = "fixed";
    if (!affected.every((id) => latestVerdict(items.get(id)) === "PASS")) return row;
    row.stage = "verified";
    if (row.miss && /^MISS-/.test(row.miss) && affected.some((id) => (items.get(id).metadata.value.misses ?? []).includes(row.miss))) row.stage = "miss-linked";
    return row;
  });
}

if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [verb, checklist, issues] = process.argv.slice(2);
  if (verb !== "status" || !checklist || !issues) { console.log("usage: status <checklist> <Feature-Issues.md> [--require-retire]"); process.exit(2); }
  const rows = status(readFileSync(checklist, "utf8"), readFileSync(issues, "utf8"), issues);
  for (const r of rows) console.log(`${r.stage.padEnd(11)} Issue ${r.issue}: ${r.title}${r.miss ? ` (${r.miss})` : ""}`);
  const retire = rows.length && rows.every((r) => r.stage === "miss-linked");
  console.log(retire ? `escaped-bug-workflow: every issue is verified and miss-linked; ${issues} may be deleted` : `escaped-bug-workflow: keep ${issues}; ${rows.filter((r) => r.stage !== "miss-linked").length} issue(s) not finished`);
  process.exit(!retire && process.argv.includes("--require-retire") ? 1 : 0);
}
