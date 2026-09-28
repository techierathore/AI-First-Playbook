#!/usr/bin/env node
/**
 * deployment-step-runner.mjs — run a checklist's Automated deployment rows
 * before any item is verified.
 *
 *   node .playbook/scripts/deployment-step-runner.mjs <checklist> --run-id=<id>           # plan only
 *   node .playbook/scripts/deployment-step-runner.mjs <checklist> --run-id=<id> --approved # run
 *
 * Each Automated row carries one command in inline code. Without --approved
 * the rows are listed and nothing runs (the approval gate; YOLO passes it).
 * With --approved they run in order; each log goes to
 * verification/runs/<id>/deploy-<n>.log; the first failure stops the run and
 * prints `BLOCKED` (exit 2), because verifying against a half-deployed feature
 * produces misleading FAILs. Manual rows are listed as deferred to a person.
 */
import { mkdirSync, readFileSync, writeFileSync, realpathSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { runDirectory } from "./profile-lib.mjs";
import { fileURLToPath } from "node:url";

export function deploymentRows(text) {
  const lines = text.split("\n");
  const start = lines.findIndex((l) => l.trim() === "## Deployment Steps");
  if (start === -1) return { error: 'no "## Deployment Steps" section' };
  const rows = { automated: [], manual: [] };
  let sub = null;
  for (let i = start + 1; i < lines.length && !/^##\s/.test(lines[i]); i += 1) {
    const h = lines[i].match(/^###\s+(Automated|Manual)/i);
    if (h) { sub = h[1].toLowerCase(); continue; }
    const row = lines[i].match(/^- \[[ xX]\]\s+(.*)$/);
    if (!row || !sub) continue;
    const entry = { title: row[1].trim(), line: i + 1, command: null };
    const next = lines[i + 1] ?? "";
    const cmd = next.match(/^\s+-\s+`([^`]+)`/) ?? row[1].match(/`([^`]+)`/);
    if (cmd) entry.command = cmd[1];
    rows[sub].push(entry);
  }
  return rows;
}

if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [checklist, ...rest] = process.argv.slice(2);
  const id = rest.find((a) => a.startsWith("--run-id="))?.slice(9);
  if (!checklist || !id) { console.log("usage: deployment-step-runner.mjs <checklist> --run-id=<id> [--approved]"); process.exit(2); }
  const rows = deploymentRows(readFileSync(checklist, "utf8"));
  if (rows.error) { console.log(`deploy: ${rows.error}`); process.exit(1); }
  const approved = rest.includes("--approved") || process.env.PLAYBOOK_YOLO === "1";
  const bad = rows.automated.filter((r) => !r.command);
  for (const r of bad) console.log(`deploy: line ${r.line} "${r.title}" is Automated but names no command; move it to Manual`);
  if (bad.length) process.exit(1);
  for (const r of rows.manual) console.log(`manual  ${r.title} — deferred to a person`);
  if (!rows.automated.length) { console.log("deploy: no Automated rows; nothing to run"); process.exit(0); }
  if (!approved) {
    for (const r of rows.automated) console.log(`planned ${r.title}: ${r.command}`);
    console.log("deploy: plan only; rerun with --approved after approval");
    process.exit(0);
  }
  const dir = runDirectory(process.cwd(), id);
  mkdirSync(dir, { recursive: true });
  const root = process.cwd();
  for (const [n, r] of rows.automated.entries()) {
    const out = spawnSync("sh", ["-c", r.command], { cwd: root, encoding: "utf8", maxBuffer: 256 * 1024 * 1024 });
    const log = join(dir, `deploy-${n + 1}.log`);
    writeFileSync(log, `$ ${r.command}\n${out.stdout ?? ""}${out.stderr ?? ""}`);
    if (out.status !== 0) {
      console.log(`failed  ${r.title}: exit ${out.status}; log ${log.slice(root.length + 1)}`);
      console.log("BLOCKED — a deployment step failed; no item is verified against a half-deployed feature");
      process.exit(2);
    }
    console.log(`ran     ${r.title}: exit 0; log ${log.slice(root.length + 1)}`);
  }
  console.log(`deploy: ${rows.automated.length} Automated row(s) ran`);
}
