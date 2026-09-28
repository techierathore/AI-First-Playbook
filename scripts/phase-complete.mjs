#!/usr/bin/env node
/**
 * phase-complete.mjs — recompute whether a build or fix phase is finished,
 * from item metadata and annotations, never from a checkbox or a claim.
 *
 *   node .playbook/scripts/phase-complete.mjs build <checklist>
 *   node .playbook/scripts/phase-complete.mjs fix   <checklist>
 *
 * build: every active item is `to-verify` (or `pass`) with a Self-test line,
 * or carries an [INFRA BLOCKER] / [EXTERNAL BLOCKER] note naming who supplies
 * what is missing; Infrastructure Requirements and Deployment Steps are filled
 * (a bullet or "_None required._"); the Status Table agrees with metadata.
 * fix: every item whose latest Verifier Result is not a PASS carries a newer
 * Fix applied line and is `to-verify` (or blocked with an owner note); no item
 * is `pass` without a PASS Verifier Result, because a fixer never passes its
 * own work. Exit 0 prints the handoff line for /verify; exit 1 lists every
 * unfinished item — the phase adds a wave, it never hands the rest back.
 */
import { readFileSync, realpathSync } from "node:fs";
import { parseChecklist } from "./checklist-lib.mjs";
import { latestVerdict } from "./checklist-plan.mjs";
import { fileURLToPath } from "node:url";

const INACTIVE = new Set(["out-of-scope", "deferred", "abandoned"]);
const BLOCKER = /\[(INFRA|EXTERNAL) BLOCKER\][^\n]*\b(?:owner|supplies|supplied by)\b/i;

function sectionBody(text, sections, title) {
  const s = sections.find((x) => x.level === 2 && x.title === title);
  if (!s) return null;
  const next = sections.find((x) => x.level <= 2 && x.line > s.line);
  return text.split("\n").slice(s.line, next ? next.line - 1 : undefined).join("\n");
}

export function phaseComplete(text, mode) {
  const { items, sections } = parseChecklist(text);
  const unfinished = [];
  const problems = [];
  const all = (item) => [item.title, ...Object.values(item.fields), ...item.extra].join("\n");
  for (const item of items) {
    const meta = item.metadata?.value ?? {};
    const id = meta.id ?? `line ${item.line}`;
    const status = meta.status ?? "planned";
    if (INACTIVE.has(status)) continue;
    const text = all(item);
    const blocked = BLOCKER.test(text);
    const verdict = latestVerdict(item);
    if (status === "pass" && !(verdict && verdict.startsWith("PASS"))) problems.push(`${id}: status pass without a PASS Verifier Result — only the Verifier passes an item`);
    if (mode === "build") {
      if (blocked) continue;
      if (!["to-verify", "pass"].includes(status)) { unfinished.push(`${id} (${status})`); continue; }
      if (status === "to-verify" && !item.extra.some((l) => /^- \*\*Self-test\*\*/.test(l))) unfinished.push(`${id} (no Self-test line)`);
    } else {
      if (!verdict || verdict.startsWith("PASS")) continue;
      const lastResult = item.extra.findLastIndex((l) => /^- \*\*Verifier Result\*\*/.test(l));
      const fixed = item.extra.findLastIndex((l) => /^- \*\*Fix applied\*\*/.test(l)) > lastResult;
      if (blocked) continue;
      if (!fixed || status !== "to-verify") unfinished.push(`${id} (${verdict}; ${fixed ? `status ${status}` : "no Fix applied after the latest Verifier Result"})`);
    }
  }
  for (const title of ["Infrastructure Requirements", "Deployment Steps"]) {
    const body = sectionBody(text, sections, title);
    if (body == null) problems.push(`missing section "## ${title}"`);
    else if (!/^\s*- |_None required\._/m.test(body)) problems.push(`"## ${title}" is empty; list entries or write _None required._`);
  }
  const table = sectionBody(text, sections, "Status Table") ?? "";
  for (const item of items) {
    const meta = item.metadata?.value;
    if (!meta?.id) continue;
    const row = table.split("\n").find((l) => l.includes(`| ${meta.id} |`) || l.includes(`|${meta.id}|`));
    if (!row) problems.push(`${meta.id}: no Status Table row`);
    else if (!row.toLowerCase().includes(String(meta.status).toLowerCase())) problems.push(`${meta.id}: Status Table row disagrees with metadata status ${meta.status}`);
  }
  return { mode, unfinished, problems, done: !unfinished.length && !problems.length };
}

if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [mode, path] = process.argv.slice(2);
  if (!["build", "fix"].includes(mode) || !path) { console.log("usage: phase-complete.mjs build|fix <checklist>"); process.exit(2); }
  const r = phaseComplete(readFileSync(path, "utf8"), mode);
  for (const u of r.unfinished) console.log(`unfinished: ${u}`);
  for (const p of r.problems) console.log(`problem: ${p}`);
  console.log(r.done
    ? `phase-complete: ${mode} is complete — hand off to /verify ${path}`
    : `phase-complete: ${mode} is NOT complete (${r.unfinished.length} unfinished, ${r.problems.length} problem(s)); plan another wave`);
  process.exit(r.done ? 0 : 1);
}
