#!/usr/bin/env node
/**
 * self-test-result-writer.mjs — record the build or fix self-test on each item.
 *
 *   node .playbook/scripts/self-test-result-writer.mjs <checklist> --results=<smoke-results.json>
 *   node .playbook/scripts/self-test-result-writer.mjs <checklist> --skip=ID,ID --reason="user requested"
 *
 * One `- **Self-test** (<date>): PASS|FAIL|SKIPPED — <evidence>` line per item
 * (several probes for one item fold into one line: FAIL if any failed). A PASS
 * moves the item to `to-verify`; a FAIL keeps it `in-progress`; SKIPPED is
 * allowed only with a reason and leaves status unchanged. The writer never
 * sets `pass`: only the Verifier does. The Status Table is re-synced.
 */
import { readFileSync } from "node:fs";
import { Checklist, cleanText, today, utcNow } from "./checklist-edit-lib.mjs";

export function writeSelfTests(path, results, now = new Date()) {
  const c = new Checklist(path);
  const byItem = new Map();
  for (const r of results) {
    if (!["PASS", "FAIL", "SKIPPED"].includes(r.outcome)) throw new Error(`${r.item}: outcome must be PASS, FAIL or SKIPPED`);
    c.item(r.item);
    const prev = byItem.get(r.item);
    byItem.set(r.item, {
      outcome: prev?.outcome === "FAIL" || r.outcome === "FAIL" ? "FAIL" : r.outcome,
      evidence: [prev?.evidence, cleanText(r.evidence, `${r.item} evidence`)].filter(Boolean).join("; "),
    });
  }
  for (const [item, r] of byItem) {
    c.append(item, `- **Self-test** (${today(now)}): ${r.outcome} — ${r.evidence}`);
    if (r.outcome !== "SKIPPED") c.update(item, (m) => { m.status = r.outcome === "PASS" ? "to-verify" : "in-progress"; m.updated_at = utcNow(now); });
  }
  c.save();
  return [...byItem.entries()];
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [checklist, ...rest] = process.argv.slice(2);
  const opt = (n) => rest.find((a) => a.startsWith(`--${n}=`))?.split("=").slice(1).join("=");
  let results;
  if (opt("results")) results = JSON.parse(readFileSync(opt("results"), "utf8")).results;
  else if (opt("skip") && opt("reason")) results = opt("skip").split(",").map((item) => ({ item, outcome: "SKIPPED", evidence: opt("reason") }));
  if (!checklist || !results) { console.log('usage: <checklist> --results=<json> | --skip=ID,ID --reason="…"'); process.exit(2); }
  try {
    for (const [item, r] of writeSelfTests(checklist, results)) console.log(`self-test ${item}: ${r.outcome}`);
  } catch (error) { console.log(`refused: ${error.message}`); process.exit(1); }
}
