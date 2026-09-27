#!/usr/bin/env node
/**
 * verification-summary.mjs — render the Verifier's final message from the
 * checklist itself, so the message can only repeat what the checklist says.
 *
 *   node .playbook/scripts/verification-summary.mjs <checklist>
 *
 * Reads each item's latest Verifier Result, groups outcomes by item type,
 * lists FAIL, DATA-GAP (with setup) and BLOCKED items, the Manual deployment
 * rows still pending, and the next command. Names no file but the checklist.
 */
import { readFileSync, realpathSync } from "node:fs";
import { itemType, parseChecklist } from "./checklist-lib.mjs";
import { latestVerdict } from "./checklist-plan.mjs";
import { deploymentRows } from "./deployment-step-runner.mjs";
import { fileURLToPath } from "node:url";

export function summary(path) {
  const text = readFileSync(path, "utf8");
  const { items } = parseChecklist(text);
  const byType = {};
  const lists = { FAIL: [], "DATA-GAP": [], BLOCKED: [], unverified: [] };
  for (const item of items) {
    const id = item.metadata?.value?.id ?? `line ${item.line}`;
    if (["out-of-scope", "deferred", "abandoned"].includes(item.metadata?.value?.status)) continue;
    const v = latestVerdict(item);
    const t = itemType(item) ?? "other";
    (byType[t] ??= {})[v ?? "unverified"] = ((byType[t] ??= {})[v ?? "unverified"] ?? 0) + 1;
    const last = [...item.extra].reverse().find((l) => /Verifier Result/.test(l)) ?? "";
    if (!v) lists.unverified.push(id);
    else if (v.startsWith("FAIL")) lists.FAIL.push(`${id}: ${last.replace(/^.*Evidence:\s*/, "")}`);
    else if (v === "DATA-GAP") lists["DATA-GAP"].push(`${id}: ${(item.extra.find((l) => /Test-data setup needed/.test(l)) ?? "").replace(/^.*needed:\s*/, "")}`);
    else if (v === "BLOCKED") lists.BLOCKED.push(id);
  }
  const verdict = lists.unverified.length ? "INCOMPLETE" : lists.BLOCKED.length ? "BLOCKED" : lists.FAIL.length ? `${lists.FAIL.length} FAILs` : lists["DATA-GAP"].length ? "DATA-GAP" : "ALL PASS";
  const manual = deploymentRows(text).manual ?? [];
  const out = [`Verification complete. Verdict: ${verdict}`, "", "By item type:"];
  for (const [t, o] of Object.entries(byType)) out.push(`  - ${t}: ${Object.entries(o).map(([k, n]) => `${n} ${k}`).join(", ")}`);
  for (const [k, list] of Object.entries(lists)) if (list.length) out.push("", `${k} items:`, ...list.map((l) => `  - ${l}`));
  if (manual.length) out.push("", "Manual deployment steps still pending:", ...manual.map((m) => `  - ${m.title}`));
  out.push("", `Results are inline in ${path}.`);
  const next = { "ALL PASS": "human acceptance.", "DATA-GAP": "seed the named test data, then /verify again.", INCOMPLETE: `/verify ${path} (items have no result)`, BLOCKED: "resolve each blocker with its owner, or record an expiring exception." };
  out.push(`Next: ${next[verdict] ?? `/fix ${path}`}`);
  return { verdict, text: out.join("\n") };
}

if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const path = process.argv[2];
  if (!path) { console.log("usage: verification-summary.mjs <checklist>"); process.exit(2); }
  console.log(summary(path).text);
}
