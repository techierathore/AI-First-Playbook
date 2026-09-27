#!/usr/bin/env node
/**
 * gate-check.mjs — the mechanical half of the two process gates. The decision
 * stays with the named person; this prints whether the evidence supports it.
 *
 *   node .playbook/scripts/gate-check.mjs plan-review <checklist> --requirements=<source.md> [--handoff=<plan-approval.md>]
 *   node .playbook/scripts/gate-check.mjs verification-results <checklist> [--handoff=<verification-results.md>]
 *
 * plan-review: the checklist lints, every requirement and screen maps, and —
 * when given — the plan-approval record is valid with Decision `approved`.
 * Prints READY with the next command, or each blocker (exit 1).
 * verification-results: routes from the latest verdicts — any unverified item
 * → /verify, any FAIL → /fix, BLOCKED → its owner or an expiring exception,
 * DATA-GAP → seed data, code-audit PASS → acceptance only with a recorded
 * exception, all PASS → human acceptance. A given verification-results record
 * must agree with the checklist (outcome and non-PASS IDs).
 */
import { readFileSync } from "node:fs";
import { lintChecklist } from "./checklist-lint.mjs";
import { parseChecklist } from "./checklist-lib.mjs";
import { latestVerdict } from "./checklist-plan.mjs";
import { coverage } from "./plan-coverage.mjs";
import { parseRecord, validateRecord } from "./handoff-record.mjs";

export function planReview(checklistText, sourceText, handoffText = null) {
  const blockers = [];
  for (const p of lintChecklist(checklistText).problems) blockers.push(`checklist: ${p.where} ${p.message}`);
  const cov = coverage(sourceText, checklistText);
  for (const r of cov.unmapped) blockers.push(`requirement ${r} maps to no item`);
  for (const s of cov.unmappedScreens) blockers.push(`screen ${s} maps to no UI item`);
  if (handoffText) {
    for (const p of validateRecord(handoffText)) blockers.push(`plan-approval: ${p}`);
    const { kind, rows } = parseRecord(handoffText);
    if (kind !== "plan-approval") blockers.push("the handoff is not a plan-approval record");
    else if (rows.find((r) => r.label === "Decision")?.value !== "approved") blockers.push("the plan-approval decision is not approved");
  } else blockers.push("no plan-approval record yet (the approver records it with handoff-record.mjs)");
  return blockers;
}

export function route(checklistText) {
  const items = parseChecklist(checklistText).items.filter((i) => !["out-of-scope", "deferred", "abandoned"].includes(i.metadata?.value?.status));
  const by = (pred) => items.filter((i) => pred(latestVerdict(i))).map((i) => i.metadata?.value?.id);
  const r = { unverified: by((v) => !v), fail: by((v) => v?.startsWith("FAIL")), blocked: by((v) => v === "BLOCKED"), dataGap: by((v) => v === "DATA-GAP"), codeAudit: by((v) => v === "PASS (code-audit)") };
  r.outcome = r.fail.length ? "FAIL" : r.blocked.length ? "BLOCKED" : r.dataGap.length ? "DATA-GAP" : "PASS";
  r.next = r.unverified.length ? "/verify (items have no result)" : r.fail.length ? "/fix" : r.blocked.length ? "resolve the blocker with its owner, or record an expiring exception" : r.dataGap.length ? "seed the named test data, then /verify" : r.codeAudit.length ? "human acceptance, with a recorded exception for the code-audit items" : "human acceptance";
  return r;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [gate, checklist, ...rest] = process.argv.slice(2);
  const opt = (n) => rest.find((a) => a.startsWith(`--${n}=`))?.split("=").slice(1).join("=");
  if (!["plan-review", "verification-results"].includes(gate) || !checklist) { console.log("usage: plan-review|verification-results <checklist> [...]"); process.exit(2); }
  const text = readFileSync(checklist, "utf8");
  const handoff = opt("handoff") ? readFileSync(opt("handoff"), "utf8") : null;
  if (gate === "plan-review") {
    if (!opt("requirements")) { console.log("usage: plan-review <checklist> --requirements=<source.md>"); process.exit(2); }
    const b = planReview(text, readFileSync(opt("requirements"), "utf8"), handoff);
    for (const x of b) console.log(`blocker: ${x}`);
    console.log(b.length ? `gate-check: plan review NOT ready (${b.length} blocker(s))` : `gate-check: READY — /implement ${checklist}`);
    process.exit(b.length ? 1 : 0);
  }
  const r = route(text);
  const problems = [];
  if (handoff) {
    const rows = parseRecord(handoff).rows;
    const stated = rows.find((x) => x.label === "Overall outcome")?.value;
    if (stated !== r.outcome) problems.push(`record says ${stated}, checklist says ${r.outcome}`);
    const listed = new Set((rows.find((x) => x.label === "Non-PASS items")?.value ?? "").match(/\b[A-Z][A-Z0-9]*-\d{3,}\b/g) ?? []);
    for (const id of [...r.fail, ...r.blocked, ...r.dataGap]) if (!listed.has(id)) problems.push(`record omits non-PASS item ${id}`);
  }
  for (const [k, ids] of Object.entries({ FAIL: r.fail, BLOCKED: r.blocked, "DATA-GAP": r.dataGap, unverified: r.unverified, "PASS (code-audit)": r.codeAudit })) if (ids.length) console.log(`${k}: ${ids.join(", ")}`);
  for (const p of problems) console.log(`problem: ${p}`);
  console.log(`gate-check: outcome ${r.outcome}; next: ${r.next}`);
  process.exit(problems.length || r.unverified.length ? 1 : 0);
}
