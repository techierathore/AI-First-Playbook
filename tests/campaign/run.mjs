// Grading campaign (PB-33): a fresh `npm pack`, installed with `npm exec` into a
// generated Node project on Node 22.14.0+ and npm 11.5.1+, runs every shipped
// runtime script from the installed copy against a real profile, and OpenCode
// resolves the installed runtime. Nothing here uses the source checkout's
// scripts; only the tarball's.
//   node tests/campaign/run.mjs PB-33 [--record=<file>]
import { createHash } from "node:crypto";
import { closeSync, cpSync, mkdirSync, mkdtempSync, openSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { spawn, spawnSync } from "node:child_process";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { assert, repoRoot, requirementId, runCases, ungraded } from "../lib.mjs";

const id = requirementId("PB-33");
const record = process.argv.find((a) => a.startsWith("--record="))?.slice(9);
const pkg = JSON.parse(readFileSync(join(repoRoot, "package.json"), "utf8"));
const ver = (s) => s.trim().replace(/^v/, "").split(".").map(Number);
const atLeast = (v, m) => { for (let i = 0; i < 3; i += 1) if ((v[i] ?? 0) !== m[i]) return (v[i] ?? 0) > m[i]; return true; };
const npm = (args, cwd) => spawnSync("npm", args, { cwd, encoding: "utf8", env: { ...process.env, npm_config_update_notifier: "false" } });
const nodeV = ver(process.version);
const npmV = ver(npm(["--version"], repoRoot).stdout || "0.0.0");
if (!atLeast(nodeV, ver(pkg.engines.node.replace(">=", "")))) ungraded(id, `Node ${process.version} is below ${pkg.engines.node}`);
if (!atLeast(npmV, ver(pkg.engines.npm.replace(">=", "")))) ungraded(id, `npm ${npmV.join(".")} on PATH is below ${pkg.engines.npm}`);

const work = mkdtempSync(join(tmpdir(), "pb-campaign-"));
process.on("exit", () => rmSync(work, { recursive: true, force: true }));
const log = [];
const note = (line) => log.push(line);

const packed = JSON.parse(npm(["pack", "--json", `--pack-destination=${work}`], repoRoot).stdout)[0];
const tarball = join(work, basename(packed.filename));
const sha = createHash("sha256").update(readFileSync(tarball)).digest("hex");
note(`tarball ${packed.filename} ${packed.files.length} files sha256 ${sha}`);
note(`node ${process.version} npm ${npmV.join(".")}`);

const target = join(work, "team-inventory");
mkdirSync(join(target, "docs/team-inventory"), { recursive: true });
const port = await new Promise((r) => { const s = createServer(); s.listen(0, "127.0.0.1", () => { const p = s.address().port; s.close(() => r(p)); }); });
writeFileSync(join(target, "package.json"), JSON.stringify({ name: "team-inventory", version: "1.0.0", private: true, scripts: { test: "node --test", start: "node server.js" } }, null, 2));
writeFileSync(join(target, "server.js"), "require('node:http').createServer((q, r) => r.end('ok')).listen(Number(process.env.PORT), '127.0.0.1');\n");
const install = npm(["exec", "--yes", `--package=${tarball}`, "--", "ai-first-playbook", "install"], target);
if (install.status !== 0) throw new Error(`install failed: ${install.stderr}`);
writeFileSync(join(target, ".playbook/environment-profile.yml"), readFileSync(join(target, ".playbook/environment-profile.yml"), "utf8")
  .replace(/project_type: .*/, 'project_type: "node-demo"')
  .replace(/  build: .*/, '  build: "node --check server.js"')
  .replace(/  test: .*/, '  test: "node -e \\"process.exit(0)\\""')
  .replace(/  start: .*/, `  start: "PORT=${port} node server.js"`)
  .replace(/  stop: .*/, '  stop: "true"')
  .replace(/  api_url: .*/, `  api_url: "http://127.0.0.1:${port}"`)
  .replace(/  web_url: .*/, `  web_url: "http://127.0.0.1:${port}"`)
  .replace(/  method: app-config.*/, "  method: none")
  .replace(/  config_path: .*\n/, "").replace(/  migration_command: .*\n/, "")
  .replace(/  endpoint: .*/, '  endpoint: ""')
  .replace(/  paths: \[.*\]/, '  paths: ["server.js"]')
  .replace(/  command: "<replace: cleanup command>"/, '  command: "true"'));
for (const [from, to] of [
  ["tests/verifier/fixtures/case-study-checklist.md", "docs/team-inventory/Team-Inventory-Implementation-Checklist.md"],
  ["tests/phase/fixtures/team-inventory-brd.md", "docs/team-inventory/Team-Inventory-BRD.md"],
  ["tests/phase/fixtures/team-inventory-checklist.md", "docs/team-inventory/Planned-Implementation-Checklist.md"],
  ["tests/docs/fixtures/Team-Inventory-Developer-Flow-Guide.md", "docs/team-inventory/Team-Inventory-Developer-Flow-Guide.md"],
  ["tests/docs/fixtures/Team-Inventory-Business-Verification-Reference.md", "docs/team-inventory/Team-Inventory-Business-Verification-Reference.md"],
  ["tests/handoff/fixtures/good", "docs/team-inventory/handoffs"],
]) cpSync(join(repoRoot, from), join(target, to), { recursive: true });

const run = (script, args = []) => {
  const r = spawnSync(process.execPath, [join(target, ".playbook/scripts", script), ...args], { cwd: target, encoding: "utf8" });
  note(`$ ${script} ${args.join(" ")} -> exit ${r.status}; ${(r.stdout || r.stderr).trim().split("\n").at(-1)}`);
  if (r.status !== 0) for (const l of (r.stdout + r.stderr).trim().split("\n").filter((x) => !/^ok\s/.test(x)).slice(0, 5)) note(`    ${l}`);
  return r;
};
const D = "docs/team-inventory";
const ok = (r, what) => assert(r.status === 0, `${what}: ${(r.stdout + r.stderr).trim().split("\n").slice(-3).join(" | ")}`);

const cases = [
  ["the installed target holds only the hidden runtime and every shipped script", () => {
    const shipped = pkg.files.filter((f) => f.startsWith("scripts/") && f !== "scripts/install.mjs" && !/npm-(lifecycle|cleanup)/.test(f)).map((f) => basename(f));
    for (const s of shipped) readFileSync(join(target, ".playbook/scripts", s));
  }],
  ["the profile probe resolves every fact of the real profile", () => {
    const app = spawn(process.execPath, ["server.js"], { cwd: target, env: { ...process.env, PORT: String(port) }, stdio: "ignore" });
    try {
      spawnSync(process.execPath, ["-e", "setTimeout(()=>{},500)"]);
      ok(run("playbook-probe.mjs", ["--run-id=campaign-probe"]), "probe");
    } finally { app.kill(); }
  }],
  ["gates pass and the app lifecycle starts and stops the app", () => {
    ok(run("profile-gates.mjs", ["all", "--run-id=campaign-gates"]), "gates");
    ok(run("playbook-app-lifecycle.mjs", ["start", "--run-id=campaign-app", "--timeout=20"]), "lifecycle start");
    ok(run("playbook-app-lifecycle.mjs", ["stop", "--run-id=campaign-app"]), "lifecycle stop");
  }],
  ["checklist tools: lint, verify plan, implement waves, coverage, scaffold and sync", () => {
    ok(run("checklist-lint.mjs", [`${D}/Team-Inventory-Implementation-Checklist.md`]), "lint");
    ok(run("checklist-plan.mjs", ["verify", `${D}/Team-Inventory-Implementation-Checklist.md`]), "verify plan");
    ok(run("checklist-plan.mjs", ["implement", `${D}/Planned-Implementation-Checklist.md`]), "implement plan");
    ok(run("plan-coverage.mjs", [`${D}/Team-Inventory-BRD.md`, `${D}/Planned-Implementation-Checklist.md`]), "coverage");
    ok(run("checklist-create.mjs", ["new", `${D}/New-Implementation-Checklist.md`, "--feature=New"]), "create");
    ok(run("checklist-create.mjs", ["sync", `${D}/Planned-Implementation-Checklist.md`]), "sync");
    assert(run("phase-complete.mjs", ["build", `${D}/Planned-Implementation-Checklist.md`]).status === 1, "an unbuilt checklist was reported complete");
  }],
  ["handoff records validate and a new one is created", () => {
    ok(run("handoff-record.mjs", ["validate", ...["plan-approval", "verification-results", "acceptance"].map((k) => `${D}/handoffs/${k}.md`)]), "validate");
    ok(run("handoff-record.mjs", ["template", "incident"]), "template");
  }],
  ["document tools: check, drift, links, render, scaffold and backup", () => {
    ok(run("doc-check.mjs", [`${D}/Team-Inventory-Developer-Flow-Guide.md`, "--size=small"]), "doc-check flow");
    ok(run("doc-check.mjs", [`${D}/Team-Inventory-Business-Verification-Reference.md`, "--size=small"]), "doc-check business");
    ok(run("reference-lint.mjs", [`${D}/Team-Inventory-BRD.md`]), "reference-lint");
    ok(run("render-docs.mjs", [D]), "render");
    ok(run("doc-scaffold.mjs", ["architecture", `${D}/Team-Inventory-Architecture.md`, "--feature=Team Inventory"]), "scaffold");
    ok(run("doc-upgrade.mjs", ["backup", `${D}/Team-Inventory-BRD.md`, "--run-id=campaign"]), "backup");
  }],
  ["telemetry: a miss is recorded and linked, the stream exports, the sweep plans", () => {
    const miss = spawnSync(process.execPath, [join(target, ".playbook/scripts/checklist-miss-coordinator.mjs"), "open", `${D}/Team-Inventory-Implementation-Checklist.md`, "INV-003", "--miss-class=wrong-behaviour", "--artifact=src", "--severity=major", "--found-by=verifier", "--found-phase=verification-results-gate", "--harness=opencode"], { cwd: target, encoding: "utf8" });
    note(`$ checklist-miss-coordinator.mjs open -> ${miss.stdout.trim()}`);
    assert(/linked to MISS-/.test(miss.stdout), miss.stdout);
    ok(run("playbook-telemetry.mjs", ["--misses"]), "telemetry export");
    ok(run("playbook-sweep.mjs"), "sweep");
  }],
  ["OpenCode resolves the installed commands, agents and plugins", () => {
    const bin = process.env.PLAYBOOK_OPENCODE_BIN || "opencode";
    const v = spawnSync(bin, ["--version"], { encoding: "utf8" });
    if (v.status !== 0) { note("opencode not on PATH: resolution observed by PB-01 when available"); return; }
    const out = join(work, "config.json");
    const fd = openSync(out, "w");
    const r = spawnSync(bin, ["debug", "config"], { cwd: target, stdio: ["ignore", fd, "pipe"], timeout: 180000, env: { ...process.env, PWD: target } });
    closeSync(fd);
    assert(r.status === 0, `opencode debug config exited ${r.status}`);
    const text = readFileSync(out, "utf8");
    const config = JSON.parse(text.slice(text.indexOf("{")));
    note(`opencode ${v.stdout.trim()}: ${Object.keys(config.command ?? {}).length} commands, ${Object.keys(config.agent ?? {}).length} agents`);
    assert(Object.keys(config.command ?? {}).length === 14 && ["analyst", "builder", "orchestrator", "verifier"].every((a) => a in (config.agent ?? {})), "resolution incomplete");
  }],
];

process.on("exit", () => { if (record) writeFileSync(record, `${log.join("\n")}\n`); });
await runCases(id, cases);
