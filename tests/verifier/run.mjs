// Verifier runtime scripts, exercised in a disposable project whose profile
// points at a tiny Node HTTP app. One case per defect the old prose allowed.
//   node tests/verifier/run.mjs PB-21   profile probe reports, never guesses
//   node tests/verifier/run.mjs PB-22   app lifecycle starts, polls, records, stops its own process only
//   node tests/verifier/run.mjs PB-23   build/test gates from the profile
//   node tests/verifier/run.mjs PB-24   adapters load only for item kinds present
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { spawn, spawnSync } from "node:child_process";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { assert, repoRoot, requirementId, runCases } from "../lib.mjs";

const id = requirementId("PB-21");
const cleanup = [];
process.on("exit", () => { for (const fn of cleanup.reverse()) try { fn(); } catch {} });

async function freePort() {
  return new Promise((resolve) => { const s = createServer(); s.listen(0, "127.0.0.1", () => { const p = s.address().port; s.close(() => resolve(p)); }); });
}

function target({ profile }) {
  const dir = mkdtempSync(join(tmpdir(), "pb-verifier-"));
  cleanup.push(() => rmSync(dir, { recursive: true, force: true }));
  const install = spawnSync(process.execPath, [join(repoRoot, "scripts/install.mjs"), "install", `--target=${dir}`], { encoding: "utf8" });
  if (install.status !== 0) throw new Error(install.stderr);
  writeFileSync(join(dir, "server.js"), "require('node:http').createServer((q, r) => r.end('ok')).listen(Number(process.env.PORT), '127.0.0.1');\n");
  writeFileSync(join(dir, "package.json"), JSON.stringify({ name: "pb-verifier", version: "1.0.0", scripts: { test: "node -e \"process.exit(Number(process.env.PB_TEST_EXIT||0))\"" } }));
  if (profile) writeFileSync(join(dir, ".playbook/environment-profile.yml"), profile);
  return dir;
}

const realProfile = (port) => `version: 1
project_type: "node-demo"
topology: same-host
os: linux
shell: bash
commands:
  build: "node -e \\"console.log('built')\\""
  test: "npm test --silent"
  start: "PORT=${port} node server.js"
  stop: "true"
application:
  api_url: "http://127.0.0.1:${port}"
  web_url: "http://127.0.0.1:${port}"
database:
  method: none
browser:
  endpoint: ""
logs:
  paths: ["server.js"]
secrets:
  sources: [environment-reference]
cleanup:
  command: "true"
`;

const run = (dir, script, args, env = {}) => spawnSync(process.execPath, [join(dir, ".playbook/scripts", script), ...args], { cwd: dir, encoding: "utf8", env: { ...process.env, ...env } });

