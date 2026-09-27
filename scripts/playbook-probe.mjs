#!/usr/bin/env node
/**
 * playbook-probe.mjs — the Verifier's one environment probe, driven by the
 * profile. It reports; it never guesses a port, host, path or tool location.
 *
 *   node .playbook/scripts/playbook-probe.mjs [--run-id=<id>] [--json]
 *
 * For each profile fact it prints `ok`, `blocked` (placeholder or missing
 * field) or `down` (declared but unreachable / not on PATH). With --run-id the
 * JSON result is also written to verification/runs/<id>/probe.json.
 * Exit 0 when nothing is blocked or down, 1 otherwise; the Verifier reads the
 * lines, it does not re-probe.
 */
import { existsSync, mkdirSync, writeFileSync, realpathSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { field, placeholders, readProfile, runDirectory } from "./profile-lib.mjs";
import { fileURLToPath } from "node:url";

const root = process.cwd();
const args = process.argv.slice(2);
const opt = (name) => args.find((a) => a.startsWith(`--${name}=`))?.split("=").slice(1).join("=");

async function reachable(url) {
  try {
    const res = await fetch(url, { method: "GET", signal: AbortSignal.timeout(3000), redirect: "manual" });
    return { ok: true, status: res.status };
  } catch (error) {
    return { ok: false, status: error.cause?.code ?? error.name };
  }
}

function onPath(tool) {
  if (!/^[A-Za-z0-9._+-]+$/.test(tool)) return false;
  return spawnSync("sh", ["-c", `command -v ${tool}`], { encoding: "utf8" }).status === 0;
}

export async function probe(rootDir = root) {
  const { path, profile } = readProfile(rootDir);
  const facts = [];
  const add = (name, state, detail) => facts.push({ name, state, detail });
  if (!profile) {
    add("profile", "blocked", "no .playbook/environment-profile.yml or playbook/environment-profile.yml");
    return { profile: null, facts };
  }
  add("profile", "ok", path.slice(rootDir.length + 1));
  for (const name of placeholders(profile)) add(name, "blocked", "placeholder value — replace it in the profile");
  const blockedNames = new Set(facts.filter((f) => f.state === "blocked").map((f) => f.name));
  for (const key of ["build", "test", "start", "stop"]) {
    const name = `commands.${key}`;
    if (blockedNames.has(name)) continue;
    const f = field(profile, name);
    if (f.blocked) { add(name, "blocked", f.blocked); continue; }
    const tool = String(f.value).trim().split(/\s+/).find((word) => !/^[A-Za-z_][A-Za-z0-9_]*=/.test(word)) ?? "";
    add(name, onPath(tool) ? "ok" : "down", `${tool} ${onPath(tool) ? "on PATH" : "not on PATH"}`);
  }
  for (const name of ["application.api_url", "application.web_url", "browser.endpoint"]) {
    if (blockedNames.has(name)) continue;
    const f = field(profile, name);
    if (f.blocked) { if (name !== "browser.endpoint") add(name, "blocked", f.blocked); continue; }
    const r = await reachable(f.value);
    add(name, r.ok ? "ok" : "down", `${f.value} → ${r.status}`);
  }
  if (!blockedNames.has("logs.paths")) {
    const f = field(profile, "logs.paths");
    if (!f.blocked) for (const p of [].concat(f.value)) add(`logs.paths:${p}`, existsSync(join(rootDir, p)) ? "ok" : "down", existsSync(join(rootDir, p)) ? "exists" : "not found");
  }
  const secrets = field(profile, "secrets.sources");
  add("secrets.sources", secrets.blocked ? "blocked" : "ok", secrets.blocked ?? [].concat(secrets.value).join(", "));
  return { profile: path, facts };
}

if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = await probe();
  const id = opt("run-id");
  if (id) {
    const dir = runDirectory(root, id);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "probe.json"), JSON.stringify(result, null, 2) + "\n");
  }
  if (args.includes("--json")) console.log(JSON.stringify(result, null, 2));
  else for (const f of result.facts) console.log(`${f.state.padEnd(7)} ${f.name} — ${f.detail}`);
  const bad = result.facts.filter((f) => f.state !== "ok");
  console.log(bad.length ? `probe: ${bad.length} fact(s) blocked or down; record BLOCKED with the field name, never a guessed value` : "probe: every profile fact resolved");
  process.exit(bad.length ? 1 : 0);
}
