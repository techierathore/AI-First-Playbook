#!/usr/bin/env node
/**
 * playbook-app-lifecycle.mjs — start, poll, record and stop the application
 * processes a build self-test or a verification run needs, from the profile.
 *
 *   node .playbook/scripts/playbook-app-lifecycle.mjs start  --run-id=<id> [--timeout=60]
 *   node .playbook/scripts/playbook-app-lifecycle.mjs status --run-id=<id>
 *   node .playbook/scripts/playbook-app-lifecycle.mjs stop   --run-id=<id>
 *
 * `start` runs `commands.start` detached in its own process group, records the
 * group in verification/runs/<id>/app.json with the log path, and polls
 * `application.api_url` / `web_url` until one answers or the timeout passes.
 * `stop` ends only the process group this run recorded, then runs
 * `commands.stop` when it is not a placeholder. A process the run did not
 * start is never signalled.
 */
import { existsSync, mkdirSync, openSync, readFileSync, writeFileSync } from "node:fs";
import { spawn, spawnSync } from "node:child_process";
import { join } from "node:path";
import { field, readProfile, runDirectory } from "./profile-lib.mjs";

const root = process.cwd();
const [verb, ...rest] = process.argv.slice(2);
const opt = (name) => rest.find((a) => a.startsWith(`--${name}=`))?.split("=").slice(1).join("=");
const fail = (message, code = 1) => { console.log(`lifecycle: ${message}`); process.exit(code); };

const id = opt("run-id");
if (!["start", "status", "stop"].includes(verb) || !id) fail("usage: start|status|stop --run-id=<id>", 2);
const dir = runDirectory(root, id);
const record = join(dir, "app.json");
const { profile } = readProfile(root);
if (!profile) fail("BLOCKED — no environment profile", 2);

const alive = (pid) => { try { process.kill(pid, 0); return true; } catch { return false; } };
async function answers() {
  for (const name of ["application.api_url", "application.web_url"]) {
    const f = field(profile, name);
    if (f.blocked) continue;
    try {
      const res = await fetch(f.value, { signal: AbortSignal.timeout(2000), redirect: "manual" });
      return `${f.value} → ${res.status}`;
    } catch {}
  }
  return null;
}

if (verb === "start") {
  const start = field(profile, "commands.start");
  if (start.blocked) fail(`BLOCKED — ${start.blocked}`, 2);
  if (!["application.api_url", "application.web_url"].some((n) => !field(profile, n).blocked)) fail("BLOCKED — profile application URLs are placeholders; nothing to poll", 2);
  if (existsSync(record) && alive(JSON.parse(readFileSync(record, "utf8")).pgid)) fail(`already running for ${id}`);
  mkdirSync(dir, { recursive: true });
  const log = join(dir, "app.log");
  const out = openSync(log, "a");
  const child = spawn("sh", ["-c", start.value], { cwd: root, detached: true, stdio: ["ignore", out, out] });
  child.unref();
  writeFileSync(record, JSON.stringify({ pgid: child.pid, command: "commands.start", log: log.slice(root.length + 1), started_at: new Date().toISOString() }, null, 2) + "\n");
  const deadline = Date.now() + Number(opt("timeout") ?? 60) * 1000;
  while (Date.now() < deadline) {
    const ok = await answers();
    if (ok) { console.log(`lifecycle: started (pgid ${child.pid}); ${ok}; log ${log.slice(root.length + 1)}`); process.exit(0); }
    if (!alive(child.pid)) fail(`start command exited before the application answered; see ${log.slice(root.length + 1)}`);
    await new Promise((r) => setTimeout(r, 500));
  }
  fail(`application did not answer within the timeout; still recorded for stop (pgid ${child.pid})`);
}

if (verb === "status") {
  if (!existsSync(record)) fail(`no process recorded for ${id}`);
  const { pgid } = JSON.parse(readFileSync(record, "utf8"));
  console.log(`lifecycle: pgid ${pgid} ${alive(pgid) ? "running" : "stopped"}; ${(await answers()) ?? "no application URL answers"}`);
  process.exit(0);
}

if (verb === "stop") {
  if (existsSync(record)) {
    const { pgid } = JSON.parse(readFileSync(record, "utf8"));
    if (alive(pgid)) {
      try { process.kill(-pgid, "SIGTERM"); } catch {}
      const deadline = Date.now() + 5000;
      while (alive(pgid) && Date.now() < deadline) await new Promise((r) => setTimeout(r, 200));
      if (alive(pgid)) try { process.kill(-pgid, "SIGKILL"); } catch {}
    }
    writeFileSync(record, JSON.stringify({ ...JSON.parse(readFileSync(record, "utf8")), stopped_at: new Date().toISOString() }, null, 2) + "\n");
    console.log(`lifecycle: stopped the process group this run started (pgid ${pgid})`);
  } else console.log(`lifecycle: no process recorded for ${id}; nothing signalled`);
  const stop = field(profile, "commands.stop");
  if (!stop.blocked) {
    const r = spawnSync("sh", ["-c", stop.value], { cwd: root, encoding: "utf8" });
    console.log(`lifecycle: commands.stop exited ${r.status}`);
  }
  process.exit(0);
}
