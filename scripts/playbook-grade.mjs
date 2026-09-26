#!/usr/bin/env node
/**
 * playbook-grade.mjs — grade every requirement line once.
 *
 *   node scripts/playbook-grade.mjs docs/Playbook-Requirements.md [--telemetry=<path>] [--run-id=<id>]
 *
 * A requirement row is `| PB-NN | requirement | check | source |`. The check
 * cell starts with one kind:
 *   script: `node <path> [args]`   — a command that fails when the line is broken
 *   fixture: `node <path> [args]`  — a command run over a named fixture
 *   review: <reason>               — a person reads something; printed ungraded
 *   ungraded: <reason>             — cannot run here (live model); printed ungraded
 *
 * A check passes only when it exits 0 AND prints `<ID> pass` on its own line.
 * Exit 77 with `<ID> ungraded: <reason>` is ungraded. Anything else is a fail:
 * missing output is never read as PASS. Every ID appends one redacted
 * grader-verdict record through scripts/miss-lib.mjs. Exit 1 on any fail.
 */
import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { appendRecord, buildGraderRecord, defaultGradesPath, redact } from "./miss-lib.mjs";

export const GRADER_VERSION = "1";
const repoRoot = fileURLToPath(new URL("..", import.meta.url));
const ROW_RE = /^\|\s*(PB-\d{2,})\s*\|(.*)\|\s*$/;
const KIND_RE = /^\s*(script|fixture|review|ungraded)\s*(?:\([^)]*\))?\s*:\s*(.*)$/is;

export function parseRequirements(text) {
  const rows = [];
  for (const [index, line] of text.split("\n").entries()) {
    const m = line.match(ROW_RE);
    if (!m) continue;
    const cells = m[2].split(/(?<!\\)\|/).map((c) => c.trim());
    rows.push({ id: m[1], line: index + 1, requirement: cells[0] ?? "", check: cells[1] ?? "", source: cells[2] ?? "" });
  }
  return rows;
}

