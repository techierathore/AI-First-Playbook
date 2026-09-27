#!/usr/bin/env node
/**
 * playbook-sweep.mjs — enforce the retention periods in the environment
 * profile (`retention.raw_runs_days`, default 7; `retention.graded_verdicts_days`,
 * default 365).
 *
 *   node .playbook/scripts/playbook-sweep.mjs [--apply] [--now=<ISO>]
 *
 * Raw run evidence lives in git-ignored verification/runs/<run-id>/. A run
 * folder whose newest file is older than raw_runs_days is removed. Grader
 * verdicts in verification/telemetry/grades.ndjson older than
 * graded_verdicts_days are dropped by rewriting the stream in place, keeping
 * every newer line byte-for-byte. The miss stream is never touched. Without
 * --apply nothing is changed and the plan is printed. The runtime scripts that
 * create run folders call sweepRuns() once per process, so raw evidence is
 * swept without anyone remembering to.
 */
import { existsSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { readProfile } from "./profile-lib.mjs";

const DAY = 24 * 60 * 60 * 1000;

export function retention(root = process.cwd()) {
  const r = readProfile(root).profile?.retention ?? {};
  const num = (v, d) => (Number.isInteger(v) && v > 0 ? v : d);
  return { rawRunsDays: num(r.raw_runs_days, 7), gradedVerdictsDays: num(r.graded_verdicts_days, 365) };
}

function newest(dir) {
  let latest = statSync(dir).mtimeMs;
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    const s = statSync(p);
    latest = Math.max(latest, s.isDirectory() ? newest(p) : s.mtimeMs);
  }
  return latest;
}

export function sweepRuns(root = process.cwd(), { apply = false, now = Date.now(), days = retention(root).rawRunsDays } = {}) {
  const runs = join(root, "verification", "runs");
  const removed = [];
  const kept = [];
  if (!existsSync(runs)) return { removed, kept };
  for (const id of readdirSync(runs).sort()) {
    const dir = join(runs, id);
    if (!statSync(dir).isDirectory()) continue;
    const age = now - newest(dir);
    if (age > days * DAY) {
      removed.push(id);
      if (apply) rmSync(dir, { recursive: true, force: true });
    } else kept.push(id);
  }
  return { removed, kept };
}

export function sweepGrades(root = process.cwd(), { apply = false, now = Date.now(), days = retention(root).gradedVerdictsDays } = {}) {
  const path = join(root, "verification", "telemetry", "grades.ndjson");
  if (!existsSync(path)) return { dropped: 0, kept: 0 };
  const lines = readFileSync(path, "utf8").split("\n").filter((l) => l.trim());
  const keep = lines.filter((l) => {
    try { return now - Date.parse(JSON.parse(l).ts) <= days * DAY; } catch { return true; }
  });
  if (apply && keep.length !== lines.length) writeFileSync(path, keep.length ? `${keep.join("\n")}\n` : "");
  return { dropped: lines.length - keep.length, kept: keep.length };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const apply = process.argv.includes("--apply");
  const nowArg = process.argv.find((a) => a.startsWith("--now="))?.slice(6);
  const now = nowArg ? Date.parse(nowArg) : Date.now();
  const { rawRunsDays, gradedVerdictsDays } = retention();
  const runs = sweepRuns(process.cwd(), { apply, now, days: rawRunsDays });
  const grades = sweepGrades(process.cwd(), { apply, now, days: gradedVerdictsDays });
  for (const id of runs.removed) console.log(`${apply ? "removed" : "would remove"} verification/runs/${id} (older than ${rawRunsDays} days)`);
  console.log(`sweep: ${runs.removed.length} run folder(s) ${apply ? "removed" : "due"}, ${runs.kept.length} kept; ${grades.dropped} grader verdict(s) older than ${gradedVerdictsDays} days ${apply ? "dropped" : "due"}, ${grades.kept} kept${apply ? "" : " (dry run; add --apply)"}`);
}