const cases = {
  "PB-21": [
    ["the shipped placeholder profile reports each placeholder field as blocked and guesses no value", () => {
      const dir = target({});
      const r = run(dir, "playbook-probe.mjs", []);
      assert(r.status === 1, `probe exit ${r.status}`);
      for (const name of ["project_type", "commands.build", "commands.start", "application.api_url", "database.config_path"]) {
        assert(new RegExp(`^blocked\\s+${name.replace(".", "\\.")} `, "m").test(r.stdout), `${name} not reported blocked`);
      }
      assert(!/localhost:1433|:3000|:5000|:8080/.test(r.stdout), "probe printed a guessed port (old Step 1 port scan)");
    }],
    ["a real profile resolves: commands on PATH and the running app answers", async () => {
      const port = await freePort();
      const dir = target({ profile: realProfile(port) });
      const app = spawn(process.execPath, ["server.js"], { cwd: dir, env: { ...process.env, PORT: String(port) }, stdio: "ignore" });
      cleanup.push(() => app.kill());
      await new Promise((r) => setTimeout(r, 400));
      const r = run(dir, "playbook-probe.mjs", ["--run-id=probe-1"]);
      assert(r.status === 0, `probe failed: ${r.stdout}`);
      assert(/^ok\s+application\.api_url .* 200/m.test(r.stdout), "api_url not ok with 200");
      assert(existsSync(join(dir, "verification/runs/probe-1/probe.json")), "probe.json not recorded");
    }],
    ["a declared but stopped application is reported down, not blocked and not guessed", async () => {
      const dir = target({ profile: realProfile(await freePort()) });
      const r = run(dir, "playbook-probe.mjs", []);
      assert(/^down\s+application\.api_url /m.test(r.stdout), "stopped app not reported down");
    }],
    ["a command whose tool is not on PATH is reported down by name", async () => {
      const dir = target({ profile: realProfile(await freePort()).replace('build: "node -e', 'build: "no-such-tool-xyz -e') });
      const r = run(dir, "playbook-probe.mjs", []);
      assert(/^down\s+commands\.build — no-such-tool-xyz not on PATH/m.test(r.stdout), "missing tool not reported");
    }],
  ],
  "PB-22": [
    ["start runs the profile command, records the group and polls until the app answers; stop ends it", async () => {
      const port = await freePort();
      const dir = target({ profile: realProfile(port) });
      const start = run(dir, "playbook-app-lifecycle.mjs", ["start", "--run-id=life-1", "--timeout=20"]);
      assert(start.status === 0, `start failed: ${start.stdout}`);
      const rec = JSON.parse(readFileSync(join(dir, "verification/runs/life-1/app.json"), "utf8"));
      assert(Number.isInteger(rec.pgid) && rec.log, "app.json lacks pgid or log");
      cleanup.push(() => { try { process.kill(-rec.pgid, "SIGKILL"); } catch {} });
      const stop = run(dir, "playbook-app-lifecycle.mjs", ["stop", "--run-id=life-1"]);
      assert(stop.status === 0, `stop failed: ${stop.stdout}`);
      let up = true;
      try { await fetch(`http://127.0.0.1:${port}`, { signal: AbortSignal.timeout(1000) }); } catch { up = false; }
      assert(!up, "application still answers after stop");
    }],
    ["stop never signals a process the run did not start", async () => {
      const port = await freePort();
      const dir = target({ profile: realProfile(port) });
      const other = spawn(process.execPath, ["-e", "setInterval(()=>{},1000)"], { stdio: "ignore" });
      cleanup.push(() => other.kill("SIGKILL"));
      const stop = run(dir, "playbook-app-lifecycle.mjs", ["stop", "--run-id=never-started"]);
      assert(/nothing signalled/.test(stop.stdout), "stop claimed to signal without a record");
      let alive = true;
      try { process.kill(other.pid, 0); } catch { alive = false; }
      assert(alive, "an unrelated process was killed");
    }],
    ["a placeholder start command is BLOCKED with the field name", () => {
      const dir = target({});
      const r = run(dir, "playbook-app-lifecycle.mjs", ["start", "--run-id=life-2"]);
      assert(r.status === 2 && /BLOCKED — profile field commands\.start is a placeholder/.test(r.stdout), r.stdout);
    }],
  ],
  "PB-23": [
    ["a failing test command is FAIL (exit 1), never BLOCKED", async () => {
      const dir = target({ profile: realProfile(await freePort()) });
      const r = run(dir, "profile-gates.mjs", ["all", "--run-id=gate-1"], { PB_TEST_EXIT: "3" });
      assert(r.status === 1 && /^PASS build/m.test(r.stdout) && /^FAIL test — exit 3/m.test(r.stdout), r.stdout);
      assert(existsSync(join(dir, "verification/runs/gate-1/gate-test.log")), "gate log not written");
    }],
    ["passing gates exit 0", async () => {
      const dir = target({ profile: realProfile(await freePort()) });
      const r = run(dir, "profile-gates.mjs", ["all", "--run-id=gate-2"]);
      assert(r.status === 0 && /^PASS test/m.test(r.stdout), r.stdout);
    }],
    ["a placeholder build command is BLOCKED (exit 2) naming the field", () => {
      const dir = target({});
      const r = run(dir, "profile-gates.mjs", ["build", "--run-id=gate-3"]);
      assert(r.status === 2 && /BLOCKED build — profile field commands\.build is a placeholder/.test(r.stdout), r.stdout);
    }],
  ],
  "PB-24": [
    ["the case-study checklist loads the ui, api, db and desktop adapters and skips the Phase 2 item", () => {
      const dir = target({});
      const r = run(dir, "checklist-plan.mjs", ["verify", join(repoRoot, "tests/verifier/fixtures/case-study-checklist.md"), "--json"]);
      assert(r.status === 0, r.stdout);
      const plan = JSON.parse(r.stdout);
      assert(JSON.stringify(plan.adapters) === JSON.stringify(["api", "db", "desktop", "ui"]), `adapters ${plan.adapters}`);
      assert(plan.skipped.join() === "INV-005", `skipped ${plan.skipped}`);
      for (const a of plan.adapters) assert(existsSync(join(dir, ".opencode/templates/verifier", `${a}.md`)), `installed adapter missing: ${a}`);
    }],
    ["an API-only checklist loads only the api adapter (the old Verifier loaded every branch)", () => {
      const dir = target({});
      const plan = JSON.parse(run(dir, "checklist-plan.mjs", ["verify", join(repoRoot, "tests/verifier/fixtures/api-only-checklist.md"), "--json"]).stdout);
      assert(JSON.stringify(plan.adapters) === '["api"]', `adapters ${plan.adapters}`);
    }],
    ["an item without a valid Type is reported, not guessed", () => {
      const dir = target({});
      const r = run(dir, "checklist-plan.mjs", ["verify", join(repoRoot, "tests/verifier/fixtures/untyped-checklist.md")]);
      assert(r.status === 1 && /no valid Type/.test(r.stdout), r.stdout);
    }],
  ],
};

if (!cases[id]) {
  console.log(`${id} fail: tests/verifier/run.mjs has no case set for this ID`);
  process.exit(1);
}
await runCases(id, cases[id]);