export function parseCheck(cell) {
  const m = cell.match(KIND_RE);
  if (!m) return { kind: null, error: "check cell does not start with script:, fixture:, review: or ungraded:" };
  const kind = m[1].toLowerCase();
  const rest = m[2].trim();
  if (kind === "review" || kind === "ungraded") return { kind, reason: rest.replace(/`/g, "") || null };
  const cmd = rest.match(/`([^`]+)`/);
  if (!cmd) return { kind, error: "a script or fixture check must name its command in backticks" };
  const argv = cmd[1].trim().split(/\s+/);
  if (argv[0] !== "node" || argv.length < 2) return { kind, error: "a check command must be `node <repo-relative path> [args]`" };
  const file = argv[1];
  if (isAbsolute(file) || relative(".", file).startsWith("..")) return { kind, error: `check path must stay inside the repository: ${file}` };
  return { kind, command: argv, file };
}

function runCheck(id, check, root, runId, env) {
  const started = Date.now();
  if (!existsSync(join(root, check.file))) {
    return { result: "fail", reason: `named check file does not exist: ${check.file}`, exit_code: null, duration_ms: 0 };
  }
  const child = spawnSync(process.execPath, check.command.slice(1), {
    cwd: root,
    encoding: "utf8",
    timeout: 20 * 60 * 1000,
    maxBuffer: 64 * 1024 * 1024,
    env: { ...process.env, ...env, PLAYBOOK_GRADE_ID: id, PLAYBOOK_GRADE_RUN: runId },
  });
  const duration_ms = Date.now() - started;
  const output = `${child.stdout ?? ""}`;
  const lines = output.split("\n").map((l) => l.trim());
  const mine = lines.map((l) => l.match(new RegExp(`^${id}\\s+(pass|fail|ungraded)\\b:?\\s*(.*)$`))).filter(Boolean);
  const last = mine[mine.length - 1];
  const tail = `${child.stderr ?? ""}\n${output}`.trim().split("\n").slice(-3).join(" | ");
  if (child.error) return { result: "fail", reason: `check did not run: ${child.error.code ?? child.error.message}`, exit_code: null, duration_ms };
  if (child.status === 0 && last?.[1] === "pass" && !mine.some((m) => m[1] === "fail")) {
    return { result: "pass", reason: last[2] || null, exit_code: 0, duration_ms };
  }
  if (child.status === 77 && last?.[1] === "ungraded" && last[2]) {
    return { result: "ungraded", reason: last[2], exit_code: 77, duration_ms };
  }
  if (child.status === 0) {
    return { result: "fail", reason: `exit 0 without "${id} pass" — missing output is never read as PASS`, exit_code: 0, duration_ms };
  }
  return { result: "fail", reason: last?.[2] || `exit ${child.status ?? child.signal}: ${tail}`, exit_code: child.status ?? null, duration_ms };
}

export function grade(requirementsPath, { root = repoRoot, telemetryPath = defaultGradesPath(root), runId, actor = null, env = {}, log = console.log } = {}) {
  const text = readFileSync(requirementsPath, "utf8");
  const rows = parseRequirements(text);
  runId ??= `grade-${new Date().toISOString().replace(/[-:]/g, "").replace(/\..*$/, "")}-${process.pid}`;
  const seen = new Map();
  const results = [];
  for (const row of rows) {
    if (seen.has(row.id)) {
      // Walk every ID once: a repeated ID is reported against the first row.
      const first = results.find((r) => r.id === row.id);
      if (first.result !== "fail") Object.assign(first, { result: "fail", reason: `duplicate ID on lines ${seen.get(row.id)} and ${row.line}` });
      continue;
    }
    seen.set(row.id, row.line);
    const check = parseCheck(row.check);
    let outcome;
    if (check.error) outcome = { result: "fail", reason: check.error, exit_code: null, duration_ms: 0 };
    else if (check.kind === "review" || check.kind === "ungraded") {
      outcome = check.reason
        ? { result: "ungraded", reason: check.reason, exit_code: null, duration_ms: 0 }
        : { result: "fail", reason: `a ${check.kind} line must write its reason`, exit_code: null, duration_ms: 0 };
    } else outcome = runCheck(row.id, check, root, runId, env);
    results.push({ id: row.id, kind: check.kind ?? "review", check: check.command ? check.command.slice(1).join(" ") : null, ...outcome });
  }
  for (const r of results) {
    log(`${r.id} ${r.result.padEnd(8)} ${(r.kind ?? "-").padEnd(8)} ${r.check ?? ""}${r.reason ? ` — ${redact(r.reason, 200)}` : ""}`);
    appendRecord(telemetryPath, buildGraderRecord({
      run_id: runId, req_id: r.id, check_kind: r.kind ?? "review", check: r.check, result: r.result, reason: r.reason,
      exit_code: r.exit_code, duration_ms: r.duration_ms, grader_version: GRADER_VERSION, actor,
    }));
  }
  const pass = results.filter((r) => r.result === "pass").length;
  const fail = results.filter((r) => r.result === "fail").length;
  const ungraded = results.filter((r) => r.result === "ungraded").length;
  const scripted = results.filter((r) => r.result === "pass" && r.kind === "script").length;
  log("");
  log(`${pass + fail} of ${results.length} graded`);
  log(`pass ${pass}, fail ${fail}, ungraded ${ungraded}`);
  log(`${scripted} of ${results.length} proved by a script`);
  return { runId, results, pass, fail, ungraded, total: results.length };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const file = args.find((a) => !a.startsWith("--"));
  const opt = (name) => args.find((a) => a.startsWith(`--${name}=`))?.split("=").slice(1).join("=");
  if (!file) {
    console.error("usage: node scripts/playbook-grade.mjs docs/Playbook-Requirements.md [--telemetry=<path>] [--run-id=<id>]");
    process.exit(2);
  }
  const root = resolve(opt("root") ?? repoRoot);
  const { total, fail } = grade(resolve(file), {
    root,
    telemetryPath: opt("telemetry") ? resolve(opt("telemetry")) : defaultGradesPath(root),
    runId: opt("run-id"),
    actor: process.env.PLAYBOOK_ACTOR || null,
  });
  process.exit(total === 0 || fail > 0 ? 1 : 0);
}
