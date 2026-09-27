#!/usr/bin/env node
/**
 * profile-gates.mjs — run the build and test gates exactly as the profile
 * declares them.
 *
 *   node .playbook/scripts/profile-gates.mjs build|test|all --run-id=<id>
 *
 * Each gate prints `PASS`, `FAIL` (non-zero exit: a real implementation
 * failure, never BLOCKED) or `BLOCKED` (the profile command is missing or a
 * placeholder). Output goes to verification/runs/<id>/gate-<name>.log.
 * Exit 0 only when every requested gate passed; 2 when one is BLOCKED.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { field, readProfile, runDirectory } from "./profile-lib.mjs";

const root = process.cwd();
const [which, ...rest] = process.argv.slice(2);
const id = rest.find((a) => a.startsWith("--run-id="))?.split("=")[1];
if (!["build", "test", "all"].includes(which) || !id) {
  console.log("gates: usage: build|test|all --run-id=<id>");
  process.exit(2);
}
const { profile } = readProfile(root);
const dir = runDirectory(root, id);
mkdirSync(dir, { recursive: true });
let worst = 0;
for (const gate of which === "all" ? ["build", "test"] : [which]) {
  const f = profile ? field(profile, `commands.${gate}`) : { blocked: "no environment profile" };
  if (f.blocked) {
    console.log(`BLOCKED ${gate} — ${f.blocked}`);
    worst = Math.max(worst, 2);
    continue;
  }
  const started = Date.now();
  const r = spawnSync("sh", ["-c", f.value], { cwd: root, encoding: "utf8", maxBuffer: 256 * 1024 * 1024 });
  const log = join(dir, `gate-${gate}.log`);
  writeFileSync(log, `${r.stdout ?? ""}${r.stderr ?? ""}`);
  const verdict = r.status === 0 ? "PASS" : "FAIL";
  if (verdict === "FAIL") worst = Math.max(worst, 1);
  console.log(`${verdict} ${gate} — exit ${r.status ?? r.signal} in ${Date.now() - started} ms; log ${log.slice(root.length + 1)}`);
}
process.exit(worst);
