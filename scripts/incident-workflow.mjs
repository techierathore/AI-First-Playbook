#!/usr/bin/env node
/**
 * incident-workflow.mjs — check a production incident through its loop.
 *
 *   node .playbook/scripts/incident-workflow.mjs validate <incident.md> <checklist>
 *
 * The incident record must be a valid `incident` handoff; its Regression item
 * must name an item that exists in the checklist; the postmortem is due on or
 * after the detection date; every action (actions separated by `|`) names an
 * owner and a due date. Once
 * the record's transition reaches `incident-resolved`, the regression item's
 * latest Verifier Result must be PASS: an incident is not resolved on a fix
 * nobody verified.
 */
import { readFileSync } from "node:fs";
import { parseChecklist } from "./checklist-lib.mjs";
import { latestVerdict } from "./checklist-plan.mjs";
import { parseRecord, validateRecord } from "./handoff-record.mjs";

export function validateIncident(recordText, checklistText) {
  const problems = validateRecord(recordText).map((p) => `record: ${p}`);
  const { kind, rows } = parseRecord(recordText);
  if (kind !== "incident") return [`record is a ${kind ?? "unknown"} handoff, not an incident`];
  const get = (l) => rows.find((r) => r.label === l)?.value ?? "";
  const items = new Map(parseChecklist(checklistText).items.filter((i) => i.metadata?.value?.id).map((i) => [i.metadata.value.id, i]));
  const reg = get("Regression item").match(/\b[A-Z][A-Z0-9]*-\d{3,}\b/)?.[0];
  if (!reg) problems.push("Regression item names no checklist item ID");
  else if (!items.has(reg)) problems.push(`Regression item ${reg} is not in the checklist`);
  const detected = get("Detected at (UTC)").slice(0, 10);
  const due = get("Postmortem due").match(/\d{4}-\d{2}-\d{2}/)?.[0];
  if (!due) problems.push("Postmortem due has no date");
  else if (detected && due < detected) problems.push("postmortem is due before the incident was detected");
  const actions = get("Actions");
  if (!/^none$/i.test(actions)) for (const a of actions.split(/\s*\|\s*/)) if (!/owner:/i.test(a) || !/\d{4}-\d{2}-\d{2}/.test(a)) problems.push(`action "${a.slice(0, 40)}" needs an owner and a due date`);
  if (/->\s*incident-resolved$/.test(get("Status transition")) && reg && items.has(reg) && latestVerdict(items.get(reg)) !== "PASS") problems.push(`resolved, but regression item ${reg} has no PASS Verifier Result`);
  return problems;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [verb, record, checklist] = process.argv.slice(2);
  if (verb !== "validate" || !record || !checklist) { console.log("usage: validate <incident.md> <checklist>"); process.exit(2); }
  const p = validateIncident(readFileSync(record, "utf8"), readFileSync(checklist, "utf8"));
  for (const x of p) console.log(`incident: ${x}`);
  console.log(`incident-workflow: ${p.length} problem(s)`);
  process.exit(p.length ? 1 : 0);
}
